// Arma las filas del Consolidado con valores ya calculados: Job #, Client,
// Task Name, Comments, Type of task, Date, Resource, Hours (+ Equipo en el Excel).
// Se agrupan por equipo y, dentro de cada equipo, primero las filas DEV y de
// último las filas espejo del PM (sección 10 de las reglas).

/**
 * Entradas consolidadas con metadata (equipo + marca de fila PM), agrupadas por
 * equipo con el PM de último.
 * @param {ReturnType<import("./compute.js").compute>} R
 * @param {Array<[string, string|number]>} jobcodes  Lista [client, code]
 * @returns {Array<{job:string|number, client:string, task:string, comm:string, typ:string, date:string, res:string, hrs:number, equipo:string, pm:boolean}>}
 */
export function buildConsolidadoEntries(R, jobcodes) {
  const codeByClient = new Map(jobcodes.map((j) => [String(j[0]).toUpperCase(), j[1]]));
  const jobNum = (client) => (codeByClient.has(client.toUpperCase()) ? codeByClient.get(client.toUpperCase()) : "NO EXISTE");
  const porTarea = new Map(R.pm.map((p) => [p.equipo + "|" + p.date, p.porTarea]));

  // Agrupar las filas DEV por equipo, respetando el orden en que aparecen.
  const order = [];
  const byTeam = new Map();
  for (const d of R.dev) {
    if (!byTeam.has(d.equipo)) {
      byTeam.set(d.equipo, []);
      order.push(d.equipo);
    }
    byTeam.get(d.equipo).push(d);
  }

  const mk = (d, res, hrs) => ({
    job: jobNum(d.client),
    client: d.client,
    task: d.task,
    comm: d.comm || "",
    typ: d.typ || "",
    date: d.date,
    res,
    hrs,
    equipo: d.equipo,
    pm: res !== d.res,
  });

  const entries = [];
  for (const team of order) {
    const devs = byTeam.get(team);
    for (const d of devs) entries.push(mk(d, d.res, d.hrs));
    // Filas espejo del PM: horas sin redondear para que la suma diaria sea 8 o 9.
    for (const d of devs) {
      const up = d.client.toUpperCase();
      if (d.cuentaPMPersona === "No") continue;
      if (up.startsWith("RKD") && up !== "RKD MTG" && up !== "RKD MTGINT") continue;
      const pmName = R.teamPM[team] || "PM SIN ASIGNAR";
      const hrs = d.auto === "Sí" ? porTarea.get(team + "|" + d.date) || 0 : 0;
      entries.push(mk(d, pmName, hrs));
    }
  }
  return entries;
}

/**
 * Filas del Consolidado para copiar al cliente (columnas B:I, sin Equipo).
 * @param {ReturnType<import("./compute.js").compute>} R
 * @param {Array<[string, string|number]>} jobcodes  Lista [client, code]
 * @returns {Array<[string|number, string, string, string, string, string, string, number]>}
 */
export function buildConsolidadoRows(R, jobcodes) {
  const ddmmyyyy = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return buildConsolidadoEntries(R, jobcodes).map((e) => [
    e.job,
    e.client,
    e.task,
    e.comm,
    e.typ,
    ddmmyyyy(e.date),
    e.res,
    e.hrs,
  ]);
}
