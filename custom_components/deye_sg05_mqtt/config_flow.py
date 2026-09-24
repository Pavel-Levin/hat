"""Config flow for Deye SG05 MQTT."""
from __future__ import annotations

import logging

import aiomqtt
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import CONF_BROKER, DEFAULT_BROKER, DEFAULT_PORT, DOMAIN
from .mqtt_client import async_test_connection

_LOGGER = logging.getLogger(__name__)


def _credentials_schema() -> vol.Schema:
    return vol.Schema(
        {
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
        """Try the standard Home Assistant Mosquitto add-on first."""
        if user_input is not None:
            self._username = user_input.get(CONF_USERNAME, "")
            self._password = user_input.get(CONF_PASSWORD, "")
            try:
                await async_test_connection(
                    DEFAULT_BROKER,
                    DEFAULT_PORT,
                    self._username,
                    self._password,
                )
            except (aiomqtt.MqttError, TimeoutError, OSError):
                return await self.async_step_broker()
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected MQTT validation error")
                return await self.async_step_broker()

            self._async_abort_entries_match(
                {CONF_BROKER: DEFAULT_BROKER, CONF_USERNAME: self._username}
            )
            return self.async_create_entry(
                title="Deye SG05 MQTT",
                data={
                    CONF_BROKER: DEFAULT_BROKER,
                    CONF_PORT: DEFAULT_PORT,
                    CONF_USERNAME: self._username,
                    CONF_PASSWORD: self._password,
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=_credentials_schema(),
        )

    async def async_step_broker(self, user_input=None):
        """Ask for broker details only when core-mosquitto is unavailable."""
        errors = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            port = int(user_input[CONF_PORT])
            username = user_input.get(CONF_USERNAME, self._username)
            password = user_input.get(CONF_PASSWORD, self._password)
            try:
                await async_test_connection(host, port, username, password)
            except (aiomqtt.MqttError, TimeoutError, OSError):
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected MQTT validation error")
                errors["base"] = "unknown"
            else:
                self._async_abort_entries_match(
                    {CONF_BROKER: host, CONF_USERNAME: username}
                )
                return self.async_create_entry(
                    title=f"Deye SG05 MQTT ({host})",
                    data={
                        CONF_BROKER: host,
                        CONF_PORT: port,
                        CONF_USERNAME: username,
                        CONF_PASSWORD: password,
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_HOST): TextSelector(
                    TextSelectorConfig(type=TextSelectorType.TEXT)
                ),
                vol.Required(CONF_PORT, default=DEFAULT_PORT): NumberSelector(
                    NumberSelectorConfig(
                        min=1,
                        max=65535,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Optional(CONF_USERNAME, default=self._username): TextSelector(
                    TextSelectorConfig(autocomplete="username")
                ),
                vol.Optional(CONF_PASSWORD, default=self._password): TextSelector(
                    TextSelectorConfig(
                        type=TextSelectorType.PASSWORD,
                        autocomplete="current-password",
                    )
                ),
            }
        )
        return self.async_show_form(
            step_id="broker",
            data_schema=schema,
            errors=errors,
        )
