// Carga y normaliza la configuración compartida desde los JSON de /config.
// jobcodes.json viene como [{client, jobCode}] y el core espera [[client, code]].

/**
 * @param {string} base  Prefijo de ruta a la carpeta /config (p. ej. "./config" o "../config").
 */
export async function loadConfig(base = "./config") {
  const [cfg, jc] = await Promise.all([
    fetch(`${base}/config-inicial.json`).then((r) => r.json()),
    fetch(`${base}/jobcodes.json`).then((r) => r.json()),
  ]);
  return {
    ...cfg,
    jobcodes: jc.map((j) => [j.client, j.jobCode]),
  };
}

/**
 * Convierte la lista interna de jobcodes [[client, code]] al arreglo que usa
 * buildXlsx (que espera pares [client, code]).
 * @param {Array<[string, string|number]>} jobcodes
 */
export function jobcodesForExcel(jobcodes) {
  return jobcodes.map((j) => [j[0], j[1]]);
}
