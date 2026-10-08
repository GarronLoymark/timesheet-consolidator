// Runner de CI con Playwright: corre la suite de pruebas del navegador y genera
// el Excel de salida para la verificación del Caso 8. Sale con código !=0 si algo falla.
import { chromium } from "playwright";
import { writeFileSync, statSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8777";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.error("[page error]", m.text());
});

// 1) Suite de pruebas (tests.html)
await page.goto(`${BASE}/test/tests.html`, { waitUntil: "load" });
await page.waitForFunction(() => {
  const s = document.querySelector(".summary");
  return s && /\d+ pasaron/.test(s.textContent);
}, { timeout: 60000 });
const summary = await page.$eval(".summary", (e) => e.textContent.trim());
const fails = await page.$$eval("li.fail", (els) => els.map((e) => e.textContent.trim()));
console.log("Suite:", summary);
if (fails.length) {
  fails.forEach((f) => console.error("FAIL:", f));
  await browser.close();
  process.exit(1);
}

// 2) Generar el Excel de salida (Caso 8) desde index.html (tiene XLSX y ExcelJS)
await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
const bytes = await page.evaluate(async () => {
  const core = await import("/src/core/index.js");
  const { jobcodesForExcel, loadConfig } = await import("/src/config.js");
  const cfg = await loadConfig("/config");
  const data = await fetch("/test/fixtures/team.anon.xlsx").then((r) => r.arrayBuffer());
  const wb = window.XLSX.read(data, { type: "array" });
  const parsed = core.parseTimesheetWorkbook(window.XLSX, wb, "team.anon.xlsx");
  const R = core.compute(parsed, cfg, "2026-10-01", "2026-10-04");
  const out = await core.buildXlsx(window.ExcelJS, R, jobcodesForExcel(cfg.jobcodes));
  return Array.from(new Uint8Array(out));
});
writeFileSync("out.xlsx", Buffer.from(bytes));
console.log("Excel generado: out.xlsx", statSync("out.xlsx").size, "bytes");

await browser.close();
console.log("CI runner OK");
