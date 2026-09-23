/**
 * ============================================
 * ERP-SYSTEM - Modelo de Cliente
 * ============================================
 * Schema para la gestion de clientes del ERP.
 * ============================================
 */

const mongoose = require('mongoose');
const { STATUS } = require('../../shared/constants/appConstants');

const customerSchema = new mongoose.Schema({
  // Identificacion
  name: { type: String, required: true, maxlength: 255, trim: true },
  lastName: { type: String, maxlength: 255, trim: true },
  businessName: { type: String, maxlength: 255, trim: true },
  
  // Tipo de cliente
  type: { 
    type: String, 
    enum: ['natural', 'legal'], 
    default: 'natural' 
  },
  
  // Contacto
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true, 
    lowercase: true 
  },
  phone: { type: String, maxlength: 20 },
  documentType: { type: String, maxlength: 50 },
  documentNumber: { type: String, maxlength: 50, unique: true, sparse: true },
  
  // Direccion
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 200 },
  country: { type: String, maxlength: 100, default: 'Peru' },
  zipCode: { type: String, maxlength: 20 },
  
  // Estado
  status: { 
    type: String, 
    enum: Object.values(STATUS), 
    default: STATUS.ACTIVE 
  },
  
  // Notas
  notes: { type: String, maxlength: 2000 },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

// Indices
customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ documentNumber: 1 }, { unique: true, sparse: true });
customerSchema.index({ name: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ type: 1 });
customerSchema.index({ city: 1 });
customerSchema.index({ country: 1 });

// Metodo para obtener nombre completo
customerSchema.methods.getFullName = function() {
  if (this.businessName) return this.businessName;
  return `${this.name} ${this.lastName || ''}`.trim();
};

// Metodo para obtener datos publicos
customerSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    name: obj.name,
    lastName: obj.lastName,
    businessName: obj.businessName,
    type: obj.type,
    email: obj.email,
    phone: obj.phone,
    status: obj.status,
    address: obj.address,
    city: obj.city,
    country: obj.country,
    zipCode: obj.zipCode,
    notes: obj.notes,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
