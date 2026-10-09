// Run against a seeded local application. This uses real REST APIs, not route mocks.
// QA_EMAIL and QA_PASSWORD must identify your own local test account.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:1100}});
const faults=[];page.on('pageerror',e=>faults.push(e.message));
const base=process.env.QA_URL || 'http://127.0.0.1:5173';
const shots=process.env.QA_SCREENSHOTS || '/tmp/careerpilot-screenshots';await mkdir(shots,{recursive:true});
try {
  await page.goto(base);await page.getByLabel('Email address').fill(process.env.QA_EMAIL || 'demo@example.test');await page.getByLabel('Password',{exact:true}).fill(process.env.QA_PASSWORD || '');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:/Welcome back,/}).waitFor();await page.screenshot({path:shots+'/dashboard-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Scholarships',exact:true}).click();await page.getByRole('heading',{name:'Find your next scholarship'}).waitFor();await page.getByLabel('Search opportunities').fill('Women');await page.getByRole('button',{name:'View eligibility',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByText('Eligibility checks',{exact:true}).isVisible());await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('link',{name:'Profile',exact:true}).click();await page.getByLabel('Location',{exact:true}).fill('Mysuru');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Profile saved'}).waitFor();
  await page.getByRole('link',{name:'Jobs & internships',exact:true}).click();await page.getByLabel('Search opportunities').fill('Backend');await page.getByRole('button',{name:'View match details'}).first().click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByText('Missing skills',{exact:true}).isVisible());await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('link',{name:'Skill gap analysis',exact:true}).click();await page.getByLabel('Choose a target role').selectOption({index:1});await page.getByRole('button',{name:'Analyze skill gap'}).click();await page.getByRole('heading',{name:'Your 30-day preparation plan'}).waitFor();
  await page.getByRole('link',{name:'Applications',exact:true}).click();await page.getByLabel('Application stage').first().selectOption('Preparing');await page.waitForResponse(r=>r.url().includes('/api/applications')&&r.request().method()==='GET');
  await page.getByRole('link',{name:'Deadlines',exact:true}).click();await page.getByRole('button',{name:'Add reminder'}).click();await page.getByLabel('Title',{exact:true}).fill('Browser QA reminder');await page.getByLabel('Remind me at (your local time)').fill('2098-01-01T12:00');await page.getByRole('button',{name:'Save reminder'}).click();await page.getByText('Browser QA reminder',{exact:true}).waitFor();await page.getByRole('button',{name:'Dismiss Browser QA reminder'}).click();
  await page.getByRole('link',{name:'Resume analyzer',exact:true}).click();await page.getByRole('heading',{name:'Make your experience count'}).waitFor();
  await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Dark mode'}).click();assert.ok(await page.locator('html.dark').count());await page.screenshot({path:shots+'/settings-dark.png',fullPage:true});await page.getByRole('button',{name:'Light mode'}).click();
  await page.getByRole('link',{name:'AI assistant',exact:false}).click();await page.getByLabel('Message CareerPilot').fill('Find scholarships I am eligible for.');await page.getByRole('button',{name:'Send message'}).click();await page.getByRole('alert').filter({hasText:'OPENAI_MODEL'}).waitFor({timeout:20000});
  await page.setViewportSize({width:390,height:844});await page.goto(base);await page.getByRole('heading',{name:/Welcome back,/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);await page.screenshot({path:shots+'/dashboard-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('link',{name:'Scholarships',exact:true}).click();await page.getByRole('heading',{name:'Find your next scholarship'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  assert.deepEqual(faults,[]);console.log('PASS: desktop/mobile dashboard, scholarship filters/details, profile save, job match, skill plan, tracker stage, reminder create/dismiss, resume screen, dark mode, real unconfigured-AI error. No page errors.');
} finally {await browser.close();}
