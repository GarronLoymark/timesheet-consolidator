// Fechas. Todo se maneja en UTC a partir de cadenas ISO "YYYY-MM-DD",
// para evitar desplazamientos de zona horaria (RT-04).

const DAY = 86400000;

const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const pad = (n) => String(n).padStart(2, "0");

/**
 * Date (UTC) -> "YYYY-MM-DD".
 * @param {Date} d
 */
export const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * "YYYY-MM-DD" -> Date a medianoche UTC.
 * @param {string} s
 */
export const fromIso = (s) => new Date(s + "T00:00:00Z");

/**
 * Número de serie de Excel (epoch 1899-12-30) -> "YYYY-MM-DD".
 * @param {number} n
 */
export const serialToIso = (n) => iso(new Date(Math.round((n - 25569) * DAY)));

/** Día de la semana: 0 domingo .. 6 sábado. @param {string} s */
export const dow = (s) => fromIso(s).getUTCDay();

/** ¿Es sábado o domingo? @param {string} s */
export const isWeekend = (s) => dow(s) === 0 || dow(s) === 6;

/** Etiqueta corta de un día: "Jue 01/10". @param {string} s */
export const fmtDay = (s) => `${DIA[dow(s)]} ${s.slice(8)}/${s.slice(5, 7)}`;

/**
 * Lista de días ISO inclusivos entre a y b.
 * @param {string} a
 * @param {string} b
 * @returns {string[]}
 */
export function daysBetween(a, b) {
  const out = [];
  for (let t = fromIso(a).getTime(); t <= fromIso(b).getTime(); t += DAY) {
    out.push(iso(new Date(t)));
  }
  return out;
}

export { DAY, MES, DIA };
