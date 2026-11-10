/**
 * MuniERP IA — C-21: lector de documentos privados SEPARADO del exportador comercial.
 */
import fs from 'fs';
import path from 'path';
import { inspectPrivateDocument, localFilename, savePrivateDocumentWeb, PRIVATE_MIME_TYPES, PRIVATE_MAX_BYTES } from '../src/features/municipal/privateDocument';
import { createMunicipalApi, municipalModel } from '../src/features/municipal';

const PDF = new Uint8Array(Buffer.from('%PDF-1.4\n% sintetico\n'));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const doc = (mimeType, size, filename = 'Oficio.pdf') => ({ id: '0000000000000000000000d1', mimeType, size, filename });

describe('C-21 — verificación del documento privado', () => {
  const F = 'SJH-OBP-SOL-2026-000001';
  test('acepta PDF, PNG y JPEG con firma, tipo y tamaño coherentes; el nombre es generado', () => {
    expect(inspectPrivateDocument(PDF, { contentType: 'application/pdf', doc: doc('application/pdf', PDF.length), folio: F })).toEqual({ mimeType: 'application/pdf', filename: `${F}-documento-0000d1.pdf` });
    expect(inspectPrivateDocument(PNG, { contentType: 'image/png', doc: doc('image/png', PNG.length, 'foto de Juan.png'), folio: F }).filename).toBe(`${F}-documento-0000d1.png`);
    expect(inspectPrivateDocument(JPG, { contentType: 'image/jpeg; charset=binary', doc: doc('image/jpeg', JPG.length, 'x.jpeg'), folio: F }).filename).toBe(`${F}-documento-0000d1.jpg`);
    expect(Object.keys(PRIVATE_MIME_TYPES)).toEqual(['application/pdf', 'image/png', 'image/jpeg']);
  });

  test.each([
    ['MIME no permitido', PDF, 'text/html', doc('text/html', PDF.length)],
    ['MIME distinto al metadato', PDF, 'image/png', doc('application/pdf', PDF.length)],
    ['firma falsa (HTML con MIME PDF)', new Uint8Array(Buffer.from('<html>x</html>')), 'application/pdf', doc('application/pdf', 14)],
    ['tamaño distinto', PDF, 'application/pdf', doc('application/pdf', PDF.length + 1)],
    ['contenido vacío', new Uint8Array(0), 'application/pdf', doc('application/pdf', 0)],
  ])('rechaza: %s', (_, bytes, contentType, d) => {
    expect(() => inspectPrivateDocument(bytes, { contentType, doc: d })).toThrow(expect.objectContaining({ code: 'DOCUMENT_INTEGRITY' }));
  });

  test.each([206, 302, 401, 403, 404, 503])('rechaza respuesta HTTP %i', (status) => {
    expect(() => inspectPrivateDocument(PDF, { contentType: 'application/pdf', doc: doc('application/pdf', PDF.length), status })).toThrow(expect.objectContaining({ code: 'DOCUMENT_INTEGRITY' }));
  });

  test('rechaza contenido mayor al tope de 5 MiB aunque el metadato lo declare', () => {
    const big = new Uint8Array(PRIVATE_MAX_BYTES + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(() => inspectPrivateDocument(big, { contentType: 'application/pdf', doc: doc('application/pdf', big.length) })).toThrow(expect.objectContaining({ code: 'DOCUMENT_INTEGRITY' }));
  });

  test('nombre local: nunca toma el nombre original; folio y id inválidos se sustituyen', () => {
    expect(localFilename({ folio: 'SJH-OBP-SOL-2026-000001', docId: '0000000000000000000000d1', mimeType: 'application/pdf' })).toBe('SJH-OBP-SOL-2026-000001-documento-0000d1.pdf');
    expect(localFilename({ folio: '../../etc', docId: '../x', mimeType: 'image/png' })).toBe('expediente-documento-000000.png');
    expect(localFilename({ folio: 'SJH-OBP-SOL-2026-000001', docId: 'ABCDEF123456', mimeType: 'image/jpeg' })).toBe('SJH-OBP-SOL-2026-000001-documento-123456.jpg');
  });

  test('entrega web con enlace blob temporal que se revoca', () => {
    jest.useFakeTimers();
    const created = [];
    const revoked = [];
    const clicked = [];
    const anchor = { style: {}, click: () => clicked.push(anchor.download), remove: jest.fn() };
    const env = {
      document: { createElement: () => anchor, body: { appendChild: jest.fn() } },
      URL: { createObjectURL: (b) => { created.push(b); return 'blob:qa/1'; }, revokeObjectURL: (u) => revoked.push(u) },
    };
    expect(savePrivateDocumentWeb(PDF, { mimeType: 'application/pdf', filename: 'Oficio.pdf' }, env)).toEqual({ saved: true, filename: 'Oficio.pdf' });
    expect(clicked).toEqual(['Oficio.pdf']);
    expect(anchor.href).toBe('blob:qa/1');
    expect(anchor.remove).toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(revoked).toEqual(['blob:qa/1']);
    jest.useRealTimers();
  });
});

describe('C-21 — cliente HTTP municipal', () => {
  const client = (data, contentType) => ({ defaults: { baseURL: 'http://localhost:5000/api/v1' }, get: jest.fn(async () => ({ data, headers: { 'content-type': contentType } })) });

  test('Android/iOS: no pide el contenido ni usa el exportador; informa que no está disponible', async () => {
    for (const platform of ['android', 'ios']) {
      const c = client(PDF.buffer, 'application/pdf');
      const api = createMunicipalApi({ client: c, platform });
      const err = await api.downloadDocument('SJH-OBP-SOL-2026-000001', doc('application/pdf', PDF.length)).catch((e) => e);
      expect(err.code).toBe('PRIVATE_DOCUMENTS_UNAVAILABLE');
      expect(c.get).not.toHaveBeenCalled();
      expect(municipalModel.describeApiError(err).kind).toBe('unsupported');
    }
  });

  test('web: pide el endpoint autorizado del documento y rechaza contenido alterado sin guardarlo', async () => {
    const c = client(Buffer.from('<html>no</html>'), 'application/pdf');
    const api = createMunicipalApi({ client: c, platform: 'web' });
    const err = await api.downloadDocument('SJH-OBP-SOL-2026-000001', doc('application/pdf', 15)).catch((e) => e);
    expect(c.get).toHaveBeenCalledWith('/municipalities/SJH/requests/SJH-OBP-SOL-2026-000001/documents/0000000000000000000000d1/content', expect.objectContaining({ responseType: 'arraybuffer', baseURL: 'http://localhost:5000/api/municipal/v1' }));
    expect(err.code).toBe('DOCUMENT_INTEGRITY');
    expect(municipalModel.describeApiError(err).message).toMatch(/no superó la verificación/);
  });

  test('ningún archivo municipal usa el exportador comercial utils/downloadFile', () => {
    const roots = [path.join(__dirname, '../src/features/municipal'), path.join(__dirname, '../qa')];
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      if (['node_modules', 'dist-municipal', 'evidence-local'].includes(e.name)) return;
      if (e.isDirectory()) walk(path.join(d, e.name)); else if (/\.(js|jsx|cjs)$/.test(e.name)) files.push(path.join(d, e.name));
    });
    roots.forEach(walk);
    const importsExporter = /(from\s*['"][^'"]*utils\/downloadFile['"]|require\(\s*['"][^'"]*utils\/downloadFile['"])/;
    const offenders = files.filter((f) => importsExporter.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
