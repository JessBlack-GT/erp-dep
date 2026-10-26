'use strict';
/* MT-60, MT-61 y congelamiento de la matriz municipal (RQ05). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rbac = require('../../src/security/rbac');
const perms = require('../../src/modules/municipal/policy/permissions');

const SRC = path.resolve(__dirname, '../../src');
const MODULE = path.join(SRC, 'modules', 'municipal');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : [],
  );
}
const requiresOf = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

describe('MuniERP — catálogo ERP intacto (MT-60)', () => {
  it('el catálogo del ERP conserva sus 30 permisos de main@d5b64b0, ninguno municipal', () => {
    assert.strictEqual(rbac.PERMISSIONS.length, 30);
    assert.ok(rbac.PERMISSIONS.every((p) => !p.startsWith('municipal.')));
    const digest = crypto.createHash('sha256').update(rbac.PERMISSIONS.join('\n')).digest('hex');
    assert.strictEqual(digest, crypto.createHash('sha256').update([
      'commercial.read', 'commercial.create', 'commercial.update', 'commercial.confirm', 'commercial.cancel',
      'customers.read', 'customers.create', 'customers.update', 'customers.delete',
      'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'inventory.read', 'inventory.entry', 'inventory.exit', 'inventory.transfer', 'inventory.adjust', 'inventory.warehouse.manage',
      'users.read', 'users.create', 'users.update', 'users.status', 'users.assignRole', 'roles.read', 'roles.manage',
    ].join('\n')).digest('hex'));
  });

  it('ningún rol del ERP (incluidos admin y superadmin) contiene permisos municipales', () => {
    for (const [role, list] of Object.entries(rbac.ROLE_PERMISSIONS))
      assert.ok(list.every((p) => !p.startsWith('municipal.')), role);
    assert.ok(!rbac.hasPermission({ isSuperadmin: true, permissions: [] }, 'municipal.requests.read'));
  });
});

describe('MuniERP — matriz municipal congelada (04-ROLES-PERMISOS)', () => {
  it('21 permisos y 7 roles registrados', () => {
    assert.strictEqual(perms.PERMISSIONS.length, 21);
    assert.deepStrictEqual([...perms.ROLES], ['ADMIN_MUNICIPAL', 'SUPERVISOR_MUNICIPAL', 'TITULAR_DEPENDENCIA', 'OPERADOR_DEPENDENCIA', 'VENTANILLA', 'AUDITOR_MUNICIPAL', 'CONSULTA']);
  });

  it('separación de funciones: ADMIN_MUNICIPAL no lee expedientes, documentos ni indicadores (MT-11)', () => {
    for (const p of ['municipal.requests.read', 'municipal.documents.read', 'municipal.indicators.read', 'municipal.citizens.read'])
      assert.strictEqual(perms.scopeFor('ADMIN_MUNICIPAL', p), null, p);
  });

  it('auditor solo metadatos y sin escritura (MT-12)', () => {
    assert.strictEqual(perms.scopeFor('AUDITOR_MUNICIPAL', 'municipal.requests.read'), 'META');
    for (const p of perms.PERMISSIONS.filter((x) => /\.(create|update|assign|assignUser|close|cancel|grant|upload|retire|manage)$/.test(x)))
      assert.strictEqual(perms.scopeFor('AUDITOR_MUNICIPAL', p), null, p);
  });

  it('asignación de roles: nadie crea ADMIN_MUNICIPAL por API; solo ADMIN asigna (MT-10)', () => {
    assert.strictEqual(perms.canAssignRole('ADMIN_MUNICIPAL', 'ADMIN_MUNICIPAL'), false);
    assert.strictEqual(perms.canAssignRole('ADMIN_MUNICIPAL', 'TITULAR_DEPENDENCIA'), true);
    assert.strictEqual(perms.canAssignRole('TITULAR_DEPENDENCIA', 'OPERADOR_DEPENDENCIA'), false);
    assert.strictEqual(perms.canAssignRole('ADMIN_MUNICIPAL', 'NO_EXISTE'), false);
  });

  it('un permiso no registrado se rechaza en lugar de ignorarse', () => {
    assert.throws(() => perms.scopeFor('TITULAR_DEPENDENCIA', 'municipal.todo'), /no registrado/);
  });
});

describe('MuniERP — frontera de módulo (MT-61)', () => {
  it('el módulo municipal solo importa de sí mismo o de módulos nativos de Node', () => {
    const builtin = new Set(require('module').builtinModules);
    for (const file of walk(MODULE))
      for (const req of requiresOf(file)) {
        if (req.startsWith('.')) {
          const target = path.resolve(path.dirname(file), req);
          assert.ok(target.startsWith(MODULE + path.sep), `${path.relative(SRC, file)} importa ${req}`);
        } else assert.ok(builtin.has(req), `${path.relative(SRC, file)} importa paquete ${req}`);
      }
  });

  it('ningún archivo del ERP importa el módulo municipal y no está montado', () => {
    for (const file of walk(SRC).filter((f) => !f.startsWith(MODULE + path.sep)))
      assert.ok(!requiresOf(file).some((r) => r.includes('municipal')), path.relative(SRC, file));
    assert.ok(!fs.readFileSync(path.join(SRC, 'app.js'), 'utf8').includes('municipal'));
  });
});
