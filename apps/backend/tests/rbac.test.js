const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/modules/users/users.model');
const Role = require('../src/modules/roles/roles.model');
const repo = require('../src/modules/customers/customers.repository');
const rbac = require('../src/security/rbac');
const { requirePermission } = require('../src/middleware/authorize');
const id = '507f1f77bcf86cd799439011';
const item = { _id: id, name: 'QA', email: 'qa@example.com', status: 'active' };
// Independent approved expectations, not imported from the implementation matrix.
const matrix = { superadmin: [1,1,1,1], admin: [1,1,1,1], manager: [1,1,1,0], sales: [1,1,1,0], purchasing: [1,0,0,0], warehouse: [1,0,0,0], finance: [1,0,0,0], hr: [0,0,0,0], auditor: [1,0,0,0], user: [0,0,0,0] };
const endpoints = [
  ['get','',0,200], ['get','/search?q=QA',0,200], ['get','/stats',0,200], ['get','/'+id,0,200],
  ['post','',1,201,{name:'QA',email:'qa@example.com'}],
  ['patch','/'+id,2,200,{name:'Updated'}], ['patch','/'+id+'/status',2,200,{status:'inactive'}], ['delete','/'+id,3,200],
];
describe('RBAC: persisted identities, approved matrix and privilege boundaries', () => {
  let user, storedRole;
  const token = () => jwt.sign({ id, role: 'superadmin', permissions: ['customers.delete'] }, process.env.JWT_SECRET);
  const call = ([method,path,,status,body], expected=status, auth=token()) => {
    const req = request(app)[method]('/api/v1/customers'+path);
    if(auth) req.set('Authorization','Bearer '+auth);
    return req.send(body).expect(expected);
  };
  beforeEach(() => {
    user={_id:id,role:'user',status:'active',permissions:['customers.delete']}; storedRole=null;
    sinon.stub(User,'findById').returns({select:()=>({lean:async()=>user})});
    sinon.stub(Role,'findOne').returns({lean:async()=>storedRole});
    sinon.stub(repo,'findAll').resolves([item]); sinon.stub(repo,'findById').resolves(item);
    sinon.stub(repo,'exists').resolves(null); sinon.stub(repo,'findByDocumentNumber').resolves(null);
    sinon.stub(repo,'create').resolves(item); sinon.stub(repo,'updateById').resolves(item);
    sinon.stub(repo,'updateStatus').resolves(item); sinon.stub(repo,'softDelete').resolves({...item,status:'deleted'});
    sinon.stub(repo,'count').resolves(1);
  });
  afterEach(()=>sinon.restore());
  for(const [role, grants] of Object.entries(matrix)) {
    for(const [action,index] of [['read',0],['create',1],['update',2],['delete',3]]) {
      it(`${role}: customers.${action} ${grants[index]?'allowed':'denied'}`, async()=>{
        user.role=role;
        for(const e of endpoints.filter(e=>e[2]===index)) await call(e,grants[index]?e[3]:403);
        if(!grants[index]) for(const method of ['create','updateById','updateStatus','softDelete']) expect(repo[method].called).to.equal(false);
      });
    }
  }
  it('requires authentication on all eight routes',async()=>{for(const e of endpoints)await call(e,401,null);});
  it('rejects missing and inactive persisted users even with a valid superadmin token',async()=>{
    user=null;await call(endpoints[0],401);user={_id:id,role:'superadmin',status:'inactive'};await call(endpoints[0],401);
  });
  it('rejects forged JWT signatures',async()=>{await call(endpoints[0],401,jwt.sign({id,role:'superadmin'},'untrusted-key'));});
  it('ignores token, body and legacy user permission grants',async()=>{
    await request(app).post('/api/v1/customers').set('Authorization','Bearer '+token()).send({...item,role:'superadmin',permissions:['customers.create']}).expect(403);
    expect(repo.create.called).to.equal(false);
  });
  for(const [permission,index] of rbac.PERMISSIONS.filter(p => p.startsWith('customers.')).map((p,i)=>[p,i])) {
    it(`stored Role grants only ${permission}`,async()=>{
      storedRole={status:'active',permissions:[permission]};
      for(const e of endpoints)await call(e,e[2]===index?e[3]:403);
    });
  }
  it('applies role revocation on the next request using the same JWT',async()=>{
    user.role='admin';const auth=token();await call(endpoints[0],200,auth);
    storedRole={status:'active',permissions:[]};await call(endpoints[0],403,auth);
  });
  it('disabled Role revokes superadmin access',async()=>{
    user.role='superadmin';storedRole={status:'inactive',permissions:rbac.PERMISSIONS};await call(endpoints[0],403);
  });
  it('active superadmin grants every registered action centrally even with an empty role grant list',async()=>{
    user.role='superadmin';storedRole={status:'active',permissions:[]};
    for(const e of endpoints) await call(e);
  });
  it('unknown stored permissions grant no access',async()=>{
    storedRole={status:'active',permissions:['customers.*','unregistered.read','*']};
    await call(endpoints[0],403);
  });
  it('supports the legacy super_admin alias but denies viewer by default',async()=>{
    user.role='super_admin';await call(endpoints[0]);user.role='viewer';await call(endpoints[0],403);
  });
  it('fails closed when the role database is unavailable',async()=>{
    Role.findOne.returns({lean:async()=>{throw Error('private connection details');}});
    const response=await call(endpoints[0],503);expect(JSON.stringify(response.body)).not.to.include('private');
  });
  it('prevents user API privilege escalation before persistence writes',async()=>{
    for(const method of ['patch','delete'])await request(app)[method]('/api/v1/users/'+id).set('Authorization','Bearer '+token()).send({role:'superadmin'}).expect(403);
    await request(app).post('/api/v1/users').set('Authorization','Bearer '+token()).send({role:'superadmin'}).expect(403);
  });
  it('prevents update permission from bypassing delete through status fields',async()=>{
    user.role='sales';
    await request(app).patch('/api/v1/customers/'+id).set('Authorization','Bearer '+token()).send({status:'deleted'}).expect(400);
    await request(app).patch('/api/v1/customers/'+id+'/status').set('Authorization','Bearer '+token()).send({status:'deleted'}).expect(400);
    expect(repo.updateById.called).to.equal(false);expect(repo.updateStatus.called).to.equal(false);
  });
  it('requires authenticated identity even for superadmin and rejects unknown permissions',async()=>{
    const res={status:sinon.stub().returnsThis(),json:sinon.stub()}; const next=sinon.spy();
    await requirePermission('customers.read')({user:{role:'superadmin'}},res,next);
    expect(res.status.calledWith(401)).to.equal(true);expect(next.called).to.equal(false);
    expect(()=>requirePermission('unregistered.read')).to.throw('Unregistered permission');
  });
});
