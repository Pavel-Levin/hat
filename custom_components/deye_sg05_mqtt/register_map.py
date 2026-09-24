"""Read-only Deye SUN-20K-SG05LP3-EU-SM2 register map.

Generated from the workbook supplied by the user. Register addressing is zero-based.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MetricDef:
    reg: int
    key: str
    group: str
    dtype: str
    scale: float = 1.0
    offset: float = 0.0
    unit: str | None = None
    count: int = 1
    high_reg: int | None = None


METRICS: tuple[MetricDef, ...] = (
    MetricDef(reg=24, key='battery_input_count', group='info', dtype='uint16', scale=1.0, offset=0.0, unit=None, count=1, high_reg=None),
    MetricDef(reg=133, key='gen_port_mode', group='microinverter', dtype='uint16', scale=1.0, offset=0.0, unit=None, count=1, high_reg=None),
    MetricDef(reg=210, key='bms1_charge_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=211, key='bms1_discharge_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=212, key='bms1_charge_current_limit_a', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=213, key='bms1_discharge_current_limit_a', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=214, key='bms1_soc_pct', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='%', count=1, high_reg=None),
    MetricDef(reg=215, key='bms1_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=216, key='bms1_current_a', group='bms', dtype='int16 signed', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=217, key='bms1_temperature_c', group='bms', dtype='int16 signed', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=218, key='bms1_charge_max_current_a', group='bms', dtype='int16 signed', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=219, key='bms1_discharge_max_current_a', group='bms', dtype='int16 signed', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=241, key='bms2_charge_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=242, key='bms2_discharge_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=243, key='bms2_charge_current_limit_a', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=244, key='bms2_discharge_current_limit_a', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=245, key='bms2_soc_pct', group='bms', dtype='uint16', scale=1.0, offset=0.0, unit='%', count=1, high_reg=None),
    MetricDef(reg=246, key='bms2_voltage_v', group='bms', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=247, key='bms2_current_a', group='bms', dtype='int16 signed', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=248, key='bms2_temperature_c', group='bms', dtype='int16 signed', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=249, key='bms2_charge_max_current_a', group='bms', dtype='int16 signed', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=250, key='bms2_discharge_max_current_a', group='bms', dtype='int16 signed', scale=1.0, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=500, key='running_status', group='status', dtype='uint16', scale=1.0, offset=0.0, unit=None, count=1, high_reg=None),
    MetricDef(reg=501, key='inverter_grid_active_today_kwh', group='energy', dtype='int16 signed', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=504, key='inverter_grid_active_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=505),
    MetricDef(reg=512, key='gen_port_total_work_h', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='h', count=2, high_reg=513),
    MetricDef(reg=514, key='battery_charge_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=515, key='battery_discharge_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=516, key='battery_charge_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=517),
    MetricDef(reg=518, key='battery_discharge_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=519),
    MetricDef(reg=520, key='grid_import_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=521, key='grid_export_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=522, key='grid_import_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=523),
    MetricDef(reg=524, key='grid_export_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=525),
    MetricDef(reg=526, key='load_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=527, key='load_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=528),
    MetricDef(reg=529, key='pv_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=530, key='pv1_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=531, key='pv2_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=532, key='pv3_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=533, key='pv4_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=534, key='total_pv_energy_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=535),
    MetricDef(reg=536, key='gen_port_today_kwh', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='kWh', count=1, high_reg=None),
    MetricDef(reg=537, key='gen_port_total_kwh', group='energy', dtype='uint32, low word → high word', scale=0.1, offset=0.0, unit='kWh', count=2, high_reg=538),
    MetricDef(reg=539, key='gen_port_work_today_h', group='energy', dtype='uint16', scale=0.1, offset=0.0, unit='h', count=1, high_reg=None),
    MetricDef(reg=540, key='dc_transformer_temperature_c', group='temperature', dtype='uint16', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=541, key='heatsink_temperature_c', group='temperature', dtype='uint16', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=586, key='battery1_temperature_c', group='battery', dtype='uint16', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=587, key='battery1_voltage_v', group='battery', dtype='uint16', scale=0.01, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=588, key='battery1_soc_pct', group='battery', dtype='uint16', scale=1.0, offset=0.0, unit='%', count=1, high_reg=None),
    MetricDef(reg=589, key='battery2_soc_pct', group='battery', dtype='uint16', scale=1.0, offset=0.0, unit='%', count=1, high_reg=None),
    MetricDef(reg=590, key='battery1_power_w', group='battery', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=591, key='battery1_current_a', group='battery', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=592, key='battery_corrected_ah', group='battery', dtype='uint16', scale=1.0, offset=0.0, unit='Ah', count=1, high_reg=None),
    MetricDef(reg=593, key='battery2_voltage_v', group='battery', dtype='uint16', scale=0.01, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=594, key='battery2_current_a', group='battery', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=595, key='battery2_power_w', group='battery', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=596, key='battery2_temperature_c', group='battery', dtype='int16 signed', scale=0.1, offset=-100.0, unit='°C', count=1, high_reg=None),
    MetricDef(reg=598, key='grid_l1_v', group='grid', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=599, key='grid_l2_v', group='grid', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=600, key='grid_l3_v', group='grid', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=607, key='grid_internal_w', group='grid', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=609, key='grid_hz', group='grid', dtype='uint16', scale=0.01, offset=0.0, unit='Hz', count=1, high_reg=None),
    MetricDef(reg=613, key='grid_l1_a', group='grid', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=614, key='grid_l2_a', group='grid', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=615, key='grid_l3_a', group='grid', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=616, key='grid_l1_w', group='grid', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=617, key='grid_l2_w', group='grid', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=618, key='grid_l3_w', group='grid', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=619, key='grid_w', group='grid', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=627, key='inverter_l1_v', group='inverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=628, key='inverter_l2_v', group='inverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=629, key='inverter_l3_v', group='inverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=630, key='inverter_l1_a', group='inverter', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=631, key='inverter_l2_a', group='inverter', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=632, key='inverter_l3_a', group='inverter', dtype='int16 signed', scale=0.01, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=636, key='inverter_w', group='inverter', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=638, key='inverter_hz', group='inverter', dtype='uint16', scale=0.01, offset=0.0, unit='Hz', count=1, high_reg=None),
    MetricDef(reg=643, key='ups_w', group='load', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=644, key='load_l1_v', group='load', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=645, key='load_l2_v', group='load', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=646, key='load_l3_v', group='load', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=650, key='load_l1_w', group='load', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=651, key='load_l2_w', group='load', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=652, key='load_l3_w', group='load', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=653, key='load_w', group='load', dtype='int16 signed', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=655, key='load_hz', group='load', dtype='uint16', scale=0.01, offset=0.0, unit='Hz', count=1, high_reg=None),
    MetricDef(reg=661, key='gen_port_l1_voltage_v', group='microinverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=662, key='gen_port_l2_voltage_v', group='microinverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=663, key='gen_port_l3_voltage_v', group='microinverter', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=664, key='gen_port_l1_power_w', group='microinverter', dtype='int32 signed, low/high в разных регистрах', scale=1.0, offset=0.0, unit='W', count=1, high_reg=668),
    MetricDef(reg=665, key='gen_port_l2_power_w', group='microinverter', dtype='int32 signed, low/high в разных регистрах', scale=1.0, offset=0.0, unit='W', count=1, high_reg=669),
    MetricDef(reg=666, key='gen_port_l3_power_w', group='microinverter', dtype='int32 signed, low/high в разных регистрах', scale=1.0, offset=0.0, unit='W', count=1, high_reg=670),
    MetricDef(reg=667, key='gen_port_power_w', group='microinverter', dtype='int32 signed, low/high в разных регистрах', scale=1.0, offset=0.0, unit='W', count=1, high_reg=671),
    MetricDef(reg=672, key='pv1_w', group='pv', dtype='uint16', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=673, key='pv2_w', group='pv', dtype='uint16', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=674, key='pv3_w', group='pv', dtype='uint16', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=675, key='pv4_w', group='pv', dtype='uint16', scale=1.0, offset=0.0, unit='W', count=1, high_reg=None),
    MetricDef(reg=676, key='pv1_v', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=677, key='pv1_a', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=678, key='pv2_v', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=679, key='pv2_a', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=680, key='pv3_v', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=681, key='pv3_a', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
    MetricDef(reg=682, key='pv4_v', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='V', count=1, high_reg=None),
    MetricDef(reg=683, key='pv4_a', group='pv', dtype='uint16', scale=0.1, offset=0.0, unit='A', count=1, high_reg=None),
)


def _signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def _signed32(value: int) -> int:
    return value - 0x100000000 if value & 0x80000000 else value


def decode_metric(metric: MetricDef, registers: dict[int, int]) -> int | float | None:
    """Decode one metric from the current register cache."""
    if metric.reg not in registers:
        return None

    low = int(registers[metric.reg]) & 0xFFFF

    if metric.group == "bms" and low == 0xFFFF:
        return None

    if metric.key == "battery2_temperature_c" and low == 0:
        return None

    if "int32 signed" in metric.dtype:
        if metric.high_reg is None or metric.high_reg not in registers:
            return None
        high = int(registers[metric.high_reg]) & 0xFFFF
        raw = _signed32((high << 16) | low)
    elif "uint32" in metric.dtype:
        if metric.high_reg is None or metric.high_reg not in registers:
            return None
        high = int(registers[metric.high_reg]) & 0xFFFF
        raw = (high << 16) | low
    elif "int16 signed" in metric.dtype:
        raw = _signed16(low)
    else:
        raw = low

    value = raw * metric.scale + metric.offset
    if metric.scale == 1 and metric.offset == 0:
        return int(value)
    return round(float(value), 4)
