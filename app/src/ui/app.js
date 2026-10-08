// Orquestación de la interfaz: carga de archivos, selección de semana,
// pestañas, edición de configuración y descarga del Excel. Todo en el navegador.

import {
  parseTimesheetWorkbook,
  parseJobCodes,
  isClientWorkbook,
  weeksFromRows,
  compute,
  buildXlsx,
} from "../core/index.js";
import { jobcodesForExcel } from "../config.js";
import { getConfig, saveConfig, resetConfig } from "./config-store.js";
import {
  renderOverview,
  renderTrend,
  renderValidation,
  filterValidation,
  validationTable,
  renderPM,
  renderTasks,
  renderIssues,
  renderConfig,
} from "./render.js";
import { HOLIDAYS_2026 } from "../data/holidays.js";
import { putFile, getAllFiles, removeFile as removeStoredFile, clearFiles } from "./file-store.js";

const XLSX = window.XLSX;
const ExcelJS = window.ExcelJS;

const $ = (id) => document.getElementById(id);
const el = {
  drop: $("drop"),
  file: $("file"),
  files: $("files"),
  uploadPanel: $("uploadPanel"),
  topbarLeft: document.querySelector(".topbar-left"),
  week: $("week"),
  from: $("from"),
  to: $("to"),
  dedupe: $("dedupe"),
  status: $("status"),
  report: $("report"),
  panel: $("panel"),
  empty: $("empty"),
  download: $("btnDownload"),
  toast: $("toast"),
};

const state = {
  cfg: null,
  timesheetFiles: [], // { name, parsed }
  weeks: [],
  R: null,
  tab: "resumen",
  filter: { q: "", soloProblemas: false },
  options: { dedupe: false }, // opciones del reporte (ignorar duplicados)
  overrides: {}, // ajuste manual Sí/No por fila (key file|tab|row)
  taskShowAll: false,
  ui: {}, // preferencias recordadas (semana/filtros/pestaña)
};

const OVR_KEY = "ts.overrides.v1";
function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVR_KEY)) || {};
  } catch {
    return {};
  }
}
function saveOverrides() {
  localStorage.setItem(OVR_KEY, JSON.stringify(state.overrides));
}

const UI_KEY = "ts.ui.v1";
function loadUi() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY)) || {};
  } catch {
    return {};
  }
}
function saveUi() {
  localStorage.setItem(
    UI_KEY,
    JSON.stringify({ tab: state.tab, filter: state.filter, options: state.options, weekFrom: el.from.value, weekTo: el.to.value })
  );
}

init();

async function init() {
  try {
    state.cfg = await getConfig();
    const ui = loadUi();
    state.ui = ui;
    state.overrides = loadOverrides();
    if (ui.tab) state.tab = ui.tab;
    if (ui.filter) state.filter = { q: ui.filter.q || "", soloProblemas: !!ui.filter.soloProblemas };
    if (ui.options) state.options = { dedupe: !!ui.options.dedupe };
    highlightTab();
    wireEvents();
    el.dedupe.checked = state.options.dedupe;
    // Primer uso: solo el onboarding; la carga y la semana aparecen al subir archivos.
    el.uploadPanel.classList.add("hidden");
    el.topbarLeft.classList.add("hidden");
    // Restaura los archivos subidos en una sesión anterior (si los hay).
    await restoreFiles();
  } catch (e) {
    console.error("Error al iniciar la app:", e);
    const empty = document.getElementById("empty");
    if (empty) {
      empty.classList.remove("hidden");
      empty.innerHTML = `<div class="onboard-card"><h2>No se pudo cargar la app</h2><p class="onboard-lead">Recarga la página. Si persiste, limpia la caché del navegador.</p><button class="primary" onclick="location.reload()">Recargar</button></div>`;
    }
  }
}

// Marca la pestaña activa en la navegación lateral.
function highlightTab() {
  document.querySelectorAll("#nav .navitem").forEach((b) => {
    if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function wireEvents() {
  el.drop.addEventListener("click", () => el.file.click());
  const onboardBtn = $("onboardBtn");
  if (onboardBtn) onboardBtn.addEventListener("click", () => el.file.click());
  el.drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.file.click();
    }
  });
  el.file.addEventListener("change", (e) => handleFiles(e.target.files));
  ["dragenter", "dragover"].forEach((ev) =>
    el.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      el.drop.classList.add("over");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    el.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      el.drop.classList.remove("over");
    })
  );
  el.drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  el.week.addEventListener("change", () => {
    const opt = state.weeks[el.week.value];
    if (opt) {
      el.from.value = opt.from;
      el.to.value = opt.to;
    }
    recompute();
    saveUi();
  });
  el.from.addEventListener("change", () => {
    recompute();
    saveUi();
  });
  el.to.addEventListener("change", () => {
    recompute();
    saveUi();
  });
  el.dedupe.addEventListener("change", () => {
    state.options.dedupe = el.dedupe.checked;
    recompute();
    saveUi();
  });

  document.querySelectorAll("#nav .navitem").forEach((b) =>
    b.addEventListener("click", () => selectTab(b.dataset.tab))
  );

  el.download.addEventListener("click", download);
  el.panel.addEventListener("input", onConfigInput);
  el.panel.addEventListener("change", onConfigInput);
  el.panel.addEventListener("click", onConfigClick);
  el.panel.addEventListener("click", onSortClick);
}

async function handleFiles(fileList) {
  const list = [...fileList].filter((f) => /\.(xlsx|xlsm)$/i.test(f.name));
  if (!list.length) return;
  setStatus(`<span class="spinner"></span> Leyendo ${list.length} archivo(s)…`);

  for (const file of list) {
    try {
      const buf = await file.arrayBuffer();
      ingestWorkbook(file.name, buf);
      // Se guarda una copia para no tener que volver a subirlo tras refrescar.
      putFile(file.name, buf.slice(0)).catch((e) => console.warn("No se pudo guardar el archivo:", e));
    } catch (e) {
      console.error(e);
      setStatus(`Error leyendo ${file.name}: ${e.message}`);
    }
  }

  el.file.value = "";
  renderFiles();
  refreshWeeks();
  setStatus("");
}

// Procesa un libro ya leído (desde bytes): Job Codes, consolidado o timesheet.
function ingestWorkbook(name, buf) {
  const wb = XLSX.read(buf, { type: "array" });

  // Toda pestaña JobCodes actualiza la lista guardada.
  const jc = parseJobCodes(XLSX, wb);
  if (jc && jc.length) {
    state.cfg.jobcodes = jc;
    saveConfig(state.cfg);
  }

  // El consolidado del cliente solo aporta Job Codes.
  if (isClientWorkbook(wb)) {
    if (!state.timesheetFiles.some((f) => f.name === name)) {
      state.timesheetFiles.push({ name, parsed: null, clientOnly: true });
    }
    return;
  }

  const parsed = parseTimesheetWorkbook(XLSX, wb, name);
  const idx = state.timesheetFiles.findIndex((f) => f.name === name);
  if (idx >= 0) state.timesheetFiles[idx] = { name, parsed };
  else state.timesheetFiles.push({ name, parsed });
}

// Restaura los archivos guardados en IndexedDB al abrir la app.
async function restoreFiles() {
  let saved = [];
  try {
    saved = await getAllFiles();
  } catch (e) {
    console.warn("No se pudieron leer los archivos guardados:", e);
    return;
  }
  if (!saved.length) return;
  for (const { name, bytes } of saved) {
    try {
      ingestWorkbook(name, bytes);
    } catch (e) {
      console.warn(`No se pudo restaurar ${name}:`, e);
    }
  }
  renderFiles();
  refreshWeeks();
}

function mergedParsed() {
  const rows = [];
  const issues = [];
  const tabs = [];
  for (const f of state.timesheetFiles) {
    if (!f.parsed) continue;
    rows.push(...f.parsed.rows);
    issues.push(...f.parsed.issues);
    tabs.push(...f.parsed.tabs);
  }
  return { rows, issues, tabs };
}

function renderFiles() {
  el.drop.classList.toggle("compact", state.timesheetFiles.length > 0);
  const xIcon =
    '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const fileIcon =
    '<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v5h5"/><path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/></svg>';
  el.files.innerHTML = state.timesheetFiles
    .map(
      (f, i) =>
        `<li>${fileIcon}${escapeHtml(f.name)}${f.clientOnly ? " (solo Job Codes)" : ""}<button class="x" data-rm="${i}" title="Quitar" aria-label="Quitar ${escapeHtml(f.name)}">${xIcon}</button></li>`
    )
    .join("");
  el.files.querySelectorAll("button[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      const [removed] = state.timesheetFiles.splice(+b.dataset.rm, 1);
      if (removed) removeStoredFile(removed.name).catch(() => {});
      renderFiles();
      refreshWeeks();
    })
  );
}

function refreshWeeks() {
  const parsed = mergedParsed();
  const hasData = parsed.rows.length > 0;
  const hasFiles = state.timesheetFiles.length > 0;
  el.uploadPanel.classList.toggle("hidden", !hasFiles);
  el.topbarLeft.classList.toggle("hidden", !hasData);
  el.report.classList.toggle("hidden", !hasData);
  el.empty.classList.toggle("hidden", hasFiles);

  if (!hasData) {
    state.R = null;
    el.download.disabled = true;
    return;
  }

  state.weeks = weeksFromRows(parsed.rows);
  el.week.innerHTML =
    state.weeks
      .map((w, i) => `<option value="${i}">${escapeHtml(w.label)} (${w.from} → ${w.to})</option>`)
      .join("") + `<option value="custom">Rango personalizado…</option>`;

  let def = state.weeks.length - 1; // la más reciente por defecto
  // Restaurar la semana recordada si todavía existe en los datos.
  if (state.ui && state.ui.weekFrom) {
    const idx = state.weeks.findIndex((w) => w.from === state.ui.weekFrom && w.to === state.ui.weekTo);
    if (idx >= 0) def = idx;
  }
  el.week.value = String(def);
  el.from.value = state.weeks[def].from;
  el.to.value = state.weeks[def].to;
  recompute();
}

function recompute() {
  const from = el.from.value;
  const to = el.to.value;
  if (!from || !to || from > to) return;
  const parsed = mergedParsed();
  if (!parsed.rows.length) return;
  state.R = compute(parsed, state.cfg, from, to, state.overrides, state.options);
  el.download.disabled = false;
  renderPanel();
}

function selectTab(tab) {
  state.tab = tab;
  highlightTab();
  saveUi();
  renderPanel();
}

// Resumen de métricas por cada semana detectada, para la vista Tendencia.
function buildWeekSummaries() {
  const parsed = mergedParsed();
  return state.weeks.map((w) => {
    const R = compute(parsed, state.cfg, w.from, w.to, state.overrides, state.options);
    const fuera = R.validation.filter((v) => v.tipo === "Fijo" && v.estado !== "OK").length;
    const horas = R.dev.reduce((s, d) => s + d.hrs, 0);
    const horasPM = R.pm.reduce((s, p) => s + p.horasPM, 0);
    return { label: w.label, from: w.from, to: w.to, personas: R.validation.length, fuera, horas, horasPM, incidencias: R.issues.length };
  });
}

function renderPanel() {
  if (state.tab === "config") {
    setPanel(renderConfig(state.cfg));
    return;
  }
  if (!state.R) {
    setPanel(`<div class="empty">Carga archivos para ver el reporte.</div>`);
    return;
  }
  if (state.tab === "resumen") setPanel(renderOverview(state.R));
  else if (state.tab === "tendencia") setPanel(renderTrend(buildWeekSummaries()));
  else if (state.tab === "validacion") setPanel(renderValidation(state.R, state.filter));
  else if (state.tab === "pm") setPanel(renderPM(state.R));
  else if (state.tab === "tareas") setPanel(renderTasks(state.R, { showAll: state.taskShowAll }));
  else if (state.tab === "incidencias") setPanel(renderIssues(state.R));
}

// Pinta el panel con una transición suave de entrada.
function setPanel(html) {  el.panel.innerHTML = html;
  el.panel.classList.remove("fade");
  void el.panel.offsetWidth;
  el.panel.classList.add("fade");
}

// Ordena una tabla .sortable al hacer clic en un encabezado. Respeta los
// grupos (tr.grp): ordena las filas dentro de cada grupo.
function onSortClick(e) {
  const th = e.target.closest("th");
  if (!th || !th.closest("thead")) return;
  const table = th.closest("table.sortable");
  if (!table) return;

  const ths = [...th.parentElement.children];
  const col = ths.indexOf(th);
  const dir = table.dataset.sortCol === String(col) && table.dataset.sortDir === "asc" ? "desc" : "asc";
  table.dataset.sortCol = String(col);
  table.dataset.sortDir = dir;
  ths.forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
  th.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");

  const cellVal = (tr) => {
    const c = tr.cells[col];
    if (!c) return { t: "", n: null };
    const t = c.textContent.trim();
    const n = parseFloat(t.replace(/[^\d.\-]/g, ""));
    return { t, n: Number.isNaN(n) ? null : n };
  };
  const cmp = (a, b) => {
    const va = cellVal(a);
    const vb = cellVal(b);
    const r = va.n !== null && vb.n !== null ? va.n - vb.n : va.t.localeCompare(vb.t, "es");
    return dir === "asc" ? r : -r;
  };

  const tbody = table.tBodies[0];
  const segments = [];
  let cur = null;
  for (const tr of [...tbody.rows]) {
    if (tr.classList.contains("grp")) {
      cur = { head: tr, rows: [] };
      segments.push(cur);
    } else {
      if (!cur) {
        cur = { head: null, rows: [] };
        segments.push(cur);
      }
      cur.rows.push(tr);
    }
  }
  tbody.innerHTML = "";
  for (const seg of segments) {
    if (seg.head) tbody.appendChild(seg.head);
    seg.rows.sort(cmp).forEach((tr) => tbody.appendChild(tr));
  }
}

async function download() {
  if (!state.R) return;
  el.download.disabled = true;
  const prev = el.download.textContent;
  el.download.textContent = "Generando…";
  try {
    const buf = await buildXlsx(ExcelJS, state.R, jobcodesForExcel(state.cfg.jobcodes));
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Timesheet ${state.R.label}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("No se pudo generar el Excel: " + e.message);
  } finally {
    el.download.textContent = prev;
    el.download.disabled = false;
  }
}

// ---------- Configuración ----------
function onConfigInput(e) {
  const t = e.target;

  // Ajuste manual Sí/No por tarea.
  if (t.classList.contains("ovr")) {
    const key = t.getAttribute("data-ovr-key");
    if (t.value) state.overrides[key] = t.value;
    else delete state.overrides[key];
    saveOverrides();
    recompute();
    return;
  }
  if (t.id === "taskAll") {
    state.taskShowAll = t.checked;
    if (state.R) setPanel(renderTasks(state.R, { showAll: state.taskShowAll }));
    return;
  }

  // Filtro de la tabla de Validación: actualiza solo el cuerpo para no perder el foco.
  if (t.id === "valSearch" || t.id === "valSolo") {
    if (t.id === "valSearch") state.filter.q = t.value;
    else state.filter.soloProblemas = t.checked;
    if (state.R) {
      const filtered = filterValidation(state.R, state.filter);
      const body = document.getElementById("valBody");
      const count = document.getElementById("valCount");
      if (body) body.innerHTML = validationTable(state.R, filtered);
      if (count) count.textContent = `${filtered.length} de ${state.R.validation.length}`;
    }
    saveUi();
    return;
  }

  if (!t.matches("[data-param], [data-r], [data-a], [data-fer], #cfgKeywords")) return;

  if (t.dataset.param) {
    state.cfg.params = { ...state.cfg.params, [t.dataset.param]: Number(t.value) };
  } else if (t.dataset.r != null) {
    const i = +t.dataset.r;
    state.cfg.roster[i] = { ...state.cfg.roster[i], [t.dataset.k]: t.value };
  } else if (t.dataset.a != null) {
    const i = +t.dataset.a;
    state.cfg.aliases[i] = { ...state.cfg.aliases[i], [t.dataset.k]: t.value };
  } else if (t.dataset.fer != null) {
    const i = +t.dataset.fer;
    state.cfg.feriados = state.cfg.feriados || [];
    state.cfg.feriados[i] = { ...state.cfg.feriados[i], [t.dataset.k]: t.value };
  } else if (t.id === "cfgKeywords") {
    state.cfg.keywords = t.value
      .split("\n")
      .map((l) => l.replace(/·/g, " "))
      .filter((l) => l !== "");
  }
  saveConfig(state.cfg);
  flashSaved();
  if (state.R) recomputeKeepTab();
}

function onConfigClick(e) {
  const t = e.target;
  const add = t.closest && t.closest("[data-add-person]");
  if (add) {
    const name = add.getAttribute("data-add-person");
    if (!state.cfg.roster.some((p) => p.dev === name)) {
      state.cfg.roster.push({ dev: name, equipo: "", pm: "", tipo: "Fijo", cuentaPM: "Sí" });
      saveConfig(state.cfg);
    }
    recompute();
    toast(`"${name}" agregado al roster. Asígnale equipo y tipo en Configuración.`);
    return;
  }
  const delFer = t.closest && t.closest("[data-del-fer]");
  if (delFer) {
    state.cfg.feriados.splice(+delFer.getAttribute("data-del-fer"), 1);
    saveConfig(state.cfg);
    recomputeKeepTab();
    el.panel.innerHTML = renderConfig(state.cfg);
    return;
  }
  if (t.id === "cfgAddPerson") {
    state.cfg.roster.push({ dev: "", equipo: "", pm: "", tipo: "Fijo", cuentaPM: "Sí" });
    saveConfig(state.cfg);
    el.panel.innerHTML = renderConfig(state.cfg);
  } else if (t.id === "cfgAddAlias") {
    state.cfg.aliases = state.cfg.aliases || [];
    state.cfg.aliases.push({ de: "", a: "" });
    saveConfig(state.cfg);
    el.panel.innerHTML = renderConfig(state.cfg);
  } else if (t.id === "cfgAddFeriado") {
    state.cfg.feriados = state.cfg.feriados || [];
    state.cfg.feriados.push({ fecha: "", nombre: "" });
    saveConfig(state.cfg);
    el.panel.innerHTML = renderConfig(state.cfg);
  } else if (t.id === "cfgAddHolidays") {
    const sel = document.getElementById("cfgHolidayCountry");
    const code = sel ? sel.value : "CR";
    state.cfg.feriados = state.cfg.feriados || [];
    const existing = new Set(state.cfg.feriados.map((f) => f.fecha));
    let added = 0;
    for (const h of HOLIDAYS_2026[code] || []) {
      if (!existing.has(h.fecha)) {
        state.cfg.feriados.push({ ...h });
        existing.add(h.fecha);
        added++;
      }
    }
    state.cfg.feriados.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    saveConfig(state.cfg);
    recomputeKeepTab();
    el.panel.innerHTML = renderConfig(state.cfg);
    toast(`${added} feriado(s) agregado(s). Revísalos y edita lo que haga falta.`);
  } else if (t.id === "cfgReset") {
    resetConfig().then((cfg) => {
      state.cfg = cfg;
      el.panel.innerHTML = renderConfig(state.cfg);
      if (state.timesheetFiles.length) recompute();
    });
  }
}

// Recalcula el reporte sin salir de la pestaña de configuración.
function recomputeKeepTab() {
  const from = el.from.value;
  const to = el.to.value;
  if (!from || !to || from > to) return;
  const parsed = mergedParsed();
  if (!parsed.rows.length) return;
  state.R = compute(parsed, state.cfg, from, to, state.overrides, state.options);
}

function flashSaved() {
  const s = document.getElementById("cfgState");
  if (!s) return;
  s.textContent = "Guardado";
  s.className = "saveState ok";
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => {
    s.textContent = "";
    s.className = "saveState";
  }, 1200);
}

function setStatus(html) {
  el.status.innerHTML = html;
}

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 3500);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
