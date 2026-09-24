# Deye SG05 MQTT for Home Assistant

Custom integration for **Deye SUN-20K-SG05LP3-EU-SM2** and MQTT gateways using the `id-nsg-v0.1-*` topic tree.

## Highlights

- Read-only MQTT/Modbus register decoding.
- Battery, BMS, grid, inverter, load and PV1-PV4 sensors.
- GEN-port sensors are exposed as a separate logical **Microinverter (GEN)** device.
- Built-in **Deye Dashboard** sidebar panel.
- One-click Energy Dashboard configuration for the selected gateway:
  - grid import/export,
  - DC PV generation,
  - microinverter generation through the GEN port,
  - battery charge/discharge and SOC.
- Multiple gateways are distinguished by MQTT ID.

## Installation with HACS

Add this repository as a custom HACS **Integration** repository, install it, and restart Home Assistant.

After restart:

1. Settings -> Devices & services -> Add integration.
2. Add **Deye SG05 MQTT**.
3. Enter MQTT credentials.
4. Open **Deye Dashboard** from the sidebar.
5. Select the required gateway.
6. Press **Настроить Energy** once to add that gateway's energy sources without deleting unrelated Energy sources.

## MQTT

The current gateway firmware is supported under both branches:

```text
id-nsg-v0.1-XXXXXXXXXXXX/modbus/data
id-nsg-v0.1-XXXXXXXXXXXX/modbus/1/586/11
```

Legacy `/read/#` topics remain supported.

## Safety

This integration is read-only and does not write inverter Modbus registers.
