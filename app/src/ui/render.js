// Render de las vistas del reporte. Funciones puras que devuelven HTML
// (salvo la configuración, que se cablea por delegación en app.js).

import { fmtDay, isWeekend } from "../core/index.js";
import { icon } from "./icons.js";
import { barList, donut, chartCard, lineChart } from "./charts.js";
import { COUNTRIES } from "../data/holidays.js";
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const f2 = (n) => Number(n).toFixed(2);
const f4 = (n) => Number(n).toFixed(4);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Encabezado estándar de cada sección (título + subtítulo + zona derecha). */
function pageHeader(ic, title, subtitle, right = "") {
  return (
    `<div class="pagehead"><div>` +
    `<h2 class="pagetitle">${ic} ${esc(title)}</h2>` +
    (subtitle ? `<p class="pagesub">${subtitle}</p>` : "") +
    `</div>${right ? `<div class="pagehead-right">${right}</div>` : ""}</div>`
  );
}

/** Semáforo de "¿lista para entregar?" con lo que falta por resolver. */
export function renderBanner(R) {
  const fijosFuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const sinRoster = R.issues.filter((i) => / no está en Equipos$/.test(i.tipo)).length;
  const jobCodes = R.issues.filter((i) => /^Job Code .* no existe/.test(i.tipo)).length;
  const bloqueos = fijosFuera + sinRoster;

  if (bloqueos === 0) {
    const extra = jobCodes ? ` Revisa ${jobCodes} Job Code(s) desconocido(s) antes de entregar.` : "";
    return `<div class="banner ok" role="status">${icon.check()}<div><strong>Lista para entregar.</strong> Ningún recurso fijo fuera de rango.${extra}</div></div>`;
  }
  const partes = [];
  if (fijosFuera) partes.push(`${fijosFuera} recurso(s) fijo(s) fuera de rango`);
  if (sinRoster) partes.push(`${sinRoster} persona(s) sin equipo`);
  if (jobCodes) partes.push(`${jobCodes} Job Code(s) desconocido(s)`);
  return `<div class="banner" role="alert">${icon.alert()}<div><strong>Falta revisar:</strong> ${partes.join(" · ")}.</div></div>`;
}

export function renderStats(R) {
  const fijosFuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const onDemandHoras = R.validation.filter((v) => v.tipo === "On demand").reduce((s, v) => s + v.total, 0);
  const horasPM = R.pm.reduce((s, p) => s + p.horasPM, 0);
  const cards = [
    [icon.calendar(), esc(R.label), "Semana", false],
    [icon.rows(), R.dev.length, "Registros DEV", false],
    [icon.users(), R.validation.length, "Personas", false],
    [icon.alert(), fijosFuera, "Fijos fuera de rango", fijosFuera > 0],
    [icon.clock(), f2(onDemandHoras), "Horas on demand", false],
    [icon.userClock(), f2(horasPM), "Horas PM", false],
    [icon.alert(), R.issues.length, "Incidencias", R.issues.length > 0],
  ];
  return cards
    .map(
      ([ic, val, label, bad]) =>
        `<div class="stat ${bad ? "bad" : ""}"><div class="si">${ic}</div><div><b>${val}</b><span>${esc(label)}</span></div></div>`
    )
    .join("");
}

export function filterValidation(R, filter = {}) {
  const q = (filter.q || "").trim().toLowerCase();
  const solo = !!filter.soloProblemas;
  return R.validation.filter((v) => {
    if (solo && !(v.tipo === "Fijo" && v.estado !== "OK")) return false;
    if (q && !(v.dev.toLowerCase().includes(q) || v.equipo.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Tabla de validación (solo el cuerpo filtrable, sin el toolbar). */
export function validationTable(R, filtered) {
  if (filtered.length === 0) return `<div class="empty">Sin resultados para el filtro.</div>`;
  const days = R.days;
  const holidays = new Set(R.holidays || []);
  const names = R.holidayNames || {};

  const head =
    `<thead><tr><th>Recurso</th><th>Tipo</th>` +
    days
      .map((d) => {
        const shaded = isWeekend(d) || holidays.has(d);
        const title = holidays.has(d) ? ` title="${esc(names[d] || "Feriado")}"` : "";
        const mark = holidays.has(d) ? " *" : "";
        return `<th class="n ${shaded ? "wk" : ""}"${title}>${esc(fmtDay(d))}${mark}</th>`;
      })
      .join("") +
    `<th class="n">Total</th><th>Estado</th></tr></thead>`;

  const rowsByTeam = {};
  for (const v of filtered) (rowsByTeam[v.equipo] ||= []).push(v);

  let body = "";
  for (const team of Object.keys(rowsByTeam)) {
    body += `<tr class="grp"><td colspan="${days.length + 4}">${esc(team)}</td></tr>`;
    for (const v of rowsByTeam[team]) {
      const cells = days
        .map((d) => {
          const h = v.perDay[d] || 0;
          const shaded = isWeekend(d) || holidays.has(d);
          const redDay = v.tipo === "Fijo" && !shaded && (round2(h) < R.params.minDia || round2(h) > R.params.maxDia);
          const cls = redDay ? "n bad" : shaded ? "n wk" : "n";
          return `<td class="${cls}">${h ? f2(h) : shaded ? "" : "0"}</td>`;
        })
        .join("");
      const chip =
        v.tipo === "On demand"
          ? `<span class="chip od">${esc(v.estado)}</span>`
          : v.estado === "OK"
          ? `<span class="chip ok">${icon.check(14)} OK</span>`
          : `<span class="chip bad">${icon.alert(14)} ${esc(v.estado)}</span>`;
      body += `<tr><td>${esc(v.dev)}</td><td>${esc(v.tipo)}</td>${cells}<td class="n">${f2(v.total)}</td><td>${chip}</td></tr>`;
    }
  }
  return `<div class="scroll"><table class="sortable">${head}<tbody>${body}</tbody></table></div>`;
}

/** Página Resumen: semáforo + KPIs + gráficos. */
export function renderOverview(R) {
  const ok = R.validation.filter((v) => v.tipo !== "On demand" && v.estado === "OK").length;
  const fuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const od = R.validation.filter((v) => v.tipo === "On demand").length;

  const estado = donut(
    [
      { label: "OK", value: ok, color: "#1e7b4a" },
      { label: "Fuera de rango", value: fuera, color: "#a8381f" },
      { label: "On demand", value: od, color: "#9aa5b1" },
    ],
    { centerValue: R.validation.length, centerLabel: "personas" }
  );

  const pmByTeam = {};
  for (const p of R.pm) pmByTeam[p.equipo] = (pmByTeam[p.equipo] || 0) + p.horasPM;
  const pmBars = barList(
    Object.entries(pmByTeam).map(([label, value]) => ({ label, value })),
    { unit: " h", decimals: 2 }
  );

  const hByTeam = {};
  for (const d of R.dev) hByTeam[d.equipo] = (hByTeam[d.equipo] || 0) + d.hrs;
  const hBars = barList(
    Object.entries(hByTeam).map(([label, value]) => ({ label, value })),
    { unit: " h", decimals: 0 }
  );

  return (
    pageHeader(icon.trending(18), "Resumen", `Semana ${esc(R.label)} · ${R.dev.length} registros`) +
    renderBanner(R) +
    `<div class="stats">${renderStats(R)}</div>` +
    `<div class="charts">` +
    chartCard("Estado de los recursos", estado, icon.users(16)) +
    chartCard("Horas PM por equipo", pmBars, icon.userClock(16)) +
    chartCard("Horas registradas por equipo", hBars, icon.briefcase(16)) +
    `</div>`
  );
}

/** Página Tendencia: compara métricas entre las semanas detectadas. */
export function renderTrend(summaries) {
  const header = pageHeader(icon.trending(18), "Tendencia", "Comparación entre las semanas detectadas en los datos.");
  if (!summaries || summaries.length <= 1) {
    return `${header}<div class="empty">Carga datos con más de una semana para ver la comparación.</div>`;
  }

  const head =
    `<thead><tr><th>Semana</th><th class="n">Personas</th><th class="n">Fijos fuera</th>` +
    `<th class="n">Horas registradas</th><th class="n">Horas PM</th><th class="n">Incidencias</th></tr></thead>`;
  const body = summaries
    .map(
      (s) =>
        `<tr><td>${esc(s.label)}</td><td class="n">${s.personas}</td>` +
        `<td class="n ${s.fuera ? "bad" : ""}">${s.fuera}</td><td class="n">${f2(s.horas)}</td>` +
        `<td class="n">${f2(s.horasPM)}</td><td class="n ${s.incidencias ? "bad" : ""}">${s.incidencias}</td></tr>`
    )
    .join("");

  const pts = (key, dec = 0) => summaries.map((s) => ({ label: s.label, value: s[key] }));
  const charts =
    `<div class="charts">` +
    chartCard("Horas PM por semana", lineChart(pts("horasPM"), { unit: " h", decimals: 2, color: "#2e6f9e" }), icon.userClock(16)) +
    chartCard("Fijos fuera de rango por semana", lineChart(pts("fuera"), { color: "#a8381f" }), icon.alert(16)) +
    chartCard("Incidencias por semana", lineChart(pts("incidencias"), { color: "#d98324" }), icon.alert(16)) +
    `</div>`;

  return `${header}${charts}<div class="scroll"><table class="sortable">${head}<tbody>${body}</tbody></table></div>`;
}

export function renderValidation(R, filter = {}) {
  if (R.validation.length === 0) return `<div class="empty">Sin personas en el rango.</div>`;
  const names = R.holidayNames || {};
  const filtered = filterValidation(R, filter);

  const toolbar =
    `<div class="toolbar">` +
    `<div class="searchbox">${icon.search()}<input id="valSearch" type="search" placeholder="Buscar persona o equipo" value="${esc(filter.q || "")}"></div>` +
    `<label class="toggle"><input id="valSolo" type="checkbox" ${filter.soloProblemas ? "checked" : ""}> Solo fuera de rango</label>` +
    `<span class="count" id="valCount">${filtered.length} de ${R.validation.length}</span>` +
    `</div>`;

  const nota =
    (R.holidays || []).length > 0
      ? `<p class="note">* Feriado (no cuenta como día hábil): ${R.holidays
          .map((d) => `${esc(fmtDay(d))} ${esc(names[d] || "")}`)
          .join(" · ")}.</p>`
      : "";

  const ok = R.validation.filter((v) => v.tipo !== "On demand" && v.estado === "OK").length;
  const fuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const od = R.validation.filter((v) => v.tipo === "On demand").length;
  const chips =
    `<div class="sumchips">` +
    `<span class="sumchip ok">${icon.check(14)} <b>${ok}</b> OK</span>` +
    `<span class="sumchip ${fuera ? "bad" : ""}">${icon.alert(14)} <b>${fuera}</b> fuera de rango</span>` +
    `<span class="sumchip">${icon.clock(14)} <b>${od}</b> on demand</span>` +
    `</div>`;
  const header = pageHeader(icon.check(18), "Validación de horas", `${R.validation.length} personas · semana ${esc(R.label)}`, chips);

  return `${header}${nota}${toolbar}<div id="valBody">${validationTable(R, filtered)}</div>`;
}

export function renderPM(R) {
  if (R.pm.length === 0) return `${pageHeader(icon.userClock(18), "Horas del PM", "")}<div class="empty">Sin horas de PM en el rango.</div>`;

  // Resumen por equipo.
  const byTeam = {};
  for (const p of R.pm) {
    const t = (byTeam[p.equipo] ||= { equipo: p.equipo, pm: p.pm, horas: 0, dias: 0, tareas: 0 });
    t.horas += p.horasPM;
    if (p.horasPM > 0) t.dias++;
    t.tareas += p.tareas;
  }
  const totalPM = R.pm.reduce((s, p) => s + p.horasPM, 0);
  const cards = Object.values(byTeam)
    .map(
      (t) =>
        `<div class="teamcard"><h4>${icon.briefcase(14)} ${esc(t.equipo)}</h4>` +
        `<div class="big">${f2(t.horas)}<small> h PM</small></div>` +
        `<div class="meta">${esc(t.pm)} · ${t.dias} día(s) · ${t.tareas} tareas</div></div>`
    )
    .join("");
  const header = pageHeader(icon.userClock(18), "Horas del PM", `${f2(totalPM)} h repartidas por equipo y día hábil`);

  const head =
    `<thead><tr><th>Equipo</th><th>Día</th><th>PM</th><th class="n">DEVs fijos</th><th class="n">Horas fijos</th>` +
    `<th class="n">Promedio</th><th class="n">Horas PM</th><th class="n">Tareas</th><th class="n">Por tarea</th></tr></thead>`;
  let body = "";
  for (const p of R.pm) {
    body +=
      `<tr><td>${esc(p.equipo)}</td><td>${esc(fmtDay(p.date))}</td><td>${esc(p.pm)}</td>` +
      `<td class="n">${p.devsFijos}</td><td class="n">${f2(p.horasFijos)}</td><td class="n">${f2(p.prom)}</td>` +
      `<td class="n"><b>${p.horasPM}</b></td><td class="n">${p.tareas}</td><td class="n">${p.tareas ? f4(p.porTarea) : "–"}</td></tr>`;
  }
  return `${header}<div class="teamcards">${cards}</div><div class="scroll"><table class="sortable">${head}<tbody>${body}</tbody></table></div>`;
}

export function renderTasks(R, opts = {}) {
  const showAll = !!opts.showAll;
  const isMeeting = (d) => {
    const c = d.client.toUpperCase();
    return c === "RKD MTG" || c === "RKD MTGINT";
  };
  const rows = R.dev.filter((d) => showAll || isMeeting(d));
  const header = pageHeader(
    icon.tasks(18),
    "Tareas y ajuste manual",
    "Marca Sí/No para forzar si una tarea cuenta para el PM. Se recalcula al instante."
  );
  const toolbar =
    `<div class="toolbar">` +
    `<label class="toggle"><input id="taskAll" type="checkbox" ${showAll ? "checked" : ""}> Mostrar todas las tareas</label>` +
    `<span class="count">${rows.length} tareas${showAll ? "" : " (solo reuniones RKD)"}</span>` +
    `</div>`;

  if (rows.length === 0)
    return `${header}${toolbar}<div class="empty">No hay reuniones RKD en el rango. Activa "Mostrar todas las tareas".</div>`;

  const head =
    `<thead><tr><th>Recurso</th><th>Día</th><th>Job Code</th><th>Tarea</th><th>Auto</th><th>Ajuste</th></tr></thead>`;
  let body = "";
  for (const d of rows) {
    const autoChip =
      d.auto === "Sí" ? `<span class="chip ok">Sí</span>` : `<span class="chip od">No</span>`;
    const sel =
      `<select class="ovr" data-ovr-key="${esc(d.key)}">` +
      `<option value="" ${d.override === "" ? "selected" : ""}>Auto</option>` +
      `<option value="Sí" ${d.override === "Sí" ? "selected" : ""}>Sí</option>` +
      `<option value="No" ${d.override === "No" ? "selected" : ""}>No</option>` +
      `</select>`;
    const changed = d.override ? ' class="ovr-row"' : "";
    body +=
      `<tr${changed}><td>${esc(d.res)}</td><td>${esc(fmtDay(d.date))}</td><td>${esc(d.client)}</td>` +
      `<td>${esc(d.task.slice(0, 70))}</td><td>${autoChip}</td><td>${sel}</td></tr>`;
  }
  return `${header}${toolbar}<div class="scroll"><table>${head}<tbody>${body}</tbody></table></div>`;
}

export function renderIssues(R) {
  const header = pageHeader(
    icon.alert(18),
    "Incidencias de datos",
    R.issues.length ? `${R.issues.length} incidencias para corregir en el origen` : "Sin problemas detectados"
  );
  if (R.issues.length === 0) return `${header}<div class="empty">Sin incidencias. Los datos están limpios.</div>`;

  const byType = {};
  for (const i of R.issues) {
    const t = i.tipo.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, "N");
    (byType[t] ||= []).push(i);
  }
  const isErr = (tipo) => /no existe|no está en Equipos|incompleta/i.test(tipo);
  // Valor específico de cada fila (código, fila duplicada o nombre) para no repetir el tipo.
  const specific = (tipo) => {
    const q = /"([^"]+)"/.exec(tipo);
    if (q) return q[1];
    const f = /fila (\d+)/.exec(tipo);
    if (f) return "fila " + f[1];
    return "";
  };
  const cleanTitle = (t) =>
    t.replace(/\s*"…"\s*/g, " ").replace(/^(.*?)(:|$).*/, (m, a) => a).replace(/\s+/g, " ").trim();

  let rows = "";
  for (const t of Object.keys(byType)) {
    const list = byType[t];
    const err = isErr(t);
    rows +=
      `<tr class="grp inc"><td colspan="3">` +
      `<span class="sev ${err ? "err" : "warn"}"></span>${esc(cleanTitle(t))}` +
      `<span class="grp-count">${list.length}</span></td></tr>`;
    for (const i of list) {
      const m = /^"(.+)" no está en Equipos$/.exec(i.tipo);
      const action = m
        ? ` <button class="miniadd" data-add-person="${esc(m[1])}">+ Agregar al roster</button>`
        : "";
      const spec = specific(i.tipo);
      const detail =
        (spec ? `<b>${esc(spec)}</b>` : "") + (spec && i.detalle ? " · " : "") + (i.detalle ? esc(i.detalle) : "");
      rows += `<tr><td>${i.tab ? esc(i.tab) : "—"}</td><td class="n">${esc(i.row)}</td><td>${detail || "—"}${action}</td></tr>`;
    }
  }
  return (
    `${header}<div class="scroll"><table class="sortable">` +
    `<thead><tr><th>Pestaña</th><th class="n">Fila</th><th>Detalle</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`
  );
}

export function renderConfig(cfg) {
  const p = cfg.params || {};
  const paramRows = [
    ["minDia", "Horas mínimas por día"],
    ["maxDia", "Horas máximas por día"],
    ["umbral", "Umbral jornada alta PM"],
    ["pmNormal", "Horas PM jornada normal"],
    ["pmAlta", "Horas PM jornada alta"],
  ]
    .map(
      ([k, label]) =>
        `<label class="field"><span>${esc(label)}</span><input data-param="${k}" type="number" step="0.5" value="${esc(p[k])}"></label>`
    )
    .join("");

  const kw = (cfg.keywords || []).map((k) => k.replace(/ /g, "·")).join("\n");

  const roster = (cfg.roster || [])
    .map(
      (r, i) => `<tr>
        <td><input data-r="${i}" data-k="dev" value="${esc(r.dev)}"></td>
        <td><input data-r="${i}" data-k="equipo" value="${esc(r.equipo)}"></td>
        <td><input data-r="${i}" data-k="pm" value="${esc(r.pm || "")}"></td>
        <td><select data-r="${i}" data-k="tipo">${["Fijo", "On demand", "PM", "No incluir"]
        .map((t) => `<option ${t === r.tipo ? "selected" : ""}>${t}</option>`)
        .join("")}</select></td>
        <td><select data-r="${i}" data-k="cuentaPM">${["Sí", "No"]
        .map((t) => `<option ${t === (r.cuentaPM || "Sí") ? "selected" : ""}>${t}</option>`)
        .join("")}</select></td>
      </tr>`
    )
    .join("");

  const aliases = (cfg.aliases || [])
    .map(
      (a, i) =>
        `<tr><td><input data-a="${i}" data-k="de" value="${esc(a.de)}" placeholder="Como lo escriben"></td><td><input data-a="${i}" data-k="a" value="${esc(a.a)}" placeholder="Código correcto"></td></tr>`
    )
    .join("");

  const feriados = (cfg.feriados || [])
    .map(
      (f, i) =>
        `<tr><td><input data-fer="${i}" data-k="fecha" type="date" value="${esc(f.fecha || "")}"></td><td><input data-fer="${i}" data-k="nombre" value="${esc(f.nombre || "")}" placeholder="Nombre"></td><td><button class="x" data-del-fer="${i}" title="Quitar feriado" aria-label="Quitar feriado"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></td></tr>`
    )
    .join("");

  const header = pageHeader(
    icon.settings(18),
    "Configuración",
    "Se guarda en tu navegador y se aplica al recalcular.",
    `<button id="cfgReset">Restaurar valores iniciales</button><span id="cfgState" class="saveState"></span>`
  );

  return `${header}<div class="cfg">
    <div class="cfg-grid">
      <div class="cfg-card">
        <h3>${icon.settings(16)} Parámetros</h3>
        <div class="field-grid">${paramRows}</div>
      </div>
      <div class="cfg-card">
        <h3>${icon.search(16)} Palabras clave de reuniones</h3>
        <p class="note">Una por línea. <code>·</code> representa un espacio (importan: <code>·pm·</code>).</p>
        <textarea id="cfgKeywords" rows="7">${esc(kw)}</textarea>
      </div>
    </div>

    <div class="cfg-card">
      <h3>${icon.users(16)} Equipos (roster)</h3>
      <div class="scroll"><table id="cfgRoster">
        <thead><tr><th>DEV</th><th>Equipo</th><th>PM</th><th>Tipo</th><th>Cuenta PM</th></tr></thead>
        <tbody>${roster}</tbody>
      </table></div>
      <button id="cfgAddPerson" class="addbtn">+ Agregar persona</button>
    </div>

    <div class="cfg-grid">
      <div class="cfg-card">
        <h3>${icon.briefcase(16)} Alias de Job Codes</h3>
        <div class="scroll"><table id="cfgAliases">
          <thead><tr><th>Como lo escriben</th><th>Código correcto</th></tr></thead>
          <tbody>${aliases}</tbody>
        </table></div>
        <button id="cfgAddAlias" class="addbtn">+ Agregar alias</button>
      </div>
      <div class="cfg-card">
        <h3>${icon.calendar(16)} Feriados</h3>
        <p class="note">No cuentan como día hábil: bajan el mínimo/máximo y no generan horas de PM.</p>
        <div class="row" style="gap:8px;margin-bottom:10px">
          <select id="cfgHolidayCountry">${COUNTRIES.map((c) => `<option value="${c.code}">${esc(c.label)}</option>`).join("")}</select>
          <button id="cfgAddHolidays">Agregar feriados 2026</button>
        </div>
        <div class="scroll"><table id="cfgFeriados">
          <thead><tr><th>Fecha</th><th>Nombre</th><th></th></tr></thead>
          <tbody>${feriados}</tbody>
        </table></div>
        <button id="cfgAddFeriado" class="addbtn">+ Agregar feriado</button>
      </div>
    </div>
  </div>`;
}
