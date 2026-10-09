import { z } from 'zod';
import { Reminder } from '../../models/index.js';
import { deadlines, createReminder } from '../../services/data.js';
import { reminderSchema } from '../../services/schemas.js';
export const calendarTools = [
  { name: 'list_upcoming_deadlines', description: 'List future deadlines of the student’s tracked applications.', schema: z.object({}).strict(), run: deadlines },
  { name: 'create_reminder', description: 'Propose a future in-app reminder stored in MongoDB. Confirmation required. No email, push or Google Calendar notification is sent.', schema: reminderSchema, write: true, run: createReminder },
  { name: 'list_reminders', description: 'Read the student’s saved in-app reminders.', schema: z.object({}).strict(), run: u => Reminder.find({ userId: u, dismissed: false }).sort({ remindAt: 1 }).limit(50).lean() }
];
