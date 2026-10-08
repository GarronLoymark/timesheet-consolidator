// Suite de pruebas: verifica el core contra los valores esperados de
// docs/05-casos-de-prueba.md usando los fixtures reales de octubre 2026.

import { describe, it, expect, render } from "./harness.js";
import { loadConfig } from "../src/config.js";
import {
  parseTimesheetWorkbook,
  compute,
  normClient,
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

  const cfg = await loadConfig("../config");
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

  describe("Caso 6 · ¿Cuenta para el PM?", () => {
    const kw = cfg.keywords;
    const mk = (client, task = "", typ = "", comm = "") => ({ client, task, typ, comm });
    it("BFF (no RKD) -> Sí", () => expect(autoCount(mk("BFF", "Homepage Banner"), undefined, kw)).toBe("Sí"));
    it("RKD MTG Daily Scrum -> Sí", () => expect(autoCount(mk("RKD MTG", "Daily Scrum", "Meeting"), undefined, kw)).toBe("Sí"));
    it("RKD MTG 'Implementation review' -> No", () =>
      expect(autoCount(mk("RKD MTG", "Implementation review", "Meeting"), undefined, kw)).toBe("No"));
    it("RKD MTG 'Sync with PM about scope' -> Sí", () =>
      expect(autoCount(mk("RKD MTG", "Sync with PM about scope", "Meeting"), undefined, kw)).toBe("Sí"));
    it("RKD TRAIN -> No", () => expect(autoCount(mk("RKD TRAIN", "Lightboxes training"), undefined, kw)).toBe("No"));
    it("cuentaPM=No con BFF -> No", () => expect(autoCount(mk("BFF", "x"), { cuentaPM: "No" }, kw)).toBe("No"));
    it("keyword vacía no hace que todo cuente", () =>
      expect(autoCount(mk("RKD MTG", "nada"), undefined, ["", ...kw.filter((k) => k !== "daily")])).toBe("No"));
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
    it("filas DEV auto 'Sí' = 375", () => expect(R.dev.filter((d) => d.auto === "Sí").length).toBe(375));
    it("personas en Validación = 22", () => expect(R.validation.length).toBe(22));
    it("incidencias = 24", () => expect(R.issues.length).toBe(24));
    it("horas PM totales = 66", () => expect(sumPM(R)).toBe(66));
  });

  describe("Caso 3 · Validación (semana 1)", () => {
    it("Email Dev 3 total 18.25 · Excede 0.25", () => {
      const v = val(R, "Email Dev 3");
      expect(v.total).toBeCloseTo(18.25, 2);
      expect(v.estado).toBe("Excede 0.25 h");
    });
    it("Web Dev 2 total 14.5 · Faltan 1.50", () => {
      const v = val(R, "Web Dev 2");
      expect(v.total).toBeCloseTo(14.5, 2);
      expect(v.estado).toBe("Faltan 1.50 h");
    });
    it("Standard Dev 3 total 18 · OK", () => {
      const v = val(R, "Standard Dev 3");
      expect(v.total).toBeCloseTo(18, 2);
      expect(v.estado).toBe("OK");
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
    it("Email 01/10: 5 · 43.70 · 8.74 · 9 · 67", () => check("Email", "2026-10-01", 5, 43.7, 8.74, 9, 67));
    it("Email 02/10: 5 · 40.00 · 8.00 · 8 · 67", () => check("Email", "2026-10-02", 5, 40, 8, 8, 67));
    it("QA 01/10: 7 · 56.00 · 8.00 · 8 · 79", () => check("QA", "2026-10-01", 7, 56, 8, 8, 79));
    it("QA 02/10: 7 · 56.00 · 8.00 · 8 · 88", () => check("QA", "2026-10-02", 7, 56, 8, 8, 88));
    it("Standard 01/10: 4 · 34.00 · 8.50 · 9 · 22", () => check("Standard", "2026-10-01", 4, 34, 8.5, 9, 22));
    it("Standard 02/10: 4 · 32.00 · 8.00 · 8 · 16", () => check("Standard", "2026-10-02", 4, 32, 8, 8, 16));
    it("Web 01/10: 3 · 24.00 · 8.00 · 8 · 18", () => check("Web", "2026-10-01", 3, 24, 8, 8, 18));
    it("Web 02/10: 3 · 22.50 · 7.50 · 8 · 13", () => check("Web", "2026-10-02", 3, 22.5, 7.5, 8, 13));
  });

  describe("Caso · Copiar para el cliente (Consolidado B:I)", () => {
    const rows = buildConsolidadoRows(R, cfg.jobcodes.map((j) => [j[0], j[1]]));
    it("total de filas = 795 (405 DEV + 390 espejo PM)", () => expect(rows.length).toBe(795));
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

  render(out);
}

main().catch((e) => {
  document.getElementById("out").innerHTML =
    `<div class="summary fail">Error al correr las pruebas: ${e && e.message ? e.message : e}</div>`;
  console.error(e);
});
