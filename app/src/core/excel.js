// Generación del Excel de salida con ExcelJS — especificación en 04-excel-de-salida.md.
// ExcelJS se recibe como parámetro para mantener el core puro.

import { isWeekend, fmtDay } from "./dates.js";

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
  const MIN = "Parametros!$B$5";
  const MAX = "Parametros!$B$6";
  const UMB = "Parametros!$B$7";
  const PMN = "Parametros!$B$8";
  const PMA = "Parametros!$B$9";
  wsP.getCell("A12").value = "Palabras clave de reuniones RKD MTG / RKD MTGINT que SÍ cuentan para el PM";
  wsP.getCell("A12").font = FB;
  wsP.getCell("A13").value =
    "Se buscan en Type of task + Task Name + Comments. Los espacios al inicio o final importan.";
  const KW0 = 14;
  for (let i = 0; i < 40; i++) {
    const c = wsP.getCell(KW0 + i, 1);
    c.value = R.keywords[i] != null ? R.keywords[i] : null;
    c.fill = YEL;
  }
  const KWR = `Parametros!$A$${KW0}:$A$${KW0 + 39}`;
  wsP.getColumn(1).width = 64;
  wsP.getColumn(2).width = 14;

  // ---- Equipos ----
  header(wsE, 1, ["DEV (Resource)", "Equipo", "PM del equipo", "Tipo", "¿Sus tareas cuentan para el PM?"]);
  R.roster.forEach((p) => wsE.addRow([p.dev, p.equipo, p.pm || "", p.tipo || "Fijo", p.cuentaPM || "Sí"]));
  [28, 20, 26, 12, 16].forEach((w, i) => (wsE.getColumn(i + 1).width = w));

  // ---- JobCodes ----
  header(wsJ, 1, ["Client", "JobCode"]);
  jobcodes.forEach((j) => wsJ.addRow(j));
  const JC = `JobCodes!$A$2:$B$${Math.max(2, jobcodes.length + 1)}`;

  // ---- Consolidado ----
  wsC.getCell("B1").value = R.label;
  wsC.getCell("B1").font = { ...FB, size: 12 };
  const hdr = [
    "Job #", "Client", "Task Name", "Comments", "Type of task", "Date", "Resource", "Hours",
    "Equipo", "Tipo recurso", "Tipo fila", "Cuenta PM (auto)", "Ajuste manual (Sí/No)", "Cuenta PM final", "Origen",
  ];
  header(wsC, 2, hdr, 2);
  const r0 = 3;
  const common = (r, d) => {
    wsC.getCell(r, 2).value = { formula: `IFERROR(VLOOKUP(C${r},${JC},2,0),"NO EXISTE")` };
    wsC.getCell(r, 3).value = d.client;
    wsC.getCell(r, 4).value = d.task;
    wsC.getCell(r, 5).value = d.comm || null;
    wsC.getCell(r, 6).value = d.typ || null;
    const dc = wsC.getCell(r, 7);
    dc.value = toDate(d.date);
    dc.numFmt = "dd/mm/yyyy";
  };
  R.dev.forEach((d, i) => {
    const r = r0 + i;
    common(r, d);
    wsC.getCell(r, 8).value = d.res;
    wsC.getCell(r, 9).value = d.hrs;
    wsC.getCell(r, 10).value = d.equipo;
    wsC.getCell(r, 11).value = d.tipo;
    wsC.getCell(r, 12).value = "DEV";
    const t = `" "&LOWER(F${r}&" "&D${r}&" "&E${r})&" "`;
    wsC.getCell(r, 13).value =
      d.cuentaPMPersona === "No"
        ? "No"
        : {
            formula: `IF(LEFT(UPPER(TRIM(C${r})),3)<>"RKD","Sí",IF(OR(UPPER(TRIM(C${r}))="RKD MTG",UPPER(TRIM(C${r}))="RKD MTGINT"),IF(SUMPRODUCT((${KWR}<>"")*ISNUMBER(SEARCH(LOWER(${KWR}),${t})))>0,"Sí","No"),"No"))`,
          };
    wsC.getCell(r, 14).fill = YEL;
    wsC.getCell(r, 14).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };
    wsC.getCell(r, 15).value = { formula: `IF(N${r}<>"",N${r},M${r})` };
    wsC.getCell(r, 16).value = `${d.tab} fila ${d.row}`;
  });

  const lastDev = r0 + R.dev.length - 1;
  let r = lastDev + 1;
  R.dev.forEach((d, i) => {
    const src = r0 + i;
    const up = d.client.toUpperCase();
    if (d.cuentaPMPersona === "No") return;
    if (up.startsWith("RKD") && up !== "RKD MTG" && up !== "RKD MTGINT") return;
    common(r, d);
    wsC.getCell(r, 8).value = R.teamPM[d.equipo] || "PM SIN ASIGNAR";
    wsC.getCell(r, 9).value = {
      formula: `IF(O${r}="Sí",SUMIFS('Horas PM'!$I:$I,'Horas PM'!$A:$A,J${r},'Horas PM'!$B:$B,G${r}),0)`,
    };
    wsC.getCell(r, 10).value = d.equipo;
    wsC.getCell(r, 11).value = "PM";
    wsC.getCell(r, 12).value = "PM";
    wsC.getCell(r, 15).value = { formula: `O${src}` };
    wsC.getCell(r, 16).value = `Fila ${src}`;
    for (let c = 2; c <= 16; c++) wsC.getCell(r, c).fill = PMF;
    r++;
  });

  const last = Math.max(r - 1, r0);
  for (let i = r0; i <= last; i++) wsC.getCell(i, 9).numFmt = "0.00";
  wsC.autoFilter = { from: { row: 2, column: 2 }, to: { row: last, column: 16 } };
  wsC.views = [{ state: "frozen", ySplit: 2 }];
  [3, 9, 12, 48, 28, 22, 11, 22, 8, 16, 11, 8, 11, 12, 11, 18].forEach(
    (w, i) => (wsC.getColumn(i + 1).width = w)
  );
  wsC.addConditionalFormatting({
    ref: `B${r0}:B${last}`,
    rules: [{ type: "cellIs", operator: "equal", formulae: ['"NO EXISTE"'], style: { fill: REDF } }],
  });
  const CR = (col) => `Consolidado!$${col}$${r0}:$${col}$${last}`;

  // ---- Validacion ----
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
  const nWd = R.weekdays.length;
  R.validation.forEach((v, i) => {
    const rr = 4 + i;
    wsV.getCell(rr, 1).value = v.dev;
    wsV.getCell(rr, 2).value = v.equipo;
    wsV.getCell(rr, 3).value = v.tipo;
    R.days.forEach((d, j) => {
      const c = wsV.getCell(rr, 4 + j);
      c.value = { formula: `SUMIFS(${CR("I")},${CR("H")},$A${rr},${CR("G")},${L(4 + j)}$2,${CR("L")},"DEV")` };
      c.numFmt = "0.00";
      if (nonWorking(d)) c.fill = fill("EDEDED");
    });
    wsV.getCell(rr, cT).value = { formula: `SUM(D${rr}:${L(3 + nd)}${rr})` };
    wsV.getCell(rr, cT).numFmt = "0.00";
    const t = `${L(cT)}${rr}`;
    const mn = `${L(cMin)}${rr}`;
    const mx = `${L(cMax)}${rr}`;
    wsV.getCell(rr, cMin).value = { formula: `IF($C${rr}="On demand","",${nWd}*${MIN})` };
    wsV.getCell(rr, cMax).value = { formula: `IF($C${rr}="On demand","",${nWd}*${MAX})` };
    wsV.getCell(rr, cE).value = {
      formula: `IF($C${rr}="On demand","On demand: "&TEXT(${t},"0.00")&" h en la semana",IF(${t}<${mn},"Faltan "&TEXT(${mn}-${t},"0.00")&" h",IF(${t}>${mx},"Excede "&TEXT(${t}-${mx},"0.00")&" h","OK")))`,
    };
  });
  const lv = 3 + Math.max(R.validation.length, 1);
  R.days.forEach((d, j) => {
    if (nonWorking(d)) return;
    const col = L(4 + j);
    wsV.addConditionalFormatting({
      ref: `${col}4:${col}${lv}`,
      rules: [
        {
          type: "expression",
          formulae: [`AND($C4="Fijo",OR(${col}4<${MIN},${col}4>${MAX}))`],
          style: { fill: REDF },
        },
      ],
    });
  });
  wsV.addConditionalFormatting({
    ref: `${L(cE)}4:${L(cE)}${lv}`,
    rules: [
      { type: "cellIs", operator: "equal", formulae: ['"OK"'], style: { fill: GRNF } },
      { type: "expression", formulae: [`AND($C4="Fijo",${L(cE)}4<>"OK")`], style: { fill: REDF } },
    ],
  });
  wsV.getColumn(1).width = 24;
  wsV.getColumn(2).width = 18;
  wsV.getColumn(3).width = 11;
  wsV.getColumn(cE).width = 28;
  wsV.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];

  // ---- Horas PM ----
  header(wsH, 1, [
    "Equipo", "Fecha", "PM", "DEVs fijos con horas", "Horas de los fijos", "Promedio por DEV fijo",
    "Horas PM del día", "Tareas que cuentan", "Horas PM por tarea", "Control: total asignado",
  ]);
  let hr = 2;
  for (const p of R.pm) {
    const dcol = L(4 + R.days.indexOf(p.date));
    wsH.getCell(hr, 1).value = p.equipo;
    const dc = wsH.getCell(hr, 2);
    dc.value = toDate(p.date);
    dc.numFmt = "dd/mm/yyyy";
    wsH.getCell(hr, 3).value = p.pm;
    wsH.getCell(hr, 4).value = {
      formula: `COUNTIFS(Validacion!$B$4:$B$${lv},A${hr},Validacion!$C$4:$C$${lv},"Fijo",Validacion!$${dcol}$4:$${dcol}$${lv},">0")`,
    };
    wsH.getCell(hr, 5).value = {
      formula: `SUMIFS(${CR("I")},${CR("J")},A${hr},${CR("G")},B${hr},${CR("K")},"Fijo",${CR("L")},"DEV")`,
    };
    wsH.getCell(hr, 6).value = { formula: `IFERROR(E${hr}/D${hr},0)` };
    wsH.getCell(hr, 7).value = { formula: `IF(H${hr}=0,0,IF(F${hr}>=${UMB},${PMA},${PMN}))` };
    wsH.getCell(hr, 8).value = {
      formula: `COUNTIFS(${CR("J")},A${hr},${CR("G")},B${hr},${CR("L")},"DEV",${CR("O")},"Sí")`,
    };
    wsH.getCell(hr, 9).value = { formula: `IFERROR(G${hr}/H${hr},0)` };
    wsH.getCell(hr, 10).value = {
      formula: `SUMIFS(${CR("I")},${CR("J")},A${hr},${CR("G")},B${hr},${CR("L")},"PM")`,
    };
    [5, 6, 7, 9, 10].forEach((c) => (wsH.getCell(hr, c).numFmt = "0.00"));
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
