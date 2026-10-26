// @ts-check
'use strict';
/**
 * Adaptador en memoria del puerto DocumentStorage (ADR-10). Solo prototipo y pruebas.
 * El adaptador GridFS (bucket `municipal_files`) se implementará al montar el módulo (C-07).
 * Deliberadamente sin operación de borrado.
 */
function createMemoryStorage() {
  const blobs = new Map();
  return {
    /** @param {string} key @param {Buffer} buffer */
    async put(key, buffer) {
      if (blobs.has(key)) throw new Error('Clave de almacenamiento duplicada');
      blobs.set(key, Buffer.from(buffer));
    },
    /** @param {string} key */
    async get(key) {
      const b = blobs.get(key);
      if (!b) throw new Error('Contenido no disponible');
      return Buffer.from(b);
    },
    size: () => blobs.size,
  };
}

module.exports = { createMemoryStorage };
