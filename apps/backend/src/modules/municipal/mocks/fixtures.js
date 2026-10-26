// @ts-check
'use strict';
/**
 * Conjunto de datos 100 % SINTÉTICO para prototipo, pruebas y maquetas de interfaz.
 * Ninguna persona real: nombres "Ciudadano Sintético NNN", correos en example.org (RFC 2606).
 * Los códigos de dependencia son provisionales hasta recibir el catálogo oficial del ayuntamiento.
 */
const oid = (n) => n.toString(16).padStart(24, '0');
const DAY = 86400000;

const MUNICIPALITIES = Object.freeze([
  { id: oid(1), code: 'SJH', name: 'San Juan Huactzinco', state: 'Tlaxcala', status: 'ACTIVA' },
  { id: oid(2), code: 'ZZZ', name: 'Municipio Ficticio de Aislamiento', state: 'N/A', status: 'ACTIVA' },
]);

const DEPENDENCY_CODES = Object.freeze({
  PRE: 'Presidencia Municipal',
  SEC: 'Secretaría del Ayuntamiento',
  TES: 'Tesorería',
  OBP: 'Obras Públicas',
  RCI: 'Registro Civil',
  DIF: 'Sistema DIF Municipal',
  AGP: 'Agua Potable',
  SEG: 'Seguridad Pública',
});

function buildDependencies() {
  const list = Object.entries(DEPENDENCY_CODES).map(([code, name], i) => ({
    id: oid(100 + i), municipalityId: oid(1), code, name, parentCode: null, status: 'ACTIVA',
  }));
  list.push({ id: oid(150), municipalityId: oid(2), code: 'OBP', name: 'Obras Públicas (ficticio)', parentCode: null, status: 'ACTIVA' });
  return list;
}

/** Usuarios: solo identificadores; las cuentas reales viven en el User del ERP. */
const USERS = Object.freeze({
  u_super_erp: oid(201), u_admin_erp: oid(202), u_reg: oid(203), u_admin_mun: oid(204),
  u_sup: oid(205), u_tit_obp: oid(206), u_op_obp: oid(207), u_op_tes: oid(208),
  u_vent: oid(209), u_aud: oid(210), u_tit_dif: oid(211), u_consulta_obp: oid(212),
  u_zzz_tit_obp: oid(213), u_expired: oid(214),
});

function buildMemberships(now) {
  const dep = (code, mun = oid(1)) => buildDependencies().find((d) => d.code === code && d.municipalityId === mun).id;
  const m = (n, user, role, deps, extra = {}) => ({
    id: oid(300 + n), userId: USERS[user], municipalityId: oid(1), role, dependencyIds: deps,
    status: 'ACTIVA', validFrom: new Date(now.getTime() - 365 * DAY), validTo: null, ...extra,
  });
  return [
    m(1, 'u_admin_mun', 'ADMIN_MUNICIPAL', []),
    m(2, 'u_sup', 'SUPERVISOR_MUNICIPAL', [dep('PRE')]),
    m(3, 'u_tit_obp', 'TITULAR_DEPENDENCIA', [dep('OBP')]),
    m(4, 'u_op_obp', 'OPERADOR_DEPENDENCIA', [dep('OBP')]),
    m(5, 'u_op_tes', 'OPERADOR_DEPENDENCIA', [dep('TES')]),
    m(6, 'u_vent', 'VENTANILLA', []),
    m(7, 'u_aud', 'AUDITOR_MUNICIPAL', []),
    m(8, 'u_tit_dif', 'TITULAR_DEPENDENCIA', [dep('DIF')]),
    m(9, 'u_consulta_obp', 'CONSULTA', [dep('OBP')]),
    m(10, 'u_zzz_tit_obp', 'TITULAR_DEPENDENCIA', [dep('OBP', oid(2))], { municipalityId: oid(2) }),
    m(11, 'u_expired', 'TITULAR_DEPENDENCIA', [dep('OBP')], { validTo: new Date(now.getTime() - DAY) }),
  ];
}

function buildCitizens() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: oid(400 + i),
    municipalityId: i === 11 ? oid(2) : oid(1),
    fullName: `Ciudadano Sintético ${String(i + 1).padStart(3, '0')}`,
    email: `ciudadano${i + 1}@example.org`,
    locality: 'Localidad de prueba',
    synthetic: true,
  }));
}

module.exports = { oid, DAY, MUNICIPALITIES, DEPENDENCY_CODES, USERS, buildDependencies, buildMemberships, buildCitizens };
