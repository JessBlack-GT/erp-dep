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
 *  - tamaño coincidente con el metadato;
 *  - nombre saneado sin rutas ni caracteres reservados y con extensión coherente.
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

/** Nombre local seguro: sin rutas, sin caracteres reservados ni de control, con extensión coherente. */
export function safeFilename(name, mimeType) {
  const exts = PRIVATE_MIME_TYPES[mimeType] || [];
  let base = String(name || '').split(/[\\/]/).pop();
  base = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim().slice(0, 100);
  const ext = (base.match(/\.([A-Za-z0-9]+)$/) || [])[1];
  if (!base || base.replace(/\.[A-Za-z0-9]+$/, '') === '') base = 'documento';
  if (!ext || !exts.includes(ext.toLowerCase())) base = `${base.replace(/\.[A-Za-z0-9]+$/, '')}.${exts[0] || 'bin'}`;
  return base;
}

/**
 * Verifica el contenido recibido contra el metadato del documento. Lanza PrivateDocumentError
 * (`DOCUMENT_INTEGRITY`) si algo no coincide; nunca entrega contenido no verificado.
 * @param {Uint8Array} bytes
 * @param {{ contentType: string, doc: { mimeType: string, size?: number, filename?: string } }} input
 */
export function inspectPrivateDocument(bytes, { contentType, doc }) {
  const declared = baseMime(doc && doc.mimeType);
  const received = baseMime(contentType);
  if (!PRIVATE_MIME_TYPES[declared]) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'Tipo de documento no permitido.');
  if (received !== declared) throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El tipo recibido no coincide con el del documento.');
  const sig = SIGNATURES[declared];
  if (!bytes || bytes.length < sig.length || !sig.every((b, i) => bytes[i] === b))
    throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El contenido recibido no corresponde al tipo del documento.');
  if (typeof doc.size === 'number' && bytes.length !== doc.size)
    throw new PrivateDocumentError('DOCUMENT_INTEGRITY', 'El tamaño recibido no coincide con el del documento.');
  return { mimeType: declared, filename: safeFilename(doc.filename, declared) };
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
