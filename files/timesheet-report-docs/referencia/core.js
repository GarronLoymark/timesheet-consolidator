/* Lógica del reporte de timesheet. Sin dependencias del DOM. */
(function (G) {
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const fromIso = s => new Date(s + "T00:00:00Z");
  const serialToIso = n => iso(new Date(Math.round((n - 25569) * DAY)));
  const dow = s => fromIso(s).getUTCDay();               // 0 dom .. 6 sáb
  const isWeekend = s => dow(s) === 0 || dow(s) === 6;
  const MES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const DIA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const fmtDay = s => `${DIA[dow(s)]} ${s.slice(8)}/${s.slice(5, 7)}`;
  const daysBetween = (a, b) => { const out = []; for (let t = fromIso(a).getTime(); t <= fromIso(b).getTime(); t += DAY) out.push(iso(new Date(t))); return out; };
  const key = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const txt = v => (v == null ? "" : String(v));

  const DEFAULT_PARAMS = { minDia: 8, maxDia: 9, umbral: 8.5, pmNormal: 8, pmAlta: 9 };

  /* ---------- lectura de exports (SheetJS) ---------- */
  function parseTimesheetWorkbook(XLSX, wb, fileName) {
    const rows = [], issues = [], tabs = [];
    for (const name of wb.SheetNames) {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      let h = -1, cols = {};
      for (let i = 0; i < Math.min(5, aoa.length); i++) {
        const m = {}; (aoa[i] || []).forEach((v, j) => { if (v != null) m[key(v)] = j; });
        if ("client" in m && "hours" in m) { h = i; cols = m; break; }
      }
      if (h < 0) continue;
      const g = (r, k) => (k in cols ? r[cols[k]] : null);
      let n = 0;
      for (let i = h + 1; i < aoa.length; i++) {
        const r = aoa[i] || [], rowNum = i + 1, where = { file: fileName, tab: name, row: rowNum };
        const client = g(r, "client"), task = g(r, "task name"), comm = g(r, "comments"),
              typ = g(r, "type of task"), date = g(r, "date"), res = g(r, "resource"), hrs = g(r, "hours");
        const hasTask = clean(task) !== "" , hasClient = clean(client) !== "";
        if (!hasTask && !hasClient && res == null && date == null) continue;
        let d = null;
        if (typeof date === "number") d = serialToIso(date);
        else if (date instanceof Date) d = iso(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
        if (!hasTask && !hasClient) {
          if (typeof hrs === "number" && hrs) rows.push({ kind: "subtotal", ...where, date: d, res: clean(res), hrs });
          continue;
        }
        if (!d || clean(res) === "") { issues.push({ ...where, date: d, tipo: "Fila incompleta (sin fecha o sin Resource): no se incluye", detalle: clean(task).slice(0, 90) }); continue; }
        n++;
        rows.push({ kind: "data", ...where, client: clean(client), task: clean(task), comm: comm == null ? "" : clean(comm), typ: clean(typ),
                    date: d, res: clean(res), hrs: typeof hrs === "number" ? hrs : null });
      }
      tabs.push({ file: fileName, tab: name, rows: n });
    }
    return { rows, issues, tabs };
  }

  function parseJobCodes(XLSX, wb) {
    const name = wb.SheetNames.find(s => key(s) === "jobcodes");
    if (!name) return null;
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const out = [];
    for (let i = 1; i < aoa.length; i++) { const r = aoa[i] || []; if (clean(r[0]) && r[1] != null && clean(r[1]) !== "") out.push([clean(r[0]), r[1]]); }
    return out;
  }

  /* ---------- semanas disponibles ---------- */
  function weeksFromRows(rows) {
    const dates = [...new Set(rows.filter(r => r.date).map(r => r.date))].sort();
    const weeks = new Map();
    for (const d of dates) {
      const t = fromIso(d), mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY), sun = new Date(mon.getTime() + 6 * DAY);
      let a = iso(mon), b = iso(sun);
      const m0 = d.slice(0, 7);                                        // recortar al mes del dato
      if (a.slice(0, 7) !== m0) a = m0 + "-01";
      if (b.slice(0, 7) !== m0) { const e = new Date(Date.UTC(+m0.slice(0, 4), +m0.slice(5, 7), 0)); b = iso(e); }
      const k = a + "|" + b;
      if (!weeks.has(k)) weeks.set(k, { from: a, to: b, n: 0 });
      weeks.get(k).n++;
    }
    return [...weeks.values()].map(w => ({ ...w, label: weekLabel(w.from, w.to) }));
  }
  function weekLabel(a, b) {
    const wd = daysBetween(a, b).filter(d => !isWeekend(d));
    const x = wd[0] || a, y = wd[wd.length - 1] || b;
    return `${+x.slice(8)}-${+y.slice(8)} ${MES[+y.slice(5, 7) - 1]}`;
  }

  /* ---------- reglas ---------- */
  function normClient(raw, task, aliasMap, known) {
    let c = clean(raw);
    if (!c && task) c = clean(String(task).slice(0, 5));
    c = c.replace(/:+$/, "").trim();
    const up = c.toUpperCase();
    if (aliasMap[up]) return aliasMap[up];
    if (up.startsWith("RKD")) return up === "RKD MTG INT" ? "RKD MTGINT" : up;
    return known.has(up) ? up : c;
  }
  function meetingCounts(r, keywords) {
    const t = " " + (r.typ + " " + r.task + " " + r.comm).toLowerCase() + " ";
    return keywords.some(k => k !== "" && t.includes(String(k).toLowerCase()));
  }
  function autoCount(r, person, keywords) {
    if (person && person.cuentaPM === "No") return "No";
    const c = r.client.toUpperCase();
    if (!c.startsWith("RKD")) return "Sí";
    if (c === "RKD MTG" || c === "RKD MTGINT") return meetingCounts(r, keywords) ? "Sí" : "No";
    return "No";
  }

  /* ---------- cálculo principal ---------- */
  function compute(parsed, cfg, from, to) {
    const params = { ...DEFAULT_PARAMS, ...(cfg.params || {}) };
    const keywords = (cfg.keywords || []).filter(k => k !== "" && k != null);
    const known = new Set((cfg.jobcodes || []).map(j => String(j[0]).toUpperCase()));
    const aliasMap = {}; (cfg.aliases || []).forEach(a => { if (a.de && a.a) aliasMap[clean(a.de).toUpperCase()] = clean(a.a); });
    const roster = (cfg.roster || []).filter(p => clean(p.dev));
    const byKey = new Map(roster.map(p => [key(p.dev), p]));
    const teamPM = {}; roster.forEach(p => { if (p.equipo && clean(p.pm) && !teamPM[p.equipo]) teamPM[p.equipo] = clean(p.pm); });
    const days = daysBetween(from, to), weekdays = days.filter(d => !isWeekend(d));
    const inRange = d => d && d >= from && d <= to;
    const issues = parsed.issues.filter(i => !i.date || inRange(i.date)).map(i => ({ ...i }));
    const unknownPeople = new Map(), pmOwnRows = new Map();

    const dev = [];
    for (const r of parsed.rows) {
      if (!inRange(r.date)) continue;
      if (r.kind === "subtotal") { issues.push({ file: r.file, tab: r.tab, row: r.row, tipo: "Fila sin Client ni Task Name con horas: no se incluye (¿subtotal u horas sin descripción?)", detalle: `${fmtDay(r.date)} · ${r.hrs} h` }); continue; }
      const person = byKey.get(key(r.res));
      if (!person) unknownPeople.set(key(r.res), r.res);
      if (person && person.tipo === "No incluir") continue;
      if (person && person.tipo === "PM") { pmOwnRows.set(person.dev, (pmOwnRows.get(person.dev) || 0) + 1); continue; }
      const client = normClient(r.client, r.task, aliasMap, known);
      const tipo = person ? (person.tipo || "Fijo") : "Fijo";
      const row = { ...r, client, res: person ? person.dev : r.res, equipo: person ? (person.equipo || "SIN EQUIPO") : "SIN EQUIPO", tipo,
                    cuentaPMPersona: person ? (person.cuentaPM || "Sí") : "Sí" };
      if (r.hrs == null) { row.hrs = 0; issues.push({ file: r.file, tab: r.tab, row: r.row, tipo: "Fila sin horas (se toma como 0)", detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 80)}` }); }
      if (!known.has(client.toUpperCase())) issues.push({ file: r.file, tab: r.tab, row: r.row, tipo: `Job Code "${client}" no existe en JobCodes`, detalle: r.task.slice(0, 90) });
      if (isWeekend(r.date) && tipo !== "On demand") issues.push({ file: r.file, tab: r.tab, row: r.row, tipo: "Recurso fijo con horas en fin de semana", detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 80)}` });
      row.auto = autoCount(row, person, keywords);
      dev.push(row);
    }
    // duplicados exactos dentro de la misma pestaña
    const seen = new Map();
    for (const r of dev) {
      const k = [r.file, r.tab, r.client, r.task, r.comm, r.date, r.hrs].join("|");
      if (seen.has(k)) issues.push({ file: r.file, tab: r.tab, row: r.row, tipo: `Posible duplicado de la fila ${seen.get(k)} (se está sumando)`, detalle: `${fmtDay(r.date)} · ${r.task.slice(0, 70)} · ${r.hrs} h` });
      else seen.set(k, r.row);
    }
    for (const [, name] of unknownPeople) issues.push({ file: "", tab: "", row: "", tipo: `"${name}" no está en Equipos`, detalle: "Agrégalo en Configuración para asignarle equipo y tipo" });
    for (const [name, n] of pmOwnRows) issues.push({ file: "", tab: "", row: "", tipo: `${n} filas propias de ${name} (PM) no se incluyen`, detalle: "Las horas del PM se calculan con la regla del equipo" });
    const excluded = roster.filter(p => p.tipo === "No incluir").map(p => key(p.dev));
    const tabExcluded = tab => { const k = key(tab).replace(/\.$/, ""); return k && excluded.some(e => e === k || e.split(" ")[0] === k.split(" ")[0]); };
    for (const t of parsed.tabs) if (t.rows === 0 && !tabExcluded(t.tab)) issues.push({ file: t.file, tab: t.tab, row: "", tipo: "Pestaña sin registros", detalle: "" });

    const order = r => [r.equipo, r.tipo === "On demand" ? 1 : 0, r.res, r.date].join("|");
    dev.sort((a, b) => order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0);

    // validación
    const people = new Map();
    for (const p of roster) if (p.tipo !== "PM" && p.tipo !== "No incluir") people.set(p.dev, { dev: p.dev, equipo: p.equipo || "SIN EQUIPO", tipo: p.tipo || "Fijo" });
    for (const r of dev) if (!people.has(r.res)) people.set(r.res, { dev: r.res, equipo: r.equipo, tipo: r.tipo });
    const validation = [...people.values()].sort((a, b) => (a.equipo + (a.tipo === "On demand" ? 1 : 0) + a.dev).localeCompare(b.equipo + (b.tipo === "On demand" ? 1 : 0) + b.dev)).map(p => {
      const perDay = {}; days.forEach(d => perDay[d] = 0);
      dev.filter(r => r.res === p.dev).forEach(r => perDay[r.date] += r.hrs);
      const total = days.reduce((s, d) => s + perDay[d], 0);
      let min = null, max = null, estado = "On demand";
      if (p.tipo !== "On demand") {
        min = weekdays.length * params.minDia; max = weekdays.length * params.maxDia;
        estado = total < min - 1e-9 ? `Faltan ${(min - total).toFixed(2)} h` : total > max + 1e-9 ? `Excede ${(total - max).toFixed(2)} h` : "OK";
      }
      return { ...p, perDay, total, min, max, estado };
    });

    // horas PM por equipo y día hábil
    const teams = [...new Set(dev.map(r => r.equipo))].sort();
    const pm = [];
    for (const t of teams) for (const d of weekdays) {
      const fixedVal = validation.filter(v => v.equipo === t && v.tipo === "Fijo");
      const devsFijos = fixedVal.filter(v => v.perDay[d] > 0).length;
      const horasFijos = fixedVal.reduce((s, v) => s + v.perDay[d], 0);
      const prom = devsFijos ? horasFijos / devsFijos : 0;
      const tareas = dev.filter(r => r.equipo === t && r.date === d && r.auto === "Sí").length;
      const horasPM = tareas === 0 ? 0 : prom >= params.umbral ? params.pmAlta : params.pmNormal;
      pm.push({ equipo: t, date: d, pm: teamPM[t] || "PM SIN ASIGNAR", devsFijos, horasFijos, prom, horasPM, tareas, porTarea: tareas ? horasPM / tareas : 0 });
    }
    const weekendTasks = dev.filter(r => isWeekend(r.date) && r.auto === "Sí").length;
    return { params, keywords, days, weekdays, dev, validation, pm, issues, teamPM, from, to, label: weekLabel(from, to), weekendTasks, roster };
  }

  /* ---------- Excel de salida (ExcelJS) ---------- */
  async function buildXlsx(ExcelJS, R, jobcodes) {
    const wb = new ExcelJS.Workbook();
    wb.calcProperties.fullCalcOnLoad = true;
    const F = { name: "Arial", size: 10 }, FB = { ...F, bold: true };
    const fill = c => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + c } });
    const HDR = fill("1F3864"), YEL = fill("FFF2CC"), PMF = fill("E2EFDA"), REDF = fill("F8CBAD"), GRNF = fill("C6EFCE");
    const header = (ws, rowNum, values, startCol = 1) => values.forEach((v, i) => { const c = ws.getCell(rowNum, startCol + i); c.value = v; c.font = { ...FB, color: { argb: "FFFFFFFF" } }; c.fill = HDR; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
    const L = n => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const toDate = s => new Date(s + "T00:00:00Z");
    const setFont = ws => ws.eachRow(r => r.eachCell(c => { if (!c.font || !c.font.bold) c.font = { ...F, ...(c.font && c.font.color ? { color: c.font.color } : {}) }; }));

    const wsC = wb.addWorksheet("Consolidado"), wsV = wb.addWorksheet("Validacion"), wsH = wb.addWorksheet("Horas PM"),
          wsI = wb.addWorksheet("Incidencias"), wsP = wb.addWorksheet("Parametros"), wsE = wb.addWorksheet("Equipos"), wsJ = wb.addWorksheet("JobCodes");

    // Parametros
    wsP.getCell("A1").value = "Parámetros del reporte"; wsP.getCell("A1").font = { ...FB, size: 12 };
    const prm = [["Semana desde", toDate(R.from)], ["Semana hasta", toDate(R.to)], ["Horas mínimas por día (recurso fijo)", R.params.minDia],
      ["Horas máximas por día (recurso fijo)", R.params.maxDia], ["Promedio del equipo (fijos) para usar jornada alta del PM", R.params.umbral],
      ["Horas PM por día - jornada normal", R.params.pmNormal], ["Horas PM por día - jornada alta", R.params.pmAlta]];
    prm.forEach((p, i) => { wsP.getCell(3 + i, 1).value = p[0]; const c = wsP.getCell(3 + i, 2); c.value = p[1]; c.fill = YEL; if (p[1] instanceof Date) c.numFmt = "dd/mm/yyyy"; });
    const MIN = "Parametros!$B$5", MAX = "Parametros!$B$6", UMB = "Parametros!$B$7", PMN = "Parametros!$B$8", PMA = "Parametros!$B$9";
    wsP.getCell("A12").value = "Palabras clave de reuniones RKD MTG / RKD MTGINT que SÍ cuentan para el PM"; wsP.getCell("A12").font = FB;
    wsP.getCell("A13").value = "Se buscan en Type of task + Task Name + Comments. Los espacios al inicio o final importan.";
    const KW0 = 14; for (let i = 0; i < 40; i++) { const c = wsP.getCell(KW0 + i, 1); c.value = R.keywords[i] != null ? R.keywords[i] : null; c.fill = YEL; }
    const KWR = `Parametros!$A$${KW0}:$A$${KW0 + 39}`;
    wsP.getColumn(1).width = 64; wsP.getColumn(2).width = 14;

    // Equipos
    header(wsE, 1, ["DEV (Resource)", "Equipo", "PM del equipo", "Tipo", "¿Sus tareas cuentan para el PM?"]);
    R.roster.forEach(p => wsE.addRow([p.dev, p.equipo, p.pm || "", p.tipo || "Fijo", p.cuentaPM || "Sí"]));
    [28, 20, 26, 12, 16].forEach((w, i) => wsE.getColumn(i + 1).width = w);
    // JobCodes
    header(wsJ, 1, ["Client", "JobCode"]); jobcodes.forEach(j => wsJ.addRow(j));
    const JC = `JobCodes!$A$2:$B$${Math.max(2, jobcodes.length + 1)}`;

    // Consolidado
    wsC.getCell("B1").value = R.label; wsC.getCell("B1").font = { ...FB, size: 12 };
    const hdr = ["Job #", "Client", "Task Name", "Comments", "Type of task", "Date", "Resource", "Hours", "Equipo", "Tipo recurso", "Tipo fila", "Cuenta PM (auto)", "Ajuste manual (Sí/No)", "Cuenta PM final", "Origen"];
    header(wsC, 2, hdr, 2);
    const r0 = 3;
    const common = (r, d) => {
      wsC.getCell(r, 2).value = { formula: `IFERROR(VLOOKUP(C${r},${JC},2,0),"NO EXISTE")` };
      wsC.getCell(r, 3).value = d.client; wsC.getCell(r, 4).value = d.task; wsC.getCell(r, 5).value = d.comm || null; wsC.getCell(r, 6).value = d.typ || null;
      const dc = wsC.getCell(r, 7); dc.value = toDate(d.date); dc.numFmt = "dd/mm/yyyy";
    };
    R.dev.forEach((d, i) => {
      const r = r0 + i; common(r, d);
      wsC.getCell(r, 8).value = d.res; wsC.getCell(r, 9).value = d.hrs; wsC.getCell(r, 10).value = d.equipo; wsC.getCell(r, 11).value = d.tipo; wsC.getCell(r, 12).value = "DEV";
      const t = `" "&LOWER(F${r}&" "&D${r}&" "&E${r})&" "`;
      wsC.getCell(r, 13).value = d.cuentaPMPersona === "No" ? "No" : { formula:
        `IF(LEFT(UPPER(TRIM(C${r})),3)<>"RKD","Sí",IF(OR(UPPER(TRIM(C${r}))="RKD MTG",UPPER(TRIM(C${r}))="RKD MTGINT"),IF(SUMPRODUCT((${KWR}<>"")*ISNUMBER(SEARCH(LOWER(${KWR}),${t})))>0,"Sí","No"),"No"))` };
      wsC.getCell(r, 14).fill = YEL;
      wsC.getCell(r, 14).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };
      wsC.getCell(r, 15).value = { formula: `IF(N${r}<>"",N${r},M${r})` };
      wsC.getCell(r, 16).value = `${d.tab} fila ${d.row}`;
    });
    const lastDev = r0 + R.dev.length - 1;
    let r = lastDev + 1;
    R.dev.forEach((d, i) => {
      const src = r0 + i, up = d.client.toUpperCase();
      if (d.cuentaPMPersona === "No") return;
      if (up.startsWith("RKD") && up !== "RKD MTG" && up !== "RKD MTGINT") return;
      common(r, d);
      wsC.getCell(r, 8).value = R.teamPM[d.equipo] || "PM SIN ASIGNAR";
      wsC.getCell(r, 9).value = { formula: `IF(O${r}="Sí",SUMIFS('Horas PM'!$I:$I,'Horas PM'!$A:$A,J${r},'Horas PM'!$B:$B,G${r}),0)` };
      wsC.getCell(r, 10).value = d.equipo; wsC.getCell(r, 11).value = "PM"; wsC.getCell(r, 12).value = "PM";
      wsC.getCell(r, 15).value = { formula: `O${src}` }; wsC.getCell(r, 16).value = `Fila ${src}`;
      for (let c = 2; c <= 16; c++) wsC.getCell(r, c).fill = PMF;
      r++;
    });
    const last = Math.max(r - 1, r0);
    for (let i = r0; i <= last; i++) wsC.getCell(i, 9).numFmt = "0.00";
    wsC.autoFilter = { from: { row: 2, column: 2 }, to: { row: last, column: 16 } };
    wsC.views = [{ state: "frozen", ySplit: 2 }];
    [3, 9, 12, 48, 28, 22, 11, 22, 8, 16, 11, 8, 11, 12, 11, 18].forEach((w, i) => wsC.getColumn(i + 1).width = w);
    wsC.addConditionalFormatting({ ref: `B${r0}:B${last}`, rules: [{ type: "cellIs", operator: "equal", formulae: ['"NO EXISTE"'], style: { fill: REDF } }] });
    const CR = col => `Consolidado!$${col}$${r0}:$${col}$${last}`;

    // Validacion
    wsV.getCell("A1").value = "Validación de horas por recurso"; wsV.getCell("A1").font = { ...FB, size: 12 };
    const nd = R.days.length;
    header(wsV, 3, ["Recurso", "Equipo", "Tipo", ...R.days.map(fmtDay), "Total", "Mínimo", "Máximo", "Estado"]);
    R.days.forEach((d, j) => { const c = wsV.getCell(2, 4 + j); c.value = toDate(d); c.numFmt = "dd/mm/yyyy"; c.font = { ...F, size: 8, color: { argb: "FF808080" } }; });
    const cT = 4 + nd, cMin = cT + 1, cMax = cT + 2, cE = cT + 3;
    const nWd = R.weekdays.length;
    R.validation.forEach((v, i) => {
      const rr = 4 + i;
      wsV.getCell(rr, 1).value = v.dev; wsV.getCell(rr, 2).value = v.equipo; wsV.getCell(rr, 3).value = v.tipo;
      R.days.forEach((d, j) => { const c = wsV.getCell(rr, 4 + j); c.value = { formula: `SUMIFS(${CR("I")},${CR("H")},$A${rr},${CR("G")},${L(4 + j)}$2,${CR("L")},"DEV")` }; c.numFmt = "0.00"; if (isWeekend(d)) c.fill = fill("EDEDED"); });
      wsV.getCell(rr, cT).value = { formula: `SUM(D${rr}:${L(3 + nd)}${rr})` }; wsV.getCell(rr, cT).numFmt = "0.00";
      const t = `${L(cT)}${rr}`, mn = `${L(cMin)}${rr}`, mx = `${L(cMax)}${rr}`;
      wsV.getCell(rr, cMin).value = { formula: `IF($C${rr}="On demand","",${nWd}*${MIN})` };
      wsV.getCell(rr, cMax).value = { formula: `IF($C${rr}="On demand","",${nWd}*${MAX})` };
      wsV.getCell(rr, cE).value = { formula: `IF($C${rr}="On demand","On demand: "&TEXT(${t},"0.00")&" h en la semana",IF(${t}<${mn},"Faltan "&TEXT(${mn}-${t},"0.00")&" h",IF(${t}>${mx},"Excede "&TEXT(${t}-${mx},"0.00")&" h","OK")))` };
    });
    const lv = 3 + Math.max(R.validation.length, 1);
    R.days.forEach((d, j) => {
      if (isWeekend(d)) return; const col = L(4 + j);
      wsV.addConditionalFormatting({ ref: `${col}4:${col}${lv}`, rules: [{ type: "expression", formulae: [`AND($C4="Fijo",OR(${col}4<${MIN},${col}4>${MAX}))`], style: { fill: REDF } }] });
    });
    wsV.addConditionalFormatting({ ref: `${L(cE)}4:${L(cE)}${lv}`, rules: [
      { type: "cellIs", operator: "equal", formulae: ['"OK"'], style: { fill: GRNF } },
      { type: "expression", formulae: [`AND($C4="Fijo",${L(cE)}4<>"OK")`], style: { fill: REDF } }] });
    wsV.getColumn(1).width = 24; wsV.getColumn(2).width = 18; wsV.getColumn(3).width = 11; wsV.getColumn(cE).width = 28;
    wsV.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];

    // Horas PM
    header(wsH, 1, ["Equipo", "Fecha", "PM", "DEVs fijos con horas", "Horas de los fijos", "Promedio por DEV fijo", "Horas PM del día", "Tareas que cuentan", "Horas PM por tarea", "Control: total asignado"]);
    let hr = 2;
    for (const p of R.pm) {
      const dcol = L(4 + R.days.indexOf(p.date));
      wsH.getCell(hr, 1).value = p.equipo; const dc = wsH.getCell(hr, 2); dc.value = toDate(p.date); dc.numFmt = "dd/mm/yyyy";
      wsH.getCell(hr, 3).value = p.pm;
      wsH.getCell(hr, 4).value = { formula: `COUNTIFS(Validacion!$B$4:$B$${lv},A${hr},Validacion!$C$4:$C$${lv},"Fijo",Validacion!$${dcol}$4:$${dcol}$${lv},">0")` };
      wsH.getCell(hr, 5).value = { formula: `SUMIFS(${CR("I")},${CR("J")},A${hr},${CR("G")},B${hr},${CR("K")},"Fijo",${CR("L")},"DEV")` };
      wsH.getCell(hr, 6).value = { formula: `IFERROR(E${hr}/D${hr},0)` };
      wsH.getCell(hr, 7).value = { formula: `IF(H${hr}=0,0,IF(F${hr}>=${UMB},${PMA},${PMN}))` };
      wsH.getCell(hr, 8).value = { formula: `COUNTIFS(${CR("J")},A${hr},${CR("G")},B${hr},${CR("L")},"DEV",${CR("O")},"Sí")` };
      wsH.getCell(hr, 9).value = { formula: `IFERROR(G${hr}/H${hr},0)` };
      wsH.getCell(hr, 10).value = { formula: `SUMIFS(${CR("I")},${CR("J")},A${hr},${CR("G")},B${hr},${CR("L")},"PM")` };
      [5, 6, 7, 9, 10].forEach(c => wsH.getCell(hr, c).numFmt = "0.00");
      hr++;
    }
    wsH.getCell(hr, 1).value = "TOTAL"; wsH.getCell(hr, 1).font = FB;
    [5, 7, 8, 10].forEach(c => { wsH.getCell(hr, c).value = { formula: `SUM(${L(c)}2:${L(c)}${hr - 1})` }; wsH.getCell(hr, c).numFmt = "0.00"; });
    wsH.addConditionalFormatting({ ref: `J2:J${Math.max(2, hr - 1)}`, rules: [{ type: "expression", formulae: ["ROUND(J2,2)<>ROUND(G2,2)"], style: { fill: REDF } }] });
    [18, 11, 24, 10, 10, 10, 10, 10, 10, 12].forEach((w, i) => wsH.getColumn(i + 1).width = w);
    wsH.views = [{ state: "frozen", ySplit: 1 }];

    // Incidencias
    header(wsI, 1, ["Archivo", "Pestaña", "Fila", "Incidencia", "Detalle"]);
    R.issues.forEach(i => wsI.addRow([i.file, i.tab, i.row, i.tipo, i.detalle]));
    [30, 18, 7, 60, 70].forEach((w, i) => wsI.getColumn(i + 1).width = w);

    [wsC, wsV, wsH, wsI, wsP, wsE, wsJ].forEach(setFont);
    return wb.xlsx.writeBuffer();
  }

  G.TS = { parseTimesheetWorkbook, parseJobCodes, weeksFromRows, compute, buildXlsx, fmtDay, isWeekend, DEFAULT_PARAMS, key, weekLabel };
})(typeof window !== "undefined" ? window : globalThis);
