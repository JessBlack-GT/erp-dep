/**
 * ============================================
 * ERP-SYSTEM - Modelo de Usuario
 * ============================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, STATUS } = require('../../shared/constants/appConstants');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true, maxlength: 100 },
  lastName: { type: String, required: true, maxlength: 100 },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
  status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE },
  permissions: { type: [String], default: [] },
  avatar: { type: String },
  phone: { type: String },
  lastLoginAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Índices
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// Hash de contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener datos públicos
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.updatedAt;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
