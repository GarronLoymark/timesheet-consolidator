// Normalización del Job Code (columna Client) — sección 6 de las reglas.

import { clean } from "./text.js";

/**
 * Normaliza el valor de Client a un Job Code.
 * @param {string} raw        Valor crudo de Client
 * @param {string} task       Task Name (respaldo si Client viene vacío)
 * @param {Record<string,string>} aliasMap  Alias en MAYÚSCULAS -> código correcto
 * @param {Set<string>} known Códigos conocidos en MAYÚSCULAS
 * @returns {string}
 */
export function normClient(raw, task, aliasMap, known) {
  let c = clean(raw);
  if (!c && task) c = clean(String(task).slice(0, 5)); // respaldo: primeros 5 del Task Name
  c = c.replace(/:+$/, "").trim(); // quitar ":" finales (CGMOH: -> CGMOH)

  const up = c.toUpperCase();
  if (aliasMap[up]) return aliasMap[up]; // alias (HCPFB -> HCSFL)
  if (up.startsWith("RKD")) return up === "RKD MTG INT" ? "RKD MTGINT" : up;
  return known.has(up) ? up : c; // conocido -> MAYÚSCULAS; desconocido -> tal cual
}

/** Distancia de edición de Levenshtein entre dos cadenas. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Extrae el código que suele venir al inicio del Task Name
 * ("FBNYC - TTT - …" o "MFNMS: Molly's…" -> "FBNYC"/"MFNMS").
 * @param {string} task
 * @returns {string}  Código en MAYÚSCULAS, o "" si no hay uno reconocible.
 */
export function codeFromTask(task) {
  const t = clean(task);
  if (!t) return "";
  const m = /^([A-Za-z]{2,8})\b/.exec(t);
  return m ? m[1].toUpperCase() : "";
}

/**
 * Sugiere el Job Code conocido más cercano a un código desconocido (posible typo).
 * Si el Task Name empieza con un código conocido parecido al Client, se prioriza
 * ese (misma tarea, Client mal escrito).
 * @param {string} code  Código desconocido (se compara en MAYÚSCULAS)
 * @param {Iterable<string>} known  Códigos conocidos en MAYÚSCULAS
 * @param {string} [task]  Task Name (respaldo para confirmar el typo)
 * @returns {string}  Mejor coincidencia, o "" si ninguna es lo bastante cercana
 */
export function closestJobCode(code, known, task) {
  const up = String(code || "").toUpperCase().trim();
  if (up.length < 3) return "";
  const knownSet = known instanceof Set ? known : new Set(known);
  if (knownSet.has(up)) return ""; // ya es conocido
  // Umbral según largo: códigos cortos toleran 1 cambio, largos hasta 2.
  const maxDist = up.length <= 5 ? 1 : 2;

  // 1) El Task empieza con un código conocido parecido al Client: alta confianza.
  const fromTask = codeFromTask(task);
  if (fromTask && fromTask !== up && knownSet.has(fromTask) && levenshtein(up, fromTask) <= maxDist) {
    return fromTask;
  }

  // 2) Comparación de Levenshtein contra todos los códigos conocidos.
  let best = "";
  let bestDist = Infinity;
  for (const k of knownSet) {
    const d = levenshtein(up, k);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return bestDist <= maxDist ? best : "";
}
