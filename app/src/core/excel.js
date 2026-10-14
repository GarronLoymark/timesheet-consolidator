// Generación del Excel de salida con ExcelJS — especificación en 04-excel-de-salida.md.
// ExcelJS se recibe como parámetro para mantener el core puro.

import { isWeekend, fmtDay } from "./dates.js";
import { buildConsolidadoEntries } from "./consolidado.js";

/**
 * Construye el libro de salida y devuelve un ArrayBuffer (writeBuffer).
 * @param {any} ExcelJS
 * @param {any} R          Resultado de compute(...)
 * @param {Array<[string, string|number]>} jobcodes  Lista [client, code]
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildXlsx(ExcelJS, R, jobcodes) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;

  const holidaySet = new Set(R.holidays || []);
  const nonWorking = (d) => isWeekend(d) || holidaySet.has(d);

  const F = { name: "Arial", size: 10 };
  const FB = { ...F, bold: true };
  const fill = (c) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + c } });
  const HDR = fill("1F3864");
  const YEL = fill("FFF2CC");
  const PMF = fill("E2EFDA");
  const REDF = fill("F8CBAD");
  const GRNF = fill("C6EFCE");

  const header = (ws, rowNum, values, startCol = 1) =>
    values.forEach((v, i) => {
      const c = ws.getCell(rowNum, startCol + i);
      c.value = v;
      c.font = { ...FB, color: { argb: "FFFFFFFF" } };
      c.fill = HDR;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

  // Número de columna -> letra de columna de Excel.
  const L = (n) => {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const toDate = (s) => new Date(s + "T00:00:00Z");
  const setFont = (ws) =>
    ws.eachRow((r) =>
      r.eachCell((c) => {
        if (!c.font || !c.font.bold) {
          c.font = { ...F, ...(c.font && c.font.color ? { color: c.font.color } : {}) };
        }
      })
    );

  const wsC = wb.addWorksheet("Consolidado");
  const wsV = wb.addWorksheet("Validacion");
  const wsH = wb.addWorksheet("Horas PM");
  const wsI = wb.addWorksheet("Incidencias");
  const wsP = wb.addWorksheet("Parametros");
  const wsE = wb.addWorksheet("Equipos");
  const wsJ = wb.addWorksheet("JobCodes");

  // ---- Parametros ----
  wsP.getCell("A1").value = "Parámetros del reporte";
  wsP.getCell("A1").font = { ...FB, size: 12 };
  const prm = [
    ["Semana desde", toDate(R.from)],
    ["Semana hasta", toDate(R.to)],
    ["Horas mínimas por día (recurso fijo)", R.params.minDia],
    ["Horas máximas por día (recurso fijo)", R.params.maxDia],
    ["Promedio del equipo (fijos) para usar jornada alta del PM", R.params.umbral],
    ["Horas PM por día - jornada normal", R.params.pmNormal],
    ["Horas PM por día - jornada alta", R.params.pmAlta],
  ];
  prm.forEach((p, i) => {
    wsP.getCell(3 + i, 1).value = p[0];
    const c = wsP.getCell(3 + i, 2);
    c.value = p[1];
    c.fill = YEL;
    if (p[1] instanceof Date) c.numFmt = "dd/mm/yyyy";
  });
  wsP.getColumn(1).width = 64;
  wsP.getColumn(2).width = 14;

  // ---- Equipos ----
  header(wsE, 1, ["DEV (Resource)", "Equipo", "PM del equipo", "Tipo", "¿Sus tareas cuentan para el PM?"]);
  R.roster.forEach((p) => wsE.addRow([p.dev, p.equipo, p.pm || "", p.tipo || "Fijo", p.cuentaPM || "Sí"]));
  [28, 20, 26, 12, 16].forEach((w, i) => (wsE.getColumn(i + 1).width = w));

  // ---- JobCodes ----
  header(wsJ, 1, ["Client", "JobCode"]);
  jobcodes.forEach((j) => wsJ.addRow(j));
  const round2 = (n) => Math.round((n || 0) * 100) / 100;

  // ---- Consolidado ---- (valores ya calculados; el PM de último en cada equipo)
  wsC.getCell("B1").value = R.label;
  wsC.getCell("B1").font = { ...FB, size: 12 };
  header(wsC, 2, ["Job #", "Client", "Task Name", "Comments", "Type of task", "Date", "Resource", "Hours", "Equipo"], 2);
  const r0 = 3;
  const entries = buildConsolidadoEntries(R, jobcodes);
  entries.forEach((e, i) => {
    const r = r0 + i;
    wsC.getCell(r, 2).value = e.job;
    wsC.getCell(r, 3).value = e.client;
    wsC.getCell(r, 4).value = e.task;
    wsC.getCell(r, 5).value = e.comm || null;
    wsC.getCell(r, 6).value = e.typ || null;
    const dc = wsC.getCell(r, 7);
    dc.value = toDate(e.date);
    dc.numFmt = "dd/mm/yyyy";
    wsC.getCell(r, 8).value = e.res;
    const hc = wsC.getCell(r, 9);
    hc.value = e.hrs;
    hc.numFmt = "0.00";
    wsC.getCell(r, 10).value = e.equipo;
    if (e.pm) for (let c = 2; c <= 10; c++) wsC.getCell(r, c).fill = PMF;
  });
  const last = Math.max(r0 + entries.length - 1, r0);
  wsC.autoFilter = { from: { row: 2, column: 2 }, to: { row: last, column: 10 } };
  wsC.views = [{ state: "frozen", ySplit: 2 }];
  [3, 9, 12, 48, 28, 22, 11, 22, 8, 16].forEach((w, i) => (wsC.getColumn(i + 1).width = w));
  wsC.addConditionalFormatting({
    ref: `B${r0}:B${last}`,
    rules: [{ type: "cellIs", operator: "equal", formulae: ['"NO EXISTE"'], style: { fill: REDF } }],
  });

  // ---- Validacion ---- (valores ya calculados)
  wsV.getCell("A1").value = "Validación de horas por recurso";
  wsV.getCell("A1").font = { ...FB, size: 12 };
  const nd = R.days.length;
  header(wsV, 3, ["Recurso", "Equipo", "Tipo", ...R.days.map(fmtDay), "Total", "Mínimo", "Máximo", "Estado"]);
  R.days.forEach((d, j) => {
    const c = wsV.getCell(2, 4 + j);
    c.value = toDate(d);
    c.numFmt = "dd/mm/yyyy";
    c.font = { ...F, size: 8, color: { argb: "FF808080" } };
  });
  const cT = 4 + nd;
  const cMin = cT + 1;
  const cMax = cT + 2;
  const cE = cT + 3;
  R.validation.forEach((v, i) => {
    const rr = 4 + i;
    wsV.getCell(rr, 1).value = v.dev;
    wsV.getCell(rr, 2).value = v.equipo;
    wsV.getCell(rr, 3).value = v.tipo;
    R.days.forEach((d, j) => {
      const c = wsV.getCell(rr, 4 + j);
      const h = round2(v.perDay[d]);
      c.value = h;
      c.numFmt = "0.00";
      if (nonWorking(d)) c.fill = fill("EDEDED");
      else if (v.tipo === "Fijo" && (h < R.params.minDia || h > R.params.maxDia)) c.fill = REDF;
    });
    wsV.getCell(rr, cT).value = round2(v.total);
    wsV.getCell(rr, cT).numFmt = "0.00";
    wsV.getCell(rr, cMin).value = v.tipo === "On demand" ? "" : v.min;
    wsV.getCell(rr, cMax).value = v.tipo === "On demand" ? "" : v.max;
    const ec = wsV.getCell(rr, cE);
    ec.value = v.estado;
    if (v.estado === "OK") ec.fill = GRNF;
    else if (v.tipo === "Fijo" && v.estado !== "OK") ec.fill = REDF;
  });
  wsV.getColumn(1).width = 24;
  wsV.getColumn(2).width = 18;
  wsV.getColumn(3).width = 11;
  wsV.getColumn(cE).width = 28;
  wsV.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];

  // ---- Horas PM ---- (valores ya calculados)
  header(wsH, 1, [
    "Equipo", "Fecha", "PM", "DEVs fijos con horas", "Horas de los fijos", "Promedio por DEV fijo",
    "Horas PM del día", "Tareas que cuentan", "Horas PM por tarea", "Total asignado",
  ]);
  let hr = 2;
  for (const p of R.pm) {
    wsH.getCell(hr, 1).value = p.equipo;
    const dc = wsH.getCell(hr, 2);
    dc.value = toDate(p.date);
    dc.numFmt = "dd/mm/yyyy";
    wsH.getCell(hr, 3).value = p.pm;
    wsH.getCell(hr, 4).value = p.devsFijos;
    wsH.getCell(hr, 5).value = round2(p.horasFijos);
    wsH.getCell(hr, 6).value = round2(p.prom);
    wsH.getCell(hr, 7).value = p.horasPM;
    wsH.getCell(hr, 8).value = p.tareas;
    wsH.getCell(hr, 9).value = round2(p.porTarea);
    wsH.getCell(hr, 10).value = p.horasPM;
    [5, 6, 9].forEach((c) => (wsH.getCell(hr, c).numFmt = "0.00"));
    hr++;
  }
  // Feriados: el PM recibe Holiday de 8 h (no se promedia ese día).
  for (const h of R.pmHolidays || []) {
    wsH.getCell(hr, 1).value = h.equipo;
    const dc = wsH.getCell(hr, 2);
    dc.value = toDate(h.date);
    dc.numFmt = "dd/mm/yyyy";
    wsH.getCell(hr, 3).value = h.pm;
    wsH.getCell(hr, 7).value = h.hrs;
    wsH.getCell(hr, 8).value = `Holiday · ${h.nombre || ""}`.trim();
    wsH.getCell(hr, 10).value = h.hrs;
    hr++;
  }
  wsH.getCell(hr, 1).value = "TOTAL";
  wsH.getCell(hr, 1).font = FB;
  [5, 7, 8, 10].forEach((c) => {
    wsH.getCell(hr, c).value = { formula: `SUM(${L(c)}2:${L(c)}${hr - 1})` };
    wsH.getCell(hr, c).numFmt = "0.00";
  });
  wsH.addConditionalFormatting({
    ref: `J2:J${Math.max(2, hr - 1)}`,
    rules: [{ type: "expression", formulae: ["ROUND(J2,2)<>ROUND(G2,2)"], style: { fill: REDF } }],
  });
  [18, 11, 24, 10, 10, 10, 10, 10, 10, 12].forEach((w, i) => (wsH.getColumn(i + 1).width = w));
  wsH.views = [{ state: "frozen", ySplit: 1 }];

  // ---- Incidencias ----
  header(wsI, 1, ["Archivo", "Pestaña", "Fila", "Incidencia", "Detalle"]);
  R.issues.forEach((i) => wsI.addRow([i.file, i.tab, i.row, i.tipo, i.detalle]));
  [30, 18, 7, 60, 70].forEach((w, i) => (wsI.getColumn(i + 1).width = w));

  [wsC, wsV, wsH, wsI, wsP, wsE, wsJ].forEach(setFont);
  return wb.xlsx.writeBuffer();
}
