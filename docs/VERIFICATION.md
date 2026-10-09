# Verification report

Verified on 9 October 2026 using Node.js 24.19.0, npm 11.9.0 and a disposable MongoDB 7.0.14 instance. No user Atlas credentials or live AI API key were available.

## Automated backend checks

`npm test`: **25 passed, 0 failed, 0 skipped** on the final backend code.

The suite covers:

- Registration, incorrect password handling, protected routes, logout/session revocation.
- CSRF tokens, cross-origin rejection, invalid and unexpected input fields.
- Profile persistence and isolation between two separate accounts.
- Scholarship unknown/pass/fail results, expired deadlines and incomplete requirements.
- Normalized skill matching, score arithmetic, partial matches and preparation plans.
- Application save idempotency, stage/notes persistence and cross-user write rejection.
- PDF/DOCX extraction, PDF page metadata/page limits, and fake-file rejection.
- Actual official MCP SDK tool discovery, schema validation, dispatch and bound identity.
- Actual stdio MCP child-process calls against real temporary MongoDB.
- Mutation capabilities restricted to exact arguments, expiry and one-time consumption.
- Real reminder persistence after confirmation; cross-user and duplicate approval rejection.
- Conversation isolation and honest service errors when AI settings are absent.
- RAG tenant/model/type prefilters and minimum relevance threshold in the query pipeline.
- Bounded agent control flow, model-selected tools, returned tool context and failure handling.

Agent loop unit tests inject explicit test model responses. They test orchestration behavior, not the quality or availability of an external LLM. In-memory MCP tests use linked SDK transports; database integration tests additionally use the application's real stdio server.

## Frontend checks

`npm run build`: **passed**, generating the production React bundle.

A Playwright browser run against real Express + disposable MongoDB passed these desktop/mobile flows:

- Sign in to the seeded fictional student account.
- Dashboard rendering at desktop and 390px mobile width.
- Scholarship search and eligibility detail dialog.
- Profile save and persisted response.
- Job match dialog and skill-gap preparation plan.
- Application stage change.
- Reminder creation and dismissal.
- Resume screen and light/dark theme switching.
- Assistant request showing an actual unconfigured-AI error.
- No uncaught browser page errors and no horizontal overflow on the tested mobile dashboard/discovery views.

The browser test does not intercept API requests or replace them with fake application data. Its database is seeded with explicitly fictional demo records. Screenshots were visually inspected for desktop dashboard, mobile dashboard and dark settings.

The initial runtime needed TCP-only MongoDB (`--nounixsocket`) and a loopback Vite host. Tests now use those settings. Browser binaries are not part of the downloadable project; install Chromium with `npx playwright install chromium` before `npm run test:ui`.

## Not verified live

These implementations are present, but **their real external-service happy paths remain unverified**:

1. Your Atlas cluster connection and vector-index creation/readiness.
2. Live provider embedding generation and successful Atlas semantic retrieval.
3. Live LLM selection of tools over multiple turns and answer/citation quality.
4. Live structured resume analysis/tailoring output.
5. The complete 20-step AI demonstration in the build brief with your services.

The project includes `backend/tests/live/atlas.test.js` for real ingestion/retrieval and tenant-isolation checks after configuration. Run the manual checklist in `docs/DEMO_CHECKLIST.md` before describing the full RAG/agent demonstration as tested.

## Known boundaries

- Demo records are not current real-world scholarship/job opportunities.
- Reminders are in-app records, not email/push delivery.
- No OCR, real opportunity crawler, admin UI, password recovery or email verification.
- Exact source quote checks reduce resume fabrication risk but do not prove generated paraphrases are factually perfect. Review drafts manually.
- No production penetration test, load test or accessibility certification was performed.
- The code is designed as a readable local portfolio application. Production operation requires infrastructure, monitoring, data-retention policy and additional review.
