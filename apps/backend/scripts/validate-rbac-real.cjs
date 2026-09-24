// Run only in an explicitly confirmed QA database. Never prints credentials/tokens.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const mongoose = require('mongoose');
const { validateQaEnvironment, classifyConnectionError } = require('./qa-environment.cjs');
const matrix = { superadmin:[1,1,1,1],admin:[1,1,1,1],manager:[1,1,1,0],sales:[1,1,1,0],purchasing:[1,0,0,0],warehouse:[1,0,0,0],finance:[1,0,0,0],hr:[0,0,0,0],auditor:[1,0,0,0],user:[0,0,0,0] };
const permissions = ['customers.read','customers.create','customers.update','customers.delete'];
async function main() {
  const envPath=path.resolve(process.env.M03_ENV_FILE || path.join(__dirname,'../.env'));
  if(!fs.existsSync(envPath)){console.log('RBAC QA: LOCAL_ENV_MISSING');process.exitCode=2;return;}
  const env=require('dotenv').parse(fs.readFileSync(envPath));
  const preflight=validateQaEnvironment(env);
  if(!preflight.ok){console.log('RBAC QA: '+preflight.reason);process.exitCode=2;return;}
  // Isolated runner server only; no change to the application default rate limit.
  Object.assign(process.env,env,{MONGODB_DB_NAME:preflight.dbName,RATE_LIMIT_MAX:'1000'});
  const User=require('../src/modules/users/users.model');
  const Role=require('../src/modules/roles/roles.model');
  const Customer=require('../src/modules/customers/customers.model');
  const marker='QA_RBAC_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');
  const password=crypto.randomBytes(32).toString('hex');
  const userIds=[],roleIds=[],customerIds=[],checks=[];
  let server,connected=false,created=0,cleaned=0,step='CONNECT';
  try {
    await mongoose.connect(env.MONGODB_URI,{dbName:preflight.dbName,serverSelectionTimeoutMS:10000});connected=true;
    // Do not override existing policy documents, even in QA.
    if(await Role.exists({name:{$in:Object.keys(matrix)}}))throw Error('QA_ROLE_FIXTURE_COLLISION');
    for(const [name,grants] of Object.entries(matrix)){
      const roleId=new mongoose.Types.ObjectId();roleIds.push(roleId);
      await Role.create({_id:roleId,name,description:marker,permissions:permissions.filter((_,i)=>grants[i]),status:'active'});created++;
    }
    const target=await Customer.create({name:marker,email:marker.toLowerCase()+'@example.com'});
    customerIds.push(target._id);created++;
    const app=require('../src/app');
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const base='http://127.0.0.1:'+server.address().port+'/api/v1';
    async function http(label,method,url,expected,token,body){
      step=label;
      const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
      const data=await response.json();
      // Track successful creations even when a subsequent assertion fails.
      if(method==='POST'&&url==='/customers'&&response.status===201){customerIds.push(new mongoose.Types.ObjectId(data.data._id));created++;}
      assert.equal(response.status,expected,label);checks.push({operation:label,http:response.status,result:'PASS'});return data.data;
    }
    const tokens={},users={};
    for(const name of Object.keys(matrix)){
      const id=new mongoose.Types.ObjectId();userIds.push(id);users[name]=id;
      const email=marker.toLowerCase()+'_'+name+'@example.com';
      await User.create({_id:id,email,password,firstName:marker,lastName:'QA',role:name});created++;
      const session=await http(name+':login','POST','/auth/login',200,null,{email,password});tokens[name]=session.accessToken;
      const payload=require('jsonwebtoken').decode(session.accessToken);
      assert(!('permissions' in payload)&&!('role' in payload)&&!('email' in payload));
      assert.deepEqual(session.user.permissions.filter(p => p.startsWith('customers.')).sort(),permissions.filter((_,i)=>matrix[name][i]).sort());
    }
    const endpoints=[['GET','/customers',0,200],['GET','/customers/search?q='+marker,0,200],['GET','/customers/stats',0,200],['GET','/customers/'+target.id,0,200],['POST','/customers',1,201],['PATCH','/customers/'+target.id,2,200],['PATCH','/customers/'+target.id+'/status',2,200],['DELETE','/customers/'+target.id,3,200]];
    for(const [method,url] of endpoints)await http('no-token:'+method+url.split('?')[0],method,url,401);
    await http('invalid-token','GET','/customers',401,'invalid');
    for(const [name,grants] of Object.entries(matrix)){
      await Customer.updateOne({_id:target._id},{$set:{status:'active',name:marker}});
      for(const [method,url,index,success] of endpoints){
        const body=method==='POST'?{name:marker+' '+name,email:marker.toLowerCase()+'_'+name+'@example.com'}:method==='PATCH'?(url.endsWith('/status')?{status:'inactive'}:{name:marker+' updated'}):undefined;
        const before=await Customer.findById(target._id).lean();
        await http(name+':'+method+url.split('?')[0],method,url,grants[index]?success:403,tokens[name],body);
        if(!grants[index])assert.deepEqual(await Customer.findById(target._id).lean(),before);
        if(method==='DELETE'&&grants[index])assert.equal((await Customer.findById(target._id)).status,'deleted');
      }
    }
    await http('self-elevation','PATCH','/users/'+users.user,403,tokens.user,{role:'superadmin',permissions});
    assert.equal((await User.findById(users.user)).role,'user');
    await http('status-delete-bypass','PATCH','/customers/'+target.id+'/status',400,tokens.sales,{status:'deleted'});
    await http('update-delete-bypass','PATCH','/customers/'+target.id,400,tokens.sales,{status:'deleted'});
    const roleId=roleIds[Object.keys(matrix).indexOf('user')];
    for(const [index,permission] of permissions.entries()){
      await Role.updateOne({_id:roleId,description:marker},{$set:{permissions:[permission]}});
      for(const [method,url,action,status] of endpoints){
        const body=method==='POST'?{name:marker,email:marker.toLowerCase()+'_single_'+index+'@example.com'}:method==='PATCH'?(url.endsWith('/status')?{status:'inactive'}:{name:marker}):undefined;
        await http('single-'+permission+':'+method+url.split('?')[0],method,url,action===index?status:403,tokens.user,body);
      }
    }
    await Role.updateOne({_id:roleId,description:marker},{$set:{permissions:[]}});
    await http('role-revocation-same-token','GET','/customers',403,tokens.user);
    await User.updateOne({_id:users.admin},{$set:{status:'inactive'}});
    await http('inactive-user-same-token','GET','/customers',401,tokens.admin);
    await User.deleteOne({_id:users.admin,firstName:marker});cleaned++;
    await http('deleted-user-same-token','GET','/customers',401,tokens.admin);
    const tampered=require('jsonwebtoken').sign({id:String(users.user),role:'superadmin',permissions},env.JWT_SECRET);
    await http('obsolete-privileged-claims-ignored','GET','/customers',403,tampered);
  } catch(error){console.log('RBAC QA failure: '+classifyConnectionError(error));process.exitCode=1;}
  finally {
    if(connected){try{
      cleaned+=(await Customer.deleteMany({_id:{$in:customerIds},email:{$regex:'^'+marker.toLowerCase()}})).deletedCount;
      cleaned+=(await User.deleteMany({_id:{$in:userIds},firstName:marker})).deletedCount;
      cleaned+=(await Role.deleteMany({_id:{$in:roleIds},description:marker})).deletedCount;
      assert.equal(cleaned,created);
    }catch(_){console.log('RBAC QA cleanup: FAILED');process.exitCode=1;}}
    if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();
    console.log('RBAC_RESULT: '+JSON.stringify({connection:connected?'SUCCESS':'FAILED',checks,recordsCreated:created,recordsCleaned:cleaned,failedStep:process.exitCode?step:null,success:!process.exitCode}));
  }
}
main().catch(()=>{console.log('RBAC QA: CONFIGURATION');process.exitCode=2;});
