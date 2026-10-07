// Core del reporte de timesheet. Punto de entrada que reexporta todo.
// Toda la lógica es pura (sin DOM ni red); SheetJS/ExcelJS se pasan por parámetro.

export { key, clean, txt } from "./text.js";
export { iso, fromIso, serialToIso, isWeekend, fmtDay, daysBetween, MES, DIA } from "./dates.js";
export { parseTimesheetWorkbook, parseJobCodes, isClientWorkbook } from "./parse.js";
export { weeksFromRows, weekLabel } from "./weeks.js";
export { normClient } from "./jobcodes.js";
export { meetingCounts, autoCount } from "./rules.js";
export { compute, DEFAULT_PARAMS } from "./compute.js";
export { buildXlsx } from "./excel.js";
export { buildConsolidadoRows, consolidadoToTSV } from "./consolidado.js";
