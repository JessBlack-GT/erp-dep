'use strict';
/* Pruebas puras de folio (RQ01), estados/historial (RQ02), documentos (RQ05) e indicadores (RQ04). */
const assert = require('assert');
const folio = require('../../src/modules/municipal/domain/folio');
const { applyTransition, registrationEntry } = require('../../src/modules/municipal/domain/request-state');
const docs = require('../../src/modules/municipal/domain/documents');
const { computeIndicators } = require('../../src/modules/municipal/domain/indicators');
const { validateRequestCreate, validateCitizenCreate } = require('../../src/modules/municipal/domain/validation');

const DAY = 86400000;
const PDF = Buffer.from('%PDF-1.4\n% sintético\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Folio (RQ01, MT-30)', () => {
  it('formatea, valida y analiza', () => {
    const f = folio.formatFolio({ municipality: 'SJH', dependency: 'OBP', type: 'SOL', year: 2026, sequence: 42 });
    assert.strictEqual(f, 'SJH-OBP-SOL-2026-000042');
    assert.ok(folio.FOLIO_PATTERN.test(f));
    assert.deepStrictEqual(folio.parseFolio(f), { municipality: 'SJH', dependency: 'OBP', type: 'SOL', year: 2026, sequence: 42 });
  });
  it('rechaza secuencias fuera de rango y folios mal formados', () => {
    assert.throws(() => folio.formatFolio({ municipality: 'SJH', dependency: 'OBP', type: 'SOL', year: 2026, sequence: 0 }), RangeError);
    assert.throws(() => folio.formatFolio({ municipality: 'SJH', dependency: 'OBP', type: 'SOL', year: 2026, sequence: 1000000 }), RangeError);
    assert.throws(() => folio.formatFolio({ municipality: 'sjh', dependency: 'OBP', type: 'SOL', year: 2026, sequence: 1 }), TypeError);
    for (const bad of ['SJH-OBP-SOL-2026-000000', 'SJH-OBP-SOL-26-000001', 'SJH-OBP-SOL-2026-1', "SJH-OBP-SOL-2026-000001' OR 1=1", null])
      assert.strictEqual(folio.parseFolio(bad), null, String(bad));
  });
  it('el año se toma en hora de México (31-dic 23:30 local sigue siendo el año anterior, MT-35)', () => {
    assert.strictEqual(folio.yearInMexico(new Date('2027-01-01T05:30:00Z')), 2026);
    assert.strictEqual(folio.yearInMexico(new Date('2027-01-01T06:30:00Z')), 2027);
  });
  it('la clave del contador separa municipio, dependencia, tipo y año', () => {
    assert.strictEqual(folio.counterKey({ municipality: 'SJH', dependency: 'OBP', type: 'SOL', year: 2026 }), 'SJH:OBP:SOL:2026');
  });
});

describe('Ciclo de vida e historial (RQ02, MT-40…MT-47)', () => {
  const env = { actorId: 'a1', at: new Date('2026-10-02T10:00:00Z'), validDependencyIds: ['dOBP', 'dTES'] };
  const base = { status: 'REGISTRADA', version: 0, ownerDependencyId: 'dOBP', history: [registrationEntry('a0', new Date('2026-10-01T10:00:00Z'))] };

  it('cada cambio conserva actor, fecha y estado de origen/destino', () => {
    const r1 = applyTransition(base, { action: 'TURNAR', version: 0, toDependencies: ['dTES'] }, env);
    const r2 = applyTransition({ ...base, ...r1 }, { action: 'ASIGNAR', version: 1, assignedUserId: 'u9' }, { ...env, actorId: 'a2' });
    const r3 = applyTransition({ ...base, ...r2 }, { action: 'CERRAR', version: 2, note: 'Atendida en sitio' }, { ...env, actorId: 'a3' });
    assert.strictEqual(r3.history.length, 4);
    for (const h of r3.history) {
      assert.ok(h.actorId && h.at instanceof Date && 'toStatus' in h && 'fromStatus' in h);
      assert.ok(Object.isFrozen(h));
    }
    assert.deepStrictEqual(r3.history.map((h) => [h.action, h.fromStatus, h.toStatus, h.actorId]), [
      ['REGISTRAR', null, 'REGISTRADA', 'a0'], ['TURNAR', 'REGISTRADA', 'EN_TRAMITE', 'a1'],
      ['ASIGNAR', 'EN_TRAMITE', 'EN_TRAMITE', 'a2'], ['CERRAR', 'EN_TRAMITE', 'CERRADA', 'a3'],
    ]);
    assert.strictEqual(r2.history[2].assignedUserId, 'u9');
    assert.strictEqual(base.history.length, 1, 'no muta la solicitud original');
  });
  it('CERRAR/CANCELAR sin nota → 400 (MT-40)', () => {
    assert.throws(() => applyTransition({ ...base, status: 'EN_TRAMITE' }, { action: 'CERRAR', version: 0 }, env), (e) => e.statusCode === 400);
    assert.throws(() => applyTransition(base, { action: 'CANCELAR', version: 0, note: 'no' }, env), (e) => e.statusCode === 400);
  });
  it('desde estado terminal → 409 INVALID_TRANSITION (MT-41)', () => {
    assert.throws(() => applyTransition({ ...base, status: 'CERRADA' }, { action: 'REANUDAR', version: 0 }, env), (e) => e.code === 'INVALID_TRANSITION');
  });
  it('versión obsoleta → 409 CONFLICT (MT-44)', () => {
    assert.throws(() => applyTransition(base, { action: 'TURNAR', version: 5, toDependencies: ['dTES'] }, env), (e) => e.code === 'CONFLICT');
  });
  it('turnar a dependencia de otro municipio o inexistente → 400 (MT-45)', () => {
    assert.throws(() => applyTransition(base, { action: 'TURNAR', version: 0, toDependencies: ['dZZZ'] }, env), (e) => e.statusCode === 400);
  });
});

describe('Validación de cargas (MT-18)', () => {
  const ok = { type: 'SOL', ownerDependency: 'OBP', subject: 'Bache en calle sintética', citizenId: 'a'.repeat(24), channel: 'PRESENCIAL' };
  it('acepta el contrato y fija confidencialidad PUBLICA por defecto', () => {
    assert.strictEqual(validateRequestCreate(ok).confidentiality, 'PUBLICA');
  });
  it('rechaza campos del servidor y desconocidos', () => {
    for (const k of ['municipalityId', 'folio', 'createdBy', 'history', 'status', 'assignedUserId'])
      assert.throws(() => validateRequestCreate({ ...ok, [k]: 'x' }), (e) => e.statusCode === 400 && e.fields.includes(k), k);
    assert.throws(() => validateRequestCreate({ ...ok, extra: 1 }), (e) => e.fields.includes('extra'));
  });
  it('canal obligatorio y en catálogo (RQ06)', () => {
    const { channel, ...noChannel } = ok; // eslint-disable-line no-unused-vars
    assert.throws(() => validateRequestCreate(noChannel), (e) => e.fields.includes('channel'));
    assert.throws(() => validateRequestCreate({ ...ok, channel: 'FAX' }), (e) => e.fields.includes('channel'));
  });
  it('no permite capturar CURP en texto libre ni en el nombre del ciudadano', () => {
    const curp = 'GOMC800101HTLRRR09';
    assert.throws(() => validateRequestCreate({ ...ok, description: 'CURP ' + curp }), /CURP/);
    assert.throws(() => validateCitizenCreate({ fullName: curp }), /CURP/);
  });
});

describe('Documentos privados (RQ05, MT-80…MT-84)', () => {
  const b64 = (b) => b.toString('base64');
  it('acepta PDF/PNG por firma binaria, sanea nombre y calcula sha256', () => {
    const r = docs.validateUpload({ filename: '../../etc/Oficio Ñandú.exe.pdf', mimeType: 'application/pdf', contentBase64: b64(PDF) });
    assert.strictEqual(r.filename, 'Oficio Nandu.exe.pdf');
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(docs.validateUpload({ filename: 'foto', mimeType: 'image/png', contentBase64: b64(PNG) }).filename, 'foto.png');
  });
  it('rechaza contenido que no corresponde al MIME declarado (MT-81)', () => {
    assert.throws(() => docs.validateUpload({ filename: 'x.pdf', mimeType: 'application/pdf', contentBase64: b64(Buffer.from('<script>')) }), /no corresponde/);
    assert.throws(() => docs.validateUpload({ filename: 'x.html', mimeType: 'text/html', contentBase64: b64(PDF) }), /no permitido/);
  });
  it('rechaza > 5 MB con 413 y campos extra (MT-82)', () => {
    const big = Buffer.concat([PDF, Buffer.alloc(docs.MAX_BYTES)]);
    assert.throws(() => docs.validateUpload({ filename: 'g.pdf', mimeType: 'application/pdf', contentBase64: b64(big) }), (e) => e.statusCode === 413);
    assert.throws(() => docs.validateUpload({ filename: 'g.pdf', mimeType: 'application/pdf', contentBase64: b64(PDF), storageKey: 'x' }), /no permitidos/);
  });
  it('cabeceras de descarga: attachment, no-store, nosniff (MT-84)', () => {
    const h = docs.downloadHeaders({ filename: 'Oficio Nandu.pdf', mimeType: 'application/pdf', size: 10 });
    assert.match(h['Content-Disposition'], /^attachment;/);
    assert.strictEqual(h['Cache-Control'], 'no-store');
    assert.strictEqual(h['X-Content-Type-Options'], 'nosniff');
  });
});

describe('Indicadores — oráculo puro (RQ04, MT-70…MT-73)', () => {
  const now = new Date('2026-10-31T12:00:00Z');
  const at = (d) => new Date(`2026-10-${String(d).padStart(2, '0')}T12:00:00Z`);
  const closed = (created, closedDay) => ({ history: [{ toStatus: 'REGISTRADA', at: at(created) }, { toStatus: 'CERRADA', at: at(closedDay) }] });
  const rows = [
    { status: 'REGISTRADA', ownerDependencyId: 'OBP', channel: 'PRESENCIAL', createdAt: at(30) },
    { status: 'EN_TRAMITE', ownerDependencyId: 'OBP', channel: 'TELEFONO', createdAt: at(1) }, // vencida (30 días)
    { status: 'EN_ESPERA_CIUDADANO', ownerDependencyId: 'TES', channel: 'PRESENCIAL', createdAt: at(20) },
    { status: 'CERRADA', ownerDependencyId: 'OBP', channel: 'PRESENCIAL', createdAt: at(2), ...closed(2, 6) }, // 4 días
    { status: 'CERRADA', ownerDependencyId: 'TES', channel: 'WEB_FUNCIONARIO', createdAt: at(10), ...closed(10, 12) }, // 2 días
    { status: 'CANCELADA', ownerDependencyId: 'TES', channel: 'PRESENCIAL', createdAt: new Date('2026-09-15T12:00:00Z') },
  ];
  it('coincide con el conteo manual del set de prueba', () => {
    const r = computeIndicators(rows, { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z'), now, slaDays: 15 });
    assert.strictEqual(r.total, 6);
    assert.strictEqual(r.open, 3);
    assert.strictEqual(r.registeredInPeriod, 5);
    assert.strictEqual(r.closedInPeriod, 2);
    assert.strictEqual(r.avgResolutionDays, 3);
    assert.strictEqual(r.overdueOpen, 1); // abiertas: 1 d, 30 d y 11 d de antigüedad → solo una > 15 d
    assert.deepStrictEqual(r.byStatus, { REGISTRADA: 1, EN_TRAMITE: 1, EN_ESPERA_CIUDADANO: 1, CERRADA: 2, CANCELADA: 1 });
    assert.deepStrictEqual(r.byDependency, { OBP: 3, TES: 3 });
    assert.deepStrictEqual(r.byChannel, { PRESENCIAL: 4, TELEFONO: 1, WEB_FUNCIONARIO: 1 });
  });
  it('un conjunto vacío no produce promedios inventados', () => {
    const r = computeIndicators([], { from: new Date('2026-10-01'), to: new Date('2026-11-01'), now });
    assert.strictEqual(r.total, 0);
    assert.strictEqual(r.avgResolutionDays, null);
  });
  it('rechaza periodos y plazos inválidos', () => {
    assert.throws(() => computeIndicators([], { from: now, to: now, now }), RangeError);
    assert.throws(() => computeIndicators([], { from: new Date('2026-10-01'), to: now, now, slaDays: 0 }), RangeError);
  });
});
