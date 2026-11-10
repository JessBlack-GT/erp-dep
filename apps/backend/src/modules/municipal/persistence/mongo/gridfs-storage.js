// @ts-check
'use strict';
/**
 * Almacenamiento privado de binarios en GridFS (docs/munierp/12 §7) — PREPARADO, SIN CONEXIÓN.
 * Recibe un `GridFSBucket` INYECTADO (`new GridFSBucket(db, { bucketName: 'municipal_files' })` o un doble).
 * Misma interfaz que storage/memory-storage.js: `put(key, buffer)` y `get(key)`; sin borrado.
 *
 * - La clave es opaca (`docs.newStorageKey()`): no contiene folio, nombre de archivo ni datos personales.
 * - No sobrescribe: si la clave existe → DUPLICATE_STORAGE_KEY (además del índice único sobre
 *   `files.filename` del plan de instalación, que cierra la carrera entre dos subidas simultáneas).
 * - GridFS no participa en transacciones: el servicio guarda primero el metadato PENDIENTE, después el
 *   binario y por último marca VIGENTE (doc 12 §7). Un fallo deja un PENDIENTE conciliable.
 * - La integridad (sha256) la verifica el servicio al descargar.
 */
const fail = (code, message, cause) => Object.assign(new Error(message), { code, cause });

/** @param {{ bucket: any, maxBytes?: number }} deps */
function createGridFsStorage({ bucket, maxBytes = 10 * 1024 * 1024 }) {
  if (!bucket || typeof bucket.openUploadStream !== 'function' || typeof bucket.find !== 'function')
    throw new TypeError('Se requiere un GridFSBucket');
  const filesFor = (key) => bucket.find({ filename: key }).limit(2).toArray();
  const assertKey = (key) => {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw fail('INVALID_STORAGE_KEY', 'Clave de almacenamiento inválida');
  };

  return {
    async put(key, buffer) {
      assertKey(key);
      if (!Buffer.isBuffer(buffer)) throw new TypeError('Se requiere un Buffer');
      if (buffer.length > maxBytes) throw fail('PAYLOAD_TOO_LARGE', 'Archivo demasiado grande');
      if ((await filesFor(key)).length) throw fail('DUPLICATE_STORAGE_KEY', 'La clave ya existe; no se sobrescribe');
      await new Promise((resolve, reject) => {
        const upload = bucket.openUploadStream(key, { metadata: { kind: 'municipal-private' } });
        upload.once('error', (e) => reject(e && e.code === 11000 ? fail('DUPLICATE_STORAGE_KEY', 'La clave ya existe; no se sobrescribe', e) : e));
        upload.once('finish', resolve);
        upload.end(buffer);
      });
    },
    async get(key) {
      assertKey(key);
      const files = await filesFor(key);
      if (files.length === 0) throw fail('NOT_FOUND', 'Contenido inexistente');
      if (files.length > 1) throw fail('STORAGE_INTEGRITY', 'Más de un binario con la misma clave');
      const chunks = [];
      await new Promise((resolve, reject) => {
        const stream = bucket.openDownloadStream(files[0]._id);
        stream.on('data', (c) => chunks.push(Buffer.from(c)));
        stream.once('error', reject);
        stream.once('end', resolve);
      });
      return Buffer.concat(chunks);
    },
  };
}

module.exports = { createGridFsStorage };
