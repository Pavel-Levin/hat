"""Sensor platform for Deye SG05 MQTT."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MANUFACTURER, MODEL
from .mqtt_client import DeyeMqttClient
from .register_map import METRICS, MetricDef


def _device_class(metric: MetricDef):
    if metric.key.endswith("_soc_pct"):
        return SensorDeviceClass.BATTERY
    return {
        "V": SensorDeviceClass.VOLTAGE,
        "A": SensorDeviceClass.CURRENT,
        "W": SensorDeviceClass.POWER,
        "Hz": SensorDeviceClass.FREQUENCY,
        "°C": SensorDeviceClass.TEMPERATURE,
        "kWh": SensorDeviceClass.ENERGY,
        "h": SensorDeviceClass.DURATION,
    }.get(metric.unit)


def _state_class(metric: MetricDef):
    if metric.unit in ("kWh", "h") and (
        "today" in metric.key or "total" in metric.key
    ):
        return SensorStateClass.TOTAL_INCREASING
    if metric.unit in ("V", "A", "W", "Hz", "°C", "%", "Ah"):
        return SensorStateClass.MEASUREMENT
    return None


def _entity_category(metric: MetricDef):
    if metric.group in ("bms", "info", "status"):
        return EntityCategory.DIAGNOSTIC
    return None


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors and add devices as they appear on MQTT."""
    client: DeyeMqttClient = hass.data[DOMAIN][entry.entry_id]
    added_devices: set[str] = set()

    @callback
    def add_device(device_id: str) -> None:
        if device_id in added_devices:
            return
        added_devices.add(device_id)
        async_add_entities(
            DeyeRegisterSensor(client, device_id, metric) for metric in METRICS
        )

    for device_id in tuple(client.devices):
        add_device(device_id)

    entry.async_on_unload(client.add_device_listener(add_device))


class DeyeRegisterSensor(SensorEntity):
    """One decoded register-map metric."""

    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(
        self,
        client: DeyeMqttClient,
        device_id: str,
        metric: MetricDef,
    ) -> None:
        self.client = client
        self.device_id = device_id
        self.metric = metric

        self._attr_unique_id = f"{device_id}_{metric.key}"
        self._attr_translation_key = metric.key
        self._attr_native_unit_of_measurement = metric.unit
        self._attr_device_class = _device_class(metric)
        self._attr_state_class = _state_class(metric)
        self._attr_entity_category = _entity_category(metric)

        hello = client.devices.get(device_id).hello if device_id in client.devices else {}
        mac = str(hello.get("mac", "")).strip() or device_id.rsplit("-", 1)[-1]
        short_id = device_id.removeprefix("id-nsg-v0.1-")
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, device_id)},
            connections={("mac", mac)} if len(mac) == 12 else set(),
            manufacturer=MANUFACTURER,
            model=MODEL,
            name=f"Deye {MODEL} [{short_id}]",
            sw_version=hello.get("fw"),
        )

    @property
    def native_value(self):
        return self.client.metric_value(self.device_id, self.metric)

    @property
    def available(self) -> bool:
        return (
            self.client.device_available(self.device_id)
            and self.native_value is not None
        )

    @property
    def extra_state_attributes(self):
        attrs = {
            "register": self.metric.reg,
            "group": self.metric.group,
            "gateway_id": self.device_id,
        }
        if self.metric.high_reg is not None:
            attrs["high_register"] = self.metric.high_reg
        return attrs

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.client.add_update_listener(
                self.device_id, self._handle_update
            )
        )

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()
