"""Button platform for Deye SG05 MQTT."""
from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.components.energy.data import async_get_manager
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MANUFACTURER, MODEL
from .mqtt_client import DeyeMqttClient

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Create one Energy configuration button for every discovered gateway."""
    client: DeyeMqttClient = hass.data[DOMAIN][entry.entry_id]
    added_devices: set[str] = set()

    @callback
    def add_device(device_id: str) -> None:
        if device_id in added_devices:
            return
        added_devices.add(device_id)
        async_add_entities([DeyeConfigureEnergyButton(entry, device_id)])

    for device_id in tuple(client.devices):
        add_device(device_id)

    entry.async_on_unload(client.add_device_listener(add_device))


class DeyeConfigureEnergyButton(ButtonEntity):
    """Configure Home Assistant Energy for one Deye gateway."""

    _attr_has_entity_name = True
    _attr_name = "Настроить Energy Dashboard"
    _attr_icon = "mdi:lightning-bolt-circle"

    def __init__(self, entry: ConfigEntry, device_id: str) -> None:
        self.entry = entry
        self.device_id = device_id
        short_id = device_id.removeprefix("id-nsg-v0.1-")
        self._attr_unique_id = f"{device_id}_configure_energy"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, device_id)},
            manufacturer=MANUFACTURER,
            model=MODEL,
            name=f"Deye {MODEL} [{short_id}]",
        )

    def _metric_entities(self) -> dict[str, str]:
        registry = er.async_get(self.hass)
        prefix = f"{self.device_id}_"
        result: dict[str, str] = {}

        for entity in registry.entities.values():
            if entity.config_entry_id != self.entry.entry_id:
                continue
            unique_id = entity.unique_id or ""
            if not unique_id.startswith(prefix):
                continue

            metric_key = unique_id[len(prefix):]
            result[metric_key] = entity.entity_id

        return result

    def _is_available(self, entity_id: str | None) -> bool:
        if not entity_id:
            return False
        state = self.hass.states.get(entity_id)
        return state is not None and state.state not in ("unknown", "unavailable")

    async def async_press(self) -> None:
        """Populate Energy preferences using this gateway's entities."""
        entities = self._metric_entities()

        required = {
            "grid_import_total_kwh",
            "grid_export_total_kwh",
            "grid_w",
            "total_pv_energy_kwh",
            "battery_discharge_total_kwh",
            "battery_charge_total_kwh",
            "battery1_power_w",
            "battery1_soc_pct",
        }
        missing = sorted(key for key in required if key not in entities)
        if missing:
            raise HomeAssistantError(
                "Не найдены обязательные Deye-сущности: " + ", ".join(missing)
            )

        manager = await async_get_manager(self.hass)
        current = manager.data or manager.default_preferences()
        short_id = self.device_id.removeprefix("id-nsg-v0.1-")
        marker = f"[{short_id}]"

        our_names = {
            f"Deye Grid {marker}",
            f"Deye PV {marker}",
            f"Microinverter GEN {marker}",
            f"Deye Battery {marker}",
        }

        sources = [
            source
            for source in current.get("energy_sources", [])
            if source.get("name") not in our_names
        ]

        sources.append(
            {
                "type": "grid",
                "name": f"Deye Grid {marker}",
                "stat_energy_from": entities["grid_import_total_kwh"],
                "stat_energy_to": entities["grid_export_total_kwh"],
                "stat_cost": None,
                "entity_energy_price": None,
                "number_energy_price": None,
                "stat_compensation": None,
                "entity_energy_price_export": None,
                "number_energy_price_export": None,
                "power_config": {"stat_rate": entities["grid_w"]},
                "cost_adjustment_day": 0,
            }
        )

        solar_source = {
            "type": "solar",
            "name": f"Deye PV {marker}",
            "stat_energy_from": entities["total_pv_energy_kwh"],
            "config_entry_solar_forecast": None,
        }
        if "pv_total_w" in entities:
            solar_source["stat_rate"] = entities["pv_total_w"]
        sources.append(solar_source)

        gen_energy = entities.get("gen_port_total_kwh")
        if self._is_available(gen_energy):
            gen_source = {
                "type": "solar",
                "name": f"Microinverter GEN {marker}",
                "stat_energy_from": gen_energy,
                "config_entry_solar_forecast": None,
            }
            gen_power = entities.get("gen_port_power_w")
            if gen_power:
                gen_source["stat_rate"] = gen_power
            sources.append(gen_source)

        sources.append(
            {
                "type": "battery",
                "name": f"Deye Battery {marker}",
                "stat_energy_from": entities["battery_discharge_total_kwh"],
                "stat_energy_to": entities["battery_charge_total_kwh"],
                "power_config": {"stat_rate": entities["battery1_power_w"]},
                "stat_soc": entities["battery1_soc_pct"],
            }
        )

        await manager.async_update({"energy_sources": sources})
        _LOGGER.info("Configured Energy Dashboard for Deye gateway %s", self.device_id)
