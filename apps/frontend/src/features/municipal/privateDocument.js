/**
 * MuniERP IA — lector de DOCUMENTOS PRIVADOS municipales (C-21).
 *
 * Mecanismo SEPARADO del exportador de reportes comerciales (`utils/downloadFile`): ese exportador
 * guarda en Descargas públicas y está pensado para PDF/XLSX generados por el ERP. Un documento
 * municipal privado solo se obtiene del endpoint autorizado por documento
 * (GET …/documents/{id}/content, que comprueba municipio, dependencia, expediente y confidencialidad en
 * cada lectura) y aquí se VERIFICA antes de entregarlo al usuario:
 *  - MIME permitido (PDF, PNG, JPEG) y coincidente con el metadato del documento;
 *  - firma del contenido (bytes iniciales) coherente con el MIME;
 *  - respuesta HTTP 200 y tamaño coincidente con el metadato, con tope de 5 MiB (el del servidor);
 *  - nombre local GENERADO (folio + id abreviado + extensión de la lista permitida): nunca se usa el
 *    nombre que subió el usuario, como pide la política de Codex (`utils/privateDocumentPolicy`, aún
 *    sin integrar en esta rama; al integrarse, la verificación debe delegarse en ella para no duplicarla).
 *
 * Web: se entrega con un enlace temporal (`blob:`) que se revoca al terminar. Android/iOS: NO
 * disponible hasta el lector privado nativo (caché privada, visor interno, caducidad y revocación,
 * según la indicación de Codex); se informa al usuario en lugar de usar el exportador comercial.
 */

export const PRIVATE_MIME_TYPES = Object.freeze({
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
});

const SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
};

export class PrivateDocumentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PrivateDocumentError';
    this.code = code;
  }
}

const baseMime = (contentType) => String(contentType || '').split(';')[0].trim().toLowerCase();

/** Tope de tamaño: igual al del servidor (domain/documents.js MAX_BYTES) y al de la política de Codex. */
export const PRIVATE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Nombre local generado: `<folio>-documento-<6 últimos del id>.<ext>`. No contiene el nombre original
 * (que puede llevar datos personales) ni rutas; la extensión sale de la lista permitida.
 */
export function localFilename({ folio, docId, mimeType }) {
  const ext = (PRIVATE_MIME_TYPES[mimeType] || ['bin'])[0];
  const safeFolio = /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-\d{4}-\d{6}$/.test(String(folio || '')) ? folio : 'expediente';
  const tail = /^[0-9a-f]{6,}$/i.test(String(docId || '')) ? String(docId).slice(-6).toLowerCase() : '000000';
  return `${safeFolio}-documento-${tail}.${ext}`;
}

/**
 * Verifica el contenido recibido contra el metadato del documento. Lanza PrivateDocumentError
 * (`DOCUMENT_INTEGRITY`) si algo no coincide; nunca entrega contenido no verificado.
 * @param {Uint8Array} bytes
 * @param {{ contentType: string, doc: { id?: string, mimeType: string, size?: number }, folio?: string, status?: number }} input
 */
export function inspectPrivateDocument(bytes, { contentType, doc, folio, status = 200 }) {
  if (status !== 200) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'Documento no disponible.');
  const declared = baseMime(doc && doc.mimeType);
  const received = baseMime(contentType);
  if (!PRIVATE_MIME_TYPES[declared]) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'Tipo de documento no permitido.');
  if (received !== declared) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El tipo recibido no coincide con el del documento.');
  const sig = SIGNATURES[declared];
  if (!bytes || bytes.length < sig.length || !sig.every((b, i) => bytes[i] === b))
    throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El contenido recibido no corresponde al tipo del documento.');
  if (bytes.length > PRIVATE_MAX_BYTES) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El documento supera el tamaño permitido.');
  if (typeof doc.size === 'number' && bytes.length !== doc.size)
    throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El tamaño recibido no coincide con el del documento.');
  return { mimeType: declared, filename: localFilename({ folio, docId: doc.id, mimeType: declared }) };
}

/**
 * Entrega en web mediante un enlace `blob:` temporal. No usa el exportador comercial.
 * @param {Uint8Array} bytes @param {{ mimeType: string, filename: string }} info
 */
export function savePrivateDocumentWeb(bytes, { mimeType, filename }, env = globalThis) {
  const { document, URL } = env;
  if (!document || !URL || typeof URL.createObjectURL !== 'function')
    throw new PrivateDocumentError('PRIVATE_DOCUMENTS_UNAVAILABLE', 'La descarga de documentos privados no está disponible en esta plataforma.');
  const href = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Revocación diferida: algunos navegadores leen el blob después del clic.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return { saved: true, filename };
}

/** Plataformas nativas: el lector privado aún no existe (C-21). */
export function privateDocumentsUnavailable() {
  return new PrivateDocumentError(
    'PRIVATE_DOCUMENTS_UNAVAILABLE',
    'La descarga de documentos privados aún no está disponible en la app móvil. Consúltelo desde la versión web.',
  );
}
