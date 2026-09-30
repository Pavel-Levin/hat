# Deye SG05 MQTT for Home Assistant

Custom integration for **Deye SUN-20K-SG05LP3-EU-SM2** and MQTT gateways using the `id-nsg-v0.1-*` topic tree.

## Highlights

- Read-only MQTT/Modbus register decoding.
- Battery, BMS, grid, inverter, load and PV1-PV4 sensors.
- GEN-port measurements exposed as a separate logical **Microinverter (GEN)** device.
- Built-in **Deye Dashboard** sidebar panel.
- Version 0.5 adds a redesigned live energy-flow view with separate DC PV, Deye inverter, AC bus, load, battery, grid and GEN microinverter nodes.
- Grid direction is shown as import/export from signed power.
- Multiple gateways are selectable by MQTT ID.
- One-click Energy Dashboard setup for grid, DC PV, GEN microinverter and battery.

## Installation with HACS

Add this repository as a custom HACS **Integration** repository, install it, and restart Home Assistant.

After restart:

1. Settings -> Devices & services -> Add integration.
2. Add **Deye SG05 MQTT**.
3. Enter the MQTT broker address, port, TLS mode and credentials. For the
   NSG production broker use port `8883` with TLS enabled. Use
   `core-mosquitto:1883` without TLS only when the gateway publishes to the
   Home Assistant Mosquitto add-on itself.
4. Open **Deye Dashboard** from the sidebar.
5. Select the required gateway.
6. Press **Настроить Energy** if you want the integration to populate the Energy dashboard sources.

## MQTT

Supported raw register topic styles:

```text
id-nsg-v0.1-XXXXXXXXXXXX/modbus/data
id-nsg-v0.1-XXXXXXXXXXXX/modbus/1/586/11
```

Legacy `/read/#` topics remain supported.

## Safety

The integration remains read-only. It does not write inverter Modbus registers.
