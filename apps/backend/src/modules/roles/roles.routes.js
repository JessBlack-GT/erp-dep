const router = require('express').Router();
const { authenticateToken } = require('../../middleware/authenticate');

// Model/repository exist, but management endpoints and access policy are not implemented.
// Do not expose repository writes as an undocumented administration API.
router.use(authenticateToken);
router.use((req, res) => res.status(501).json({
  success: false,
  error: 'Gestión de roles pendiente de implementación',
  code: 'ROLES_NOT_IMPLEMENTED',
}));
module.exports = router;
