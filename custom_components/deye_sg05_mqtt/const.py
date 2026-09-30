"""Constants for Deye SG05 MQTT."""
from __future__ import annotations

DOMAIN = "deye_sg05_mqtt"
PLATFORMS = ["sensor"]

DEFAULT_BROKER = "core-mosquitto"
DEFAULT_PORT = 1883

CONF_BROKER = "broker"
CONF_PORT = "port"
CONF_TLS = "tls"
CONF_DEVICE_ID = "device_id"

DEVICE_PREFIX = "id-nsg-v0.1-"
MODEL = "SUN-20K-SG05LP3-EU-SM2"
MANUFACTURER = "Deye"
