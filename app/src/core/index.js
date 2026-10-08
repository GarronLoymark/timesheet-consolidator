// Core del reporte de timesheet. Reexporta solo el API que consume la UI y las pruebas.
// Toda la lógica es pura (sin DOM ni red); SheetJS/ExcelJS se pasan por parámetro.

export { isWeekend, fmtDay } from "./dates.js";
export { parseTimesheetWorkbook, parseJobCodes, isClientWorkbook } from "./parse.js";
export { weeksFromRows, weekLabel } from "./weeks.js";
export { normClient } from "./jobcodes.js";
export { autoCount } from "./rules.js";
export { compute } from "./compute.js";
export { buildXlsx } from "./excel.js";
export { buildConsolidadoRows } from "./consolidado.js";

