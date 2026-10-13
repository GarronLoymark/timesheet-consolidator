// Reglas de "¿la tarea cuenta para el PM?" — sección 7 de las reglas.

/**
 * Tipo de reunión del PM según el Type of task (va con hora exacta, no se promedia).
 * @param {{typ:string}} r
 * @returns {"daily"|"ops"|"1on1"|""}
 */
export function meetingKind(r) {
  const t = String(r.typ || "").trim().toLowerCase();
  if (t === "daily meeting") return "daily";
  if (t === "1:1 meeting") return "1on1";
  if (t.includes("ops")) return "ops";
  return "";
}

/**
 * Regla automática de conteo para el PM.
 * - Las reuniones del PM (daily / ops / 1:1, por Type) cuentan (van exactas).
 * - Todo el trabajo de clientes (no RKD) cuenta (se promedia).
 * - Holiday y cualquier otro RKD (TRAIN, PTO, MTG de otro tipo) no cuentan.
 * @param {{client:string, typ:string}} r
 * @param {{cuentaPM?:string}|undefined} person
 * @returns {"Sí"|"No"}
 */
export function autoCount(r, person) {
  if (person && person.cuentaPM === "No") return "No";
  if (String(r.typ || "").trim().toLowerCase() === "holiday") return "No";
  if (meetingKind(r)) return "Sí"; // daily / ops / 1:1
  const c = r.client.toUpperCase();
  if (!c.startsWith("RKD")) return "Sí"; // trabajo de clientes
  return "No"; // RKD TRAIN, RKD PTO, RKD MTG de otro tipo, etc.
}
