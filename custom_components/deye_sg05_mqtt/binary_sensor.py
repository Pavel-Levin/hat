"""Grid phase monitoring for Deye SG05 MQTT."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, MANUFACTURER, MODEL
from .mqtt_client import DeyeMqttClient
from .register_map import METRICS

PHASE_MISSING_THRESHOLD_V = 50.0
_VOLTAGE_METRICS = {
    phase: next(metric for metric in METRICS if metric.key == f"grid_{phase}_v")
    for phase in ("l1", "l2", "l3")
}


def _device_info(device_id: str) -> DeviceInfo:
    short_id = device_id.removeprefix("id-nsg-v0.1-")
    return DeviceInfo(
        identifiers={(DOMAIN, device_id)},
        manufacturer=MANUFACTURER,
        model=MODEL,
        name=f"Deye {MODEL} [{short_id}]",
    )


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Create phase sensors for every discovered gateway."""
    client: DeyeMqttClient = hass.data[DOMAIN][entry.entry_id]
    added_devices: set[str] = set()

    @callback
    def add_device(device_id: str) -> None:
        if device_id in added_devices:
            return
        added_devices.add(device_id)
        phases = [DeyeGridPhaseMissingSensor(client, device_id, phase) for phase in ("l1", "l2", "l3")]
        async_add_entities([*phases, DeyeAnyGridPhaseMissingSensor(client, device_id)])

    for device_id in tuple(client.devices):
        add_device(device_id)

    entry.async_on_unload(client.add_device_listener(add_device))


class DeyeGridPhaseMissingSensor(BinarySensorEntity):
    """Report and notify when one grid phase is missing."""

    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:transmission-tower-off"

    def __init__(self, client: DeyeMqttClient, device_id: str, phase: str) -> None:
        self.client = client
        self.device_id = device_id
        self.phase = phase
        self.metric = _VOLTAGE_METRICS[phase]
        self._last_missing: bool | None = None
        self._attr_unique_id = f"{device_id}_grid_phase_{phase}_missing"
        self._attr_translation_key = f"grid_phase_{phase}_missing"
        self._attr_device_info = _device_info(device_id)

    @property
    def voltage(self) -> float | None:
        value = self.client.metric_value(self.device_id, self.metric)
        return float(value) if value is not None else None

    @property
    def available(self) -> bool:
        return self.client.device_available(self.device_id) and self.voltage is not None

    @property
    def is_on(self) -> bool | None:
        voltage = self.voltage
        return None if voltage is None else voltage < PHASE_MISSING_THRESHOLD_V

    @property
    def extra_state_attributes(self):
        return {
            "gateway_id": self.device_id,
            "metric_key": f"grid_phase_{self.phase}_missing",
            "phase": self.phase.upper(),
            "voltage": self.voltage,
            "threshold_v": PHASE_MISSING_THRESHOLD_V,
        }

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.client.add_update_listener(self.device_id, self._handle_update))

    @callback
    def _handle_update(self) -> None:
        missing = self.is_on if self.available else None
        phase_name = self.phase.upper()
        notification_id = f"deye_{self.device_id}_{self.phase}_missing"

        if missing is True and self._last_missing is not True:
            persistent_notification.async_create(
                self.hass,
                f"Напряжение {phase_name}: {self.voltage:.1f} В. "
                f"Даталогер: {self.device_id}.",
                title=f"Пропала фаза {phase_name}",
                notification_id=notification_id,
            )
        elif missing is False and self._last_missing is True:
            persistent_notification.async_dismiss(self.hass, notification_id)
            persistent_notification.async_create(
                self.hass,
                f"Напряжение {phase_name} восстановлено: {self.voltage:.1f} В.",
                title=f"Фаза {phase_name} восстановлена",
                notification_id=f"deye_{self.device_id}_{self.phase}_restored",
            )

        if missing is not None:
            self._last_missing = missing
        self.async_write_ha_state()


class DeyeAnyGridPhaseMissingSensor(BinarySensorEntity):
    """Aggregate problem sensor for all three grid phases."""

    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:transmission-tower-off"
    _attr_translation_key = "grid_any_phase_missing"

    def __init__(self, client: DeyeMqttClient, device_id: str) -> None:
        self.client = client
        self.device_id = device_id
        self._attr_unique_id = f"{device_id}_grid_any_phase_missing"
        self._attr_device_info = _device_info(device_id)

    def _voltages(self) -> dict[str, float | None]:
        values = {}
        for phase, metric in _VOLTAGE_METRICS.items():
            value = self.client.metric_value(self.device_id, metric)
            values[phase] = float(value) if value is not None else None
        return values

    @property
    def available(self) -> bool:
        values = self._voltages().values()
        return self.client.device_available(self.device_id) and all(value is not None for value in values)

    @property
    def is_on(self) -> bool | None:
        values = self._voltages().values()
        if any(value is None for value in values):
            return None
        return any(value < PHASE_MISSING_THRESHOLD_V for value in values)

    @property
    def extra_state_attributes(self):
        voltages = self._voltages()
        return {
            "gateway_id": self.device_id,
            "metric_key": "grid_any_phase_missing",
            "missing_phases": [
                phase.upper()
                for phase, value in voltages.items()
                if value is not None and value < PHASE_MISSING_THRESHOLD_V
            ],
            "threshold_v": PHASE_MISSING_THRESHOLD_V,
        }

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.client.add_update_listener(self.device_id, self._handle_update))

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()
