// Suite de pruebas: verifica el core contra los valores esperados de
// docs/05-casos-de-prueba.md usando los fixtures reales de octubre 2026.

import { describe, it, expect, render } from "./harness.js";
import {
  parseTimesheetWorkbook,
  compute,
  normClient,
  closestJobCode,
  autoCount,
  weekLabel,
  buildConsolidadoRows,
} from "../src/core/index.js";

const XLSX = window.XLSX;

async function readWorkbook(url) {
  const buf = await fetch(url).then((r) => r.arrayBuffer());
  return XLSX.read(buf, { type: "array" });
}

function sumPM(R) {
  return R.pm.reduce((s, p) => s + p.horasPM, 0);
}

function pmRow(R, equipo, dateIso) {
  return R.pm.find((p) => p.equipo === equipo && p.date === dateIso);
}

function val(R, dev) {
  return R.validation.find((v) => v.dev === dev);
}

async function main() {
  const out = document.getElementById("out");
  out.textContent = "Cargando configuración y fixtures…";

  // Config anónima para pruebas (coincide con los fixtures *.anon.xlsx).
  const cfgBase = await fetch("./fixtures/config.anon.json").then((r) => r.json());
  const jc = await fetch("../config/jobcodes.json").then((r) => r.json());
  const cfg = { ...cfgBase, jobcodes: jc.map((j) => [j.client, j.jobCode]) };
  const known = new Set(cfg.jobcodes.map((j) => String(j[0]).toUpperCase()));
  const aliasMap = {};
  (cfg.aliases || []).forEach((a) => (aliasMap[String(a.de).toUpperCase()] = a.a));

  // ---------- Unitarios (sin fixture) ----------
  describe("Caso 7 · Normalización de Job Code", () => {
    it("RKD MtgInt -> RKD MTGINT", () => expect(normClient("RKD MtgInt", "", aliasMap, known)).toBe("RKD MTGINT"));
    it("RKD Mtg -> RKD MTG", () => expect(normClient("RKD Mtg", "", aliasMap, known)).toBe("RKD MTG"));
    it("RKD Train -> RKD TRAIN", () => expect(normClient("RKD Train", "", aliasMap, known)).toBe("RKD TRAIN"));
    it("CGMOH: -> CGMOH", () => expect(normClient("CGMOH:", "", aliasMap, known)).toBe("CGMOH"));
    it("HCPFB -> HCSFL (alias)", () => expect(normClient("HCPFB", "", aliasMap, known)).toBe("HCSFL"));
    it("vacío + Task 'BVRPA: Halloween' -> BVRPA", () =>
      expect(normClient("", "BVRPA: Halloween party", aliasMap, known)).toBe("BVRPA"));
    it("'NTFB ' (con espacio) -> NTFB", () => expect(normClient("NTFB ", "", aliasMap, known)).toBe("NTFB"));
    it("RKD MTG INT -> RKD MTGINT", () => expect(normClient("RKD MTG INT", "", aliasMap, known)).toBe("RKD MTGINT"));
  });

  describe("Typos de Job Code (sugerencia)", () => {
    it("BRF -> BFF (1 cambio)", () => expect(closestJobCode("BRF", known)).toBe("BFF"));
    it("NFNMS -> MFNMS (1 cambio)", () => expect(closestJobCode("NFNMS", known)).toBe("MFNMS"));
    it("código ya conocido no sugiere nada", () => expect(closestJobCode("BFF", known)).toBe(""));
    it("demasiado corto no sugiere", () => expect(closestJobCode("AB", known)).toBe(""));
    it("sin parecido no sugiere", () => expect(closestJobCode("ZZZZZZ", known)).toBe(""));
    it("usa el código al inicio del Task para corregir el Client", () =>
      expect(closestJobCode("MFNM", known, "MFNMS: Molly's Mobile Market - Email 2A")).toBe("MFNMS"));
    it("ignora el Task si su código no se parece al Client", () =>
      expect(closestJobCode("XQWPL", known, "BFF: eNews - 10/19 @ 10am")).toBe(""));
  });

  describe("Caso 6 · ¿Cuenta para el PM?", () => {
    const mk = (client, typ = "") => ({ client, typ });
    it("BFF (no RKD) -> Sí", () => expect(autoCount(mk("BFF"))).toBe("Sí"));
    it("RKD MTG con type 'Daily meeting' -> Sí", () => expect(autoCount(mk("RKD MTG", "Daily meeting"))).toBe("Sí"));
    it("RKD MTGINT con type 'Daily meeting' -> Sí", () => expect(autoCount(mk("RKD MTGINT", "daily meeting"))).toBe("Sí"));
    it("RKD MTG con otro type -> No", () => expect(autoCount(mk("RKD MTG", "Meeting"))).toBe("No"));
    it("RKD MTG sin type -> No", () => expect(autoCount(mk("RKD MTG", ""))).toBe("No"));
    it("RKD TRAIN -> No", () => expect(autoCount(mk("RKD TRAIN", "Training"))).toBe("No"));
    it("cuentaPM=No con BFF -> No", () => expect(autoCount(mk("BFF"), { cuentaPM: "No" })).toBe("No"));
  });

  describe("Semanas · etiquetas", () => {
    it("1-4 oct -> '1-2 OCT'", () => expect(weekLabel("2026-10-01", "2026-10-04")).toBe("1-2 OCT"));
    it("5-11 oct -> '5-9 OCT'", () => expect(weekLabel("2026-10-05", "2026-10-11")).toBe("5-9 OCT"));
  });

  // ---------- Fixtures reales ----------
  out.textContent = "Leyendo team.xlsx…";
  const wb = await readWorkbook("./fixtures/team.anon.xlsx");
  const parsed = parseTimesheetWorkbook(XLSX, wb, "team.xlsx");
  const R = compute(parsed, cfg, "2026-10-01", "2026-10-04");

  describe("Caso 2 · Totales de la semana 1 (1-2 OCT)", () => {
    it("etiqueta = '1-2 OCT'", () => expect(R.label).toBe("1-2 OCT"));
    it("filas DEV incluidas = 405", () => expect(R.dev.length).toBe(405));
    it("filas DEV auto 'Sí' = 360", () => expect(R.dev.filter((d) => d.auto === "Sí").length).toBe(360));
    it("personas en Validación = 22", () => expect(R.validation.length).toBe(22));
    it("incidencias = 23", () => expect(R.issues.length).toBe(23));
    it("horas PM totales = 66", () => expect(sumPM(R)).toBe(66));
  });

  describe("Caso 3 · Validación (semana 1)", () => {
    it("Email Dev 3 total 18.25 · Excede 1.25 (día de 10.25)", () => {
      const v = val(R, "Email Dev 3");
      expect(v.total).toBeCloseTo(18.25, 2);
      expect(v.estado).toBe("Excede 1.25 h");
    });
    it("Web Dev 2 total 14.5 · Faltan 1.50", () => {
      const v = val(R, "Web Dev 2");
      expect(v.total).toBeCloseTo(14.5, 2);
      expect(v.estado).toBe("Faltan 1.50 h");
    });
    it("Standard Dev 3 total 18 · Excede 1.00 (día de 10h)", () => {
      const v = val(R, "Standard Dev 3");
      expect(v.total).toBeCloseTo(18, 2);
      expect(v.estado).toBe("Excede 1.00 h");
    });
    it("QA Dev 6 total 16 · OK (redondeo)", () => {
      const v = val(R, "QA Dev 6");
      expect(v.total).toBeCloseTo(16, 2);
      expect(v.estado).toBe("OK");
    });
    it("Email OnDem 2 · On demand 11.5", () => {
      const v = val(R, "Email OnDem 2");
      expect(v.tipo).toBe("On demand");
      expect(v.total).toBeCloseTo(11.5, 2);
    });
    it("QA OnDem 1 existe con total 0", () => {
      const v = val(R, "QA OnDem 1");
      expect(!!v).toBe(true);
      expect(v.total).toBeCloseTo(0, 2);
    });
    it("QA PM (PM) no aparece", () => expect(!!val(R, "QA PM")).toBe(false));
    it("Ops 1 (No incluir) no aparece", () => expect(!!val(R, "Ops 1")).toBe(false));
  });

  describe("Caso 4 · Horas PM (semana 1)", () => {
    const check = (equipo, d, devsFijos, horasFijos, prom, horasPM, tareas) => {
      const p = pmRow(R, equipo, d);
      expect(p.devsFijos).toBe(devsFijos);
      expect(p.horasFijos).toBeCloseTo(horasFijos, 2);
      expect(p.prom).toBeCloseTo(prom, 2);
      expect(p.horasPM).toBe(horasPM);
      expect(p.tareas).toBe(tareas);
    };
    it("Email 01/10: 5 · 43.70 · 8.74 · 9 · 66", () => check("Email", "2026-10-01", 5, 43.7, 8.74, 9, 66));
    it("Email 02/10: 5 · 40.00 · 8.00 · 8 · 63 (daily de-duplicada)", () => check("Email", "2026-10-02", 5, 40, 8, 8, 63));
    it("QA 01/10: 7 · 56.00 · 8.00 · 8 · 78", () => check("QA", "2026-10-01", 7, 56, 8, 8, 78));
    it("QA 02/10: 7 · 56.00 · 8.00 · 8 · 88", () => check("QA", "2026-10-02", 7, 56, 8, 8, 88));
    it("Standard 01/10: 4 · 34.00 · 8.50 · 9 · 17", () => check("Standard", "2026-10-01", 4, 34, 8.5, 9, 17));
    it("Standard 02/10: 4 · 32.00 · 8.00 · 8 · 12", () => check("Standard", "2026-10-02", 4, 32, 8, 8, 12));
    it("Web 01/10: 3 · 24.00 · 8.00 · 8 · 16", () => check("Web", "2026-10-01", 3, 24, 8, 8, 16));
    it("Web 02/10: 3 · 22.50 · 7.50 · 8 · 11", () => check("Web", "2026-10-02", 3, 22.5, 7.5, 8, 11));
  });

  describe("Caso · Copiar para el cliente (Consolidado B:I)", () => {
    const rows = buildConsolidadoRows(R, cfg.jobcodes.map((j) => [j[0], j[1]]));
    it("total de filas = 756 (405 DEV + 351 espejo PM; dailies de-duplicadas)", () => expect(rows.length).toBe(756));
    it("la suma de horas PM por equipo/día es exactamente 8 o 9", () => {
      const pmNames = new Set(Object.values(R.teamPM));
      const byKey = {};
      for (const r of rows) if (pmNames.has(r[6])) byKey[r[6] + "|" + r[5]] = (byKey[r[6] + "|" + r[5]] || 0) + r[7];
      const weekdaySums = Object.entries(byKey)
        .filter(([k]) => !/0[34]\/10\/2026$/.test(k))
        .map(([, v]) => Math.round(v * 100) / 100);
      const ok = weekdaySums.length > 0 && weekdaySums.every((s) => s === 8 || s === 9);
      expect(ok).toBe(true);
    });
  });

  describe("Feriados (opcional, apagado por defecto)", () => {
    const cfgH = { ...cfg, feriados: [{ fecha: "2026-10-01", nombre: "Prueba" }] };
    const RH = compute(parsed, cfgH, "2026-10-01", "2026-10-04");
    it("sin feriados configurados, no cambia nada (2 días hábiles)", () => expect(R.weekdays.length).toBe(2));
    it("con feriado el jue 01/10, los días hábiles bajan a 1", () => expect(RH.weekdays.length).toBe(1));
    it("el feriado no genera horas de PM", () => expect(RH.pm.some((p) => p.date === "2026-10-01")).toBe(false));
    it("el mínimo de un fijo baja a 8 (1 día hábil)", () => {
      const v = RH.validation.find((x) => x.dev === "Email Dev 3");
      expect(v.min).toBe(8);
    });
  });

  describe("Ajuste manual Sí/No (override)", () => {
    const base = compute(parsed, cfg, "2026-10-01", "2026-10-04");
    it("sin overrides, la regla final es igual a la automática", () =>
      expect(base.dev.every((d) => d.final === d.auto)).toBe(true));
    const pmWeb = base.pm.find((p) => p.equipo === "Web" && p.date === "2026-10-01");
    const target = base.dev.find((d) => d.equipo === "Web" && d.date === "2026-10-01" && d.final === "Sí");
    const RH = compute(parsed, cfg, "2026-10-01", "2026-10-04", { [target.key]: "No" });
    const pmWeb2 = RH.pm.find((p) => p.equipo === "Web" && p.date === "2026-10-01");
    it("override 'No' baja en 1 las tareas del equipo/día", () => expect(pmWeb2.tareas).toBe(pmWeb.tareas - 1));
  });

  describe("Caso 5 · Filas ocultas (Standard Dev 3, filas 113-117)", () => {
    const v = R.validation.find((x) => x.dev === "Standard Dev 3");
    it("queda con 10 h el 01/10 (8 reales + 2 duplicadas)", () =>
      expect(v.perDay["2026-10-01"]).toBeCloseTo(10, 2));
    const dupRows = R.issues.filter((i) => /duplicado/.test(i.tipo) && [113, 114, 115].includes(+i.row)).length;
    it("genera duplicado en las filas 113, 114 y 115", () => expect(dupRows).toBe(3));
    const subRows = R.issues.filter(
      (i) => /Fila sin Client ni Task Name/.test(i.tipo) && [116, 117].includes(+i.row)
    ).length;
    it("excluye como subtotal las filas 116 y 117", () => expect(subRows).toBe(2));
  });

  describe("Ignorar duplicados (dedupe)", () => {
    const Rd = compute(parsed, cfg, "2026-10-01", "2026-10-04", {}, { dedupe: true });
    it("excluye duplicados: Standard Dev 3 queda con 8 h el 01/10", () => {
      const v = Rd.validation.find((x) => x.dev === "Standard Dev 3");
      expect(v.perDay["2026-10-01"]).toBeCloseTo(8, 2);
    });
    it("con dedupe hay 6 filas DEV menos (los 6 duplicados; el Type de tarea distingue)", () => expect(Rd.dev.length).toBe(R.dev.length - 6));
  });

  describe("Ignorar persona (check del roster)", () => {
    const cfgIgnore = {
      ...cfg,
      roster: cfg.roster.map((p) => (p.dev === "QA Dev 6" ? { ...p, ignorar: true } : p)),
    };
    const Ri = compute(parsed, cfgIgnore, "2026-10-01", "2026-10-04", {});
    it("aparece sin ignorar", () => expect(!!val(R, "QA Dev 6")).toBe(true));
    it("con ignorar=true desaparece de Validación", () => expect(val(Ri, "QA Dev 6")).toBe(undefined));
    it("con ignorar=true sus horas no se cuentan como registros DEV", () =>
      expect(Ri.dev.some((d) => d.res === "QA Dev 6")).toBe(false));
  });

  describe("Reuniones del PM (exactas + promedio + de-dup)", () => {
    const mkRow = (res, client, task, typ, comm, hrs, n) => ({
      kind: "data", file: "f", tab: res, row: n, seq: n,
      client, task, taskUrl: "", comm, commUrl: "", typ, date: "2026-10-01", res, hrs,
    });
    const parsedM = {
      rows: [
        mkRow("Dev W", "BFF", "work1", "Build", "", 4, 1),
        mkRow("Dev K", "BFF", "work2", "Build", "", 4, 2),
        mkRow("Dev W", "RKD MTG", "daily", "Daily meeting", "", 0.25, 3),
        mkRow("Dev K", "RKD MTG", "daily", "Daily meeting", "", 0.25, 4),
        mkRow("Dev W", "RKD MTG", "1:1", "1:1 Meeting", "1:1 with PM", 0.5, 5),
        mkRow("Dev W", "RKD MTG", "ops", "Meeting with ops", "ops sync", 0.5, 6),
        mkRow("Dev K", "RKD MTG", "ops", "Meeting with ops", "ops sync", 0.5, 7),
      ],
      issues: [],
      tabs: [],
    };
    const cfgM = {
      params: { minDia: 8, maxDia: 9, umbral: 8.5, pmNormal: 8, pmAlta: 9 },
      roster: [
        { dev: "Guille", equipo: "X", pm: "Guille", tipo: "PM", cuentaPM: "Sí" },
        { dev: "Dev W", equipo: "X", pm: "Guille", tipo: "Fijo", cuentaPM: "Sí" },
        { dev: "Dev K", equipo: "X", pm: "Guille", tipo: "Fijo", cuentaPM: "Sí" },
      ],
      aliases: [],
      feriados: [],
      jobcodes: [["BFF", "100"], ["RKD MTG", "200"]],
    };
    const RM = compute(parsedM, cfgM, "2026-10-01", "2026-10-01");
    const pmX = RM.pm.find((p) => p.equipo === "X");
    const consM = buildConsolidadoRows(RM, cfgM.jobcodes);
    const pmRowsM = consM.filter((r) => r[6] === "Guille"); // [job,client,task,comm,typ,date,res,hrs]
    const sum = (arr) => Math.round(arr.reduce((s, r) => s + r[7], 0) * 100) / 100;

    it("horas PM del día = 8", () => expect(pmX.horasPM).toBe(8));
    it("filas espejo del PM = 5 (daily+1:1+ops+2 cliente)", () => expect(pmX.tareas).toBe(5));
    it("la suma de horas del PM = 8", () => expect(sum(pmRowsM)).toBe(8));
    it("una sola daily con 0.25 exacta", () => {
      const dailies = pmRowsM.filter((r) => r[4] === "Daily meeting");
      expect(dailies.length).toBe(1);
      expect(dailies[0][7]).toBeCloseTo(0.25, 2);
    });
    it("una sola ops con 0.5 exacta (de-duplicada)", () => {
      const ops = pmRowsM.filter((r) => /ops/i.test(r[4]));
      expect(ops.length).toBe(1);
      expect(ops[0][7]).toBeCloseTo(0.5, 2);
    });
    it("1:1 con etiqueta '1:1 Dev W' y 0.5 exacta", () => {
      const uno = pmRowsM.filter((r) => r[4] === "1:1 Meeting");
      expect(uno.length).toBe(1);
      expect(uno[0][7]).toBeCloseTo(0.5, 2);
      expect(uno[0][3]).toBe("1:1 Dev W");
    });
    it("el resto (6.75) se reparte entre las 2 tareas de cliente (3.375 c/u)", () => {
      const cli = pmRowsM.filter((r) => r[1] === "BFF");
      expect(cli.length).toBe(2);
      cli.forEach((r) => expect(r[7]).toBeCloseTo(3.375, 3));
    });
  });

  render(out);
}

main().catch((e) => {
  document.getElementById("out").innerHTML =
    `<div class="summary fail">Error al correr las pruebas: ${e && e.message ? e.message : e}</div>`;
  console.error(e);
});
