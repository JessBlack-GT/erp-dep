/**
 * ERP-SYSTEM - Repositorio de audit
 */
const Audit = require('./audit.model');
class AuditRepository {
  async append(data, session) {
    return (await Audit.create([data], { session }))[0];
  }
}
module.exports = new AuditRepository();
