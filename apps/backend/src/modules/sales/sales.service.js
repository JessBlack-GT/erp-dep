const commercial = require('../commercial/commercial.service');
const validation = require('./sales.validation');
class SalesService {
  getAll(query, actor) {
    return commercial.list(validation.query(query), actor, 'SALE');
  }
  getById(id, actor) {
    return commercial.getById(id, actor, 'SALE');
  }
  create(data, actor) {
    return commercial.createDraft(validation.input(data), actor);
  }
  update(id, data, actor) {
    const { content, expectedRevision } = validation.update(data);
    return commercial.updateDraft(id, content, actor, {
      type: 'SALE',
      expectedRevision,
    });
  }
  confirm(id, data, actor) {
    return commercial.confirm(id, actor, {
      type: 'SALE',
      expectedRevision: validation.command(data),
    });
  }
  cancel(id, data, actor) {
    return commercial.cancel(id, actor, {
      type: 'SALE',
      expectedRevision: validation.command(data),
    });
  }
}
module.exports = new SalesService();
