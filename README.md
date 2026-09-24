# Deye SG05 MQTT for Home Assistant

Custom integration for **Deye SUN-20K-SG05LP3-EU-SM2** and the MQTT gateway topic format:

```text
id-nsg-v0.1-XXXXXXXXXXXX/read/1/<register>/<count>
```

The integration is **read-only**. It never writes Modbus registers.

## What it does

- Connects directly to an MQTT broker.
- Automatically discovers `id-nsg-v0.1-*` gateways.
- Decodes the register blocks from the supplied SUN-20K-SG05LP3-EU-SM2 map.
- Creates Home Assistant sensors for battery, BMS, grid, inverter, load, GEN port, PV1-PV4, temperatures and energy counters.
- Uses `total_increasing` for energy counters so they can be selected in the Energy dashboard.

## Setup

After the integration files are installed and Home Assistant is restarted:

1. Settings -> Devices & services -> Add integration.
2. Search for **Deye SG05 MQTT**.
3. Enter the MQTT username and password.
4. The integration first tries `core-mosquitto:1883`.
5. If that broker is not reachable, the next screen asks for broker host and port.
6. Deye devices appear automatically as soon as MQTT messages arrive.

No inverter IP, Modbus address or topic prefix is required.

## Installation

### HACS
This repository is HACS-compatible. Add this repository to HACS as a custom **Integration** repository and install **Deye SG05 MQTT**.

### Manual
Copy:

```text
custom_components/deye_sg05_mqtt
```

to:

```text
/config/custom_components/deye_sg05_mqtt
```

then restart Home Assistant.

## MQTT payload expected

Example:

```json
{
  "source": "poll",
  "item_id": 114,
  "slave": 1,
  "reg": 586,
  "count": 11,
  "changed": true,
  "period_ms": 2000,
  "data": [1130, 5670, 98, 0, 65471, 65482, 320, 0, 65474, 0, 0]
}
```

The topic must follow the gateway tree, e.g.:

```text
id-nsg-v0.1-A4CB8F1D1268/read/1/586/11
```

## Notes

- BMS values containing `65535` are treated as unavailable.
- Battery 2 temperature raw `0` is treated as unavailable, matching the supplied test map.
- The supplied workbook explicitly describes this as a read-only map; write registers are therefore not implemented.
