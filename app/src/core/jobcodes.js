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
