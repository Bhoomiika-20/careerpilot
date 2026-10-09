import { z } from 'zod';
import { id } from '../../services/schemas.js';
import { latestResume, analyzeResume } from '../../services/resume.js';
import { matchFor } from '../../services/data.js';
export const resumeTools = [
  { name: 'get_resume', description: 'Read the authenticated student’s latest uploaded resume.', schema: z.object({}).strict(), run: latestResume },
  { name: 'analyze_resume', description: 'Analyze the real uploaded resume with the LLM; may take time and incur API usage.', schema: z.object({}).strict(), run: u => analyzeResume(u) },
  { name: 'compare_resume_with_job', description: 'Compare actual profile and resume evidence against a saved job.', schema: z.object({ jobId: id }).strict(), run: (u, a) => matchFor(u, a.jobId) },
  { name: 'generate_resume_suggestions', description: 'Generate reviewable wording suggestions based on actual resume evidence and optional job.', schema: z.object({ jobId: id.optional() }).strict(), run: (u, a) => analyzeResume(u, a.jobId) }
];
