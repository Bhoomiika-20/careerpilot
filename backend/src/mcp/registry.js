import { profileTools } from './profile/tools.js';
import { scholarshipTools } from './scholarship/tools.js';
import { jobTools } from './jobs/tools.js';
import { resumeTools } from './resume/tools.js';
import { calendarTools } from './calendar/tools.js';
export const toolRegistry = [...profileTools, ...scholarshipTools, ...jobTools, ...resumeTools, ...calendarTools];
export const findTool = name => toolRegistry.find(t => t.name === name);
