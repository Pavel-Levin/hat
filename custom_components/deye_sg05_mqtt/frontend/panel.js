class DeyeSg05Panel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._selected = null;
    this._energyMessage = "";
    this._energyBusy = false;
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  set panel(value) {
    this._panel = value;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  _states() {
    if (!this._hass) return [];
    return Object.values(this._hass.states).filter(
      (state) => state.attributes?.gateway_id && state.attributes?.metric_key
    );
  }

  _gateways(states) {
    return [...new Set(states.map((s) => s.attributes.gateway_id))].sort();
  }

  _index(states, gateway) {
    const idx = {};
    for (const state of states) {
      if (state.attributes.gateway_id === gateway) {
        idx[state.attributes.metric_key] = state;
      }
    }
    return idx;
  }

  _short(gateway) {
    return (gateway || "").replace("id-nsg-v0.1-", "");
  }

  _state(idx, key) {
    return idx[key] || null;
  }

  _entity(idx, key) {
    return this._state(idx, key)?.entity_id || null;
  }

  _number(idx, key) {
    const state = this._state(idx, key);
    if (!state || state.state === "unknown" || state.state === "unavailable") return null;
    const n = Number(state.state);
    return Number.isFinite(n) ? n : null;
  }

  _value(idx, key, fallback = "—") {
    const state = this._state(idx, key);
    if (!state || state.state === "unknown" || state.state === "unavailable") return fallback;
    const unit = state.attributes.unit_of_measurement || "";
    const num = Number(state.state);
    let value = state.state;
    if (Number.isFinite(num)) {
      const a = Math.abs(num);
      const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
      value = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(num);
    }
    return unit ? `${value} ${unit}` : value;
  }

  _sum(idx, keys) {
    const values = keys.map((key) => this._number(idx, key));
    if (values.every((v) => v === null)) return null;
    return values.reduce((sum, value) => sum + (value || 0), 0);
  }

  _formatW(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return Math.abs(value) >= 1000
      ? `${(value / 1000).toFixed(2)} kW`
      : `${Math.round(value)} W`;
  }

  _formatSignedW(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return Math.abs(value) >= 1000
      ? `${sign}${(value / 1000).toFixed(2)} kW`
      : `${sign}${Math.round(value)} W`;
  }

  _card(title, value, subtitle, icon, tone = "") {
    return `
      <div class="metric-card ${tone}">
        <div class="metric-icon">${icon}</div>
        <div class="metric-copy">
          <div class="metric-title">${title}</div>
          <div class="metric-value">${value}</div>
          <div class="metric-subtitle">${subtitle || ""}</div>
        </div>
      </div>
    `;
  }

  _row(label, value, accent = false) {
    return `
      <div class="row">
        <span>${label}</span>
        <strong class="${accent ? "accent-value" : ""}">${value}</strong>
      </div>
    `;
  }

  _pvCards(idx) {
    return [1, 2, 3, 4].map((n) => `
      <div class="mini-card">
        <div class="mini-title">PV${n}</div>
        <div class="mini-power">${this._value(idx, `pv${n}_w`)}</div>
        <div class="mini-line">${this._value(idx, `pv${n}_v`)}</div>
        <div class="mini-line">${this._value(idx, `pv${n}_a`)}</div>
      </div>
    `).join("");
  }

  _phaseTable(idx, prefix, withCurrent = true) {
    return `
      <table>
        <thead>
          <tr>
            <th>Фаза</th>
            <th>V</th>
            ${withCurrent ? "<th>A</th>" : ""}
            <th>W</th>
          </tr>
        </thead>
        <tbody>
          ${["l1","l2","l3"].map((phase) => `
            <tr>
              <td>${phase.toUpperCase()}</td>
              <td>${this._value(idx, `${prefix}_${phase}_v`)}</td>
              ${withCurrent ? `<td>${this._value(idx, `${prefix}_${phase}_a`)}</td>` : ""}
              <td>${this._value(idx, `${prefix}_${phase}_w`)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  _flowDirectionClass(value, positiveClass, negativeClass) {
    if (value === null || Math.abs(value) < 5) return "idle";
    return value > 0 ? positiveClass : negativeClass;
  }

  _flowDiagram(idx) {
    const pv = this._sum(idx, ["pv1_w", "pv2_w", "pv3_w", "pv4_w"]);
    const gen = this._number(idx, "gen_port_power_w");
    const grid = this._number(idx, "grid_w");
    const battery = this._number(idx, "battery1_power_w");
    const load = this._number(idx, "load_w");
    const inverter = this._number(idx, "inverter_w");
    const soc = this._value(idx, "battery1_soc_pct");

    const gridMode = this._flowDirectionClass(grid, "to-bus", "from-bus");
    const batteryMode = this._flowDirectionClass(battery, "from-battery", "to-battery");
    const pvActive = pv !== null && Math.abs(pv) >= 5 ? "active" : "idle";
    const genActive = gen !== null && Math.abs(gen) >= 5 ? "active" : "idle";
    const loadActive = load !== null && Math.abs(load) >= 5 ? "active" : "idle";

    return `
      <section class="power-flow card">
        <div class="flow-title-row">
          <div>
            <h2>Потоки энергии</h2>
            <div class="flow-hint">Сеть: + импорт, − экспорт · Батарея: знак показан как передаёт Deye</div>
          </div>
          <div class="bus-badge">AC BUS</div>
        </div>

        <div class="flow-layout">
          <div class="flow-node pv-node">
            <div class="node-icon">☀️</div>
            <div class="node-label">DC PV</div>
            <div class="node-value">${this._formatW(pv)}</div>
          </div>

          <div class="connector pv-connector ${pvActive}"><span>→</span></div>

          <div class="flow-node inverter-node">
            <div class="node-icon">⚡</div>
            <div class="node-label">Deye inverter</div>
            <div class="node-value">${this._formatSignedW(inverter)}</div>
          </div>

          <div class="connector inverter-bus active"><span>→</span></div>

          <div class="flow-node bus-node">
            <div class="node-icon">🔷</div>
            <div class="node-label">AC BUS</div>
            <div class="node-value">общая шина</div>
          </div>

          <div class="connector bus-load ${loadActive}"><span>↓</span></div>

          <div class="flow-node load-node">
            <div class="node-icon">🏠</div>
            <div class="node-label">Нагрузка</div>
            <div class="node-value">${this._formatW(load)}</div>
          </div>

          <div class="flow-node battery-node">
            <div class="node-icon">🔋</div>
            <div class="node-label">Батарея</div>
            <div class="node-value">${soc}</div>
            <div class="node-sub">${this._formatSignedW(battery)}</div>
          </div>

          <div class="connector battery-connector ${batteryMode}">
            <span class="arrow-right">↔</span>
          </div>

          <div class="flow-node gen-node">
            <div class="node-icon">🔌</div>
            <div class="node-label">Microinverter / GEN</div>
            <div class="node-value">${this._formatW(gen)}</div>
          </div>

          <div class="connector gen-connector ${genActive}"><span>→</span></div>

          <div class="flow-node grid-node">
            <div class="node-icon">🌐</div>
            <div class="node-label">Сеть</div>
            <div class="node-value">${this._formatSignedW(grid)}</div>
            <div class="node-sub">${grid !== null ? (grid >= 0 ? "импорт" : "экспорт") : "—"}</div>
          </div>

          <div class="connector grid-connector ${gridMode}">
            <span>↔</span>
          </div>
        </div>
      </section>
    `;
  }

  _health(idx) {
    const keys = Object.keys(idx);
    const available = keys.filter((key) => {
      const state = idx[key];
      return state && state.state !== "unknown" && state.state !== "unavailable";
    }).length;
    const last = keys
      .map((key) => idx[key]?.last_updated)
      .filter(Boolean)
      .sort()
      .at(-1);
    const age = last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 1000)) : null;
    return {
      available,
      total: keys.length,
      lastText: age === null ? "нет данных" : age < 60 ? `${age} сек назад` : `${Math.floor(age/60)} мин назад`,
    };
  }

  async _configureEnergy(idx) {
    if (!this._hass || this._energyBusy) return;
    this._energyBusy = true;
    this._energyMessage = "Настройка Energy…";
    this._render();

    try {
      const required = {
        gridImport: this._entity(idx, "grid_import_total_kwh"),
        gridExport: this._entity(idx, "grid_export_total_kwh"),
        gridPower: this._entity(idx, "grid_w"),
        pvEnergy: this._entity(idx, "total_pv_energy_kwh"),
        genEnergy: this._entity(idx, "gen_port_total_kwh"),
        genPower: this._entity(idx, "gen_port_power_w"),
        batteryDischarge: this._entity(idx, "battery_discharge_total_kwh"),
        batteryCharge: this._entity(idx, "battery_charge_total_kwh"),
        batteryPower: this._entity(idx, "battery1_power_w"),
        batterySoc: this._entity(idx, "battery1_soc_pct"),
      };

      const missing = Object.entries(required)
        .filter(([key, value]) => !value && !["genEnergy", "genPower"].includes(key))
        .map(([key]) => key);
      if (missing.length) throw new Error(`Нет нужных сущностей: ${missing.join(", ")}`);

      const prefs = await this._hass.callWS({ type: "energy/get_prefs" });
      const short = this._short(this._selected);
      const marker = `[${short}]`;
      const names = new Set([
        `Deye Grid ${marker}`,
        `Deye PV ${marker}`,
        `Microinverter GEN ${marker}`,
        `Deye Battery ${marker}`,
      ]);

      const sources = (prefs.energy_sources || []).filter(
        (source) => !names.has(source.name || "")
      );

      sources.push({
        type: "grid",
        name: `Deye Grid ${marker}`,
        stat_energy_from: required.gridImport,
        stat_energy_to: required.gridExport,
        stat_cost: null,
        entity_energy_price: null,
        number_energy_price: null,
        stat_compensation: null,
        entity_energy_price_export: null,
        number_energy_price_export: null,
        power_config: { stat_rate: required.gridPower },
        cost_adjustment_day: 0,
      });

      sources.push({
        type: "solar",
        name: `Deye PV ${marker}`,
        stat_energy_from: required.pvEnergy,
        config_entry_solar_forecast: null,
      });

      if (required.genEnergy) {
        const genSource = {
          type: "solar",
          name: `Microinverter GEN ${marker}`,
          stat_energy_from: required.genEnergy,
          config_entry_solar_forecast: null,
        };
        if (required.genPower) genSource.stat_rate = required.genPower;
        sources.push(genSource);
      }

      sources.push({
        type: "battery",
        name: `Deye Battery ${marker}`,
        stat_energy_from: required.batteryDischarge,
        stat_energy_to: required.batteryCharge,
        power_config: { stat_rate: required.batteryPower },
        stat_soc: required.batterySoc,
      });

      await this._hass.callWS({
        type: "energy/save_prefs",
        energy_sources: sources,
        device_consumption: prefs.device_consumption || [],
        device_consumption_water: prefs.device_consumption_water || [],
      });

      this._energyMessage = "Energy настроен для выбранного шлюза.";
    } catch (err) {
      this._energyMessage = `Ошибка Energy: ${err?.message || err}`;
    } finally {
      this._energyBusy = false;
      this._render();
    }
  }

  _render() {
    if (!this.shadowRoot) return;

    const states = this._states();
    const gateways = this._gateways(states);

    if (!gateways.length) {
      this.shadowRoot.innerHTML = `
        <style>${this._styles()}</style>
        <main><section class="card empty"><h2>Deye Dashboard</h2><p>Ожидаю данные MQTT…</p></section></main>
      `;
      return;
    }

    if (!this._selected || !gateways.includes(this._selected)) this._selected = gateways[0];

    const idx = this._index(states, this._selected);
    const pv = this._sum(idx, ["pv1_w", "pv2_w", "pv3_w", "pv4_w"]);
    const gen = this._number(idx, "gen_port_power_w");
    const load = this._number(idx, "load_w");
    const grid = this._number(idx, "grid_w");
    const battery = this._number(idx, "battery1_power_w");
    const health = this._health(idx);

    const options = gateways.map((gateway) =>
      `<option value="${gateway}" ${gateway === this._selected ? "selected" : ""}>${this._short(gateway)}</option>`
    ).join("");

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <main>
        <header>
          <div>
            <div class="eyebrow">SUN-20K-SG05LP3-EU-SM2</div>
            <h1>Deye Dashboard</h1>
            <div class="health">● ${health.available}/${health.total} датчиков · обновлено ${health.lastText}</div>
          </div>
          <div class="actions">
            <label>Шлюз<select id="gateway">${options}</select></label>
            <button id="energy" ${this._energyBusy ? "disabled" : ""}>⚡ Настроить Energy</button>
          </div>
        </header>

        ${this._energyMessage ? `<div class="notice">${this._energyMessage}</div>` : ""}

        <section class="summary-grid">
          ${this._card("DC PV", this._formatW(pv), "PV1–PV4", "☀️", "solar")}
          ${this._card("Микроинвертор", this._formatW(gen), "через GEN-порт", "🔌", "gen")}
          ${this._card("Нагрузка", this._formatW(load), "дом", "🏠", "load")}
          ${this._card("Сеть", this._formatSignedW(grid), grid !== null ? (grid >= 0 ? "импорт" : "экспорт") : "—", "🌐", "grid")}
          ${this._card("Батарея", this._value(idx, "battery1_soc_pct"), this._formatSignedW(battery), "🔋", "battery")}
        </section>

        ${this._flowDiagram(idx)}

        <div class="two-col">
          <section class="card">
            <h2>☀️ DC солнечные панели</h2>
            <div class="mini-grid">${this._pvCards(idx)}</div>
            <div class="rows">
              ${this._row("PV сегодня", this._value(idx, "pv_today_kwh"), true)}
              ${this._row("PV всего", this._value(idx, "total_pv_energy_kwh"))}
            </div>
          </section>

          <section class="card gen-panel">
            <h2>🔌 Микроинвертор на GEN-порту</h2>
            <div class="rows">
              ${this._row("Режим GEN", this._value(idx, "gen_port_mode"))}
              ${this._row("L1 напряжение", this._value(idx, "gen_port_l1_voltage_v"))}
              ${this._row("L2 напряжение", this._value(idx, "gen_port_l2_voltage_v"))}
              ${this._row("L3 напряжение", this._value(idx, "gen_port_l3_voltage_v"))}
              ${this._row("L1 мощность", this._value(idx, "gen_port_l1_power_w"))}
              ${this._row("L2 мощность", this._value(idx, "gen_port_l2_power_w"))}
              ${this._row("L3 мощность", this._value(idx, "gen_port_l3_power_w"))}
              ${this._row("Мощность всего", this._value(idx, "gen_port_power_w"), true)}
              ${this._row("Энергия сегодня", this._value(idx, "gen_port_today_kwh"), true)}
              ${this._row("Энергия всего", this._value(idx, "gen_port_total_kwh"))}
            </div>
          </section>
        </div>

        <div class="two-col">
          <section class="card">
            <h2>🔋 Батарея</h2>
            <div class="rows">
              ${this._row("SOC", this._value(idx, "battery1_soc_pct"), true)}
              ${this._row("Напряжение", this._value(idx, "battery1_voltage_v"))}
              ${this._row("Ток", this._value(idx, "battery1_current_a"))}
              ${this._row("Мощность", this._value(idx, "battery1_power_w"))}
              ${this._row("Температура", this._value(idx, "battery1_temperature_c"))}
              ${this._row("Ёмкость", this._value(idx, "battery_corrected_ah"))}
              ${this._row("Заряд сегодня", this._value(idx, "battery_charge_today_kwh"))}
              ${this._row("Разряд сегодня", this._value(idx, "battery_discharge_today_kwh"))}
            </div>
          </section>

          <section class="card">
            <h2>🌐 Сеть</h2>
            ${this._phaseTable(idx, "grid", true)}
            <div class="rows">
              ${this._row("Частота", this._value(idx, "grid_hz"))}
              ${this._row("Общая мощность", this._value(idx, "grid_w"), true)}
              ${this._row("Импорт сегодня", this._value(idx, "grid_import_today_kwh"))}
              ${this._row("Экспорт сегодня", this._value(idx, "grid_export_today_kwh"))}
            </div>
          </section>
        </div>

        <div class="two-col">
          <section class="card">
            <h2>🏠 Нагрузка</h2>
            <table>
              <thead><tr><th>Фаза</th><th>V</th><th>W</th></tr></thead>
              <tbody>
                ${["l1","l2","l3"].map((phase) => `
                  <tr>
                    <td>${phase.toUpperCase()}</td>
                    <td>${this._value(idx, `load_${phase}_v`)}</td>
                    <td>${this._value(idx, `load_${phase}_w`)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div class="rows">
              ${this._row("Частота", this._value(idx, "load_hz"))}
              ${this._row("Мощность", this._value(idx, "load_w"), true)}
              ${this._row("Энергия сегодня", this._value(idx, "load_today_kwh"))}
            </div>
          </section>

          <section class="card">
            <h2>⚡ Инвертор</h2>
            <div class="rows">
              ${this._row("Мощность", this._value(idx, "inverter_w"), true)}
              ${this._row("Частота", this._value(idx, "inverter_hz"))}
              ${this._row("L1 напряжение", this._value(idx, "inverter_l1_v"))}
              ${this._row("L2 напряжение", this._value(idx, "inverter_l2_v"))}
              ${this._row("L3 напряжение", this._value(idx, "inverter_l3_v"))}
              ${this._row("Радиатор", this._value(idx, "heatsink_temperature_c"))}
              ${this._row("DC трансформатор", this._value(idx, "dc_transformer_temperature_c"))}
            </div>
          </section>
        </div>

        <section class="card energy-card">
          <h2>📊 Накопленная энергия</h2>
          <div class="energy-grid">
            <div>
              <h3>PV</h3>
              ${this._row("Сегодня", this._value(idx, "pv_today_kwh"))}
              ${this._row("Всего", this._value(idx, "total_pv_energy_kwh"))}
            </div>
            <div>
              <h3>Microinverter / GEN</h3>
              ${this._row("Сегодня", this._value(idx, "gen_port_today_kwh"))}
              ${this._row("Всего", this._value(idx, "gen_port_total_kwh"))}
            </div>
            <div>
              <h3>Сеть</h3>
              ${this._row("Импорт", this._value(idx, "grid_import_total_kwh"))}
              ${this._row("Экспорт", this._value(idx, "grid_export_total_kwh"))}
            </div>
            <div>
              <h3>Батарея</h3>
              ${this._row("Заряд", this._value(idx, "battery_charge_total_kwh"))}
              ${this._row("Разряд", this._value(idx, "battery_discharge_total_kwh"))}
            </div>
          </div>
        </section>

        <footer>MQTT ID: <code>${this._selected}</code></footer>
      </main>
    `;

    this.shadowRoot.querySelector("#gateway")?.addEventListener("change", (event) => {
      this._selected = event.target.value;
      this._energyMessage = "";
      this._render();
    });

    this.shadowRoot.querySelector("#energy")?.addEventListener("click", () => {
      this._configureEnergy(idx);
    });
  }

  _styles() {
    return `
      :host {
        display:block;
        min-height:100%;
        background:var(--primary-background-color,#f5f6f8);
        color:var(--primary-text-color,#202124);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      * { box-sizing:border-box; }
      main { max-width:1480px; margin:auto; padding:22px; }
      header { display:flex; justify-content:space-between; align-items:end; gap:20px; margin-bottom:16px; }
      h1 { margin:2px 0 0; font-size:31px; line-height:1.05; }
      h2 { margin:0 0 14px; font-size:19px; }
      h3 { margin:0 0 9px; font-size:14px; }
      .eyebrow { font-size:12px; opacity:.62; font-weight:700; letter-spacing:.04em; }
      .health { font-size:12px; margin-top:7px; opacity:.62; }
      .health::first-letter { color:#31a354; }
      .actions { display:flex; align-items:end; gap:10px; }
      label { display:flex; flex-direction:column; gap:4px; font-size:12px; }
      select,button {
        border:1px solid var(--divider-color,#ddd);
        border-radius:11px;
        padding:10px 13px;
        background:var(--card-background-color,#fff);
        color:inherit;
      }
      button { cursor:pointer; font-weight:700; }
      button:disabled { opacity:.5; cursor:wait; }
      .notice { padding:11px 14px; border-radius:10px; margin-bottom:14px; background:var(--secondary-background-color,#eaf3ff); }
      .card,.metric-card {
        background:var(--card-background-color,#fff);
        border:1px solid var(--divider-color,rgba(0,0,0,.08));
        border-radius:17px;
        box-shadow:0 2px 8px rgba(0,0,0,.035);
      }
      .summary-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
      .metric-card { min-height:105px; padding:17px; display:flex; gap:13px; align-items:center; }
      .metric-icon { font-size:28px; }
      .metric-title { font-size:12px; opacity:.63; }
      .metric-value { font-size:23px; font-weight:780; margin:3px 0; white-space:nowrap; }
      .metric-subtitle { font-size:12px; opacity:.62; }
      .power-flow { padding:18px; margin-bottom:14px; overflow:hidden; }
      .flow-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:10px; }
      .flow-title-row h2 { margin-bottom:3px; }
      .flow-hint { font-size:11px; opacity:.56; }
      .bus-badge { font-size:11px; font-weight:750; padding:6px 9px; border-radius:999px; background:var(--secondary-background-color,#eef1f3); }
      .flow-layout {
        display:grid;
        grid-template-columns:minmax(125px,1fr) 54px minmax(145px,1fr) 54px minmax(145px,1fr) 54px minmax(125px,1fr);
        grid-template-rows:126px 54px 126px;
        align-items:center;
        gap:0;
        max-width:1120px;
        margin:0 auto;
      }
      .flow-node {
        background:var(--secondary-background-color,#f1f2f3);
        border-radius:15px;
        padding:13px;
        min-height:96px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        position:relative;
        z-index:2;
      }
      .node-icon { font-size:25px; }
      .node-label { font-size:12px; opacity:.66; margin-top:3px; }
      .node-value { font-size:18px; font-weight:780; margin-top:4px; }
      .node-sub { font-size:11px; opacity:.6; margin-top:2px; }
      .pv-node { grid-column:1; grid-row:1; }
      .pv-connector { grid-column:2; grid-row:1; }
      .inverter-node { grid-column:3; grid-row:1; }
      .inverter-bus { grid-column:4; grid-row:1; }
      .bus-node { grid-column:5; grid-row:1; border:1px solid var(--primary-color,#03a9f4); }
      .bus-load { grid-column:5; grid-row:2; transform:rotate(90deg); }
      .load-node { grid-column:5; grid-row:3; }
      .battery-node { grid-column:3; grid-row:3; }
      .battery-connector { grid-column:4; grid-row:3; }
      .gen-node { grid-column:7; grid-row:1; border:1px dashed var(--primary-color,#03a9f4); }
      .gen-connector { grid-column:6; grid-row:1; transform:rotate(180deg); }
      .grid-node { grid-column:7; grid-row:3; }
      .grid-connector { grid-column:6; grid-row:3; }
      .connector {
        height:4px;
        position:relative;
        display:flex;
        align-items:center;
        justify-content:center;
        color:var(--secondary-text-color,#777);
      }
      .connector::before {
        content:"";
        position:absolute;
        left:4px;
        right:4px;
        height:3px;
        border-radius:99px;
        background:var(--divider-color,#d7d9db);
      }
      .connector span {
        position:relative;
        z-index:1;
        padding:2px 5px;
        border-radius:999px;
        background:var(--card-background-color,#fff);
        font-weight:800;
      }
      .connector.active::before,
      .connector.to-bus::before,
      .connector.from-battery::before {
        background:var(--primary-color,#03a9f4);
        animation:pulse 1.5s ease-in-out infinite;
      }
      .connector.from-bus::before,
      .connector.to-battery::before {
        background:var(--warning-color,#ff9800);
        animation:pulse 1.5s ease-in-out infinite;
      }
      .connector.idle { opacity:.4; }
      @keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
      .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
      .card { padding:19px; }
      .gen-panel { border-top:3px solid var(--primary-color,#03a9f4); }
      .mini-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:12px; }
      .mini-card { padding:12px; border-radius:12px; background:var(--secondary-background-color,#f1f2f3); }
      .mini-title { font-size:12px; font-weight:760; opacity:.7; }
      .mini-power { font-size:19px; font-weight:780; margin:5px 0; }
      .mini-line { font-size:12px; opacity:.68; margin-top:2px; }
      .rows { display:flex; flex-direction:column; }
      .row { display:flex; justify-content:space-between; gap:15px; padding:8px 0; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      .row:last-child { border-bottom:0; }
      .row span { opacity:.72; }
      .row strong { text-align:right; }
      .accent-value { font-weight:800; }
      table { width:100%; border-collapse:collapse; margin-bottom:8px; }
      th,td { text-align:right; padding:8px 5px; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      th:first-child,td:first-child { text-align:left; }
      th { font-size:11px; opacity:.58; }
      .energy-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:24px; }
      footer { text-align:center; font-size:12px; opacity:.5; padding:17px 0 4px; }
      code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }
      .empty { max-width:560px; margin:70px auto; text-align:center; }
      @media(max-width:1100px) {
        .summary-grid { grid-template-columns:repeat(2,1fr); }
        .flow-layout { grid-template-columns:1fr 38px 1fr 38px 1fr; }
        .gen-node { grid-column:1; grid-row:3; }
        .gen-connector { grid-column:2; grid-row:3; transform:none; }
        .grid-node { grid-column:5; grid-row:3; }
        .grid-connector { grid-column:4; grid-row:3; }
        .battery-node,.battery-connector { display:none; }
        .load-node { grid-column:3; grid-row:3; }
        .bus-load { grid-column:3; }
      }
      @media(max-width:800px) {
        main { padding:11px; }
        header { flex-direction:column; align-items:stretch; }
        .actions { align-items:stretch; }
        .actions label { flex:1; }
        select { width:100%; }
        .two-col,.energy-grid { grid-template-columns:1fr; }
        .flow-layout { display:grid; grid-template-columns:1fr; grid-template-rows:auto; gap:8px; }
        .flow-node,.connector { grid-column:1 !important; grid-row:auto !important; }
        .connector { min-height:20px; transform:rotate(90deg) !important; }
      }
      @media(max-width:560px) {
        .summary-grid { grid-template-columns:1fr; }
        .actions { flex-direction:column; }
        .mini-grid { grid-template-columns:1fr 1fr; }
      }
    `;
  }
}

if (!customElements.get("deye-sg05-panel")) {
  customElements.define("deye-sg05-panel", DeyeSg05Panel);
}
