/**
 * ============================================
 * ERP-SYSTEM - Middleware de Autorización
 * ============================================
 */

const { logger } = require('../shared/utils/logger');

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
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({ success: false, error: 'Sin permisos' });
    }
    const hasPermission = permissions.some((perm) => req.user.permissions.includes(perm));
    if (!hasPermission) {
      logger.warn(`Permiso denegado: Usuario ${req.user.id} necesita ${permissions.join(', ')}`);
      return res.status(403).json({ success: false, error: 'Permiso denegado' });
    }
    next();
  };
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

module.exports = { authorizeRoles, authorizePermissions, authorizeOwnerOrAdmin };
