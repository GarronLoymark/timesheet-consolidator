// Arma las filas del Consolidado con valores ya calculados (columnas B:I del
// archivo del cliente): Job #, Client, Task Name, Comments, Type of task, Date,
// Resource, Hours. Primero las filas DEV y luego las filas espejo del PM,
// igual que en el Excel de salida (sección 10 de las reglas).

/**
 * @param {ReturnType<import("./compute.js").compute>} R
 * @param {Array<[string, string|number]>} jobcodes  Lista [client, code]
 * @returns {Array<[string|number, string, string, string, string, string, string, number]>}
 */
export function buildConsolidadoRows(R, jobcodes) {
  const codeByClient = new Map(jobcodes.map((j) => [String(j[0]).toUpperCase(), j[1]]));
  const jobNum = (client) => (codeByClient.has(client.toUpperCase()) ? codeByClient.get(client.toUpperCase()) : "NO EXISTE");
  const porTarea = new Map(R.pm.map((p) => [p.equipo + "|" + p.date, p.porTarea]));
  const ddmmyyyy = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

  const rows = [];

  // Filas DEV (ya vienen ordenadas por equipo/tipo/persona/fecha).
  for (const d of R.dev) {
    rows.push([jobNum(d.client), d.client, d.task, d.comm || "", d.typ || "", ddmmyyyy(d.date), d.res, d.hrs]);
  }

  // Filas espejo del PM (mismo filtro que el Excel de salida).
  // Horas sin redondear: la suma diaria debe ser exactamente 8 o 9 (sección 10).
  for (const d of R.dev) {
    const up = d.client.toUpperCase();
    if (d.cuentaPMPersona === "No") continue;
    if (up.startsWith("RKD") && up !== "RKD MTG" && up !== "RKD MTGINT") continue;
    const pm = R.teamPM[d.equipo] || "PM SIN ASIGNAR";
    const hrs = d.auto === "Sí" ? (porTarea.get(d.equipo + "|" + d.date) || 0) : 0;
    rows.push([jobNum(d.client), d.client, d.task, d.comm || "", d.typ || "", ddmmyyyy(d.date), pm, hrs]);
  }

  return rows;
}

/** Texto TSV listo para pegar en Excel (sin encabezados), horas con punto decimal. */
export function consolidadoToTSV(rows) {
  return rows.map((r) => r.map(cell).join("\t")).join("\n");
}

function cell(v) {
  if (typeof v === "number") return String(v);
  return String(v == null ? "" : v).replace(/\t|\n|\r/g, " ");
}
