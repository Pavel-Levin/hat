"""MQTT client and Deye raw-register decoder."""
from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
import json
import logging
import re
from typing import Any

import aiomqtt

from homeassistant.core import HomeAssistant

from .const import DEVICE_PREFIX
from .register_map import MetricDef, decode_metric

_LOGGER = logging.getLogger(__name__)
_READ_TOPIC_RE = re.compile(
    r"^(?P<device>[^/]+)/read/(?P<slave>\d+)/(?P<reg>\d+)/(?P<count>\d+)/?$"
)


@dataclass(slots=True)
class DeyeDevice:
    device_id: str
    registers: dict[int, int] = field(default_factory=dict)
    hello: dict[str, Any] = field(default_factory=dict)
    online: bool | None = None


async def async_test_connection(
    broker: str, port: int, username: str, password: str
) -> None:
    """Open and close an MQTT connection to validate broker credentials."""
    async with asyncio.timeout(7):
        async with aiomqtt.Client(
            hostname=broker,
            port=port,
            username=username or None,
            password=password or None,
        ):
            return


class DeyeMqttClient:
    """Maintain one MQTT connection and register caches for Deye gateways."""

    def __init__(
        self,
        hass: HomeAssistant,
        broker: str,
        port: int,
        username: str,
        password: str,
    ) -> None:
        self.hass = hass
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.devices: dict[str, DeyeDevice] = {}
        self.connected = False
        self._task: asyncio.Task | None = None
        self._device_listeners: list[Callable[[str], None]] = []
        self._update_listeners: dict[str, list[Callable[[], None]]] = {}

    async def async_start(self) -> None:
        if self._task is None:
            self._task = self.hass.async_create_task(
                self._run(), "Deye SG05 MQTT listener"
            )

    async def async_stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self.connected = False

    def add_device_listener(self, callback: Callable[[str], None]) -> Callable[[], None]:
        self._device_listeners.append(callback)

        def remove() -> None:
            if callback in self._device_listeners:
                self._device_listeners.remove(callback)

        return remove

    def add_update_listener(
        self, device_id: str, callback: Callable[[], None]
    ) -> Callable[[], None]:
        self._update_listeners.setdefault(device_id, []).append(callback)

        def remove() -> None:
            callbacks = self._update_listeners.get(device_id, [])
            if callback in callbacks:
                callbacks.remove(callback)

        return remove

    def metric_value(self, device_id: str, metric: MetricDef):
        device = self.devices.get(device_id)
        if device is None:
            return None
        return decode_metric(metric, device.registers)

    def device_available(self, device_id: str) -> bool:
        device = self.devices.get(device_id)
        if device is None or not self.connected:
            return False
        return device.online is not False

    def _ensure_device(self, device_id: str) -> DeyeDevice:
        is_new = device_id not in self.devices
        device = self.devices.setdefault(device_id, DeyeDevice(device_id))
        if is_new:
            _LOGGER.info("Discovered Deye MQTT gateway %s", device_id)
            for callback in tuple(self._device_listeners):
                callback(device_id)
        return device

    def _notify(self, device_id: str) -> None:
        for callback in tuple(self._update_listeners.get(device_id, [])):
            try:
                callback()
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Failed to update entity for %s", device_id)

    def _notify_all(self) -> None:
        for device_id in tuple(self.devices):
            self._notify(device_id)

    async def _run(self) -> None:
        delay = 2
        while True:
            try:
                async with aiomqtt.Client(
                    hostname=self.broker,
                    port=self.port,
                    username=self.username or None,
                    password=self.password or None,
                ) as client:
                    self.connected = True
                    delay = 2
                    self._notify_all()
                    await client.subscribe("+/hello", qos=0)
                    await client.subscribe("+/status", qos=0)
                    # Includes both:
                    #   <id>/read/1/586/11
                    #   <id>/read/data
                    await client.subscribe("+/read/#", qos=0)

                    async for message in client.messages:
                        self._handle_message(str(message.topic), bytes(message.payload))

            except asyncio.CancelledError:
                raise
            except aiomqtt.MqttError as err:
                if self.connected:
                    _LOGGER.warning("MQTT disconnected: %s", err)
                else:
                    _LOGGER.warning("Cannot connect to MQTT broker: %s", err)
            except Exception:
                _LOGGER.exception("Unexpected Deye MQTT listener error")
            finally:
                self.connected = False
                self._notify_all()

            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)

    def _handle_message(self, topic: str, payload: bytes) -> None:
        try:
            data = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return

        topic_parts = topic.strip("/").split("/")
        if not topic_parts:
            return
        device_id = topic_parts[0]
        if not device_id.startswith(DEVICE_PREFIX):
            return

        if topic.rstrip("/").endswith("/hello") and isinstance(data, dict):
            vendor = str(data.get("vendor", "Deye"))
            if vendor.lower() != "deye" and "deye" not in str(data).lower():
                return
            device = self._ensure_device(device_id)
            device.hello.update(data)
            device.online = True
            self._notify(device_id)
            return

        if topic.rstrip("/").endswith("/status") and isinstance(data, dict):
            device = self._ensure_device(device_id)
            if "online" in data:
                device.online = bool(data["online"])
            self._notify(device_id)
            return

        if "/read/" not in topic or not isinstance(data, dict):
            return

        # Prefer the register/slave carried in the JSON payload. This makes the
        # integration work with both the per-register topic tree and the
        # gateway's generic ".../read/data" topic.
        match = _READ_TOPIC_RE.match(topic.strip("/"))
        try:
            if "reg" in data:
                start_reg = int(data["reg"])
            elif match:
                start_reg = int(match.group("reg"))
            else:
                return

            if "slave" in data:
                slave = int(data["slave"])
            elif match:
                slave = int(match.group("slave"))
            else:
                slave = 1

            values = data.get("data")
            if slave != 1 or not isinstance(values, list):
                return
            values = [int(v) & 0xFFFF for v in values]
        except (TypeError, ValueError):
            return

        device = self._ensure_device(device_id)
        for offset, value in enumerate(values):
            device.registers[start_reg + offset] = value
        device.online = True

        _LOGGER.debug(
            "Deye %s: cached registers %s..%s from %s",
            device_id,
            start_reg,
            start_reg + len(values) - 1,
            topic,
        )
        self._notify(device_id)
