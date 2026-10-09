import { z } from 'zod';
import { student, updateProfile } from '../../services/data.js';
import { profileSchema } from '../../services/schemas.js';
export const profileTools = [
  { name: 'get_student_profile', description: 'Read the authenticated student profile (financial details excluded).', schema: z.object({}).strict(), run: userId => student(userId) },
  { name: 'get_student_skills', description: 'Read the student’s saved technical skills and proficiency.', schema: z.object({}).strict(), run: async userId => (await student(userId)).skills },
  { name: 'get_student_projects', description: 'Read the student’s actual saved projects.', schema: z.object({}).strict(), run: async userId => (await student(userId)).projects },
  { name: 'update_student_profile', description: 'Propose a profile update. Requires explicit user confirmation.', schema: profileSchema.omit({ annualFamilyIncome: true }), write: true, run: updateProfile }
];
