// Configuración compartida persistida en localStorage.
// La primera vez se siembra desde /config; luego el usuario la edita.

import { loadConfig } from "../config.js";

const KEY = "ts.config.v1";

/** Carga la configuración: localStorage si existe, si no la inicial de /config. */
export async function getConfig() {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // cae al default si está corrupta
    }
  }
  const cfg = await loadConfig("./config");
  localStorage.setItem(KEY, JSON.stringify(cfg));
  return cfg;
}

/** Guarda la configuración completa. */
export function saveConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

/** Restaura la configuración inicial desde /config. */
export async function resetConfig() {
  localStorage.removeItem(KEY);
  return getConfig();
}
