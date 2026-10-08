// Utilidades de texto. Sin dependencias del DOM ni de red.

/**
 * Normaliza un texto a minúsculas, sin tildes y con espacios colapsados.
 * Se usa para COMPARAR nombres y encabezados (no para mostrar).
 * @param {unknown} s
 * @returns {string}
 */
export function key(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Limpia un texto para MOSTRAR: colapsa espacios y recorta extremos.
 * @param {unknown} s
 * @returns {string}
 */
export function clean(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}
