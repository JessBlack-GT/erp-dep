/**
 * ============================================
 * ERP-SYSTEM - Middleware de Autorización
 * ============================================
 */

const { logger } = require('../shared/utils/logger');
const rbac = require('../security/rbac');

function requireAccess(check) {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'No autenticado' });
    try {
      const access = await rbac.resolveAccess(req.user.id);
      if (!access) return res.status(401).json({ success: false, error: 'Sesión no válida' });
      if (!check(access)) return res.status(403).json({ success: false, error: 'Sin permisos suficientes' });
      req.user = access;
      next();
    } catch (_) {
      // Fail closed without exposing database or authentication details.
      return res.status(503).json({ success: false, error: 'Autorización no disponible' });
    }
  };
}
function requirePermission(permission) {
  if (!rbac.PERMISSIONS.includes(permission)) throw new Error('Unregistered permission');
  return requireAccess(access => rbac.hasPermission(access, permission));
}
const requireCurrentUser = requireAccess(() => true);
// User management is security-sensitive: never let a user grant themselves a role.
const requireSystemAdmin = requireAccess(access => access.roleActive && ['superadmin', 'admin'].includes(access.role));

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado', message: 'Debe iniciar sesión' });
    }
    if (!req.user.role) {
      return res.status(403).json({ success: false, error: 'Rol no definido' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn(`Acceso denegado: Usuario ${req.user.id} rol ${req.user.role} en ${req.method} ${req.path}`);
      return res.status(403).json({ success: false, error: 'Acceso denegado', message: 'Sin permisos suficientes' });
    }
    next();
  };
}

function authorizePermissions(...permissions) {
  if (!permissions.length || permissions.some(p => !rbac.PERMISSIONS.includes(p))) throw new Error('Unregistered permission');
  return requireAccess(access => permissions.some(p => rbac.hasPermission(access, p)));
}

function authorizeOwnerOrAdmin(resourceIdField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }
    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];
    const isOwner = req.user.id === resourceId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Acceso denegado', message: 'Solo puede acceder a sus recursos' });
    }
    next();
  };
}

module.exports = { authorizeRoles, authorizePermissions, authorizeOwnerOrAdmin, requirePermission, requireCurrentUser, requireSystemAdmin };
