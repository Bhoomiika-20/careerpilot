import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibility, jobMatch, preparationPlan } from '../src/services/rules.js';
import { chunkText } from '../src/rag/chunker.js';
const base = { minCgpa: 8, maxIncome: 400000, eligibleBranches: ['ISE'], eligibleDegrees: ['B.Tech'], rulesComplete: true, deadline: '2099-01-01', isDemo: true };
test('eligibility keeps missing income unknown and recognizes zero income', () => {
  const student = { cgpa: 8.5, branch: 'ISE', degree: 'B.Tech' };
  assert.equal(eligibility(student, base).status, 'More information required');
  assert.equal(eligibility({ ...student, annualFamilyIncome: 0 }, base).status, 'Eligible');
  assert.equal(eligibility({ ...student, annualFamilyIncome: 500000 }, base).status, 'Not eligible');
});
test('eligibility rejects branch mismatch and closed deadlines; incomplete rules stay uncertain', () => {
  const profile = { cgpa: 9, branch: 'ISE', degree: 'B.Tech', annualFamilyIncome: 200000 };
  assert.equal(eligibility(profile, {...base, eligibleBranches:['CSE']}).status, 'Not eligible');
  assert.equal(eligibility(profile, {...base, deadline:'2020-01-01'}).status, 'Not eligible');
  assert.equal(eligibility(profile, {...base, rulesComplete:false}).status, 'More information required');
});
test('matching uses normalized aliases, deduplicates requirements and exposes score arithmetic', () => {
  const result = jobMatch([{name:'Node.js',proficiency:'Intermediate'},{name:'Express.js',proficiency:'Beginner'}],[{name:'API',technologies:['Node.js']}],{requiredSkills:['Node','node.js','Express','Redis'],preferredSkills:['AWS']},'I used nodejs in an API.');
  assert.equal(result.score,57); assert.deepEqual(result.missing,['redis']); assert.deepEqual(result.partial,['express']); assert.equal(result.relevantProjects[0].name,'API'); assert.deepEqual(result.resumeEvidence,['nodejs']);
  assert.equal(jobMatch([],[],{requiredSkills:[],preferredSkills:[]}).score,null);
});
test('plans are tied to missing or beginner skills and span 30 days', () => {
  const plan = preparationPlan({ missing:['redis','docker'],partial:['express'] });
  assert.deepEqual(plan.flatMap(p => p.topics),['redis','docker','express']); assert.equal(plan.at(-1).days,'22–30');
});
test('chunking preserves coverage with overlap and rejects invalid sizes', () => {
  const text = Array.from({length:600},(_,i) => `word${i}`).join(' '); const chunks = chunkText(text,200,40);
  assert.ok(chunks.length > 2); assert.ok(chunks.every(c => c.length <= 200));
  for(let i=1;i<chunks.length;i++) assert.equal(chunks[i-1].slice(-40),chunks[i].slice(0,40));
  assert.ok(chunks.at(-1).endsWith('word599')); assert.throws(() => chunkText('abc',2,2));
});
