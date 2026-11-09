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
 * Es el único archivo del módulo que importa del núcleo (frontera verificada por prueba).
 * Se carga de forma diferida para que el resto del módulo no dependa de la configuración del ERP.
 */
function erpIdentityMiddlewares() {
  const { authenticateToken } = require('../../../middleware/authenticate');
  const { requireCurrentUser } = require('../../../middleware/authorize');
  return [authenticateToken, requireCurrentUser];
}

module.exports = { erpIdentityMiddlewares };
