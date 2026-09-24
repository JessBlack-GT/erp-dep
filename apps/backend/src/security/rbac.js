// Central module.action catalog and initial policy. Role documents override defaults.
const CUSTOMER_PERMISSIONS = Object.freeze(['customers.read', 'customers.create', 'customers.update', 'customers.delete']);
const SUPPLIER_PERMISSIONS = Object.freeze(['suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete']);
const PRODUCT_PERMISSIONS = Object.freeze(['products.read', 'products.create', 'products.update', 'products.delete']);
const INVENTORY_PERMISSIONS = Object.freeze(['inventory.read', 'inventory.entry', 'inventory.exit', 'inventory.transfer', 'inventory.adjust', 'inventory.warehouse.manage']);
const PERMISSIONS = Object.freeze([...CUSTOMER_PERMISSIONS, ...SUPPLIER_PERMISSIONS, ...PRODUCT_PERMISSIONS, ...INVENTORY_PERMISSIONS]);
const ROLE_PERMISSIONS = Object.freeze({
  superadmin: PERMISSIONS,
  admin: PERMISSIONS,
  manager: [...CUSTOMER_PERMISSIONS.slice(0, 3), ...SUPPLIER_PERMISSIONS.slice(0, 3), ...PRODUCT_PERMISSIONS.slice(0, 3), ...INVENTORY_PERMISSIONS],
  sales: [...CUSTOMER_PERMISSIONS.slice(0, 3), 'suppliers.read', 'products.read', 'inventory.read'],
  purchasing: ['customers.read', ...SUPPLIER_PERMISSIONS.slice(0, 3), ...PRODUCT_PERMISSIONS.slice(0, 3), 'inventory.read', 'inventory.entry'],
  warehouse: ['customers.read', 'suppliers.read', ...PRODUCT_PERMISSIONS.slice(0, 3), ...INVENTORY_PERMISSIONS],
  finance: ['customers.read', 'suppliers.read', 'products.read', 'inventory.read'],
  hr: [],
  auditor: ['customers.read', 'suppliers.read', 'products.read', 'inventory.read'],
  user: [],
});
Object.values(ROLE_PERMISSIONS).forEach(Object.freeze);
const normalizeRole = role => role === 'super_admin' ? 'superadmin' : role;

async function resolveAccess(id) {
  const mongoose = require('mongoose');
  if (!mongoose.isValidObjectId(id)) return null;
  const User = require('../modules/users/users.model');
  const Role = require('../modules/roles/roles.model');
  const user = await User.findById(id).select('_id email firstName lastName role status').lean();
  if (!user || user.status !== 'active') return null;
  const role = normalizeRole(user.role);
  let stored = await Role.findOne({ name: role }).lean();
  if (!stored && user.role !== role) stored = await Role.findOne({ name: user.role }).lean();
  const roleActive = !stored || stored.status === 'active';
  const isSuperadmin = roleActive && role === 'superadmin';
  const assigned = roleActive ? (stored ? stored.permissions : ROLE_PERMISSIONS[role] || []) : [];
  const permissions = isSuperadmin ? [...PERMISSIONS] : assigned.filter(p => PERMISSIONS.includes(p));
  // Legacy per-user permissions and token claims are deliberately not authorization sources.
  return { id: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, role, permissions, isSuperadmin, roleActive };
}

function hasPermission(access, permission) {
  return !!access && PERMISSIONS.includes(permission) && (access.isSuperadmin || access.permissions.includes(permission));
}
module.exports = { PERMISSIONS, ROLE_PERMISSIONS, normalizeRole, resolveAccess, hasPermission };
