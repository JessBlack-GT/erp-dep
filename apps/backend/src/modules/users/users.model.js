/**
 * ============================================
 * ERP-SYSTEM - Modelo de Usuario
 * ============================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, STATUS } = require('../../shared/constants/appConstants');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, maxlength: 100 },
    lastName: { type: String, required: true, maxlength: 100 },
    role: { type: String, maxlength: 64, default: ROLES.USER },
    sessionVersion: { type: Number, default: 0, select: false },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE },
    permissions: { type: [String], default: [] },
    avatar: { type: String },
    phone: { type: String },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Índices
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// Hash de contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const hash = async () => {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    };
    if (this.$locals.creationDiagnostics) await this.$locals.creationDiagnostics.run('password_hash', hash);
    else await hash();
    this.$locals.creationDiagnostics?.mark('user_save');
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
  delete obj.sessionVersion;
  delete obj.updatedAt;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
