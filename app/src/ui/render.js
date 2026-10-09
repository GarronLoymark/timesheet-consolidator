// Render de las vistas del reporte. Funciones puras que devuelven HTML
// (salvo la configuración, que se cablea por delegación en app.js).

import { fmtDay, isWeekend } from "../core/index.js";
import { icon } from "./icons.js";
import { barList, donut, chartCard } from "./charts.js";
import { COUNTRIES } from "../data/holidays.js";
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const f2 = (n) => Number(n).toFixed(2);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Convierte URLs http/https dentro de un texto en enlaces (escapando el resto).
function linkify(text) {
  const re = /(https?:\/\/[^\s<>"']+)/gi;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    out += `<a href="${esc(m[0])}" target="_blank" rel="noopener noreferrer">${esc(m[0])}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

// Texto con enlace: si la celda trae hipervínculo, envuelve el texto; si no,
// convierte en enlaces las URLs que aparezcan dentro del texto.
function linkText(text, url) {
  const t = String(text == null ? "" : text);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : "";
  if (safeUrl && t.trim()) return `<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
  return linkify(t);
}

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

  // Horas del PM por equipo y día (se muestran como una fila más del equipo).
  const pmByTeam = {};
  for (const p of R.pm || []) {
    const t = (pmByTeam[p.equipo] ||= { pm: p.pm, perDay: {}, total: 0 });
    t.perDay[p.date] = (t.perDay[p.date] || 0) + p.horasPM;
    t.total += p.horasPM;
  }

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
      const detalle =
        v.overDays && v.overDays.length
          ? `<div class="daypills">${v.overDays
              .map(
                (o) =>
                  `<span class="daypill" title="${esc(fmtDay(o.date))}: ${f2(v.perDay[o.date])} h (${f2(o.over)} h de más)">${esc(fmtDay(o.date))}</span>`
              )
              .join("")}</div>`
          : "";
      body += `<tr><td>${esc(v.dev)}</td><td>${esc(v.tipo)}</td>${cells}<td class="n">${f2(v.total)}</td><td>${chip}${detalle}</td></tr>`;
    }
    // Fila del PM del equipo, con sus horas asignadas por día.
    const pm = pmByTeam[team];
    if (pm) {
      const cells = days
        .map((d) => {
          const shaded = isWeekend(d) || holidays.has(d);
          const h = pm.perDay[d] || 0;
          return `<td class="n ${shaded ? "wk" : ""}">${h ? f2(h) : shaded ? "" : "0"}</td>`;
        })
        .join("");
      body += `<tr class="pmrow"><td>${esc(pm.pm)}</td><td>PM</td>${cells}<td class="n">${f2(pm.total)}</td><td><span class="chip od">PM</span></td></tr>`;
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

  // PTO e IDLE por equipo; Holidays como total (los feriados no son por equipo).
  const ptoByTeam = {};
  const idleByTeam = {};
  for (const d of R.dev) {
    if (d.client === "RKD PTO") ptoByTeam[d.equipo] = (ptoByTeam[d.equipo] || 0) + d.hrs;
    else if (d.client === "RKD IDLE") idleByTeam[d.equipo] = (idleByTeam[d.equipo] || 0) + d.hrs;
  }
  const holidays = (R.holidays || []).length;
  const bignum = (val, unit) => `<div class="bignum">${val}<small>${esc(unit)}</small></div>`;
  const teamBody = (obj) => {
    const entries = Object.entries(obj)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }));
    return entries.length ? barList(entries, { unit: " h", decimals: 2 }) : bignum("0", "h");
  };

  return (
    pageHeader(icon.trending(18), "Resumen", `Semana ${esc(R.label)} · ${R.dev.length} registros`) +
    renderBanner(R) +
    `<div class="stats">${renderStats(R)}</div>` +
    `<div class="charts">` +
    chartCard("Estado de los recursos", estado, icon.users(16)) +
    chartCard("Horas PM por equipo", pmBars, icon.userClock(16)) +
    chartCard("Horas registradas por equipo", hBars, icon.briefcase(16)) +
    `</div>` +
    `<div class="charts">` +
    chartCard("Hs PTO por equipo", teamBody(ptoByTeam), icon.clock(16)) +
    chartCard("Hs IDLE por equipo", teamBody(idleByTeam), icon.clock(16)) +
    chartCard("Total Holidays", bignum(holidays, "días"), icon.calendar(16)) +
    `</div>`
  );
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

export function renderTasks(R, filter = {}, pag = {}) {
  const header = pageHeader(
    icon.tasks(18),
    "Horas por recurso y fecha",
    "Detalle de las horas por DEV, en el mismo orden del Excel."
  );
  if (R.dev.length === 0) return `${header}<div class="empty">Sin registros en el rango.</div>`;

  const f = { res: filter.res || "", dia: filter.dia || "" };
  const resources = [...new Set(R.dev.map((d) => d.res))].sort();
  // Mismo orden que el Excel: por archivo y por secuencia de aparición.
  const rows = R.dev
    .filter((d) => (!f.res || d.res === f.res) && (!f.dia || d.date === f.dia))
    .slice()
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.seq ?? 0) - (b.seq ?? 0)));

  // Paginación.
  const sizes = [10, 15, 25, 50];
  const size = sizes.includes(pag.size) ? pag.size : 15;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const n = Math.min(Math.max(1, pag.n || 1), pages);
  const start = (n - 1) * size;
  const pageRows = rows.slice(start, start + size);

  const opt = (val, sel, label) => `<option value="${esc(val)}" ${val === sel ? "selected" : ""}>${esc(label ?? val)}</option>`;
  const toolbar =
    `<div class="toolbar">` +
    `<label class="f">Recurso<select id="taskRes"><option value="">Todos</option>${resources.map((r) => opt(r, f.res)).join("")}</select></label>` +
    `<label class="f">Día<select id="taskDia"><option value="">Todos</option>${R.days.map((d) => opt(d, f.dia, fmtDay(d))).join("")}</select></label>` +
    `<label class="f">Por página<select id="taskSize">${sizes.map((s) => opt(s, size)).join("")}</select></label>` +
    (f.res || f.dia ? `<button class="miniadd" id="taskClear">Limpiar filtros</button>` : "") +
    `<span class="count">${rows.length} de ${R.dev.length}</span>` +
    `</div>`;

  const head =
    `<thead><tr><th>Job Code</th><th>Tarea</th><th>Comentario</th><th>Tipo</th>` +
    `<th>Fecha</th><th>Recurso</th><th class="n">Horas</th></tr></thead>`;
  let body = "";
  // Subtotal al final de cada día de cada persona (según lo que se muestra en la página).
  let gKey = null;
  let gSum = 0;
  let gRes = "";
  let gDate = "";
  const flush = () => {
    if (gKey !== null)
      body += `<tr class="subtot"><td colspan="6">Total · ${esc(gRes)} · ${esc(fmtDay(gDate))}</td><td class="n">${f2(gSum)}</td></tr>`;
  };
  for (const d of pageRows) {
    const key = d.res + "|" + d.date;
    if (key !== gKey) {
      flush();
      gKey = key;
      gSum = 0;
      gRes = d.res;
      gDate = d.date;
    }
    body +=
      `<tr><td>${esc(d.client)}</td><td class="tcell">${linkText(d.task.slice(0, 90), d.taskUrl)}</td>` +
      `<td class="tcell">${linkText((d.comm || "").slice(0, 60), d.commUrl)}</td><td>${esc(d.typ || "")}</td>` +
      `<td>${esc(fmtDay(d.date))}</td><td>${esc(d.res)}</td><td class="n">${f2(d.hrs)}</td></tr>`;
    gSum += d.hrs || 0;
  }
  flush();
  if (!rows.length) body = `<tr><td colspan="7"><div class="empty">Sin resultados para el filtro.</div></td></tr>`;

  const from = rows.length ? start + 1 : 0;
  const to = Math.min(start + size, rows.length);
  const pager =
    `<div class="pager">` +
    `<button class="miniadd" id="taskPrev" ${n <= 1 ? "disabled" : ""}>‹ Anterior</button>` +
    `<span class="pageinfo">${from}–${to} de ${rows.length} · página ${n} de ${pages}</span>` +
    `<button class="miniadd" id="taskNext" ${n >= pages ? "disabled" : ""}>Siguiente ›</button>` +
    `</div>`;

  return `${header}${toolbar}<div class="scroll"><table>${head}<tbody>${body}</tbody></table></div>${pager}`;
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
      const fix = i.sugerencia
        ? ` <span class="suggest">¿Quisiste decir <b>${esc(i.sugerencia)}</b>?</span>` +
          ` <button class="miniadd" data-fix-jc="${esc(i.jobCode)}|${esc(i.sugerencia)}">Corregir</button>`
        : "";
      const spec = specific(i.tipo);
      const detail =
        (spec ? `<b>${esc(spec)}</b>` : "") + (spec && i.detalle ? " · " : "") + (i.detalle ? esc(i.detalle) : "");
      rows += `<tr><td>${i.tab ? esc(i.tab) : "—"}</td><td class="n">${esc(i.row)}</td><td>${detail || "—"}${action}${fix}</td></tr>`;
    }
  }
  return (
    `${header}<div class="scroll"><table class="sortable">` +
    `<thead><tr><th>Pestaña</th><th class="n">Fila</th><th>Detalle</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`
  );
}

/** Histórico de incidencias por DEV (todas las semanas cargadas), con filtros. */
export function renderIncidentHistory(history, filter = {}) {
  const header = pageHeader(
    icon.alert(18),
    "Histórico de incidencias por DEV",
    "Errores al ingresar datos en los timesheets, por desarrollador."
  );
  if (!history.length) return `${header}<div class="empty">Sin incidencias de datos en las semanas cargadas.</div>`;

  const devs = [...new Set(history.map((h) => h.dev).filter(Boolean))].sort();
  const semanas = [...new Set(history.map((h) => h.semana))];
  const f = { dev: filter.dev || "", semana: filter.semana || "", dia: filter.dia || "" };
  const rows = history.filter(
    (h) => (!f.dev || h.dev === f.dev) && (!f.semana || h.semana === f.semana) && (!f.dia || h.date === f.dia)
  );

  const opt = (val, sel) => `<option value="${esc(val)}" ${val === sel ? "selected" : ""}>${esc(val)}</option>`;
  const toolbar =
    `<div class="toolbar">` +
    `<label class="f">DEV<select id="histDev"><option value="">Todos</option>${devs.map((d) => opt(d, f.dev)).join("")}</select></label>` +
    `<label class="f">Semana<select id="histSemana"><option value="">Todas</option>${semanas.map((s) => opt(s, f.semana)).join("")}</select></label>` +
    `<label class="f">Día<input id="histDia" type="date" value="${esc(f.dia)}"></label>` +
    (f.dev || f.semana || f.dia ? `<button class="miniadd" id="histClear">Limpiar filtros</button>` : "") +
    `<span class="count">${rows.length} de ${history.length}</span>` +
    `</div>`;

  const isErr = (tipo) => /no existe|incompleta/i.test(tipo);
  let body = "";
  for (const h of rows) {
    const sev = isErr(h.tipo) ? "err" : "warn";
    body +=
      `<tr><td><span class="sev ${sev}"></span>${esc(h.dev || "—")}</td><td>${esc(h.semana)}</td>` +
      `<td>${h.date ? esc(fmtDay(h.date)) : "—"}</td><td>${esc(h.tipo)}</td><td>${h.detalle ? esc(h.detalle) : "—"}</td></tr>`;
  }
  if (!rows.length) body = `<tr><td colspan="5"><div class="empty">Sin resultados para el filtro.</div></td></tr>`;

  return (
    `${header}${toolbar}<div class="scroll"><table class="sortable">` +
    `<thead><tr><th>DEV</th><th>Semana</th><th>Día</th><th>Tipo</th><th>Detalle</th></tr></thead>` +
    `<tbody>${body}</tbody></table></div>`
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
