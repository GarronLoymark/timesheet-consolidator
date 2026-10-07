// Render de las vistas del reporte. Funciones puras que devuelven HTML
// (salvo la configuración, que se cablea por delegación en app.js).

import { fmtDay, isWeekend } from "../core/index.js";

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const f2 = (n) => Number(n).toFixed(2);
const f4 = (n) => Number(n).toFixed(4);

/** Semáforo de "¿lista para entregar?" con lo que falta por resolver. */
export function renderBanner(R) {
  const fijosFuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const sinRoster = R.issues.filter((i) => / no está en Equipos$/.test(i.tipo)).length;
  const jobCodes = R.issues.filter((i) => /^Job Code .* no existe/.test(i.tipo)).length;
  const bloqueos = fijosFuera + sinRoster;

  if (bloqueos === 0) {
    const extra = jobCodes ? ` Revisa ${jobCodes} Job Code(s) desconocido(s) antes de entregar.` : "";
    return `<div class="banner ok" role="status"><strong>Lista para entregar.</strong> Ningún recurso fijo fuera de rango.${extra}</div>`;
  }
  const partes = [];
  if (fijosFuera) partes.push(`${fijosFuera} recurso(s) fijo(s) fuera de rango`);
  if (sinRoster) partes.push(`${sinRoster} persona(s) sin equipo`);
  if (jobCodes) partes.push(`${jobCodes} Job Code(s) desconocido(s)`);
  return `<div class="banner" role="alert"><strong>Falta revisar:</strong> ${partes.join(" · ")}.</div>`;
}

export function renderStats(R) {
  const fijosFuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
  const onDemandHoras = R.validation.filter((v) => v.tipo === "On demand").reduce((s, v) => s + v.total, 0);
  const horasPM = R.pm.reduce((s, p) => s + p.horasPM, 0);
  const cards = [
    ["Semana", esc(R.label), false],
    ["Registros DEV", R.dev.length, false],
    ["Personas", R.validation.length, false],
    ["Fijos fuera de rango", fijosFuera, fijosFuera > 0],
    ["Horas on demand", f2(onDemandHoras), false],
    ["Horas PM", f2(horasPM), false],
    ["Incidencias", R.issues.length, R.issues.length > 0],
  ];
  return cards
    .map(([label, val, bad]) => `<div class="stat ${bad ? "bad" : ""}"><b>${val}</b><span>${esc(label)}</span></div>`)
    .join("");
}

export function renderValidation(R) {
  if (R.validation.length === 0) return `<div class="empty">Sin personas en el rango.</div>`;
  const days = R.days;
  const holidays = new Set(R.holidays || []);
  const names = R.holidayNames || {};
  const head =
    `<tr><th>Recurso</th><th>Tipo</th>` +
    days
      .map((d) => {
        const shaded = isWeekend(d) || holidays.has(d);
        const title = holidays.has(d) ? ` title="${esc(names[d] || "Feriado")}"` : "";
        const mark = holidays.has(d) ? " *" : "";
        return `<th class="n ${shaded ? "wk" : ""}"${title}>${esc(fmtDay(d))}${mark}</th>`;
      })
      .join("") +
    `<th class="n">Total</th><th>Estado</th></tr>`;

  const rowsByTeam = {};
  for (const v of R.validation) (rowsByTeam[v.equipo] ||= []).push(v);

  let body = "";
  for (const team of Object.keys(rowsByTeam)) {
    body += `<tr class="grp"><td colspan="${days.length + 4}">${esc(team)}</td></tr>`;
    for (const v of rowsByTeam[team]) {
      const cells = days
        .map((d) => {
          const h = v.perDay[d] || 0;
          const shaded = isWeekend(d) || holidays.has(d);
          const redDay = v.tipo === "Fijo" && !shaded && (h < R.params.minDia || h > R.params.maxDia);
          const cls = redDay ? "n bad" : shaded ? "n wk" : "n";
          return `<td class="${cls}">${h ? f2(h) : shaded ? "" : "0"}</td>`;
        })
        .join("");
      const chip =
        v.tipo === "On demand"
          ? `<span class="chip od">${esc(v.estado)}</span>`
          : v.estado === "OK"
          ? `<span class="chip ok">OK</span>`
          : `<span class="chip bad">${esc(v.estado)}</span>`;
      body += `<tr><td>${esc(v.dev)}</td><td>${esc(v.tipo)}</td>${cells}<td class="n">${f2(v.total)}</td><td>${chip}</td></tr>`;
    }
  }
  const nota =
    (R.holidays || []).length > 0
      ? `<p class="note">* Feriado (no cuenta como día hábil): ${R.holidays
          .map((d) => `${esc(fmtDay(d))} ${esc(names[d] || "")}`)
          .join(" · ")}.</p>`
      : "";
  return `${nota}<div class="scroll"><table>${head}${body}</table></div>`;
}

export function renderPM(R) {
  if (R.pm.length === 0) return `<div class="empty">Sin horas de PM en el rango.</div>`;
  const head =
    `<tr><th>Equipo</th><th>Día</th><th>PM</th><th class="n">DEVs fijos</th><th class="n">Horas fijos</th>` +
    `<th class="n">Promedio</th><th class="n">Horas PM</th><th class="n">Tareas</th><th class="n">Por tarea</th></tr>`;
  let body = "";
  for (const p of R.pm) {
    body +=
      `<tr><td>${esc(p.equipo)}</td><td>${esc(fmtDay(p.date))}</td><td>${esc(p.pm)}</td>` +
      `<td class="n">${p.devsFijos}</td><td class="n">${f2(p.horasFijos)}</td><td class="n">${f2(p.prom)}</td>` +
      `<td class="n"><b>${p.horasPM}</b></td><td class="n">${p.tareas}</td><td class="n">${p.tareas ? f4(p.porTarea) : "–"}</td></tr>`;
  }
  return `<div class="scroll"><table>${head}${body}</table></div>`;
}

export function renderIssues(R) {
  if (R.issues.length === 0) return `<div class="empty">Sin incidencias.</div>`;
  const byType = {};
  for (const i of R.issues) {
    const t = i.tipo.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, "N");
    (byType[t] ||= []).push(i);
  }
  let out = "";
  for (const t of Object.keys(byType)) {
    const list = byType[t];
    out += `<h3 style="font-size:15px;color:var(--accent);margin:16px 0 4px">${esc(list[0].tipo.replace(/^(.*?)(:|$).*/, (m, a) => a))} <span style="color:var(--muted);font-weight:400">· ${list.length}</span></h3>`;
    out += `<div class="scroll"><table><tr><th>Archivo</th><th>Pestaña</th><th class="n">Fila</th><th>Detalle</th></tr>`;
    for (const i of list) {
      const m = /^"(.+)" no está en Equipos$/.exec(i.tipo);
      const action = m
        ? ` <button class="miniadd" data-add-person="${esc(m[1])}">+ Agregar al roster</button>`
        : "";
      out += `<tr><td>${esc(i.file)}</td><td>${esc(i.tab)}</td><td class="n">${esc(i.row)}</td><td>${esc(i.tipo)}${i.detalle ? " — " + esc(i.detalle) : ""}${action}</td></tr>`;
    }
    out += `</table></div>`;
  }
  return out;
}

export function renderConfig(cfg) {
  const p = cfg.params || {};
  const paramRows = [
    ["minDia", "Horas mínimas por día (fijo)"],
    ["maxDia", "Horas máximas por día (fijo)"],
    ["umbral", "Umbral de promedio para jornada alta PM"],
    ["pmNormal", "Horas PM jornada normal"],
    ["pmAlta", "Horas PM jornada alta"],
  ]
    .map(
      ([k, label]) =>
        `<label class="f">${esc(label)}<input data-param="${k}" type="number" step="0.5" value="${esc(p[k])}" style="max-width:120px"></label>`
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
        `<tr><td><input data-a="${i}" data-k="de" value="${esc(a.de)}"></td><td><input data-a="${i}" data-k="a" value="${esc(a.a)}"></td></tr>`
    )
    .join("");

  const feriados = (cfg.feriados || [])
    .map(
      (f, i) =>
        `<tr><td><input data-fer="${i}" data-k="fecha" type="date" value="${esc(f.fecha || "")}"></td><td><input data-fer="${i}" data-k="nombre" value="${esc(f.nombre || "")}" placeholder="Nombre"></td></tr>`
    )
    .join("");

  return `<div class="cfg">
    <p class="note">Esta configuración se guarda en tu navegador. Cada campo se aplica al recalcular.</p>
    <div class="row" style="margin-bottom:12px">
      <button id="cfgReset">Restaurar valores iniciales</button>
      <span id="cfgState" class="saveState"></span>
    </div>
    <h3>Parámetros</h3>
    <div class="row">${paramRows}</div>

    <h3>Palabras clave de reuniones</h3>
    <p class="note">Una por línea. Usa <code>·</code> para representar un espacio (los espacios importan: <code>·pm·</code>).</p>
    <textarea id="cfgKeywords" rows="8" style="width:280px;font-family:monospace">${esc(kw)}</textarea>

    <h3>Equipos (roster)</h3>
    <div class="scroll"><table id="cfgRoster">
      <tr><th>DEV</th><th>Equipo</th><th>PM</th><th>Tipo</th><th>Cuenta PM</th></tr>${roster}
    </table></div>
    <button id="cfgAddPerson" style="margin-top:8px">+ Agregar persona</button>

    <h3>Alias de Job Codes</h3>
    <div class="scroll"><table id="cfgAliases">
      <tr><th>Como lo escriben</th><th>Código correcto</th></tr>${aliases}
    </table></div>
    <button id="cfgAddAlias" style="margin-top:8px">+ Agregar alias</button>

    <h3>Feriados</h3>
    <p class="note">Los feriados no cuentan como día hábil: bajan el mínimo/máximo de horas y no generan horas de PM.</p>
    <div class="scroll"><table id="cfgFeriados">
      <tr><th>Fecha</th><th>Nombre</th></tr>${feriados}
    </table></div>
    <button id="cfgAddFeriado" style="margin-top:8px">+ Agregar feriado</button>
  </div>`;
}
