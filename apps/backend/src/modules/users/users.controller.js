/**
 * ============================================
 * ERP-SYSTEM - Controlador de Usuarios
 * ============================================
 */

const userService = require('./users.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { validateRequest } = require('../../middleware/validateRequest');
const { validateRequired, validateEmail } = require('../../shared/validators/validators');

const createUserRules = [
  validateRequired,
  validateEmail,
];

exports.getUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAll(req.query, req.query);
  res.json({ success: true, data: result });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  res.json({ success: true, data: user });
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json({ success: true, data: user, message: 'Usuario creado exitosamente' });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  res.json({ success: true, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  await userService.delete(req.params.id);
  res.json({ success: true, message: 'Usuario eliminado' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user.id);
  res.json({ success: true, data: profile });
});
