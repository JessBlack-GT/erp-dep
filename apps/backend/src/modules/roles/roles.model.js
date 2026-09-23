/**
 * ============================================
 * ERP-SYSTEM - Modelo de Rol
 * ============================================
 */

const mongoose = require('mongoose');
const { ROLES, STATUS } = require('../../shared/constants/appConstants');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, maxlength: 500 },
  permissions: { type: [String], default: [] },
  status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE },
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

roleSchema.index({ name: 1 }, { unique: true });

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
