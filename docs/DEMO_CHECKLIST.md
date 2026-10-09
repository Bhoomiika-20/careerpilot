# Final demonstration checklist

Complete this after configuring your own Atlas database and compatible AI provider. Never claim that a successful frontend build alone verifies RAG or the agent.

## Preparation

- [ ] `npm ci` succeeds on Node.js 22+.
- [ ] Backend environment has a private random JWT secret and working MongoDB URI.
- [ ] Ordinary seed creates 10 fictional scholarships and 20 fictional opportunities.
- [ ] Atlas index `careerpilot_vector` is ready with matching dimensions/filter fields.
- [ ] Seed with `--with-embeddings` completes real embedding calls.
- [ ] Live retrieval test passes and its temporary document is removed.
- [ ] `npm test` and `npm run build` pass locally.

## Student flow

1. Register a new account and sign in.
2. Add degree B.Tech, branch ISE, CGPA 8.2 and optional income. Leave income blank once to see More information required on an income-limited scholarship.
3. Add Node.js, Express, MongoDB and a project you can actually explain.
4. Upload your real text-based resume or the clearly fictional sample DOCX.
5. Open the assistant: “Find scholarships I’m eligible for.”
6. Check that tool activity includes profile/search/eligibility calls, and that fictional records are labeled demo.
7. Ask: “Using the guideline documents, why am I eligible for the Open Source Learners demo scholarship?”
8. Expand a retrieved citation and compare the answer with its excerpt. If nothing is retrieved, expect an explicit evidence limitation.
9. Ask: “Find backend internships suitable for me.” Inspect matching/missing skills and transparent score.
10. Open Skill Gap Analysis and generate a plan for the selected demo role.
11. Save an opportunity; move its application to Preparing; refresh and verify persistence.
12. Ask the assistant to create a future reminder for that scholarship. Inspect exact title/time in the confirmation card.
13. Decline one proposal: verify no reminder was added.
14. Propose another and confirm once. Verify the reminder exists and a repeated approval is rejected.
15. Analyze the resume against a job. Verify every suggested statement before using it.
16. Log out and sign in with another account; verify the first student's private profile/resume/chat/reminders are not visible.

## Expected honest limits

- Demo opportunities are not active applications.
- In-app reminders do not send email/push notifications.
- No OCR for scanned PDFs.
- No provider key → a clear error, never a fake answer.
- No ready Atlas index → a clear retrieval error, never a fake vector result.
- AI can still produce an imperfect answer. Inspect evidence and avoid unsupported claims.
