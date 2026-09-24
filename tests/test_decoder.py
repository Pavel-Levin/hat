from custom_components.deye_sg05_mqtt.register_map import METRICS, decode_metric

by_key = {m.key: m for m in METRICS}

def put(start, values):
    return {start+i: v for i, v in enumerate(values)}

battery = put(586, [1130, 5670, 98, 0, 65471, 65482, 320, 0, 65474, 0, 0])
assert decode_metric(by_key["battery1_temperature_c"], battery) == 13.0
assert decode_metric(by_key["battery1_voltage_v"], battery) == 56.7
assert decode_metric(by_key["battery1_soc_pct"], battery) == 98
assert decode_metric(by_key["battery1_power_w"], battery) == -65
assert decode_metric(by_key["battery1_current_a"], battery) == -0.54
assert decode_metric(by_key["battery2_temperature_c"], battery) is None

grid = put(598, [2080,2244,2346,0,0,0,2826,2007,734,5567,0,4995,1367,839,304,1372,843,308,2839,2012,745,5596])
assert decode_metric(by_key["grid_l1_v"], grid) == 208.0
assert decode_metric(by_key["grid_hz"], grid) == 49.95
assert decode_metric(by_key["grid_l1_w"], grid) == 2839
assert decode_metric(by_key["grid_w"], grid) == 5596

inv = put(627, [2084,2244,2332,10,10,65436,45,41,65314,65400,65400,4995,0,2900,2035,516,5451,2087,2239,2339,0,0,0,2900,2035,516,5451,5451,4995])
assert decode_metric(by_key["inverter_w"], inv) == -136
assert decode_metric(by_key["load_l1_w"], inv) == 2900
assert decode_metric(by_key["load_l2_w"], inv) == 2035
assert decode_metric(by_key["load_l3_w"], inv) == 516
assert decode_metric(by_key["load_w"], inv) == 5451

genpv = put(661, [2095,2225,2342,0,65526,0,65526,0,65535,0,65535,0,0,0,0,161,0,21,0,0,0,0,0])
assert decode_metric(by_key["gen_port_l2_power_w"], genpv) == -10
assert decode_metric(by_key["gen_port_power_w"], genpv) == -10
assert decode_metric(by_key["pv1_v"], genpv) == 16.1
