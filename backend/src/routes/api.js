import { Router } from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as M from '../models/index.js';
import { authenticate, setSession, cookieOptions, issueCsrf } from '../middleware/security.js';
import { AppError, must, safeError } from '../utils/errors.js';
import { id, text, profileSchema, skillSchema, projectSchema } from '../services/schemas.js';
import { student, updateProfile, track, createReminder, deadlines, matchFor } from '../services/data.js';
import { normalize, eligibility, jobMatch, preparationPlan, profileCompleteness } from '../services/rules.js';
import { extractDocument } from '../rag/documentProcessor.js';
import { ingest } from '../rag/vectorStore.js';
import { analyzeResume, latestResume } from '../services/resume.js';
import { config } from '../config/env.js';
import { runAgent } from '../agents/agent.js';
import { connectMcp } from '../mcp/client/index.js';
import { argumentHash } from '../mcp/capability.js';
import { findTool } from '../mcp/registry.js';
export const api = Router();
const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const aiLimit = rateLimit({ windowMs: 60000, limit: 12, keyGenerator: req => String(req.user._id), standardHeaders: 'draft-8', legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });
const publicUser = u => ({ _id: u._id, fullName: u.fullName, email: u.email });
api.get('/auth/csrf', issueCsrf);
api.post('/auth/register', authLimit, async (req, res) => {
  const input = z.object({ fullName: text, email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(10).max(72).refine(v => Buffer.byteLength(v) <= 72, 'Password must be at most 72 bytes') }).strict().parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await M.User.create({ fullName: input.fullName, email: input.email, passwordHash });
  await M.StudentProfile.create({ userId: user._id, fullName: user.fullName }); setSession(res, user); res.status(201).json(publicUser(user));
});
api.post('/auth/login', authLimit, async (req, res) => {
  const input = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), password: z.string().min(1).max(72) }).strict().parse(req.body);
  const user = await M.User.findOne({ email: input.email }).select('+passwordHash');
  const hash = user?.passwordHash || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const valid = await bcrypt.compare(input.password, hash);
  must(user && valid, 401, 'Email or password is incorrect.'); setSession(res, user); res.json(publicUser(user));
});
api.use(authenticate);
api.get('/auth/me', (req, res) => res.json(publicUser(req.user)));
api.post('/auth/logout', async (req, res) => { await M.User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } }); res.clearCookie('cp_session', cookieOptions).json({ ok: true }); });
api.get('/settings', (req, res) => res.json({ aiConfigured: !!(config.OPENAI_API_KEY && config.OPENAI_MODEL), embeddingsConfigured: !!config.OPENAI_API_KEY, reminders: 'In-app only', financialData: 'Income is used locally by eligibility rules and excluded from AI profile tools.' }));
api.get('/profile', async (req, res) => res.json(await student(req.user._id, true)));
api.put('/profile', async (req, res) => res.json(await updateProfile(req.user._id, req.body)));
api.delete('/profile', async (req, res) => { await Promise.all([M.StudentProfile.deleteOne({ userId: req.user._id }), M.Skill.deleteMany({ userId: req.user._id }), M.Project.deleteMany({ userId: req.user._id })]); res.json({ ok: true }); });
for (const [path, Model, schema] of [['skills', M.Skill, skillSchema], ['projects', M.Project, projectSchema]]) {
  api.get(`/${path}`, async (req, res) => res.json(await Model.find({ userId: req.user._id }).lean()));
  api.post(`/${path}`, async (req, res) => { const data = schema.parse(req.body); if (path === 'skills') data.normalizedName = normalize(data.name); res.status(201).json(await Model.create({ ...data, userId: req.user._id })); });
  api.put(`/${path}/:id`, async (req, res) => { const data = schema.parse(req.body); if (path === 'skills') data.normalizedName = normalize(data.name); res.json(must(await Model.findOneAndUpdate({ _id: id.parse(req.params.id), userId: req.user._id }, { $set: data }, { new: true, runValidators: true }))); });
  api.delete(`/${path}/:id`, async (req, res) => { must(await Model.findOneAndDelete({ _id: id.parse(req.params.id), userId: req.user._id })); res.json({ ok: true }); });
}
api.get('/scholarships', async (req, res) => {
  const query = z.object({ q: z.string().max(200).default(''), eligible: z.enum(['true','false']).default('false') }).parse(req.query);
  const [profile, records] = await Promise.all([student(req.user._id, true), M.Scholarship.find().limit(100).lean()]);
  res.json(records.filter(s => `${s.name} ${s.provider}`.toLowerCase().includes(query.q.toLowerCase())).map(s => ({ ...s, eligibility: eligibility(profile, s) })).filter(s => query.eligible !== 'true' || s.eligibility.status === 'Eligible'));
});
api.get('/scholarships/:id', async (req, res) => { const record = must(await M.Scholarship.findById(id.parse(req.params.id)).lean()); res.json({ ...record, eligibility: eligibility(await student(req.user._id, true), record) }); });
api.get('/jobs', async (req, res) => {
  const query = z.object({ q: z.string().max(200).default(''), workMode: z.enum(['','Remote','Hybrid','On-site']).default('') }).parse(req.query);
  const [profile, records, resume] = await Promise.all([student(req.user._id), M.Job.find().limit(100).lean(), M.Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean()]);
  res.json(records.filter(j => `${j.role} ${j.requiredSkills.join(' ')}`.toLowerCase().includes(query.q.toLowerCase()) && (!query.workMode || j.workMode === query.workMode)).map(j => ({ ...j, match: jobMatch(profile.skills, profile.projects, j, resume?.text) })).sort((a, b) => (b.match.score || 0) - (a.match.score || 0)));
});
api.get('/jobs/:id', async (req, res) => res.json(await matchFor(req.user._id, id.parse(req.params.id))));
api.get('/jobs/:id/plan', async (req, res) => { const match = await matchFor(req.user._id, id.parse(req.params.id)); res.json({ ...match, plan: preparationPlan(match) }); });
api.get('/applications', async (req, res) => res.json(await M.Application.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean()));
api.post('/applications', async (req, res) => res.status(201).json(await track(req.user._id, req.body)));
api.put('/applications/:id', async (req, res) => { const data = z.object({ status: z.enum(M.statuses).optional(), notes: z.string().max(3000).optional() }).strict().parse(req.body); res.json(must(await M.Application.findOneAndUpdate({ _id: id.parse(req.params.id), userId: req.user._id }, { $set: data }, { new: true, runValidators: true }))); });
api.delete('/applications/:id', async (req, res) => { must(await M.Application.findOneAndDelete({ _id: id.parse(req.params.id), userId: req.user._id })); res.json({ ok: true }); });
api.get('/deadlines', async (req, res) => res.json(await deadlines(req.user._id)));
api.get('/reminders', async (req, res) => res.json(await M.Reminder.find({ userId: req.user._id, dismissed: false }).sort({ remindAt: 1 }).lean()));
api.post('/reminders', async (req, res) => res.status(201).json(await createReminder(req.user._id, req.body)));
api.delete('/reminders/:id', async (req, res) => { must(await M.Reminder.findOneAndUpdate({ _id: id.parse(req.params.id), userId: req.user._id }, { $set: { dismissed: true } })); res.json({ ok: true }); });
api.get('/documents', async (req, res) => res.json(await M.Document.find({ ownerKey: String(req.user._id) }).sort({ createdAt: -1 }).lean()));
api.post('/documents/upload', aiLimit, upload.single('file'), async (req, res) => {
  const meta = z.object({ title: text, kind: z.enum(['scholarship','job','guide','resume']), sourceUrl: z.union([z.string().url().refine(v => /^https?:/.test(v)), z.literal('')]).default('') }).strict().parse(req.body);
  const parsed = await extractDocument(req.file);
  const document = await ingest({ ...meta, ownerKey: String(req.user._id), originalFilename: req.file.originalname, pages: parsed.pages, isDemo: false }); res.status(201).json(document);
});
api.delete('/documents/:id', async (req, res) => { const doc = must(await M.Document.findOne({ _id: id.parse(req.params.id), ownerKey: String(req.user._id) })); await M.DocumentChunk.deleteMany({ documentId: doc._id, ownerKey: String(req.user._id) }); await doc.deleteOne(); res.json({ ok: true }); });
api.get('/resume', async (req, res) => { const resume = await M.Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean(); res.json(resume); });
api.post('/resume/upload', upload.single('file'), async (req, res) => { const { text } = await extractDocument(req.file); res.status(201).json(await M.Resume.create({ userId: req.user._id, originalFilename: req.file.originalname, text })); });
api.delete('/resume', async (req, res) => { await M.Resume.deleteMany({ userId: req.user._id }); res.json({ ok: true }); });
api.post('/resume/analyze', aiLimit, async (req, res) => { const input = z.object({ jobId: id.optional() }).strict().parse(req.body); res.json(await analyzeResume(req.user._id, input.jobId)); });
api.get('/chat/sessions', async (req, res) => res.json(await M.ChatSession.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(50).lean()));
api.post('/chat/sessions', async (req, res) => res.status(201).json(await M.ChatSession.create({ userId: req.user._id, title: 'New conversation' })));
api.get('/chat/history', async (req, res) => { const sessionId = id.parse(req.query.sessionId); must(await M.ChatSession.findOne({ _id: sessionId, userId: req.user._id })); res.json(await M.ChatMessage.find({ userId: req.user._id, sessionId }).sort({ createdAt: 1 }).limit(200).lean()); });
api.get('/chat/pending', async (req, res) => res.json(await M.ToolCall.find({ userId: req.user._id, status: 'pending', expiresAt: { $gt: new Date() } }).lean()));
api.post('/chat', aiLimit, async (req, res, next) => {
  const input = z.object({ sessionId: id, message: z.string().trim().min(1).max(4000) }).strict().parse(req.body);
  const session = await M.ChatSession.findOneAndUpdate({ _id: input.sessionId, userId: req.user._id, $or: [{ busyUntil: { $lt: new Date() } }, { busyUntil: null }] }, { $set: { busyUntil: new Date(Date.now() + 5 * 60000), title: input.message.slice(0, 60) } }, { new: true });
  must(session, 409, 'Conversation is busy or unavailable.');
  const streaming = req.get('accept') === 'text/event-stream';
  const send = (event, data) => { if (streaming && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  if (streaming) { res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders(); }
  const heartbeat = streaming ? setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 15000) : null;
  try {
    await M.ChatMessage.create({ userId: req.user._id, sessionId: session._id, role: 'user', content: input.message });
    const recent = await M.ChatMessage.find({ userId: req.user._id, sessionId: session._id }).sort({ createdAt: -1 }).limit(12).lean();
    const result = await runAgent(req.user._id, session._id, recent.reverse().map(m => ({ role: m.role, content: m.content.slice(0, 8000) })), item => send('activity', item));
    const message = await M.ChatMessage.create({ ...result, userId: req.user._id, sessionId: session._id, role: 'assistant' });
    if (streaming) send('done', message); else res.json(message);
  } catch (error) { if (streaming) send('error', { message: safeError(error) }); else next(error); }
  finally { clearInterval(heartbeat); await M.ChatSession.updateOne({ _id: session._id, userId: req.user._id }, { $unset: { busyUntil: 1 } }); if (streaming) res.end(); }
});
api.post('/chat/confirm/:id', async (req, res) => {
  const { approve } = z.object({ approve: z.boolean() }).strict().parse(req.body);
  const call = await M.ToolCall.findOneAndUpdate({ _id: id.parse(req.params.id), userId: req.user._id, status: 'pending', expiresAt: { $gt: new Date() } }, { $set: { status: approve ? 'executing' : 'rejected' } }, { new: true });
  must(call, 409, 'This confirmation is expired or has already been handled.');
  if (!approve) return res.json({ status: 'rejected' });
  let connection;
  try {
    const definition = must(findTool(call.name), 400, 'Unknown tool'); must(definition.write, 400, 'This tool does not require confirmation.');
    const parsed = definition.schema.parse(call.args);
    connection = await connectMcp(req.user._id, { name: call.name, hash: argumentHash(parsed) });
    const result = await connection.invoke(call.name, parsed);
    call.status = 'completed'; call.result = JSON.parse(JSON.stringify(result)); await call.save();
    const run = await M.AgentRun.findOne({ _id: call.runId, userId: req.user._id });
    if (run) await M.ChatMessage.create({ userId: req.user._id, sessionId: run.sessionId, role: 'assistant', content: `Confirmed and completed: ${call.name.replaceAll('_', ' ')}.`, activity: [{ tool: call.name, state: 'completed' }] });
    res.json({ status: 'completed', result });
  } catch (error) { call.status = 'failed'; await call.save(); throw error; } finally { await connection?.close(); }
});
api.get('/dashboard', async (req, res) => {
  const userId = req.user._id;
  const [profile, scholarships, jobs, applications, upcoming, reminders, runs] = await Promise.all([student(userId, true), M.Scholarship.find().lean(), M.Job.find().lean(), M.Application.find({ userId }).lean(), deadlines(userId), M.Reminder.find({ userId, dismissed: false }).sort({ remindAt: 1 }).limit(5).lean(), M.AgentRun.find({ userId }).sort({ createdAt: -1 }).limit(4).lean()]);
  const matches = jobs.map(j => ({ ...j, match: jobMatch(profile.skills, profile.projects, j) })).sort((a, b) => (b.match.score || 0) - (a.match.score || 0));
  const recommended = scholarships.map(s => ({ ...s, eligibility: eligibility(profile, s) })).filter(s => s.eligibility.status !== 'Not eligible');
  res.json({ completeness: profileCompleteness(profile, profile.skills, profile.projects), counts: { scholarships: recommended.length, jobs: matches.filter(j => j.match.score >= 50).length, applications: applications.filter(a => !['Rejected','Withdrawn','Selected'].includes(a.status)).length, deadlines: upcoming.length }, scholarships: recommended.slice(0, 3), jobs: matches.slice(0, 3), upcoming: upcoming.slice(0, 4), missingSkills: [...new Set(matches.slice(0, 3).flatMap(j => j.match.missing))], reminders, runs, aiConfigured: !!(config.OPENAI_API_KEY && config.OPENAI_MODEL) });
});
