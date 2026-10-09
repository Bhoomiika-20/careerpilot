# CareerPilot AI — beginner-friendly code walkthrough

Read this beside your editor. The easiest starting point is a normal profile request, then the assistant.

## Folder map

| Path | What it does |
|---|---|
| `frontend/src/main.jsx` | Mounts React and restores the display theme |
| `frontend/src/App.jsx` | Declares public login and protected workspace routes |
| `frontend/src/context/Auth.jsx` | Checks the session and holds the current user |
| `frontend/src/layouts/Shell.jsx` | Shared sidebar, top bar and navigation |
| `frontend/src/components/UI.jsx` | Shared fields, dialogs, loading/errors and data-fetch hooks |
| `frontend/src/pages/` | Dashboard, discovery, profile, chat, tracker, resume, skills, reminders and settings views |
| `frontend/src/services/api.js` | Axios, CSRF handling, date formatting and chat event parsing |
| `backend/src/server.js` | Connects MongoDB, starts HTTP server and handles shutdown |
| `backend/src/app.js` | Express middleware, API registration, static frontend and errors |
| `backend/src/config/` | Validated environment and Mongoose connection |
| `backend/src/middleware/security.js` | JWT sessions, authentication and CSRF |
| `backend/src/routes/api.js` | REST controllers grouped in one readable router |
| `backend/src/models/index.js` | All 16 Mongoose models and important indexes |
| `backend/src/services/` | Validation schemas, domain operations, matching rules and AI adapter |
| `backend/src/rag/` | File parsing, chunking, embeddings, ingestion and semantic retrieval |
| `backend/src/mcp/` | Five tool modules, server factory, stdio server, client and capabilities |
| `backend/src/agents/` | System instructions, tool mapping and bounded agent loop |
| `backend/scripts/` | Seed data, vector index setup and sample documents |
| `backend/tests/` | Core and database integration tests; live retrieval test is in `live/` |
| `tests/ui/` | Real-backend browser smoke test |
| `demo-documents/` | Fictional guidelines/job text produced by the seed plus uploadable samples |
| `docs/` | API/setup companion material, vector index and demo/verification checklist |

The project deliberately avoids unnecessary controllers that only forward one line to another function. REST controller functions live in `routes/api.js`, while reusable business operations live in `services/`. MCP uses those same operations. Empty placeholder directories are not required to understand the app.

## 1. Frontend entry and authentication

The browser loads `frontend/index.html`, which imports `main.jsx`. React mounts `App` into `#root`. `AuthProvider` requests `/api/auth/me` once to learn whether a valid server session exists. The protected route shows the workspace if a user is present, otherwise it redirects to login.

The login form calls Axios. Before a mutation, the API wrapper obtains `/auth/csrf` and adds its token to the `X-CSRF-Token` header. `withCredentials:true` permits cookie authentication. The user object goes into React context; the actual JWT never goes into localStorage.

The only browser persistence intentionally used is the light/dark display preference.

## 2. Backend entry and middleware

`server.js` imports the configured Express app and connects Mongoose before listening. Invalid required settings fail early. Secrets are read from `backend/.env` or the deployment environment.

`app.js` applies security headers, exact-origin CORS, JSON parsing and cookie parsing. The API has global rate limiting and CSRF checks. Auth endpoints are registered first; the router then applies `authenticate` to all private routes. AI endpoints receive a more restrictive user-based limit. Unhandled internal exceptions become generic responses, while known application errors return safe messages.

Production builds can be served by Express. Development uses Vite's `/api` proxy. This keeps normal browser calls same-origin.

## 3. Registration and login

Registration validates a name, email and password, normalizes email, hashes the password, creates a User and initial StudentProfile, and sets the session cookie. Duplicate email is an HTTP 409 response.

Login fetches the hidden passwordHash field explicitly and compares using bcrypt. `setSession` signs a JWT containing a subject/user ID, session version, issuer, audience and expiry.

On private routes, `authenticate` verifies the token and reads the user. It compares the stored session version to the token's version. Logout increments the version and clears the browser cookie, so previously copied tokens do not remain usable.

## 4. One profile update, end to end

1. `Profile.jsx` collects academic fields and preferences.
2. It converts numeric inputs to numbers or null and comma-separated lists to arrays.
3. Axios sends `PUT /api/profile` with cookies and CSRF header.
4. Express authenticates the current user and validates the schema.
5. `updateProfile` updates only a profile matching that user's ID.
6. MongoDB persists the fields and returns the new document.
7. The UI refreshes its query and shows the saved state.

Skills and projects are separate collections. Every update/delete combines the record ID with `userId`, preventing a student from editing someone else's record by guessing its ID.

## 5. Database models

| Model | Responsibility | Ownership or important index |
|---|---|---|
| User | Email, display name, password hash, session version | Unique email |
| StudentProfile | Academic/personal details and preferences | Unique userId |
| Skill | Skill, normalized alias and proficiency | Unique userId + normalizedName |
| Project | Student project description, technologies and URLs | Indexed userId |
| Scholarship | Structured rules and source/demo metadata | Shared read-only discovery collection |
| Job | Role, description, required/preferred skills and provenance | Shared read-only discovery collection |
| Application | Opportunity snapshot, stage and notes | Unique userId + kind + opportunityId |
| Document | Ingestion status, source/title, owner and chunk count | Indexed ownerKey |
| DocumentChunk | Text, embedding and citation metadata | Unique documentId + chunkIndex; Atlas vector/filter index |
| Resume | Extracted text, structured extraction and analysis | Indexed userId |
| ChatSession | Conversation title and temporary processing lock | Indexed userId |
| ChatMessage | User/assistant text, citations and activities | userId + sessionId + createdAt |
| AgentRun | Run status, activities and safe error | Indexed userId |
| ToolCall | Arguments, pending/execution state and result | Indexed userId; expiry checked in queries |
| Reminder | Title, time, note and dismissal | userId + remindAt |

All models include timestamps. Most fields use concrete types; flexible AI structures use validated service-layer schemas before they are saved. `ownerKey` is a string so private ObjectId strings and the explicit `public` demo namespace can share the same vector filter field.

## 6. Scholarship rules

`services/rules.js → eligibility` compares supported profile fields with a scholarship's encoded conditions. Every condition produces pass/fail/unknown evidence.

A known failure means Not eligible. Otherwise missing information or incomplete rules means More information required. A complete set of passing checks means Eligible under those encoded rules. Demo labels remain attached to the result.

The HTTP response for the student's own account may show their details; the MCP eligibility response redacts the actual income amount. The LLM therefore gets the decision evidence without requiring that private numeric value.

## 7. Job matching and learning plans

`normalize` maps common aliases such as Node.js and Node. `jobMatch` removes duplicate requirements, finds matched/missing skills, marks beginner-level matches, and calculates transparent weighted skill coverage. Project technologies and resume keyword evidence are supplementary, not arbitrary bonus points.

`preparationPlan` distributes missing/beginner topics into four weeks and assigns study, build, test and deployment/interview tasks. This plan does not need an AI key. The assistant can separately produce a more detailed plan using actual tool results, but the deterministic UI plan is not mislabeled as LLM output.

## 8. Resume parsing and analysis

`POST /resume/upload` accepts one PDF/DOCX. Multer puts the bytes in memory. `extractDocument` checks signatures, size, archive structure and extracted text. PDF processing records page numbers where available; DOCX uses null page numbers. Extracted text is saved privately in Resume; the original bytes are discarded.

`analyzeResume` makes real provider calls: one for structured extraction, one for analysis and wording suggestions. Zod validates the returned JSON. Extracted claims, original bullets and evidence must be exact substrings of the uploaded text. Rewrites are displayed as reviewable drafts and are never automatically added to skills or experience.

The parser cannot read text from a scanned image, and the exact-evidence check does not eliminate all risks in a generated paraphrase. That is why manual verification is part of the UI.

## 9. RAG functions

- `cleanText`: reduces whitespace noise without turning source text into instructions.
- `chunkText`: splits text into bounded pieces with overlapping boundaries.
- `embed`: requests actual provider embeddings and validates batch size, numeric vectors and dimensions.
- `ingest`: creates a processing Document, embeds chunks in batches, saves metadata and changes the document to ready. On failure it removes partial chunks and records failed status.
- `vectorPipeline`: constructs `$vectorSearch` with user/public ownership and model/type filters, then applies a relevance cutoff and excludes raw vectors from output.
- `vectorSearch`: executes that aggregation with a query timeout and reports Atlas configuration failures clearly.
- `retrieve`: embeds the question and maps returned chunks into citation-bearing excerpts for the agent.

Citation IDs come from stored chunks. The agent response handler removes citation markers whose IDs did not appear in retrieval results. The UI labels the list “retrieved sources” and shows excerpts, filename and page where available.

## 10. MCP definitions and invocation

Each group file exports an array of definitions: name, human-readable description, Zod schema, optional `write:true`, and a domain function. `registry.js` combines them.

`createServer.js` registers those tools with `McpServer.registerTool`. The input schema advertised by discovery comes from the Zod shape. The original schema is parsed again during invocation to apply refinements. Handlers return structured results and protocol text content; errors return `isError` instead of a stack trace.

`server.js` verifies the signed context, connects MongoDB and attaches `StdioServerTransport`. Standard output is protocol-only.

`client/index.js` launches the server using Node and `StdioClientTransport`. It passes configuration and signed identity through child-process environment values, not a public API argument. It returns a client, invocation helper and close function. Every agent run closes its client in a finally block.

The server is only an internal stdio child. It is not an unauthenticated public remote MCP endpoint.

## 11. Agent execution loop

`runAgent` creates an AgentRun, opens MCP, discovers tools and builds an LLM tool list. `retrieve_knowledge` is a separate RAG function alongside the discovered MCP capabilities.

`executeLoop` repeats:

1. Ask the LLM using the current messages and allowed schemas.
2. If the response has no tool calls, return its text.
3. Otherwise validate and execute each requested capability.
4. Add structured results as role=`tool` messages with the matching tool call ID.
5. Let the model decide its next step.

The loop enforces step/call limits and elapsed-time checks. Errors become tool results or a clear failed run. Only visible actions and outcomes are streamed—there is no private chain-of-thought logging.

Read tools execute through the MCP client. Write tools create pending proposals and return a pending marker; they do not execute in that loop.

## 12. Confirmation and mutation flow

The confirmation REST endpoint requires the current student and an unexpired pending ToolCall. A single atomic update changes pending to executing, so two clicks cannot both claim it.

The server validates its saved arguments and signs a new capability containing the tool name and a canonical argument hash. The MCP server compares the requested arguments to that exact hash and allows one write. The result is persisted and a confirmation message appears in the chat.

A user clicking a form's own Save button is already directly requesting that specific write. The extra proposal workflow is for assistant-generated changes, not every ordinary UI edit.

## 13. Tracker, reminders and dashboard

Application creation looks up the real stored opportunity and snapshots its title, organization, URL, deadline and demo flag. It does not accept arbitrary browser-supplied titles pretending to be a verified job. A unique compound index makes repeated saves idempotent.

The Kanban supports drag/drop and accessible select menus for stage updates. Notes and deletion use owned application endpoints.

Reminders store future timestamps. The Deadlines page displays them and marks due records. There is no hidden promise of background notification delivery.

The dashboard queries actual profile/opportunity/application/reminder/run data, computes completeness and shows counts/matches. It does not show fabricated activity or hardcoded success metrics.

## 14. Debugging a demonstration

- Login problem: inspect Network response, then session cookie, CSRF header and exact CLIENT_URL.
- No scholarship match: inspect structured profile and each eligibility check before blaming the model.
- No job match: compare normalized required skill names and the score formula.
- No document answer: verify ingestion status, embedding dimensions, index readiness and relevance.
- Tool error: inspect safe ToolCall/AgentRun status, then MCP startup/database connectivity.
- Reminder pending: inspect confirmation expiry and whether it was approved; a model statement alone is not proof of creation.

Do not copy credentials into screenshots or logs. A useful interview demonstration includes one honest error case, such as missing income or missing evidence, as well as the happy path.
