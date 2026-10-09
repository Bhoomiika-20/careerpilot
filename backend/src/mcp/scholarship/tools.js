import { z } from 'zod';
import { Scholarship } from '../../models/index.js';
import { id } from '../../services/schemas.js';
import { student, opportunity, track } from '../../services/data.js';
import { eligibility } from '../../services/rules.js';
export const scholarshipTools = [
  { name: 'search_scholarships', description: 'Search labeled scholarship database records. Demo records are fictional.', schema: z.object({ query: z.string().max(200).default('') }).strict(), run: async (_, { query }) => { const all = await Scholarship.find().limit(100).lean(); return all.filter(s => `${s.name} ${s.description}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20); } },
  { name: 'get_scholarship_details', description: 'Get structured requirements and source metadata.', schema: z.object({ scholarshipId: id }).strict(), run: (_, a) => opportunity('scholarship', a.scholarshipId) },
  { name: 'check_eligibility', description: 'Deterministically check saved student data against scholarship rules. Missing fields remain unknown; income value is not returned.', schema: z.object({ scholarshipId: id }).strict(), run: async (u, a) => { const result = eligibility(await student(u, true), await opportunity('scholarship', a.scholarshipId)); result.checks = result.checks.map(c => c.name === 'Annual family income' ? { name: c.name, result: c.result } : c); return result; } },
  { name: 'get_required_documents', description: 'List required documents from the scholarship record.', schema: z.object({ scholarshipId: id }).strict(), run: async (_, a) => ({ requiredDocuments: (await opportunity('scholarship', a.scholarshipId)).requiredDocuments }) },
  { name: 'get_scholarship_deadline', description: 'Read the deadline and demo/verification metadata. Never assume an unverified date is current.', schema: z.object({ scholarshipId: id }).strict(), run: async (_, a) => { const s = await opportunity('scholarship', a.scholarshipId); return { deadline: s.deadline ?? null, isDemo: s.isDemo, lastVerifiedAt: s.lastVerifiedAt ?? null }; } },
  { name: 'track_scholarship_application', description: 'Propose saving a scholarship in the tracker; confirmation required.', schema: z.object({ scholarshipId: id }).strict(), write: true, run: (u, a) => track(u, { kind: 'scholarship', opportunityId: a.scholarshipId }) }
];
