const aliases = { 'node.js': 'nodejs', node: 'nodejs', 'express.js': 'express', expressjs: 'express', 'react.js': 'react', reactjs: 'react', 'mongo db': 'mongodb', 'amazon web services': 'aws', 'c++': 'cpp', 'c#': 'csharp', js: 'javascript', 'information science': 'ise', 'computer science': 'cse' };
export function normalize(value = '') { const key = value.trim().toLowerCase(); return aliases[key] || key; }
export function eligibility(profile, scholarship, now = new Date()) {
  const checks = [];
  const add = (name, actual, expected, passes) => checks.push({ name, actual: actual ?? null, expected, result: actual == null || actual === '' ? 'unknown' : passes ? 'pass' : 'fail' });
  if (scholarship.minCgpa != null) add('CGPA', profile.cgpa, scholarship.minCgpa, profile.cgpa >= scholarship.minCgpa);
  if (scholarship.maxIncome != null) add('Annual family income', profile.annualFamilyIncome, scholarship.maxIncome, profile.annualFamilyIncome <= scholarship.maxIncome);
  for (const [field, allowed, label] of [['branch', scholarship.eligibleBranches, 'Branch'], ['degree', scholarship.eligibleDegrees, 'Degree']]) {
    if (allowed?.length) add(label, profile[field], allowed, allowed.map(normalize).includes(normalize(profile[field])));
  }
  if (scholarship.deadline) checks.push({ name: 'Deadline', expected: scholarship.deadline, result: new Date(scholarship.deadline) >= now ? 'pass' : 'fail' });
  if (!scholarship.rulesComplete) checks.push({ name: 'Complete verified requirements', result: 'unknown' });
  const status = checks.some(c => c.result === 'fail') ? 'Not eligible' : checks.some(c => c.result === 'unknown') || !checks.length ? 'More information required' : 'Eligible';
  return { status, checks, isDemo: !!scholarship.isDemo, caveat: scholarship.isDemo ? 'Result applies only to this fictional demo scholarship.' : 'Rule-based screening; the provider makes the final decision.' };
}
export function jobMatch(skills, projects, job, resumeText = '') {
  const levels = new Map(skills.map(s => [normalize(s.name), s.proficiency]));
  const required = [...new Set((job.requiredSkills || []).map(normalize))];
  const preferred = [...new Set((job.preferredSkills || []).map(normalize))].filter(s => !required.includes(s));
  const matched = required.filter(s => levels.has(s));
  const missing = required.filter(s => !levels.has(s));
  const partial = matched.filter(s => levels.get(s) === 'Beginner');
  const preferredMatched = preferred.filter(s => levels.has(s));
  const weight = required.length * 2 + preferred.length;
  const earned = matched.length * 2 + preferredMatched.length;
  const relevantProjects = projects.filter(p => (p.technologies || []).some(t => required.includes(normalize(t)))).map(p => ({ name: p.name, technologies: p.technologies }));
  const resumeEvidence = required.filter(s => resumeText && new RegExp('(^|[^a-z0-9])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i').test(resumeText));
  return { score: weight ? Math.round(earned / weight * 100) : null, matched, missing, partial, preferredMatched, relevantProjects, resumeEvidence, explanation: `${earned}/${weight} skill points. Required skills = 2 points, preferred = 1. Beginner skills are flagged for practice. Projects and resume provide supporting evidence, not extra score.` };
}
export function preparationPlan(match) {
  const topics = [...new Set([...match.missing, ...match.partial])];
  if (!topics.length) topics.push('Interview practice', 'Project explanation', 'Testing', 'Deployment');
  return Array.from({ length: 4 }, (_, index) => ({ week: index + 1, days: index === 3 ? '22–30' : `${index * 7 + 1}–${index * 7 + 7}`, topics: topics.filter((_, i) => i % 4 === index), task: ['Learn fundamentals and write small examples.', 'Build a feature using the topics and document it.', 'Add tests, debug failures and explain trade-offs.', 'Ship a small project, revise your resume and practice interviews.'][index] }));
}
export function profileCompleteness(profile, skills, projects) {
  const fields = ['fullName', 'location', 'degree', 'branch', 'college', 'cgpa', 'graduationYear'];
  return Math.round((fields.filter(f => profile[f] != null && profile[f] !== '').length + Number(skills.length > 0) + Number(projects.length > 0)) / 9 * 100);
}
