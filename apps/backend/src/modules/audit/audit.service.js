/**
 * ERP-SYSTEM - Servicio de audit
 */
const repo = require('./audit.repository');
const { object, id } = require('../inventory/inventory.validation');
const { ValidationError } = require('../../shared/errors/appErrors');
class AuditService {
  async record(data, session) {
    if (!session) throw new Error('Audit requires the operation transaction');
    object(data, ['actorId', 'action', 'module', 'entity', 'entityId', 'result']);
    if (!['create', 'update', 'confirm', 'cancel'].includes(data.action) ||
        data.module !== 'commercial' || data.entity !== 'CommercialDocument' ||
        !['success', 'failure'].includes(data.result))
      throw new ValidationError('Evento de auditoría inválido');
    return repo.append({
      actorId: id(data.actorId), action: data.action, module: data.module,
      entity: data.entity, entityId: id(data.entityId), result: data.result,
    }, session);
  }
}
module.exports = new AuditService();
