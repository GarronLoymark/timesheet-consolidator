// Guarda los .xlsx subidos en IndexedDB para que sobrevivan al refresco.
// Todo queda en el navegador (RNF-01): nunca se envía a un servidor.

const DB_NAME = "ts.files.v1";
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Guarda (o reemplaza) un archivo por nombre. bytes es un ArrayBuffer. */
export async function putFile(name, bytes) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const r = tx(db, "readwrite").put({ name, bytes });
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
}

/** Devuelve todos los archivos guardados: [{ name, bytes }]. */
export async function getAllFiles() {
  const db = await openDb();
  const out = await new Promise((resolve, reject) => {
    const r = tx(db, "readonly").getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return out;
}

/** Borra un archivo por nombre. */
export async function removeFile(name) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const r = tx(db, "readwrite").delete(name);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
}

/** Borra todos los archivos guardados. */
export async function clearFiles() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const r = tx(db, "readwrite").clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  db.close();
}
