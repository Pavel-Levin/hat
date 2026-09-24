class DeyeSg05Panel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._selected = null;
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

  _allDeyeStates() {
    if (!this._hass) return [];
    return Object.values(this._hass.states).filter(
      (state) =>
        state.attributes &&
        state.attributes.gateway_id &&
        state.attributes.metric_key
    );
  }

  _gateways(states) {
    return [...new Set(states.map((s) => s.attributes.gateway_id))].sort();
  }

  _index(states, gateway) {
    const out = {};
    for (const state of states) {
      if (state.attributes.gateway_id === gateway) {
        out[state.attributes.metric_key] = state;
      }
    }
    return out;
  }

  _shortId(gateway) {
    return (gateway || "").replace("id-nsg-v0.1-", "");
  }

  _state(idx, key) {
    return idx[key] || null;
  }

  _value(idx, key, fallback = "—") {
    const state = this._state(idx, key);
    if (!state || state.state === "unknown" || state.state === "unavailable") {
      return fallback;
    }
    const unit = state.attributes.unit_of_measurement || "";
    const num = Number(state.state);
    let value = state.state;
    if (Number.isFinite(num)) {
      const abs = Math.abs(num);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      value = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
      }).format(num);
    }
    return unit ? `${value} ${unit}` : value;
  }

  _number(idx, key) {
    const state = this._state(idx, key);
    if (!state) return null;
    const value = Number(state.state);
    return Number.isFinite(value) ? value : null;
  }

  _sum(idx, keys) {
    const values = keys.map((key) => this._number(idx, key));
    if (values.every((v) => v === null)) return null;
    return values.reduce((sum, v) => sum + (v || 0), 0);
  }

  _formatW(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(2)} kW`;
    }
    return `${Math.round(value)} W`;
  }

  _card(title, value, subtitle = "", icon = "⚡", cls = "") {
    return `
      <div class="metric-card ${cls}">
        <div class="metric-icon">${icon}</div>
        <div>
          <div class="metric-title">${title}</div>
          <div class="metric-value">${value}</div>
          ${subtitle ? `<div class="metric-subtitle">${subtitle}</div>` : ""}
        </div>
      </div>
    `;
  }

  _row(label, value) {
    return `
      <div class="row">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  _phaseTable(idx, prefix, includePower = true) {
    const rows = ["l1", "l2", "l3"].map((phase) => {
      const p = phase.toUpperCase();
      const voltage = this._value(idx, `${prefix}_${phase}_v`);
      const current = this._value(idx, `${prefix}_${phase}_a`);
      const power = includePower ? this._value(idx, `${prefix}_${phase}_w`) : "—";
      return `
        <tr>
          <td>${p}</td>
          <td>${voltage}</td>
          <td>${current}</td>
          ${includePower ? `<td>${power}</td>` : ""}
        </tr>
      `;
    }).join("");
    return `
      <table>
        <thead>
          <tr>
            <th>Фаза</th><th>Напряжение</th><th>Ток</th>
            ${includePower ? "<th>Мощность</th>" : ""}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  _pvCards(idx) {
    return [1,2,3,4].map((n) => {
      const power = this._value(idx, `pv${n}_w`);
      const voltage = this._value(idx, `pv${n}_v`);
      const current = this._value(idx, `pv${n}_a`);
      return `
        <div class="mini-card">
          <div class="mini-title">PV${n}</div>
          <div class="mini-power">${power}</div>
          <div class="mini-line">${voltage}</div>
          <div class="mini-line">${current}</div>
        </div>
      `;
    }).join("");
  }

  _render() {
    if (!this.shadowRoot) return;
    const states = this._allDeyeStates();
    const gateways = this._gateways(states);

    if (!gateways.length) {
      this.shadowRoot.innerHTML = `
        <style>${this._styles()}</style>
        <div class="page">
          <div class="empty">
            <h2>Deye Dashboard</h2>
            <p>Ожидаю данные Deye MQTT…</p>
            <p>После появления сенсоров панель заполнится автоматически.</p>
          </div>
        </div>
      `;
      return;
    }

    if (!this._selected || !gateways.includes(this._selected)) {
      this._selected = gateways[0];
    }

    const idx = this._index(states, this._selected);
    const pvPower = this._sum(idx, ["pv1_w", "pv2_w", "pv3_w", "pv4_w"]);
    const batteryPower = this._number(idx, "battery1_power_w");
    const gridPower = this._number(idx, "grid_w");
    const loadPower = this._number(idx, "load_w");
    const inverterPower = this._number(idx, "inverter_w");

    const options = gateways.map((gateway) =>
      `<option value="${gateway}" ${gateway === this._selected ? "selected" : ""}>
        ${this._shortId(gateway)}
      </option>`
    ).join("");

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="page">
        <header>
          <div>
            <div class="eyebrow">DEYE SUN-20K-SG05LP3-EU-SM2</div>
            <h1>Deye Dashboard</h1>
          </div>
          <label class="device-select">
            <span>Шлюз</span>
            <select id="gateway-select">${options}</select>
          </label>
        </header>

        <section class="summary-grid">
          ${this._card("PV", this._formatW(pvPower), "Сумма PV1–PV4", "☀️", "solar")}
          ${this._card("Нагрузка", this._formatW(loadPower), "Дом", "🏠", "load")}
          ${this._card("Сеть", this._formatW(gridPower), "Импорт / экспорт", "🌐", "grid")}
          ${this._card("Батарея", this._value(idx, "battery1_soc_pct"), this._formatW(batteryPower), "🔋", "battery")}
          ${this._card("Инвертор", this._formatW(inverterPower), this._value(idx, "inverter_hz"), "⚡", "inverter")}
        </section>

        <section class="flow-card">
          <div class="flow-node solar-node"><span>☀️</span><b>PV</b><strong>${this._formatW(pvPower)}</strong></div>
          <div class="arrow">→</div>
          <div class="flow-node home-node"><span>🏠</span><b>Нагрузка</b><strong>${this._formatW(loadPower)}</strong></div>
          <div class="flow-branch">
            <div class="flow-node battery-node"><span>🔋</span><b>Батарея</b><strong>${this._value(idx, "battery1_soc_pct")}</strong><small>${this._formatW(batteryPower)}</small></div>
            <div class="flow-node grid-node"><span>🌐</span><b>Сеть</b><strong>${this._formatW(gridPower)}</strong></div>
          </div>
        </section>

        <div class="two-col">
          <section class="panel">
            <h2>☀️ Солнечные панели</h2>
            <div class="mini-grid">${this._pvCards(idx)}</div>
            <div class="rows">
              ${this._row("Генерация сегодня", this._value(idx, "pv_today_kwh"))}
              ${this._row("Генерация всего", this._value(idx, "total_pv_energy_kwh"))}
            </div>
          </section>

          <section class="panel">
            <h2>🔋 Батарея 1</h2>
            <div class="rows">
              ${this._row("SOC", this._value(idx, "battery1_soc_pct"))}
              ${this._row("Напряжение", this._value(idx, "battery1_voltage_v"))}
              ${this._row("Ток", this._value(idx, "battery1_current_a"))}
              ${this._row("Мощность", this._value(idx, "battery1_power_w"))}
              ${this._row("Температура", this._value(idx, "battery1_temperature_c"))}
              ${this._row("Ёмкость", this._value(idx, "battery_corrected_ah"))}
            </div>
          </section>
        </div>

        <div class="two-col">
          <section class="panel">
            <h2>🌐 Сеть</h2>
            ${this._phaseTable(idx, "grid")}
            <div class="rows">
              ${this._row("Частота", this._value(idx, "grid_hz"))}
              ${this._row("Общая мощность", this._value(idx, "grid_w"))}
            </div>
          </section>

          <section class="panel">
            <h2>🏠 Нагрузка</h2>
            <table>
              <thead><tr><th>Фаза</th><th>Напряжение</th><th>Мощность</th></tr></thead>
              <tbody>
                <tr><td>L1</td><td>${this._value(idx, "load_l1_v")}</td><td>${this._value(idx, "load_l1_w")}</td></tr>
                <tr><td>L2</td><td>${this._value(idx, "load_l2_v")}</td><td>${this._value(idx, "load_l2_w")}</td></tr>
                <tr><td>L3</td><td>${this._value(idx, "load_l3_v")}</td><td>${this._value(idx, "load_l3_w")}</td></tr>
              </tbody>
            </table>
            <div class="rows">
              ${this._row("Частота", this._value(idx, "load_hz"))}
              ${this._row("Общая мощность", this._value(idx, "load_w"))}
            </div>
          </section>
        </div>

        <section class="panel">
          <h2>📊 Энергия</h2>
          <div class="energy-grid">
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
            <div>
              <h3>Дом / PV</h3>
              ${this._row("Нагрузка сегодня", this._value(idx, "load_today_kwh"))}
              ${this._row("Нагрузка всего", this._value(idx, "load_total_kwh"))}
              ${this._row("PV сегодня", this._value(idx, "pv_today_kwh"))}
              ${this._row("PV всего", this._value(idx, "total_pv_energy_kwh"))}
            </div>
          </div>
        </section>

        <div class="two-col">
          <section class="panel">
            <h2>⚡ Инвертор</h2>
            <div class="rows">
              ${this._row("Мощность", this._value(idx, "inverter_w"))}
              ${this._row("Частота", this._value(idx, "inverter_hz"))}
              ${this._row("L1 напряжение", this._value(idx, "inverter_l1_v"))}
              ${this._row("L2 напряжение", this._value(idx, "inverter_l2_v"))}
              ${this._row("L3 напряжение", this._value(idx, "inverter_l3_v"))}
              ${this._row("Радиатор", this._value(idx, "heatsink_temperature_c"))}
              ${this._row("DC трансформатор", this._value(idx, "dc_transformer_temperature_c"))}
            </div>
          </section>

          <section class="panel">
            <h2>🔌 GEN порт</h2>
            <div class="rows">
              ${this._row("Режим", this._value(idx, "gen_port_mode"))}
              ${this._row("Мощность", this._value(idx, "gen_port_power_w"))}
              ${this._row("Энергия сегодня", this._value(idx, "gen_port_today_kwh"))}
              ${this._row("Энергия всего", this._value(idx, "gen_port_total_kwh"))}
              ${this._row("Время сегодня", this._value(idx, "gen_port_work_today_h"))}
              ${this._row("Время всего", this._value(idx, "gen_port_total_work_h"))}
            </div>
          </section>
        </div>

        <footer>
          MQTT ID: <code>${this._selected}</code>
        </footer>
      </div>
    `;

    const select = this.shadowRoot.querySelector("#gateway-select");
    if (select) {
      select.addEventListener("change", (event) => {
        this._selected = event.target.value;
        this._render();
      });
    }
  }

  _styles() {
    return `
      :host {
        display: block;
        min-height: 100%;
        background: var(--primary-background-color, #f4f6f8);
        color: var(--primary-text-color, #202124);
        font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
      }
      * { box-sizing: border-box; }
      .page { max-width: 1400px; margin: 0 auto; padding: 24px; }
      header { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-bottom:20px; }
      h1 { margin:3px 0 0; font-size:30px; }
      h2 { margin:0 0 16px; font-size:20px; }
      h3 { margin:0 0 10px; font-size:15px; }
      .eyebrow { font-size:12px; font-weight:700; opacity:.62; letter-spacing:.08em; }
      .device-select { display:flex; flex-direction:column; gap:5px; font-size:12px; opacity:.9; }
      select { min-width:210px; padding:10px 12px; border-radius:10px; border:1px solid var(--divider-color,#ddd); background:var(--card-background-color,#fff); color:inherit; }
      .summary-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; margin-bottom:16px; }
      .metric-card, .panel, .flow-card {
        background:var(--card-background-color,#fff);
        border:1px solid var(--divider-color,rgba(0,0,0,.08));
        border-radius:16px;
        box-shadow:0 2px 8px rgba(0,0,0,.035);
      }
      .metric-card { padding:16px; display:flex; gap:12px; align-items:center; min-height:102px; }
      .metric-icon { font-size:27px; }
      .metric-title { font-size:12px; opacity:.66; margin-bottom:4px; }
      .metric-value { font-size:23px; font-weight:750; white-space:nowrap; }
      .metric-subtitle { font-size:12px; opacity:.62; margin-top:3px; }
      .flow-card { padding:20px; display:flex; align-items:center; justify-content:center; gap:18px; margin-bottom:16px; }
      .flow-node { min-width:135px; text-align:center; border-radius:14px; padding:14px; background:var(--secondary-background-color,#f6f7f8); display:flex; flex-direction:column; gap:4px; }
      .flow-node span { font-size:25px; }
      .flow-node b { font-size:12px; opacity:.66; }
      .flow-node strong { font-size:17px; }
      .flow-node small { opacity:.7; }
      .flow-branch { display:flex; gap:12px; }
      .arrow { font-size:27px; opacity:.38; }
      .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
      .panel { padding:20px; }
      .mini-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
      .mini-card { background:var(--secondary-background-color,#f6f7f8); padding:13px; border-radius:12px; }
      .mini-title { font-weight:700; font-size:13px; opacity:.68; }
      .mini-power { font-size:19px; font-weight:750; margin:5px 0; }
      .mini-line { font-size:12px; opacity:.72; }
      .rows { display:flex; flex-direction:column; gap:0; }
      .row { display:flex; justify-content:space-between; gap:16px; padding:9px 0; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      .row:last-child { border-bottom:none; }
      .row span { opacity:.72; }
      .row strong { text-align:right; }
      table { width:100%; border-collapse:collapse; margin-bottom:8px; }
      th, td { padding:9px 7px; text-align:right; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.07)); }
      th:first-child, td:first-child { text-align:left; }
      th { font-size:11px; text-transform:uppercase; opacity:.55; }
      .energy-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; }
      footer { text-align:center; opacity:.55; padding:18px 0 4px; font-size:12px; }
      code { font-family:monospace; }
      .empty { max-width:560px; margin:70px auto; background:var(--card-background-color,#fff); padding:28px; border-radius:16px; text-align:center; }
      @media (max-width: 1000px) {
        .summary-grid { grid-template-columns:repeat(2,1fr); }
        .two-col { grid-template-columns:1fr; }
        .energy-grid { grid-template-columns:1fr; }
        .flow-card { flex-wrap:wrap; }
      }
      @media (max-width: 620px) {
        .page { padding:12px; }
        header { align-items:stretch; flex-direction:column; }
        select { width:100%; }
        .summary-grid { grid-template-columns:1fr 1fr; gap:8px; }
        .metric-card { min-height:88px; padding:12px; }
        .metric-value { font-size:18px; }
        .mini-grid { grid-template-columns:1fr 1fr; }
        .flow-branch { width:100%; flex-direction:column; }
        .flow-node { flex:1; width:100%; }
        .arrow { transform:rotate(90deg); }
      }
    `;
  }
}

if (!customElements.get("deye-sg05-panel")) {
  customElements.define("deye-sg05-panel", DeyeSg05Panel);
}
