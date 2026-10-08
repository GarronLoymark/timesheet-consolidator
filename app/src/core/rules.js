// Reglas de "¿la tarea cuenta para el PM?" — sección 7 de las reglas.

/**
 * ¿La fila (reunión RKD MTG / RKD MTGINT) coincide con alguna palabra clave?
 * Se buscan en Type of task + Task Name + Comments, con espacios a los lados.
 * @param {{typ:string, task:string, comm:string}} r
 * @param {string[]} keywords
 */
function meetingCounts(r, keywords) {
  const text = " " + (r.typ + " " + r.task + " " + r.comm).toLowerCase() + " ";
  return keywords.some((k) => k !== "" && text.includes(String(k).toLowerCase()));
}

/**
 * Regla automática de conteo para el PM.
 * @param {{client:string, typ:string, task:string, comm:string}} r
 * @param {{cuentaPM?:string}|undefined} person
 * @param {string[]} keywords
 * @returns {"Sí"|"No"}
 */
export function autoCount(r, person, keywords) {
  if (person && person.cuentaPM === "No") return "No";
  const c = r.client.toUpperCase();
  if (!c.startsWith("RKD")) return "Sí"; // todo el trabajo de clientes cuenta
  if (c === "RKD MTG" || c === "RKD MTGINT") return meetingCounts(r, keywords) ? "Sí" : "No";
  return "No"; // RKD TRAIN, RKD PTO, etc.
}
