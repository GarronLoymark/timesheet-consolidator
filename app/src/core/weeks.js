// Detección de semanas y etiquetas (sección 4 de las reglas).

import { iso, fromIso, isWeekend, daysBetween, DAY, MES } from "./dates.js";

/**
 * Etiqueta de una semana usando el primer y último día HÁBIL del rango.
 * Ejemplos: "1-2 OCT", "5-9 OCT".
 * @param {string} a ISO desde
 * @param {string} b ISO hasta
 */
export function weekLabel(a, b) {
  const weekdays = daysBetween(a, b).filter((d) => !isWeekend(d));
  const first = weekdays[0] || a;
  const last = weekdays[weekdays.length - 1] || b;
  return `${+first.slice(8)}-${+last.slice(8)} ${MES[+last.slice(5, 7) - 1]}`;
}

/**
 * Semanas presentes en los datos. Cada semana va de lunes a domingo y se
 * recorta al mes de la fecha (como las pestañas Week del archivo del cliente).
 * @param {Array<{date: string|null}>} rows
 * @returns {Array<{from: string, to: string, n: number, label: string}>}
 */
export function weeksFromRows(rows) {
  const dates = [...new Set(rows.filter((r) => r.date).map((r) => r.date))].sort();
  const weeks = new Map();

  for (const d of dates) {
    const t = fromIso(d);
    const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY);
    const sunday = new Date(monday.getTime() + 6 * DAY);
    let a = iso(monday);
    let b = iso(sunday);

    const month = d.slice(0, 7); // recortar al mes del dato
    if (a.slice(0, 7) !== month) a = month + "-01";
    if (b.slice(0, 7) !== month) {
      const lastOfMonth = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0));
      b = iso(lastOfMonth);
    }

    const k = a + "|" + b;
    if (!weeks.has(k)) weeks.set(k, { from: a, to: b, n: 0 });
    weeks.get(k).n++;
  }

  return [...weeks.values()]
    .sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0))
    .map((w) => ({ ...w, label: weekLabel(w.from, w.to) }));
}
