import { StudentProfile, Skill, Project, Scholarship, Job, Application, Reminder, Resume } from '../models/index.js';
import { must } from '../utils/errors.js';
import { id, profileSchema, reminderSchema, applicationSchema } from './schemas.js';
import { jobMatch } from './rules.js';
export async function student(userId, includeIncome = false) {
  const [profile, skills, projects] = await Promise.all([StudentProfile.findOne({ userId }).lean(), Skill.find({ userId }).lean(), Project.find({ userId }).lean()]);
  const safeProfile = profile || {};
  if (!includeIncome) delete safeProfile.annualFamilyIncome;
  return { ...safeProfile, skills, projects };
}
export async function updateProfile(userId, input) {
  return StudentProfile.findOneAndUpdate({ userId }, { $set: profileSchema.parse(input) }, { upsert: true, new: true, runValidators: true }).lean();
}
export async function opportunity(kind, opportunityId) {
  return must(await (kind === 'scholarship' ? Scholarship : Job).findById(id.parse(opportunityId)).lean());
}
export async function track(userId, input) {
  const { kind, opportunityId } = applicationSchema.parse(input); const record = await opportunity(kind, opportunityId);
  return Application.findOneAndUpdate({ userId, opportunityId, kind }, { $setOnInsert: { title: record.name || record.role, organization: record.provider || record.company, applicationUrl: record.applicationUrl, deadline: record.deadline, isDemo: record.isDemo, status: 'Saved' } }, { upsert: true, new: true, runValidators: true }).lean();
}
export async function createReminder(userId, input) {
  const data = reminderSchema.parse(input);
  if (data.opportunityId) await opportunity(data.kind, data.opportunityId);
  return Reminder.create({ ...data, userId });
}
export async function matchFor(userId, jobId) {
  const [profile, job, resume] = await Promise.all([student(userId), opportunity('job', jobId), Resume.findOne({ userId }).sort({ createdAt: -1 }).lean()]);
  return { job, ...jobMatch(profile.skills, profile.projects, job, resume?.text) };
}
export async function deadlines(userId) {
  return Application.find({ userId, deadline: { $gte: new Date() } }).sort({ deadline: 1 }).limit(50).lean();
}
