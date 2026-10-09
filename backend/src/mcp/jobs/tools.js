import { z } from 'zod';
import { Job } from '../../models/index.js';
import { id } from '../../services/schemas.js';
import { opportunity, matchFor, track } from '../../services/data.js';
export const jobTools = [
  { name: 'search_jobs', description: 'Search the jobs database by role or skill. Demo records are not active vacancies.', schema: z.object({ query: z.string().max(200).default('') }).strict(), run: async (_, { query }) => { const jobs = await Job.find().limit(100).lean(); return jobs.filter(j => `${j.role} ${j.requiredSkills.join(' ')}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20); } },
  { name: 'get_job_details', description: 'Read a job description, skills and provenance.', schema: z.object({ jobId: id }).strict(), run: (_, a) => opportunity('job', a.jobId) },
  { name: 'check_job_match', description: 'Calculate transparent skill coverage and missing skills using the authenticated profile, projects and resume.', schema: z.object({ jobId: id }).strict(), run: (u, a) => matchFor(u, a.jobId) },
  { name: 'track_job_application', description: 'Propose saving a job application; confirmation required.', schema: z.object({ jobId: id }).strict(), write: true, run: (u, a) => track(u, { kind: 'job', opportunityId: a.jobId }) }
];
