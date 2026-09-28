class DeyeSg05Panel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._selected = null;
    this._energyMessage = "";
    this._energyBusy = false;
    this._showDetails = false;
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

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  _clickAttrs(entityId) {
    return entityId
      ? `data-entity="${entityId}" role="button" tabindex="0"`
      : "";
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

  _card(title, value, subtitle, icon, tone = "", entityId = null) {
    return `
      <div class="metric-card ${tone} ${entityId ? "clickable" : ""}" ${this._clickAttrs(entityId)}>
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

  _bmsPresent(idx, n) {
    const keys = [
      `bms${n}_soc_pct`,
      `bms${n}_voltage_v`,
      `bms${n}_temperature_c`,
      `bms${n}_charge_current_limit_a`,
      `bms${n}_discharge_current_limit_a`,
    ];
    return keys.some((key) => this._number(idx, key) !== null);
  }

  _bmsPanel(idx, n) {
    const present = this._bmsPresent(idx, n);
    if (!present) {
      return `
        <section class="card bms-panel bms-offline">
          <div class="bms-header">
            <h2>🧠 BMS ${n}</h2>
            <span class="status-chip offline">нет данных</span>
          </div>
          <div class="bms-empty">BMS ${n} не подключена или шлюз возвращает 0xFFFF.</div>
        </section>
      `;
    }

    const current = this._number(idx, `bms${n}_current_a`);
    const currentText = current === null
      ? "—"
      : `${current > 0 ? "+" : ""}${this._value(idx, `bms${n}_current_a`)}`;

    return `
      <section class="card bms-panel">
        <div class="bms-header">
          <h2>🧠 BMS ${n}</h2>
          <span class="status-chip online">данные есть</span>
        </div>
        <div class="bms-kpis">
          <div class="bms-kpi"><span>SOC</span><strong>${this._value(idx, `bms${n}_soc_pct`)}</strong></div>
          <div class="bms-kpi"><span>Напряжение</span><strong>${this._value(idx, `bms${n}_voltage_v`)}</strong></div>
          <div class="bms-kpi"><span>Ток</span><strong>${currentText}</strong></div>
          <div class="bms-kpi"><span>Температура</span><strong>${this._value(idx, `bms${n}_temperature_c`)}</strong></div>
        </div>
        <div class="rows">
          ${this._row("Порог напряжения заряда", this._value(idx, `bms${n}_charge_voltage_v`))}
          ${this._row("Порог напряжения разряда", this._value(idx, `bms${n}_discharge_voltage_v`))}
          ${this._row("Лимит тока заряда", this._value(idx, `bms${n}_charge_current_limit_a`))}
          ${this._row("Лимит тока разряда", this._value(idx, `bms${n}_discharge_current_limit_a`))}
          ${this._row("Макс. ток заряда", this._value(idx, `bms${n}_charge_max_current_a`))}
          ${this._row("Макс. ток разряда", this._value(idx, `bms${n}_discharge_max_current_a`))}
        </div>
      </section>
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
    const battery = this._number(idx, "battery_total_power_w") ?? this._sum(idx, ["battery1_power_w", "battery2_power_w"]);
    const load = this._number(idx, "load_w");
    const inverter = this._number(idx, "inverter_w");
    const soc = this._value(idx, "battery1_soc_pct");

    const pvEntity = this._entity(idx, "pv_total_w") || this._entity(idx, "pv1_w");
    const genEntity = this._entity(idx, "gen_port_power_w");
    const gridEntity = this._entity(idx, "grid_w");
    const batteryEntity = this._entity(idx, "battery_total_power_w") || this._entity(idx, "battery1_soc_pct");
    const loadEntity = this._entity(idx, "load_w");
    const inverterEntity = this._entity(idx, "inverter_w");

    const pvClass = pv !== null && Math.abs(pv) >= 5 ? "flow-active" : "flow-idle";
    const genClass = gen !== null && Math.abs(gen) >= 5 ? "flow-active" : "flow-idle";
    const loadClass = load !== null && Math.abs(load) >= 5 ? "flow-active" : "flow-idle";
    const gridClass = grid === null || Math.abs(grid) < 5
      ? "flow-idle"
      : grid > 0 ? "flow-active" : "flow-active reverse";
    const batteryClass = battery === null || Math.abs(battery) < 5
      ? "flow-idle"
      : battery > 0 ? "flow-active reverse" : "flow-active";

    const gridState = grid === null ? "—" : grid >= 0 ? "импорт" : "экспорт";
    const batteryState = battery === null || Math.abs(battery) < 5
      ? "ожидание"
      : battery > 0 ? "разряд" : "заряд";

    return `
      <section class="power-flow card">
        <div class="flow-title-row">
          <div>
            <h2>Потоки энергии</h2>
            <div class="flow-hint">Нажмите на узел, чтобы открыть его информацию в Home Assistant</div>
          </div>
          <div class="inverter-badge">DEYE</div>
        </div>

        <div class="cloud-flow">
          <svg class="cloud-lines" viewBox="0 0 900 390" preserveAspectRatio="none" aria-hidden="true">
            <path class="energy-path solar-path ${pvClass}" d="M 450 46 L 450 160" />
            <path class="energy-path grid-path ${gridClass}" d="M 180 160 L 450 160" />
            <path class="energy-path load-path ${loadClass}" d="M 450 160 L 720 160" />
            <path class="energy-path gen-path ${genClass}" d="M 252 270 C 320 235, 385 195, 450 160" />
            <path class="energy-path battery-path ${batteryClass}" d="M 450 160 C 525 195, 590 235, 648 270" />
          </svg>

          <div class="cloud-node pv-cloud clickable" ${this._clickAttrs(pvEntity)}>
            <div class="cloud-circle solar-circle">☀️</div>
            <div class="cloud-label">PV</div>
            <div class="cloud-value">${this._formatW(pv)}</div>
            <div class="cloud-sub">PV1–PV4</div>
          </div>

          <div class="cloud-node grid-cloud clickable" ${this._clickAttrs(gridEntity)}>
            <div class="cloud-circle grid-circle">🌐</div>
            <div class="cloud-label">Сеть</div>
            <div class="cloud-value">${this._formatSignedW(grid)}</div>
            <div class="cloud-sub">${gridState}</div>
          </div>

          <div class="cloud-node gen-cloud clickable" ${this._clickAttrs(genEntity)}>
            <div class="cloud-circle gen-circle">🔌</div>
            <div class="cloud-label">Microinverter / GEN</div>
            <div class="cloud-value">${this._formatW(gen)}</div>
            <div class="cloud-sub">GEN-порт</div>
          </div>

          <div class="cloud-node inverter-cloud clickable" ${this._clickAttrs(inverterEntity)}>
            <div class="cloud-circle inverter-circle">
              <div class="inverter-symbol">⚡</div>
              <div class="inverter-brand">DEYE</div>
            </div>
            <div class="cloud-label">Инвертор</div>
            <div class="cloud-value">${this._formatSignedW(inverter)}</div>
            <div class="cloud-sub">${this._value(idx, "inverter_hz")}</div>
          </div>

          <div class="cloud-node load-cloud clickable" ${this._clickAttrs(loadEntity)}>
            <div class="cloud-circle load-circle">🏠</div>
            <div class="cloud-label">Нагрузка</div>
            <div class="cloud-value">${this._formatW(load)}</div>
            <div class="cloud-sub">дом</div>
          </div>

          <div class="cloud-node battery-cloud clickable" ${this._clickAttrs(batteryEntity)}>
            <div class="cloud-circle battery-circle">🔋</div>
            <div class="cloud-label">Батарея</div>
            <div class="cloud-value">${soc}</div>
            <div class="cloud-sub">${batteryState} · ${this._formatSignedW(battery)}</div>
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
        batteryPower: this._entity(idx, "battery_total_power_w") || this._entity(idx, "battery1_power_w"),
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
    const battery = this._number(idx, "battery_total_power_w") ?? this._sum(idx, ["battery1_power_w", "battery2_power_w"]);
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
            <button id="details-toggle">${this._showDetails ? "▴ Скрыть детали" : "▾ Показать детали"}</button>
            <button id="energy" ${this._energyBusy ? "disabled" : ""}>⚡ Настроить Energy</button>
          </div>
        </header>

        ${this._energyMessage ? `<div class="notice">${this._energyMessage}</div>` : ""}

        <section class="summary-grid">
          ${this._card("DC PV", this._formatW(pv), "PV1–PV4", "☀️", "solar", this._entity(idx, "pv_total_w") || this._entity(idx, "pv1_w"))}
          ${this._card("Микроинвертор", this._formatW(gen), "через GEN-порт", "🔌", "gen", this._entity(idx, "gen_port_power_w"))}
          ${this._card("Нагрузка", this._formatW(load), "дом", "🏠", "load", this._entity(idx, "load_w"))}
          ${this._card("Сеть", this._formatSignedW(grid), grid !== null ? (grid >= 0 ? "импорт" : "экспорт") : "—", "🌐", "grid", this._entity(idx, "grid_w"))}
          ${this._card("Батарея", this._value(idx, "battery1_soc_pct"), this._formatSignedW(battery), "🔋", "battery", this._entity(idx, "battery1_soc_pct"))}
        </section>

        ${this._flowDiagram(idx)}

        <div class="details-area ${this._showDetails ? "" : "hidden"}">
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

        <section class="bms-section">
          <div class="section-heading">
            <div>
              <h2>🧠 Данные BMS</h2>
              <div class="section-subtitle">Учитываем обе BMS-шины; суммарный ток = BMS1 + BMS2</div>
            </div>
          </div>
          <div class="bms-total-strip"><span>Суммарный ток BMS</span><strong>${this._value(idx, "bms_total_current_a")}</strong><small>BMS1: ${this._value(idx, "bms1_current_a")} · BMS2: ${this._value(idx, "bms2_current_a")}</small></div>
          <div class="two-col bms-grid">
            ${this._bmsPanel(idx, 1)}
            ${this._bmsPanel(idx, 2)}
          </div>
        </section>

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

        </div>
        <footer>MQTT ID: <code>${this._selected}</code></footer>
      </main>
    `;

    this.shadowRoot.querySelector("#gateway")?.addEventListener("change", (event) => {
      this._selected = event.target.value;
      this._energyMessage = "";
      this._render();
    });

    this.shadowRoot.querySelector("#details-toggle")?.addEventListener("click", () => {
      this._showDetails = !this._showDetails;
      this._render();
    });

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((node) => {
      const open = () => this._moreInfo(node.dataset.entity);
      node.addEventListener("click", open);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
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
      .clickable { cursor:pointer; transition:transform .12s ease, filter .12s ease; }
      .clickable:hover { filter:brightness(1.03); }
      .cloud-node.clickable:hover { transform:translateX(-50%) translateY(-2px); }
      .clickable:focus-visible { outline:3px solid var(--primary-color,#03a9f4); outline-offset:3px; }
      .details-area.hidden { display:none; }
      .metric-card { min-height:105px; padding:17px; display:flex; gap:13px; align-items:center; }
      .metric-icon { font-size:28px; }
      .metric-title { font-size:12px; opacity:.63; }
      .metric-value { font-size:23px; font-weight:780; margin:3px 0; white-space:nowrap; }
      .metric-subtitle { font-size:12px; opacity:.62; }
      .power-flow { padding:18px; margin-bottom:14px; overflow:hidden; }
      .flow-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:8px; }
      .flow-title-row h2 { margin-bottom:3px; }
      .flow-hint { font-size:11px; opacity:.56; }
      .inverter-badge {
        font-size:11px;
        font-weight:800;
        letter-spacing:.08em;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(47,143,229,.1);
        color:#2f8fe5;
      }
      .cloud-flow {
        position:relative;
        height:390px;
        max-width:920px;
        margin:0 auto;
      }
      .cloud-lines {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        z-index:0;
        overflow:visible;
      }
      .energy-path {
        fill:none;
        stroke:var(--divider-color,#d3d8dc);
        stroke-width:4;
        stroke-linecap:round;
        vector-effect:non-scaling-stroke;
      }
      .energy-path.flow-active {
        stroke:#42a5f5;
        stroke-dasharray:10 10;
        animation:flowDash 1.05s linear infinite;
      }
      .energy-path.reverse {
        animation-direction:reverse;
        stroke:#ff9800;
      }
      .energy-path.flow-idle {
        opacity:.42;
      }
      @keyframes flowDash {
        to { stroke-dashoffset:-20; }
      }
      .cloud-node {
        position:absolute;
        z-index:2;
        width:150px;
        transform:translateX(-50%);
        text-align:center;
      }
      .cloud-circle {
        width:72px;
        height:72px;
        margin:0 auto 7px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:var(--card-background-color,#fff);
        border:3px solid var(--divider-color,#d7dce0);
        box-shadow:0 4px 14px rgba(0,0,0,.06);
        font-size:26px;
      }
      .solar-circle { border-color:#f9a825; }
      .grid-circle { border-color:#42a5f5; }
      .load-circle { border-color:#546e7a; }
      .battery-circle { border-color:#26a69a; }
      .gen-circle { border-color:#7e57c2; }
      .inverter-circle {
        width:104px;
        height:104px;
        border-radius:22px;
        border:3px solid #2f8fe5;
        background:linear-gradient(180deg,var(--card-background-color,#fff),var(--secondary-background-color,#f2f5f7));
        flex-direction:column;
        gap:2px;
      }
      .inverter-symbol { font-size:30px; line-height:1; }
      .inverter-brand { font-size:12px; font-weight:900; letter-spacing:.12em; color:#2f8fe5; }
      .cloud-label { font-size:12px; opacity:.68; }
      .cloud-value { font-size:17px; line-height:1.15; font-weight:800; margin-top:3px; }
      .cloud-sub { font-size:11px; opacity:.58; margin-top:3px; white-space:nowrap; }
      .pv-cloud { left:50%; top:10px; }
      .grid-cloud { left:20%; top:124px; }
      .inverter-cloud { left:50%; top:108px; }
      .load-cloud { left:80%; top:124px; }
      .gen-cloud { left:28%; top:240px; }
      .battery-cloud { left:72%; top:240px; }

      .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
      .card { padding:19px; }
      .gen-panel { border-top:3px solid var(--primary-color,#03a9f4); }
      .bms-section { margin-bottom:14px; }
      .section-heading { display:flex; justify-content:space-between; align-items:end; margin:0 2px 10px; }
      .section-heading h2 { margin:0; }
      .section-subtitle { font-size:12px; opacity:.58; margin-top:3px; }
      .bms-grid { margin-bottom:0; }
      .bms-total-strip { display:flex; align-items:baseline; gap:12px; padding:10px 12px; margin-bottom:10px; border-radius:12px; background:var(--secondary-background-color,#f1f2f3); }
      .bms-total-strip span { font-size:12px; opacity:.68; }
      .bms-total-strip strong { font-size:20px; }
      .bms-total-strip small { margin-left:auto; opacity:.58; }
      .bms-panel { border-top:3px solid #7b61ff; }
      .bms-offline { opacity:.72; border-top-color:var(--divider-color,#cfd2d4); }
      .bms-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      .bms-header h2 { margin:0; }
      .status-chip { font-size:11px; font-weight:750; padding:5px 8px; border-radius:999px; }
      .status-chip.online { background:rgba(49,163,84,.12); color:#238443; }
      .status-chip.offline { background:var(--secondary-background-color,#eef0f2); color:var(--secondary-text-color,#777); }
      .bms-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
      .bms-kpi { background:var(--secondary-background-color,#f1f2f3); border-radius:11px; padding:10px; display:flex; flex-direction:column; gap:4px; }
      .bms-kpi span { font-size:11px; opacity:.62; }
      .bms-kpi strong { font-size:17px; }
      .bms-empty { padding:18px; text-align:center; opacity:.62; background:var(--secondary-background-color,#f1f2f3); border-radius:12px; }
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
        .cloud-flow { height:390px; max-width:820px; }
        .cloud-node { width:138px; }
        .grid-cloud { left:18%; top:124px; }
        .inverter-cloud { left:50%; top:108px; }
        .load-cloud { left:82%; top:124px; }
        .gen-cloud { left:27%; top:240px; }
        .battery-cloud { left:73%; top:240px; }
      }
      @media(max-width:800px) {
        main { padding:11px; }
        header { flex-direction:column; align-items:stretch; }
        .actions { align-items:stretch; flex-wrap:wrap; }
        .actions label { flex:1 1 100%; }
        select { width:100%; }
        .two-col,.energy-grid { grid-template-columns:1fr; }
        .cloud-flow { height:390px; max-width:100%; }
        .cloud-circle { width:64px; height:64px; font-size:23px; }
        .inverter-circle { width:94px; height:94px; }
        .cloud-node { width:122px; }
        .pv-cloud { left:50%; top:10px; }
        .grid-cloud { left:19%; top:126px; }
        .inverter-cloud { left:50%; top:110px; }
        .load-cloud { left:81%; top:126px; }
        .gen-cloud { left:27%; top:242px; }
        .battery-cloud { left:73%; top:242px; }
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
