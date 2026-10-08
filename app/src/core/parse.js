// Lectura de libros de Excel con SheetJS. El objeto XLSX se recibe como
// parámetro para mantener el core puro y testeable (sección 1-3 de las reglas).

import { key, clean } from "./text.js";
import { iso, serialToIso } from "./dates.js";

/**
 * @typedef {Object} RowOrigin
 * @property {string} file  Nombre del archivo
 * @property {string} tab   Nombre de la pestaña
 * @property {number} row   Número de fila en Excel (1-based)
 */

/**
 * @typedef {Object} DataRow
 * @property {"data"} kind
 * @property {string} file
 * @property {string} tab
 * @property {number} row
 * @property {string} client
 * @property {string} task
 * @property {string} comm
 * @property {string} typ
 * @property {string|null} date  ISO "YYYY-MM-DD" o null
 * @property {string} res
 * @property {number|null} hrs
 */

/**
 * Lee una pestaña a matriz de celdas (array de arrays).
 * @param {any} XLSX
 * @param {any} sheet
 * @returns {any[][]}
 */
function sheetToMatrix(XLSX, sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
}

/**
 * Convierte el valor de una celda de fecha a ISO, o null si no es válida.
 * - Número: serie de Excel (epoch 1899-12-30).
 * - Date: se toman año/mes/día locales y se reinterpretan en UTC.
 * @param {unknown} value
 * @returns {string|null}
 */
function cellToIsoDate(value) {
  if (typeof value === "number") return serialToIso(value);
  if (value instanceof Date) {
    return iso(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())));
  }
  return null;
}

/**
 * Procesa un libro de timesheet y devuelve filas clasificadas, incidencias
 * de lectura y el conteo de filas por pestaña.
 * @param {any} XLSX
 * @param {any} workbook  Libro ya abierto con XLSX.read(...)
 * @param {string} fileName
 */
export function parseTimesheetWorkbook(XLSX, workbook, fileName) {
  const rows = [];
  const issues = [];
  const tabs = [];
  let seq = 0; // orden de aparición en el archivo (para mostrar como el Excel)

  for (const name of workbook.SheetNames) {
    const matrix = sheetToMatrix(XLSX, workbook.Sheets[name]);

    // Buscar la fila de encabezados en las primeras 5 filas (por nombre).
    let headerRow = -1;
    let cols = {};
    for (let i = 0; i < Math.min(5, matrix.length); i++) {
      const map = {};
      (matrix[i] || []).forEach((v, j) => {
        if (v != null) map[key(v)] = j;
      });
      if ("client" in map && "hours" in map) {
        headerRow = i;
        cols = map;
        break;
      }
    }
    if (headerRow < 0) continue; // pestaña sin tabla reconocible (p. ej. Sheet1)

    const get = (r, k) => (k in cols ? r[cols[k]] : null);
    let dataCount = 0;

    for (let i = headerRow + 1; i < matrix.length; i++) {
      const r = matrix[i] || [];
      const rowNum = i + 1;
      const where = { file: fileName, tab: name, row: rowNum };

      const client = get(r, "client");
      const task = get(r, "task name");
      const comm = get(r, "comments");
      const typ = get(r, "type of task");
      const date = get(r, "date");
      const res = get(r, "resource");
      const hrs = get(r, "hours");

      const hasTask = clean(task) !== "";
      const hasClient = clean(client) !== "";

      // Fila totalmente vacía: se ignora sin aviso.
      if (!hasTask && !hasClient && res == null && date == null) continue;

      const d = cellToIsoDate(date);

      // Sin Task ni Client: posible subtotal (si trae horas) o ruido.
      if (!hasTask && !hasClient) {
        if (typeof hrs === "number" && hrs) {
          rows.push({ kind: "subtotal", ...where, date: d, res: clean(res), hrs });
        }
        continue;
      }

      // Fila incompleta: sin fecha válida o sin Resource.
      if (!d || clean(res) === "") {
        issues.push({
          ...where,
          res: clean(res),
          date: d,
          tipo: "Fila incompleta (sin fecha o sin Resource): no se incluye",
          detalle: clean(task).slice(0, 90),
        });
        continue;
      }

      dataCount++;
      rows.push({
        kind: "data",
        ...where,
        seq: seq++,
        client: clean(client),
        task: clean(task),
        comm: comm == null ? "" : clean(comm),
        typ: clean(typ),
        date: d,
        res: clean(res),
        hrs: typeof hrs === "number" ? hrs : null,
      });
    }

    tabs.push({ file: fileName, tab: name, rows: dataCount });
  }

  return { rows, issues, tabs };
}

/**
 * Extrae la lista de Job Codes de un libro que tenga pestaña "JobCodes".
 * Devuelve pares [client, code] o null si no hay pestaña.
 * @param {any} XLSX
 * @param {any} workbook
 * @returns {Array<[string, string|number]>|null}
 */
export function parseJobCodes(XLSX, workbook) {
  const name = workbook.SheetNames.find((s) => key(s) === "jobcodes");
  if (!name) return null;
  const matrix = sheetToMatrix(XLSX, workbook.Sheets[name]);
  const out = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] || [];
    if (clean(r[0]) && r[1] != null && clean(r[1]) !== "") out.push([clean(r[0]), r[1]]);
  }
  return out;
}

/**
 * ¿El libro es el consolidado del cliente? (solo Week…/Detail… + JobCodes).
 * En ese caso solo se usan sus Job Codes y no se procesan sus filas.
 * @param {any} workbook
 */
export function isClientWorkbook(workbook) {
  const hasJobCodes = workbook.SheetNames.some((s) => key(s) === "jobcodes");
  if (!hasJobCodes) return false;
  const dataSheets = workbook.SheetNames.filter((s) => key(s) !== "jobcodes");
  if (dataSheets.length === 0) return false;
  return dataSheets.every((s) => {
    const k = key(s);
    return k.startsWith("week") || k.startsWith("detail");
  });
}
