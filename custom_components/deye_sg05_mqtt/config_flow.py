"""Config flow for Deye SG05 MQTT."""
from __future__ import annotations

import logging

import aiomqtt
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import (
    CONF_BROKER,
    CONF_DEVICE_ID,
    CONF_TLS,
    DEFAULT_BROKER,
    DEFAULT_PORT,
    DEVICE_PREFIX,
    DOMAIN,
)
from .mqtt_client import async_test_connection

_LOGGER = logging.getLogger(__name__)


def _connection_schema() -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_HOST, default=DEFAULT_BROKER): TextSelector(
                TextSelectorConfig(type=TextSelectorType.TEXT)
            ),
            vol.Required(CONF_PORT, default=DEFAULT_PORT): NumberSelector(
                NumberSelectorConfig(min=1, max=65535, mode=NumberSelectorMode.BOX)
            ),
            vol.Required(CONF_TLS, default=False): BooleanSelector(),
            vol.Required(CONF_DEVICE_ID): TextSelector(
                TextSelectorConfig(type=TextSelectorType.TEXT)
            ),
            vol.Optional(CONF_USERNAME, default=""): TextSelector(
                TextSelectorConfig(autocomplete="username")
            ),
            vol.Optional(CONF_PASSWORD, default=""): TextSelector(
                TextSelectorConfig(
                    type=TextSelectorType.PASSWORD,
                    autocomplete="current-password",
                )
            ),
        }
    )


class DeyeSg05MqttConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle Deye SG05 MQTT setup."""

    VERSION = 1

    def __init__(self) -> None:
        self._username = ""
        self._password = ""

    async def async_step_user(self, user_input=None):
        """Configure the MQTT broker explicitly."""
        errors = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            port = int(user_input[CONF_PORT])
            use_tls = bool(user_input.get(CONF_TLS, port == 8883))
            device_id = user_input[CONF_DEVICE_ID].strip()
            self._username = user_input.get(CONF_USERNAME, "")
            self._password = user_input.get(CONF_PASSWORD, "")
            if not device_id.startswith(DEVICE_PREFIX) or len(device_id) <= len(DEVICE_PREFIX):
                errors[CONF_DEVICE_ID] = "invalid_device_id"
                return self.async_show_form(
                    step_id="user",
                    data_schema=_connection_schema(),
                    errors=errors,
                )
            try:
                await async_test_connection(
                    host,
                    port,
                    self._username,
                    self._password,
                    use_tls,
                )
            except (aiomqtt.MqttError, TimeoutError, OSError):
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected MQTT validation error")
                errors["base"] = "unknown"
            else:
                self._async_abort_entries_match(
                    {CONF_BROKER: host, CONF_DEVICE_ID: device_id}
                )
                return self.async_create_entry(
                    title=f"Deye SG05 MQTT ({host})",
                    data={
                        CONF_BROKER: host,
                        CONF_PORT: port,
                        CONF_TLS: use_tls,
                        CONF_DEVICE_ID: device_id,
                        CONF_USERNAME: self._username,
                        CONF_PASSWORD: self._password,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=_connection_schema(),
            errors=errors,
        )

    async def async_step_broker(self, user_input=None):
        """Redirect entries created by the old two-step flow."""
        return await self.async_step_user(user_input)
