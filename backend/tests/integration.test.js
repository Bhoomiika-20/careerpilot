import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import AdmZip from 'adm-zip';
process.env.JWT_SECRET = 'test-only-not-for-production-0123456789';
process.env.NODE_ENV = 'test'; process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test'; process.env.OPENAI_API_KEY = ''; process.env.OPENAI_MODEL = '';
let mongo, app, models, connectMcp, alice, bob, aliceId, bobId, scholarship, job;
async function client(email, fullName) {
  const agent = request.agent(app); const csrf = (await agent.get('/api/auth/csrf')).body.token;
  const call = (method,path,body) => agent[method](path).set('X-CSRF-Token',csrf).send(body);
  const res = await call('post','/api/auth/register',{email,fullName,password:'Test-password-123'}); assert.equal(res.status,201,res.text);
  return {agent,call,id:res.body._id};
}
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] } }); process.env.MONGODB_URI = mongo.getUri('careerpilot_test');
  const { connectDatabase } = await import('../src/config/database.js'); await connectDatabase();
  ({ createApp: app } = await import('../src/app.js')); app=app(); models = await import('../src/models/index.js'); ({connectMcp} = await import('../src/mcp/client/index.js'));
  await Promise.all(Object.values(models).filter(v => v?.modelName).map(m => m.init()));
  alice=await client('alice@example.test','Alice'); bob=await client('bob@example.test','Bob'); aliceId=alice.id;bobId=bob.id;
  scholarship=await models.Scholarship.create({name:'Test Demo Scholarship',isDemo:true,minCgpa:8,maxIncome:400000,eligibleBranches:['ISE'],rulesComplete:true,deadline:new Date('2099-01-01')});
  job=await models.Job.create({role:'Backend Intern — Demo',company:'Demo',requiredSkills:['Node.js','Redis'],preferredSkills:['Docker'],isDemo:true,workMode:'Remote',type:'Internship'});
});
after(async () => {await mongoose.disconnect(); await mongo?.stop();});
test('auth rejects unauthenticated routes, CSRF violations, bad passwords and unknown fields',async () => {
  assert.equal((await request(app).get('/api/profile')).status,401);
  assert.equal((await alice.agent.put('/api/profile').send({cgpa:9})).status,403);
  assert.equal((await alice.call('post','/api/auth/login',{email:'alice@example.test',password:'wrong'})).status,401);
  assert.equal((await alice.call('put','/api/profile',{userId:bobId,cgpa:9})).status,400);
  assert.equal((await alice.call('put','/api/profile',{cgpa:11})).status,400);
});
test('profile CRUD persists; financial data remains isolated and MCP profile excludes it', async () => {
  assert.equal((await alice.call('put','/api/profile',{cgpa:8.8,branch:'ISE',annualFamilyIncome:250000})).status,200);
  const bobProfile = await bob.agent.get('/api/profile'); assert.equal(bobProfile.body.cgpa,undefined);
  const response=await alice.call('post','/api/skills',{name:'Node.js',proficiency:'Intermediate'}); assert.equal(response.status,201);
  assert.equal((await bob.call('put',`/api/skills/${response.body._id}`,{name:'Stolen',proficiency:'Beginner'})).status,404);
  const mcp=await connectMcp(aliceId);
  try { const tools=await mcp.client.listTools(); assert.equal(tools.tools.length,21); const profile=await mcp.invoke('get_student_profile',{}); assert.equal(profile.cgpa,8.8); assert.equal(profile.annualFamilyIncome,undefined); assert.equal(profile.skills[0].name,'Node.js');
    const result=await mcp.invoke('check_eligibility',{scholarshipId:String(scholarship._id)});assert.equal(result.status,'Eligible'); assert.equal(result.checks.find(c=>c.name==='Annual family income').actual,undefined);
    await assert.rejects(mcp.invoke('update_student_profile',{location:'Forbidden'}),/confirmation/);
  } finally {await mcp.close();}
});
test('applications are saved idempotently; cross-user reads and writes are blocked',async () => {
  const a=await alice.call('post','/api/applications',{kind:'job',opportunityId:String(job._id)});assert.equal(a.status,201);
  const b=await alice.call('post','/api/applications',{kind:'job',opportunityId:String(job._id)});assert.equal(a.body._id,b.body._id);
  assert.equal((await bob.agent.get('/api/applications')).body.length,0);
  assert.equal((await bob.call('put',`/api/applications/${a.body._id}`,{status:'Applied'})).status,404);
  const update=await alice.call('put',`/api/applications/${a.body._id}`,{status:'Applied',notes:'Actual note'});assert.equal(update.body.status,'Applied');
});
test('confirmation is bound to the owner, exact arguments and single consumption; real MCP creates reminder',async () => {
  const call=await models.ToolCall.create({userId:aliceId,name:'create_reminder',args:{title:'Prepare transcript',remindAt:'2098-01-01T10:00:00.000Z',note:''},status:'pending',expiresAt:new Date(Date.now()+60000)});
  assert.equal((await bob.call('post',`/api/chat/confirm/${call._id}`,{approve:true})).status,409);
  const result=await alice.call('post',`/api/chat/confirm/${call._id}`,{approve:true}); assert.equal(result.status,200,result.text);assert.equal(result.body.status,'completed');
  assert.equal((await alice.call('post',`/api/chat/confirm/${call._id}`,{approve:true})).status,409);
  assert.equal(await models.Reminder.countDocuments({userId:aliceId,title:'Prepare transcript'}),1);
  const {argumentHash}=await import('../src/mcp/capability.js');const conn=await connectMcp(aliceId,{name:'update_student_profile',hash:argumentHash({location:'Mysuru'})});
  try {await assert.rejects(conn.invoke('update_student_profile',{location:'Other city'}),/confirmation/);assert.equal((await conn.invoke('update_student_profile',{location:'Mysuru'})).location,'Mysuru');} finally {await conn.close();}
});
test('resume upload validates signatures, extracts DOCX text and remains private',async () => {
  const zip=new AdmZip();zip.addFile('[Content_Types].xml',Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));zip.addFile('word/document.xml',Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Alice built a Node.js API with documented endpoints and tested authentication.</w:t></w:r></w:p></w:body></w:document>'));
  const csrf=(await alice.agent.get('/api/auth/csrf')).body.token;
  const result=await alice.agent.post('/api/resume/upload').set('X-CSRF-Token',csrf).attach('file',zip.toBuffer(),'resume.docx');assert.equal(result.status,201,result.text);assert.match(result.body.text,/Node.js/);
  assert.equal((await bob.agent.get('/api/resume')).body,null);
  const bad=await alice.agent.post('/api/resume/upload').set('X-CSRF-Token',csrf).attach('file',Buffer.from('not a PDF'),'fake.pdf');assert.equal(bad.status,400);
});
test('chat sessions are isolated; missing AI config returns a real error',async () => {
  const csrf=(await alice.agent.get('/api/auth/csrf')).body.token; // previous multipart test rotated token
  const session=await alice.agent.post('/api/chat/sessions').set('X-CSRF-Token',csrf).send({});assert.equal(session.status,201);
  assert.equal((await bob.agent.get('/api/chat/history').query({sessionId:session.body._id})).status,404);
  const result=await alice.agent.post('/api/chat').set('X-CSRF-Token',csrf).send({sessionId:session.body._id,message:'Find scholarships'});assert.equal(result.status,503);assert.match(result.body.message,/OPENAI_MODEL/);
  assert.equal(await models.ChatMessage.countDocuments({sessionId:session.body._id,role:'assistant'}),0);
});
test('vector pipeline filters tenant before similarity search and enforces threshold',async () => {
  const {vectorPipeline}=await import('../src/rag/vectorStore.js');const pipeline=vectorPipeline(aliceId,[0.1,0.2],{kind:'scholarship'});
  assert.deepEqual(pipeline[0].$vectorSearch.filter.ownerKey,{$in:[aliceId,'public']});assert.equal(pipeline[0].$vectorSearch.filter.kind,'scholarship');assert.ok(pipeline[2].$match.score.$gte > 0);
});
test('agent executes model-selected tools, uses tool results and stops runaway loops',async () => {
  const {executeLoop}=await import('../src/agents/agent.js');const calls=[];let turn=0;
  const result=await executeLoop({messages:[],tools:[],callModel:async messages => {if(turn++ === 0) return {role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:'get_student_skills',arguments:'{}'}}]};assert.equal(JSON.parse(messages.at(-1).content).skills[0],'Node.js');return {role:'assistant',content:'You have Node.js.'};},execute:async name=>{calls.push(name);return {skills:['Node.js']};}});
  assert.deepEqual(calls,['get_student_skills']);assert.equal(result,'You have Node.js.');
  await assert.rejects(executeLoop({messages:[],tools:[],maxSteps:2,callModel:async()=>({role:'assistant',tool_calls:[{id:'x',function:{name:'loop',arguments:'{}'}}]}),execute:async()=>({})}),/step limit/);
});
test('logout invalidates existing signed cookies',async () => {
  const c=await client('logout@example.test','Logout');const cookie=(await c.call('post','/api/auth/login',{email:'logout@example.test',password:'Test-password-123'})).headers['set-cookie'].find(v=>v.startsWith('cp_session='));
  assert.equal((await c.call('post','/api/auth/logout',{})).status,200);assert.equal((await request(app).get('/api/profile').set('Cookie',cookie.split(';')[0])).status,401);
});
