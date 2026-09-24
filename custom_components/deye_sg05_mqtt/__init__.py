"""Deye SG05 MQTT integration."""
from __future__ import annotations

from pathlib import Path

import aiomqtt

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import CONF_BROKER, CONF_PORT, DOMAIN
from .mqtt_client import DeyeMqttClient, async_test_connection

PLATFORMS = [Platform.SENSOR]

PANEL_URL_PATH = "deye-sg05-dashboard"
PANEL_MODULE_URL = "/deye_sg05_mqtt/panel.js"
PANEL_DATA_KEY = f"{DOMAIN}_panel_registered"


async def _async_register_dashboard(hass: HomeAssistant) -> None:
    """Register the Deye dashboard sidebar panel once."""
    if hass.data.get(PANEL_DATA_KEY):
        return

    panel_file = Path(__file__).parent / "frontend" / "panel.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_MODULE_URL, str(panel_file), False)]
    )

    await async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name="deye-sg05-panel",
        sidebar_title="Deye Dashboard",
        sidebar_icon="mdi:solar-power-variant",
        module_url=PANEL_MODULE_URL,
        embed_iframe=False,
        trust_external=True,
        require_admin=False,
    )
    hass.data[PANEL_DATA_KEY] = True


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

    await _async_register_dashboard(hass)

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
