// Cálculo principal: filtra por semana, asocia personas, normaliza, detecta
// incidencias, valida horas y calcula las horas del PM.
// Secciones 3-10 de las reglas de negocio.

import { key, clean } from "./text.js";
import { daysBetween, isWeekend, fmtDay } from "./dates.js";
import { weekLabel } from "./weeks.js";
import { normClient } from "./jobcodes.js";
import { autoCount } from "./rules.js";

export const DEFAULT_PARAMS = { minDia: 8, maxDia: 9, umbral: 8.5, pmNormal: 8, pmAlta: 9 };

/**
 * @param {{rows:any[], issues:any[], tabs:any[]}} parsed  Resultado de parseTimesheetWorkbook (concatenado).
 * @param {any} cfg   Configuración (params, keywords, roster, aliases, jobcodes).
 * @param {string} from ISO desde.
 * @param {string} to   ISO hasta.
 */
export function compute(parsed, cfg, from, to, overrides = {}, opts = {}) {
  const params = { ...DEFAULT_PARAMS, ...(cfg.params || {}) };
  const dedupe = !!opts.dedupe; // excluir filas duplicadas de los totales y del Excel
  const keywords = (cfg.keywords || []).filter((k) => k !== "" && k != null);
  const known = new Set((cfg.jobcodes || []).map((j) => String(j[0]).toUpperCase()));
  const aliasMap = {};
  (cfg.aliases || []).forEach((a) => {
    if (a.de && a.a) aliasMap[clean(a.de).toUpperCase()] = clean(a.a);
  });

  const roster = (cfg.roster || []).filter((p) => clean(p.dev));
  const byKey = new Map(roster.map((p) => [key(p.dev), p]));
  const teamPM = {};
  roster.forEach((p) => {
    if (p.equipo && clean(p.pm) && !teamPM[p.equipo]) teamPM[p.equipo] = clean(p.pm);
  });

  // Feriados: no cuentan como día hábil (bajan mínimo/máximo y no generan horas PM).
  const holidayNames = {};
  (cfg.feriados || []).forEach((f) => {
    const fecha = typeof f === "string" ? f : f && f.fecha;
    if (fecha) holidayNames[fecha] = (f && f.nombre) || "Feriado";
  });
  const isHoliday = (d) => d in holidayNames;

  const days = daysBetween(from, to);
  const weekdays = days.filter((d) => !isWeekend(d) && !isHoliday(d));
  const inRange = (d) => d && d >= from && d <= to;

  const issues = parsed.issues.filter((i) => !i.date || inRange(i.date)).map((i) => ({ ...i }));
  const unknownPeople = new Map();
  const pmOwnRows = new Map();

  let dev = [];
  for (const r of parsed.rows) {
    if (!inRange(r.date)) continue;

    if (r.kind === "subtotal") {
      issues.push({
        file: r.file,
        tab: r.tab,
        row: r.row,
        tipo: "Fila sin Client ni Task Name con horas: no se incluye (¿subtotal u horas sin descripción?)",
        detalle: `${fmtDay(r.date)} · ${r.hrs} h`,
      });
      continue;
    }

    const person = byKey.get(key(r.res));
    if (!person) unknownPeople.set(key(r.res), r.res);
    if (person && person.tipo === "No incluir") continue;
    if (person && person.tipo === "PM") {
      pmOwnRows.set(person.dev, (pmOwnRows.get(person.dev) || 0) + 1);
      continue;
    }

    const client = normClient(r.client, r.task, aliasMap, known);
    const tipo = person ? person.tipo || "Fijo" : "Fijo";
    const row = {
      ...r,
      client,
      res: person ? person.dev : r.res,
      equipo: person ? person.equipo || "SIN EQUIPO" : "SIN EQUIPO",
      tipo,
      cuentaPMPersona: person ? person.cuentaPM || "Sí" : "Sí",
    };

    if (r.hrs == null) {
      row.hrs = 0;
      issues.push({
        file: r.file,
        tab: r.tab,
        row: r.row,
        tipo: "Fila sin horas (se toma como 0)",
        detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 80)}`,
      });
    }
    if (!known.has(client.toUpperCase())) {
      issues.push({
        file: r.file,
        tab: r.tab,
        row: r.row,
        tipo: `Job Code "${client}" no existe en JobCodes`,
        detalle: r.task.slice(0, 90),
      });
    }
    if (isWeekend(r.date) && tipo !== "On demand") {
      issues.push({
        file: r.file,
        tab: r.tab,
        row: r.row,
        tipo: "Recurso fijo con horas en fin de semana",
        detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 80)}`,
      });
    }

    row.auto = autoCount(row, person, keywords);
    // Ajuste manual del PM: si existe override para esta fila, prevalece sobre auto.
    row.key = `${r.file}|${r.tab}|${r.row}`;
    row.override = overrides[row.key] === "Sí" || overrides[row.key] === "No" ? overrides[row.key] : "";
    row.final = row.override || row.auto;
    dev.push(row);
  }

  // Duplicados exactos dentro de la misma pestaña. Por defecto se siguen
  // sumando (regla del negocio); con dedupe se marcan y se excluyen.
  const seen = new Map();
  for (const r of dev) {
    const k = [r.file, r.tab, r.res, r.client, r.task, r.comm, r.date, r.hrs].join("|");
    if (seen.has(k)) {
      r.dup = true;
      issues.push({
        file: r.file,
        tab: r.tab,
        row: r.row,
        tipo: `Posible duplicado de la fila ${seen.get(k)} (${dedupe ? "excluido" : "se está sumando"})`,
        detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 70)} · ${r.hrs} h`,
      });
    } else {
      seen.set(k, r.row);
    }
  }
  if (dedupe) dev = dev.filter((r) => !r.dup);

  for (const [, name] of unknownPeople) {
    issues.push({
      file: "",
      tab: "",
      row: "",
      tipo: `"${name}" no está en Equipos`,
      detalle: "Agrégalo en Configuración para asignarle equipo y tipo",
    });
  }
  for (const [name, n] of pmOwnRows) {
    issues.push({
      file: "",
      tab: "",
      row: "",
      tipo: `${n} filas propias de ${name} (PM) no se incluyen`,
      detalle: "Las horas del PM se calculan con la regla del equipo",
    });
  }

  const excluded = roster.filter((p) => p.tipo === "No incluir").map((p) => key(p.dev));
  const tabExcluded = (tab) => {
    const k = key(tab).replace(/\.$/, "");
    return k && excluded.some((e) => e === k || e.split(" ")[0] === k.split(" ")[0]);
  };
  for (const t of parsed.tabs) {
    if (t.rows === 0 && !tabExcluded(t.tab)) {
      issues.push({ file: t.file, tab: t.tab, row: "", tipo: "Pestaña sin registros", detalle: "" });
    }
  }

  const order = (r) => [r.equipo, r.tipo === "On demand" ? 1 : 0, r.res, r.date].join("|");
  dev.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));

  // Validación de horas por persona y día.
  const people = new Map();
  for (const p of roster) {
    if (p.tipo !== "PM" && p.tipo !== "No incluir") {
      people.set(p.dev, { dev: p.dev, equipo: p.equipo || "SIN EQUIPO", tipo: p.tipo || "Fijo" });
    }
  }
  for (const r of dev) {
    if (!people.has(r.res)) people.set(r.res, { dev: r.res, equipo: r.equipo, tipo: r.tipo });
  }

  const validation = [...people.values()]
    .sort((a, b) =>
      (a.equipo + (a.tipo === "On demand" ? 1 : 0) + a.dev).localeCompare(
        b.equipo + (b.tipo === "On demand" ? 1 : 0) + b.dev
      )
    )
    .map((p) => {
      const perDay = {};
      days.forEach((d) => (perDay[d] = 0));
      dev.filter((r) => r.res === p.dev).forEach((r) => (perDay[r.date] += r.hrs));
      const total = days.reduce((s, d) => s + perDay[d], 0);
      let min = null;
      let max = null;
      let estado = "On demand";
      if (p.tipo !== "On demand") {
        min = weekdays.length * params.minDia;
        max = weekdays.length * params.maxDia;
        estado =
          total < min - 1e-9
            ? `Faltan ${(min - total).toFixed(2)} h`
            : total > max + 1e-9
            ? `Excede ${(total - max).toFixed(2)} h`
            : "OK";
      }
      return { ...p, perDay, total, min, max, estado };
    });

  // Horas del PM por equipo y día hábil.
  const teams = [...new Set(dev.map((r) => r.equipo))].sort();
  const pm = [];
  for (const t of teams) {
    for (const d of weekdays) {
      const fixedVal = validation.filter((v) => v.equipo === t && v.tipo === "Fijo");
      const devsFijos = fixedVal.filter((v) => v.perDay[d] > 0).length;
      const horasFijos = fixedVal.reduce((s, v) => s + v.perDay[d], 0);
      const prom = devsFijos ? horasFijos / devsFijos : 0;
      const tareas = dev.filter((r) => r.equipo === t && r.date === d && r.final === "Sí").length;
      const horasPM = tareas === 0 ? 0 : prom >= params.umbral ? params.pmAlta : params.pmNormal;
      pm.push({
        equipo: t,
        date: d,
        pm: teamPM[t] || "PM SIN ASIGNAR",
        devsFijos,
        horasFijos,
        prom,
        horasPM,
        tareas,
        porTarea: tareas ? horasPM / tareas : 0,
      });
    }
  }

  const weekendTasks = dev.filter((r) => isWeekend(r.date) && r.final === "Sí").length;

  return {
    params,
    keywords,
    days,
    weekdays,
    dev,
    validation,
    pm,
    issues,
    teamPM,
    from,
    to,
    label: weekLabel(from, to),
    weekendTasks,
    roster,
    holidays: days.filter((d) => isHoliday(d)),
    holidayNames,
  };
}
