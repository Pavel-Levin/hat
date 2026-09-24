"""Deye SG05 MQTT integration."""
from __future__ import annotations

import aiomqtt

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import CONF_BROKER, CONF_PORT, DOMAIN
from .mqtt_client import DeyeMqttClient, async_test_connection

PLATFORMS = [Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Deye SG05 MQTT from a config entry."""
    broker = entry.data[CONF_BROKER]
    port = entry.data[CONF_PORT]
    username = entry.data.get(CONF_USERNAME, "")
    password = entry.data.get(CONF_PASSWORD, "")

    try:
        await async_test_connection(broker, port, username, password)
    except (aiomqtt.MqttError, TimeoutError, OSError) as err:
        raise ConfigEntryNotReady(f"MQTT broker is not reachable: {err}") from err

    client = DeyeMqttClient(hass, broker, port, username, password)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = client

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await client.async_start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Deye SG05 MQTT config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        client: DeyeMqttClient = hass.data[DOMAIN].pop(entry.entry_id)
        await client.async_stop()
    return unloaded
