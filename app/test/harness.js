// Mini arnés de pruebas para el navegador. Sin dependencias.

const results = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  results.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  const t = { name, ok: true, error: null };
  try {
    fn();
  } catch (e) {
    t.ok = false;
    t.error = e && e.message ? e.message : String(e);
  }
  (current ? current.tests : (results.push({ name: "(suelto)", tests: [] }), results[results.length - 1].tests)).push(t);
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`esperado ${fmt(expected)}, recibido ${fmt(actual)}`);
    },
    toBeCloseTo(expected, digits = 2) {
      const diff = Math.abs(Number(actual) - Number(expected));
      const tol = Math.pow(10, -digits) / 2;
      if (!(diff < tol)) throw new Error(`esperado ≈${expected} (${digits}d), recibido ${actual}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`esperado ${fmt(expected)}, recibido ${fmt(actual)}`);
      }
    },
  };
}

function fmt(v) {
  if (typeof v === "string") return `"${v}"`;
  return JSON.stringify(v);
}

export function render(el) {
  let pass = 0;
  let fail = 0;
  const parts = [];
  for (const suite of results) {
    parts.push(`<h3>${escapeHtml(suite.name)}</h3><ul>`);
    for (const t of suite.tests) {
      if (t.ok) pass++;
      else fail++;
      parts.push(
        `<li class="${t.ok ? "ok" : "fail"}">${t.ok ? "✓" : "✗"} ${escapeHtml(t.name)}` +
          (t.ok ? "" : `<div class="err">${escapeHtml(t.error)}</div>`) +
          `</li>`
      );
    }
    parts.push("</ul>");
  }
  const summary = `<div class="summary ${fail ? "fail" : "ok"}">${pass} pasaron · ${fail} fallaron</div>`;
  el.innerHTML = summary + parts.join("");
  return { pass, fail };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
