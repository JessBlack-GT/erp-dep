// @ts-check
'use strict';
/**
 * Identidad central de YJ Nexo ERP para la API municipal. NO es una autenticación alternativa:
 * reutiliza literalmente los middlewares del ERP:
 *   1. authenticateToken  → JWT de acceso válido (401 si falta, expiró o es inválido).
 *   2. requireCurrentUser → rbac.resolveAccess: usuario existente y ACTIVO, sessionVersion vigente
 *                           (401) y falla cerrada si la base no responde (503).
 * Después de esto `req.user` es el acceso resuelto por el ERP; la capa municipal SOLO usa `req.user.id`.
 *
 * Es el único archivo del módulo que importa del núcleo (frontera verificada por prueba):
 * middlewares de identidad y, desde F1-12, `security/rbac.resolveAccess` (solo lectura).
 * Se carga de forma diferida para que el resto del módulo no dependa de la configuración del ERP.
 */
function erpIdentityMiddlewares() {
  const { authenticateToken } = require('../../../middleware/authenticate');
  const { requireCurrentUser } = require('../../../middleware/authorize');
  return [authenticateToken, requireCurrentUser];
}

/**
 * Consulta de la identidad central para altas de membresía (F1-12): reutiliza rbac.resolveAccess,
 * que devuelve null si el usuario no existe o no está activo. No crea ni modifica cuentas.
 * @returns {(id: string) => Promise<{ id: string } | null>}
 */
function erpUserLookup() {
  const rbac = require('../../../security/rbac');
  return async (id) => {
    const access = await rbac.resolveAccess(id);
    return access ? { id: access.id } : null;
  };
}

module.exports = { erpIdentityMiddlewares, erpUserLookup };
