import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import * as M from '../src/models/index.js';
import { track } from '../src/services/data.js';
import { ingest } from '../src/rag/vectorStore.js';
import { normalize } from '../src/services/rules.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export async function seedData({ email = process.env.SEED_EMAIL || 'demo@example.test', password = process.env.SEED_PASSWORD, withEmbeddings = false, writeDocuments = true } = {}) {
  if (!password || password.length < 10) throw new Error('Set SEED_PASSWORD to a password of at least 10 characters.');
  let user = await M.User.findOne({ email });
  if (!user) user = await M.User.create({ fullName: 'Aarohi Mehta', email, passwordHash: await bcrypt.hash(password, 12) });
  await M.StudentProfile.updateOne({ userId: user._id }, { $setOnInsert: { fullName: 'Aarohi Mehta', location: 'Mysuru', degree: 'B.Tech', branch: 'ISE', college: 'Demo Engineering College', cgpa: 8.2, graduationYear: 2027, annualFamilyIncome: 250000, preferredRoles: ['Backend Developer'], preferredLocations: ['Remote'], interests: ['Distributed systems'], industries: ['Software'] } }, { upsert: true });
  for (const name of ['JavaScript', 'Node.js', 'Express', 'MongoDB', 'Git', 'React']) await M.Skill.updateOne({ userId: user._id, normalizedName: normalize(name) }, { $setOnInsert: { name, proficiency: 'Intermediate', category: 'Engineering' } }, { upsert: true });
  await M.Project.updateOne({ userId: user._id, name: 'Demo API Gateway' }, { $setOnInsert: { description: 'A fictional student project for exploring demo matches.', technologies: ['Node.js','Express','MongoDB'], githubUrl: '', liveUrl: '' } }, { upsert: true });
  const scholarshipNames = ['Engineering Futures','Women in Computing','Open Source Learners','Academic Excellence','First Generation Engineers','Community Builders','Backend Innovators','Cloud Learning','Research Explorer','Digital Access'];
  const documents = [];
  const due = days => new Date(Date.now() + days * 86400000);
  for (const [i, name] of scholarshipNames.entries()) {
    const record = await M.Scholarship.findOneAndUpdate({ name: `${name} — Demo` }, { $setOnInsert: { provider: 'Fictional Learning Foundation', amount: 15000 + i * 5000, description: `Fictional ${name.toLowerCase()} scholarship used solely to demonstrate rules and document retrieval.`, minCgpa: i % 3 === 0 ? 8.5 : 7, maxIncome: i % 2 === 0 ? 400000 : undefined, eligibleBranches: i % 4 === 0 ? ['CSE'] : ['ISE','CSE','IT'], eligibleDegrees: ['B.Tech'], requiredDocuments: ['Enrollment proof','Academic transcript', ...(i % 2 === 0 ? ['Income certificate'] : [])], deadline: due(7 + i * 4), isDemo: true, rulesComplete: true } }, { upsert: true, new: true });
    documents.push({ title: record.name + ' guidelines', kind: 'scholarship', opportunityId: record._id, text: `FICTIONAL DEMO DOCUMENT. This is not a real scholarship or application opportunity.\n${record.name}\nProvider: ${record.provider}. Amount: INR ${record.amount}. Minimum CGPA: ${record.minCgpa}. Eligible degrees: B.Tech. Eligible branches: ${record.eligibleBranches.join(', ')}. ${record.maxIncome ? 'Maximum annual family income: INR ' + record.maxIncome + '.' : 'No income rule in this demo.'} Required documents: ${record.requiredDocuments.join(', ')}. Demo deadline: ${record.deadline.toISOString()}. These demo rules are complete only for this fictional exercise.` });
    if (i < 2) await track(user._id, { kind: 'scholarship', opportunityId: String(record._id) });
  }
  const roles = ['Backend Developer','Full Stack Developer','Frontend Developer','Cloud Engineer','Data Engineer'];
  const skillSets = [['Node.js','Express','MongoDB','Redis','Docker'],['React','Node.js','JavaScript','SQL'],['React','TypeScript','CSS','Testing'],['AWS','Docker','Linux','Git'],['SQL','Python','ETL','MongoDB']];
  for (let i = 0; i < 20; i++) {
    const role = roles[i % 5], company = `Demo Studio ${String(i + 1).padStart(2, '0')}`;
    const job = await M.Job.findOneAndUpdate({ company }, { $setOnInsert: { role: role + (i < 15 ? ' Intern' : ''), company, type: i < 15 ? 'Internship' : 'Job', location: ['Bengaluru','Pune','Remote','Hyderabad'][i % 4], workMode: ['Remote','Hybrid','On-site'][i % 3], requiredSkills: skillSets[i % 5], preferredSkills: ['AWS','Testing'].filter(s => !skillSets[i % 5].includes(s)), experience: 'Student / 0–1 years', description: `FICTIONAL DEMO: Practice opportunity matching for ${role}. Build, test and document applications with ${skillSets[i % 5].join(', ')}. Explain your projects and collaborate through Git. This is not an active vacancy.`, deadline: due(10 + i * 2), isDemo: true } }, { upsert: true, new: true });
    documents.push({ title: job.role + ' at ' + company, kind: 'job', opportunityId: job._id, text: job.description + `\nRequired skills: ${job.requiredSkills.join(', ')}. Preferred skills: ${job.preferredSkills.join(', ')}. Location: ${job.location}. Work mode: ${job.workMode}.` });
    if (i < 3) await track(user._id, { kind: 'job', opportunityId: String(job._id) });
  }
  const dir = fileURLToPath(new URL('../../demo-documents/', import.meta.url));
  if (writeDocuments) await mkdir(dir, { recursive: true });
  for (const [index, doc] of documents.entries()) {
    const filename = `${String(index + 1).padStart(2, '0')}-${doc.kind}-demo.txt`;
    if (writeDocuments) await writeFile(dir + filename, doc.text);
    if (withEmbeddings && !await M.Document.exists({ ownerKey: 'public', opportunityId: doc.opportunityId, status: 'ready' })) await ingest({ ownerKey: 'public', title: doc.title, kind: doc.kind, opportunityId: doc.opportunityId, originalFilename: filename, isDemo: true, pages: [{ text: doc.text, pageNumber: null }] });
  }
  return { userId: String(user._id), scholarships: 10, jobs: 20, documents: documents.length, embeddingsCreated: withEmbeddings };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await connectDatabase(); console.log(await seedData({ withEmbeddings: process.argv.includes('--with-embeddings') })); }
  catch (error) { console.error(error.status ? error.message : 'Seed failed. Check SEED_PASSWORD and database settings.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
