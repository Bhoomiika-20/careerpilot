import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import AdmZip from 'adm-zip';
process.env.JWT_SECRET='test-only-not-for-production-0123456789';process.env.MONGODB_URI='mongodb://127.0.0.1/test';process.env.OPENAI_API_KEY='';process.env.OPENAI_MODEL='';process.env.NODE_ENV='test';
const {createMcpServer}=await import('../src/mcp/createServer.js');
const {toolRegistry}=await import('../src/mcp/registry.js');
const {contextToken,readContext,argumentHash}=await import('../src/mcp/capability.js');
const {executeLoop}=await import('../src/agents/agent.js');
const {vectorPipeline}=await import('../src/rag/vectorStore.js');
const {extractDocument}=await import('../src/rag/documentProcessor.js');
const {profileSchema,reminderSchema}=await import('../src/services/schemas.js');
async function pair(claims,registry){const server=createMcpServer(claims,registry);const client=new Client({name:'test-client',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(a),client.connect(b)]);return {client,close:async()=>{await client.close();await server.close();}};}
test('actual SDK discovery advertises 21 typed tools; execution uses bound user context',async()=>{
  let observed;
  const registry=toolRegistry.map(t=>t.name==='get_student_skills'?{...t,run:async userId=>{observed=userId;return [{name:'Fixture skill'}];}}:t);
  const p=await pair(readContext(contextToken('0123456789abcdef01234567')),registry);
  try{const list=await p.client.listTools();assert.equal(list.tools.length,21);assert.ok(list.tools.every(t=>t.inputSchema.type==='object'));
    const result=await p.client.callTool({name:'get_student_skills',arguments:{}});assert.equal(result.structuredContent.data[0].name,'Fixture skill');assert.equal(observed,'0123456789abcdef01234567');
    const denied=await p.client.callTool({name:'update_student_profile',arguments:{location:'Pune'}});assert.equal(denied.isError,true);assert.match(denied.content[0].text,/confirmation/);
  }finally{await p.close();}
});
test('MCP capability permits exact arguments once; expiry and tampered context are rejected',async()=>{
  let writes=0;const registry=toolRegistry.map(t=>t.name==='update_student_profile'?{...t,run:async(_,a)=>{writes++;return a;}}:t);
  const token=contextToken('0123456789abcdef01234567',{name:'update_student_profile',hash:argumentHash({location:'Pune'})});assert.throws(()=>readContext(token+'tampered'));
  const p=await pair(readContext(token),registry);
  try{assert.equal((await p.client.callTool({name:'update_student_profile',arguments:{location:'Delhi'}})).isError,true);
    assert.equal((await p.client.callTool({name:'update_student_profile',arguments:{location:'Pune'}})).isError,undefined);
    assert.equal((await p.client.callTool({name:'update_student_profile',arguments:{location:'Pune'}})).isError,true);assert.equal(writes,1);
  }finally{await p.close();}
  const expired=await pair({sub:'0123456789abcdef01234567',exp:1},registry);
  try{assert.equal((await expired.client.callTool({name:'get_student_profile',arguments:{}})).isError,true);}finally{await expired.close();}
});
test('MCP validates schemas before executing tools',async()=>{
  const p=await pair(readContext(contextToken('0123456789abcdef01234567')));
  try{const result=await p.client.callTool({name:'get_scholarship_details',arguments:{scholarshipId:'bad-id'}});assert.equal(result.isError,true);}finally{await p.close();}
});
test('vector retrieval prefilters private ownership and applies configured relevance threshold',()=>{
  const p=vectorPipeline('student-a',[0.2,0.1],{kind:'scholarship'});assert.deepEqual(p[0].$vectorSearch.filter.ownerKey,{$in:['student-a','public']});assert.equal(p[0].$vectorSearch.filter.kind,'scholarship');assert.ok(p[0].$vectorSearch.filter.embeddingModel);assert.ok(p[2].$match.score.$gte > 0);assert.equal(p[3].$project.embedding,0);
});
test('agent selects tools from model output, feeds real results back and handles tool errors',async()=>{
  let step=0;const calls=[];const activities=[];
  const result=await executeLoop({messages:[],tools:[],onActivity:a=>activities.push(a),callModel:async messages=>{
    if(step++===0)return {role:'assistant',tool_calls:[{id:'c1',type:'function',function:{name:'get_student_profile',arguments:'{}'}}]};assert.equal(JSON.parse(messages.at(-1).content).branch,'ISE');return {role:'assistant',content:'Your branch is ISE.'};
  },execute:async name=>{calls.push(name);return {branch:'ISE'};}});assert.equal(result,'Your branch is ISE.');assert.deepEqual(calls,['get_student_profile']);assert.equal(activities.at(-1).state,'completed');
  step=0;await executeLoop({messages:[],tools:[],callModel:async messages=>{if(step++===0)return {role:'assistant',tool_calls:[{id:'c',function:{name:'fail',arguments:'{}'}}]};assert.ok(JSON.parse(messages.at(-1).content).error);return {role:'assistant',content:'Unable to complete.'};},execute:async()=>{throw new Error('Secret database URL');}});
});
test('agent refuses unbounded loops and excess calls',async()=>{
  const model=async()=>({role:'assistant',tool_calls:[{id:'x',function:{name:'again',arguments:'{}'}}]});
  await assert.rejects(executeLoop({messages:[],tools:[],maxSteps:2,callModel:model,execute:async()=>({})}),/step limit/);
  await assert.rejects(executeLoop({messages:[],tools:[],maxCalls:1,callModel:model,execute:async()=>({})}),/Tool limit/);
});
test('argument validation rejects tenant overrides, invalid dates and incomplete reminder links',()=>{
  assert.throws(()=>profileSchema.parse({userId:'someone-else'}));assert.throws(()=>profileSchema.parse({cgpa:11}));
  assert.throws(()=>reminderSchema.parse({title:'Past',remindAt:'2020-01-01T00:00:00.000Z'}));assert.throws(()=>reminderSchema.parse({title:'Link',remindAt:'2099-01-01T00:00:00.000Z',kind:'job'}));
});
test('DOCX extraction reads actual text and rejects fake signatures',async()=>{
  const zip=new AdmZip();zip.addFile('word/document.xml',Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Student built a Node.js application and tested authenticated REST endpoints.</w:t></w:r></w:p></w:body></w:document>'));const buffer=zip.toBuffer();
  const result=await extractDocument({buffer,size:buffer.length,originalname:'resume.docx'});assert.match(result.text,/authenticated REST/);assert.equal(result.pages[0].pageNumber,null);
  await assert.rejects(extractDocument({buffer:Buffer.from('fake'),size:4,originalname:'resume.pdf'}),/readable PDF/);
});
test('AI service refuses missing credentials rather than fabricating a response',async()=>{
  const {aiRequest,completion}=await import('../src/services/ai.js');await assert.rejects(aiRequest('embeddings',{input:['test']}),/not configured/);await assert.rejects(completion([{role:'user',content:'Hi'}]),/OPENAI_MODEL/);
});
test('PDF extraction reads real pages, retains page metadata and rejects overlong PDFs',async()=>{
  const {PDFDocument,StandardFonts}=await import('pdf-lib');const document=await PDFDocument.create();const font=await document.embedFont(StandardFonts.Helvetica);
  document.addPage().drawText('A real PDF fixture containing scholarship eligibility evidence.',{font,size:12,x:40,y:700});
  const buffer=Buffer.from(await document.save({useObjectStreams:false}));
  const result=await extractDocument({buffer,size:buffer.length,originalname:'guideline.pdf'});assert.match(result.text,/scholarship eligibility/);assert.equal(result.pages[0].pageNumber,1);
  for(let i=1;i<41;i++)document.addPage().drawText('A page for enforcing the maximum document limit.',{font,size:12,x:40,y:700});
  const large=Buffer.from(await document.save({useObjectStreams:false}));await assert.rejects(extractDocument({buffer:large,size:large.length,originalname:'long.pdf'}),/at most 40 pages/);
});
test('CSRF middleware rejects non-hex and cross-origin tokens safely',async()=>{
  const {csrf}=await import('../src/middleware/security.js');let error;
  csrf({method:'POST',cookies:{cp_csrf:'a'.repeat(64)},get:header=>header==='X-CSRF-Token'?'é'.repeat(64):undefined},{},e=>error=e);assert.equal(error.status,403);
  csrf({method:'POST',cookies:{cp_csrf:'a'.repeat(64)},get:header=>header==='origin'?'https://untrusted.example':'a'.repeat(64)},{},e=>error=e);assert.equal(error.status,403);
});
