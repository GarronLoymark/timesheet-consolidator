// Orquestación de la interfaz: carga de archivos, selección de semana,
// pestañas, edición de configuración y descarga del Excel. Todo en el navegador.

import {
  parseTimesheetWorkbook,
  parseJobCodes,
  isClientWorkbook,
  weeksFromRows,
  compute,
  buildXlsx,
  buildConsolidadoRows,
  consolidadoToTSV,
} from "../core/index.js";
import { jobcodesForExcel } from "../config.js";
import { getConfig, saveConfig, resetConfig } from "./config-store.js";
import {
  renderBanner,
  renderStats,
  renderValidation,
  filterValidation,
  validationTable,
  renderPM,
  renderIssues,
  renderConfig,
} from "./render.js";
import { icon } from "./icons.js";

const XLSX = window.XLSX;
const ExcelJS = window.ExcelJS;

const $ = (id) => document.getElementById(id);
const el = {
  drop: $("drop"),
  file: $("file"),
  files: $("files"),
  controls: $("controls"),
  week: $("week"),
  from: $("from"),
  to: $("to"),
  status: $("status"),
  report: $("report"),
  banner: $("banner"),
  stats: $("stats"),
  panel: $("panel"),
  empty: $("empty"),
  download: $("btnDownload"),
  copy: $("btnCopy"),
  toast: $("toast"),
};

const state = {
  cfg: null,
  timesheetFiles: [], // { name, parsed }
  weeks: [],
  R: null,
  tab: "validacion",
  filter: { q: "", soloProblemas: false },
};

init();

async function init() {
  state.cfg = await getConfig();
  injectIcons();
  wireEvents();
}

// Iconos SVG inyectados desde el módulo (una sola fuente, sin duplicar en el HTML).
function injectIcons() {
  const logo = $("logo");
  if (logo) logo.innerHTML = icon.clock(24);
  const dropIcon = $("dropIcon");
  if (dropIcon) dropIcon.innerHTML = icon.upload(26);
  el.download.insertAdjacentHTML("afterbegin", icon.download(16));
  el.copy.insertAdjacentHTML("afterbegin", icon.copy(16));
  const tabIcons = { validacion: icon.check(16), pm: icon.userClock(16), incidencias: icon.alert(16), config: icon.settings(16) };
  document.querySelectorAll("nav.tabs button").forEach((b) => {
    const ic = tabIcons[b.dataset.tab];
    if (ic) b.insertAdjacentHTML("afterbegin", ic);
  });
}

function wireEvents() {
  el.drop.addEventListener("click", () => el.file.click());
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
  });
  el.from.addEventListener("change", recompute);
  el.to.addEventListener("change", recompute);

  document.querySelectorAll("nav.tabs button").forEach((b) =>
    b.addEventListener("click", () => selectTab(b.dataset.tab))
  );

  el.download.addEventListener("click", download);
  el.copy.addEventListener("click", copyForClient);
  el.panel.addEventListener("input", onConfigInput);
  el.panel.addEventListener("change", onConfigInput);
  el.panel.addEventListener("click", onConfigClick);
}

async function handleFiles(fileList) {
  const list = [...fileList].filter((f) => /\.(xlsx|xlsm)$/i.test(f.name));
  if (!list.length) return;
  setStatus(`<span class="spinner"></span> Leyendo ${list.length} archivo(s)…`);

  for (const file of list) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Toda pestaña JobCodes actualiza la lista guardada.
      const jc = parseJobCodes(XLSX, wb);
      if (jc && jc.length) {
        state.cfg.jobcodes = jc;
        saveConfig(state.cfg);
      }

      // El consolidado del cliente solo aporta Job Codes.
      if (isClientWorkbook(wb)) {
        state.timesheetFiles.push({ name: file.name, parsed: null, clientOnly: true });
        continue;
      }

      const parsed = parseTimesheetWorkbook(XLSX, wb, file.name);
      state.timesheetFiles.push({ name: file.name, parsed });
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
      state.timesheetFiles.splice(+b.dataset.rm, 1);
      renderFiles();
      refreshWeeks();
    })
  );
}

function refreshWeeks() {
  const parsed = mergedParsed();
  const hasData = parsed.rows.length > 0;
  el.controls.classList.toggle("hidden", !hasData);
  el.report.classList.toggle("hidden", !hasData);
  el.empty.classList.toggle("hidden", state.timesheetFiles.length > 0);

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

  const def = state.weeks.length - 1; // la más reciente
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
  state.R = compute(parsed, state.cfg, from, to);
  el.download.disabled = false;
  el.copy.disabled = false;
  el.banner.innerHTML = renderBanner(state.R);
  el.stats.innerHTML = renderStats(state.R);
  renderPanel();
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll("nav.tabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.tab === tab))
  );
  renderPanel();
}

function renderPanel() {
  if (state.tab === "config") {
    el.panel.innerHTML = renderConfig(state.cfg);
    return;
  }
  if (!state.R) {
    el.panel.innerHTML = `<div class="empty">Carga archivos para ver el reporte.</div>`;
    return;
  }
  if (state.tab === "validacion") el.panel.innerHTML = renderValidation(state.R, state.filter);
  else if (state.tab === "pm") el.panel.innerHTML = renderPM(state.R);
  else if (state.tab === "incidencias") el.panel.innerHTML = renderIssues(state.R);
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

async function copyForClient() {
  if (!state.R) return;
  const rows = buildConsolidadoRows(state.R, jobcodesForExcel(state.cfg.jobcodes));
  const tsv = consolidadoToTSV(rows);
  try {
    await navigator.clipboard.writeText(tsv);
    toast(`Copiadas ${rows.length} filas. Pégalas en la pestaña Week del cliente (columna B).`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = tsv;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast(`Copiadas ${rows.length} filas.`);
  }
}

// ---------- Configuración ----------
function onConfigInput(e) {
  const t = e.target;

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
  state.R = compute(parsed, state.cfg, from, to);
  el.stats.innerHTML = renderStats(state.R);
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
