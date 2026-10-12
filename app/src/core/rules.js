// Reglas de "¿la tarea cuenta para el PM?" — sección 7 de las reglas.

/**
 * Regla automática de conteo para el PM.
 * - Todo el trabajo de clientes (no RKD) cuenta.
 * - RKD MTG / RKD MTGINT cuentan solo si el Type of task es "Daily meeting".
 * - Cualquier otro RKD (TRAIN, PTO, etc.) no cuenta.
 * @param {{client:string, typ:string}} r
 * @param {{cuentaPM?:string}|undefined} person
 * @returns {"Sí"|"No"}
 */
export function autoCount(r, person) {
  if (person && person.cuentaPM === "No") return "No";
  const c = r.client.toUpperCase();
  if (!c.startsWith("RKD")) return "Sí"; // todo el trabajo de clientes cuenta
  if (c === "RKD MTG" || c === "RKD MTGINT") {
    return String(r.typ || "").trim().toLowerCase() === "daily meeting" ? "Sí" : "No";
  }
  return "No"; // RKD TRAIN, RKD PTO, etc.
}
