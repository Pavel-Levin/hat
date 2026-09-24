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

  _value(idx, key, fallback = "—") {
    const state = this._state(idx, key);
    if (!state || state.state === "unknown" || state.state === "unavailable") {
      return fallback;
    }
    const unit = state.attributes.unit_of_measurement || "";
    const num = Number(state.state);
    const value = Number.isFinite(num)
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.abs(num) >= 100 ? 0 : 2 }).format(num)
      : state.state;
    return unit ? `${value} ${unit}` : value;
  }

  _number(idx, key) {
    const state = this._state(idx, key);
    if (!state) return null;
    const n = Number(state.state);
    return Number.isFinite(n) ? n : null;
  }

  _sum(idx, keys) {
    const values = keys.map((key) => this._number(idx, key));
    if (values.every((v) => v === null)) return null;
    return values.reduce((sum, value) => sum + (value || 0), 0);
  }

  _formatW(value) {
    if (value === null || !Number.isFinite(value)) return "—";
    return Math.abs(value) >= 1000
      ? `${(value / 1000).toFixed(2)} kW`
      : `${Math.round(value)} W`;
  }

  _card(title, value, subtitle, icon) {
    return `
      <div class="card metric">
        <div class="icon">${icon}</div>
        <div>
          <div class="label">${title}</div>
          <div class="big">${value}</div>
          <div class="sub">${subtitle || ""}</div>
        </div>
      </div>
    `;
  }

  _row(label, value) {
    return `<div class="row"><span>${label}</span><strong>${value}</strong></div>`;
  }

  _pv(idx) {
    return [1, 2, 3, 4].map((n) => `
      <div class="mini">
        <b>PV${n}</b>
        <strong>${this._value(idx, `pv${n}_w`)}</strong>
        <span>${this._value(idx, `pv${n}_v`)}</span>
        <span>${this._value(idx, `pv${n}_a`)}</span>
      </div>
    `).join("");
  }

  _phaseRows(idx, prefix) {
    return ["l1", "l2", "l3"].map((phase) => `
      <tr>
        <td>${phase.toUpperCase()}</td>
        <td>${this._value(idx, `${prefix}_${phase}_v`)}</td>
        <td>${this._value(idx, `${prefix}_${phase}_a`)}</td>
        <td>${this._value(idx, `${prefix}_${phase}_w`)}</td>
      </tr>
    `).join("");
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

      const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
      if (missing.length) {
        throw new Error(`Нет нужных сущностей: ${missing.join(", ")}`);
      }

      const prefs = await this._hass.callWS({ type: "energy/get_prefs" });
      const short = this._short(this._selected);
      const marker = `[${short}]`;

      const preserved = (prefs.energy_sources || []).filter(
        (source) => !(source.name || "").includes(marker)
      );

      const sources = [
        {
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
        },
        {
          type: "solar",
          name: `Deye PV ${marker}`,
          stat_energy_from: required.pvEnergy,
          config_entry_solar_forecast: null,
        },
        {
          type: "solar",
          name: `Microinverter GEN ${marker}`,
          stat_energy_from: required.genEnergy,
          stat_rate: required.genPower,
          config_entry_solar_forecast: null,
        },
        {
          type: "battery",
          name: `Deye Battery ${marker}`,
          stat_energy_from: required.batteryDischarge,
          stat_energy_to: required.batteryCharge,
          power_config: { stat_rate: required.batteryPower },
          stat_soc: required.batterySoc,
        },
      ];

      await this._hass.callWS({
        type: "energy/save_prefs",
        energy_sources: [...preserved, ...sources],
        device_consumption: prefs.device_consumption || [],
        device_consumption_water: prefs.device_consumption_water || [],
      });

      this._energyMessage = "Energy Dashboard настроен: сеть, PV, GEN-микроинвертор и батарея.";
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

    if (!this._selected || !gateways.includes(this._selected)) {
      this._selected = gateways[0];
    }

    const idx = this._index(states, this._selected);
    const pvPower = this._sum(idx, ["pv1_w", "pv2_w", "pv3_w", "pv4_w"]);
    const genPower = this._number(idx, "gen_port_power_w");
    const loadPower = this._number(idx, "load_w");
    const gridPower = this._number(idx, "grid_w");
    const batteryPower = this._number(idx, "battery1_power_w");

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
          </div>
          <div class="actions">
            <label>Шлюз <select id="gateway">${options}</select></label>
            <button id="energy" ${this._energyBusy ? "disabled" : ""}>⚡ Настроить Energy</button>
          </div>
        </header>

        ${this._energyMessage ? `<div class="notice">${this._energyMessage}</div>` : ""}

        <section class="summary">
          ${this._card("DC PV", this._formatW(pvPower), "PV1–PV4", "☀️")}
          ${this._card("Микроинвертор", this._formatW(genPower), "через GEN порт", "🔌")}
          ${this._card("Нагрузка", this._formatW(loadPower), "дом", "🏠")}
          ${this._card("Сеть", this._formatW(gridPower), "импорт / экспорт", "🌐")}
          ${this._card("Батарея", this._value(idx, "battery1_soc_pct"), this._formatW(batteryPower), "🔋")}
        </section>

        <section class="card flow">
          <div class="node"><span>☀️</span><b>DC PV</b><strong>${this._formatW(pvPower)}</strong></div>
          <div class="arrow">→</div>
          <div class="node"><span>⚡</span><b>Инвертор</b><strong>${this._value(idx, "inverter_w")}</strong></div>
          <div class="arrow">→</div>
          <div class="node"><span>🏠</span><b>Нагрузка</b><strong>${this._formatW(loadPower)}</strong></div>
          <div class="node accent"><span>🔌</span><b>Microinverter / GEN</b><strong>${this._formatW(genPower)}</strong></div>
        </section>

        <div class="cols">
          <section class="card">
            <h2>☀️ DC солнечные панели</h2>
            <div class="pv-grid">${this._pv(idx)}</div>
            ${this._row("PV сегодня", this._value(idx, "pv_today_kwh"))}
            ${this._row("PV всего", this._value(idx, "total_pv_energy_kwh"))}
          </section>

          <section class="card micro">
            <h2>🔌 Микроинвертор на GEN-порту</h2>
            ${this._row("Режим GEN", this._value(idx, "gen_port_mode"))}
            ${this._row("L1 напряжение", this._value(idx, "gen_port_l1_voltage_v"))}
            ${this._row("L2 напряжение", this._value(idx, "gen_port_l2_voltage_v"))}
            ${this._row("L3 напряжение", this._value(idx, "gen_port_l3_voltage_v"))}
            ${this._row("L1 мощность", this._value(idx, "gen_port_l1_power_w"))}
            ${this._row("L2 мощность", this._value(idx, "gen_port_l2_power_w"))}
            ${this._row("L3 мощность", this._value(idx, "gen_port_l3_power_w"))}
            ${this._row("Мощность всего", this._value(idx, "gen_port_power_w"))}
            ${this._row("Энергия сегодня", this._value(idx, "gen_port_today_kwh"))}
            ${this._row("Энергия всего", this._value(idx, "gen_port_total_kwh"))}
          </section>
        </div>

        <div class="cols">
          <section class="card">
            <h2>🔋 Батарея</h2>
            ${this._row("SOC", this._value(idx, "battery1_soc_pct"))}
            ${this._row("Напряжение", this._value(idx, "battery1_voltage_v"))}
            ${this._row("Ток", this._value(idx, "battery1_current_a"))}
            ${this._row("Мощность", this._value(idx, "battery1_power_w"))}
            ${this._row("Температура", this._value(idx, "battery1_temperature_c"))}
            ${this._row("Заряд всего", this._value(idx, "battery_charge_total_kwh"))}
            ${this._row("Разряд всего", this._value(idx, "battery_discharge_total_kwh"))}
          </section>

          <section class="card">
            <h2>🌐 Сеть</h2>
            <table>
              <thead><tr><th>Фаза</th><th>V</th><th>A</th><th>W</th></tr></thead>
              <tbody>${this._phaseRows(idx, "grid")}</tbody>
            </table>
            ${this._row("Частота", this._value(idx, "grid_hz"))}
            ${this._row("Мощность", this._value(idx, "grid_w"))}
            ${this._row("Импорт всего", this._value(idx, "grid_import_total_kwh"))}
            ${this._row("Экспорт всего", this._value(idx, "grid_export_total_kwh"))}
          </section>
        </div>

        <section class="card energy">
          <h2>📊 Energy</h2>
          <div class="energy-cols">
            <div>
              <h3>Генерация</h3>
              ${this._row("DC PV сегодня", this._value(idx, "pv_today_kwh"))}
              ${this._row("DC PV всего", this._value(idx, "total_pv_energy_kwh"))}
              ${this._row("Microinverter сегодня", this._value(idx, "gen_port_today_kwh"))}
              ${this._row("Microinverter всего", this._value(idx, "gen_port_total_kwh"))}
            </div>
            <div>
              <h3>Сеть</h3>
              ${this._row("Импорт сегодня", this._value(idx, "grid_import_today_kwh"))}
              ${this._row("Импорт всего", this._value(idx, "grid_import_total_kwh"))}
              ${this._row("Экспорт сегодня", this._value(idx, "grid_export_today_kwh"))}
              ${this._row("Экспорт всего", this._value(idx, "grid_export_total_kwh"))}
            </div>
            <div>
              <h3>Батарея</h3>
              ${this._row("Заряд сегодня", this._value(idx, "battery_charge_today_kwh"))}
              ${this._row("Заряд всего", this._value(idx, "battery_charge_total_kwh"))}
              ${this._row("Разряд сегодня", this._value(idx, "battery_discharge_today_kwh"))}
              ${this._row("Разряд всего", this._value(idx, "battery_discharge_total_kwh"))}
            </div>
          </div>
        </section>

        <footer>MQTT: <code>${this._selected}</code></footer>
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
      :host { display:block; min-height:100%; background:var(--primary-background-color,#f5f6f8); color:var(--primary-text-color,#202124); font-family:system-ui,sans-serif; }
      * { box-sizing:border-box; }
      main { max-width:1400px; margin:auto; padding:22px; }
      header { display:flex; justify-content:space-between; align-items:end; gap:20px; margin-bottom:16px; }
      h1 { margin:2px 0 0; font-size:30px; }
      h2 { margin:0 0 14px; font-size:19px; }
      h3 { margin:0 0 8px; }
      .eyebrow { font-size:12px; opacity:.6; font-weight:700; }
      .actions { display:flex; align-items:end; gap:10px; }
      label { display:flex; flex-direction:column; gap:4px; font-size:12px; }
      select, button { border:1px solid var(--divider-color,#ddd); border-radius:10px; padding:10px 12px; background:var(--card-background-color,#fff); color:inherit; }
      button { cursor:pointer; font-weight:700; }
      button:disabled { opacity:.5; cursor:wait; }
      .notice { padding:11px 14px; border-radius:10px; margin-bottom:14px; background:var(--secondary-background-color,#eaf3ff); }
      .summary { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:14px; }
      .card { background:var(--card-background-color,#fff); border:1px solid var(--divider-color,rgba(0,0,0,.08)); border-radius:16px; padding:18px; box-shadow:0 2px 7px rgba(0,0,0,.03); }
      .metric { display:flex; gap:12px; align-items:center; min-height:96px; }
      .icon { font-size:27px; }
      .label,.sub { font-size:12px; opacity:.63; }
      .big { font-size:22px; font-weight:750; margin:3px 0; }
      .flow { display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
      .node { min-width:140px; padding:13px; border-radius:13px; background:var(--secondary-background-color,#f3f4f5); display:flex; flex-direction:column; align-items:center; gap:3px; }
      .node span { font-size:24px; }
      .node b { font-size:12px; opacity:.65; }
      .node strong { font-size:16px; }
      .accent { border:1px dashed var(--primary-color,#03a9f4); }
      .arrow { font-size:25px; opacity:.35; }
      .cols { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
      .pv-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:12px; }
      .mini { padding:12px; border-radius:11px; background:var(--secondary-background-color,#f3f4f5); display:flex; flex-direction:column; gap:4px; }
      .mini strong { font-size:18px; }
      .mini span { font-size:12px; opacity:.7; }
      .row { display:flex; justify-content:space-between; gap:15px; padding:8px 0; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      .row:last-child { border-bottom:0; }
      .row span { opacity:.72; }
      table { width:100%; border-collapse:collapse; margin-bottom:8px; }
      th,td { text-align:right; padding:8px 5px; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      th:first-child,td:first-child { text-align:left; }
      th { font-size:11px; opacity:.6; }
      .energy-cols { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
      footer { text-align:center; font-size:12px; opacity:.5; padding:16px; }
      @media(max-width:1000px){ .summary{grid-template-columns:repeat(2,1fr)} .cols,.energy-cols{grid-template-columns:1fr} }
      @media(max-width:620px){ main{padding:10px} header{flex-direction:column;align-items:stretch} .actions{flex-direction:column;align-items:stretch} .summary{grid-template-columns:1fr 1fr} .pv-grid{grid-template-columns:1fr 1fr} }
    `;
  }
}

if (!customElements.get("deye-sg05-panel")) {
  customElements.define("deye-sg05-panel", DeyeSg05Panel);
}
