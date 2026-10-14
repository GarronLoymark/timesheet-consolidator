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

  const mk = (d, res, hrs, comm) => ({
    job: jobNum(d.client),
    client: d.client,
    task: d.task,
    comm: comm != null ? comm : d.comm || "",
    typ: d.typ || "",
    date: d.date,
    res,
    hrs,
    equipo: d.equipo,
    pm: res !== d.res,
  });

  // Holidays del PM por equipo (feriados configurados en día hábil).
  const holsByTeam = new Map();
  for (const h of R.pmHolidays || []) {
    if (!holsByTeam.has(h.equipo)) holsByTeam.set(h.equipo, []);
    holsByTeam.get(h.equipo).push(h);
  }

  const entries = [];
  for (const team of order) {
    const devs = byTeam.get(team);
    for (const d of devs) entries.push(mk(d, d.res, d.hrs, d.comm || ""));
    // Filas espejo del PM (ya marcadas en compute): reuniones exactas de-duplicadas
    // y el trabajo de cliente promediado. Nada en fin de semana/feriado.
    const pmName = R.teamPM[team] || "PM SIN ASIGNAR";
    for (const d of devs) {
      if (!d.pmMirror) continue;
      entries.push(mk(d, pmName, d.pmHrs || 0, d.pmComment != null ? d.pmComment : d.comm || ""));
    }
    // Feriados: el PM recibe Holiday de 8 h ese día.
    for (const h of holsByTeam.get(team) || []) {
      entries.push({
        job: jobNum("RKD HOL"),
        client: "RKD HOL",
        task: h.nombre || "Holiday",
        comm: "",
        typ: "Holiday",
        date: h.date,
        res: h.pm,
        hrs: h.hrs,
        equipo: team,
        pm: true,
      });
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
