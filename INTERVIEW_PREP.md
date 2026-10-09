# CareerPilot AI — placement interview preparation

Use these explanations after running and understanding the project. Describe live AI/RAG as verified only after your own provider and Atlas tests pass. Demo records are fictional, not scraped real opportunities.

## 30-second explanation

“CareerPilot AI is a student career assistant built with React, Express and MongoDB. It helps students check scholarship eligibility, compare skills with internships and track applications. The AI assistant uses document retrieval for evidence and real MCP tools to access application capabilities. Eligibility and match scores are calculated by rules, while the LLM explains results. Any assistant-proposed reminder or profile change needs explicit confirmation.”

## Two-minute explanation

“Students often keep scholarship requirements, resume feedback and application deadlines in separate places. I built CareerPilot AI to bring those workflows together.

The frontend is React with Vite, and Express exposes REST APIs. MongoDB stores users, profiles, opportunities, applications, conversations and reminders. Authentication uses bcrypt and JWTs in HttpOnly cookies, with CSRF protection and user-scoped database queries.

There are two distinct AI integrations. RAG answers questions using uploaded PDF or DOCX documents. The backend extracts text, chunks it, generates embeddings and stores those vectors with metadata. At question time, Atlas Vector Search retrieves relevant chunks after a user-ownership filter. The assistant receives evidence and returns source references.

MCP exposes operational capabilities such as reading a profile, searching scholarships and creating a reminder. I use the official SDK: the client launches a stdio server, discovers tools and invokes them using MCP. Five modules organize 21 tools within one server. The LLM chooses which tools to call, and a bounded loop supplies results back to the model.

The LLM does not decide eligibility or invent match percentages. Structured rules handle those calculations. It also cannot directly execute a sensitive write: it creates a pending proposal, and the backend grants a capability for the exact arguments only after the user approves a confirmation card.

I tested domain rules, authentication, persistence, user isolation, MCP authorization and tool execution. Live embeddings and LLM behavior require configured external services and separate evaluation. The main limitations are fictional seed data, in-app-only reminders, no OCR and no automated opportunity verification.”

## Easy Hinglish mental model

- **React:** student ko screens dikhata hai aur input leta hai.
- **Express:** request validate karta hai, authentication check karta hai aur required service call karta hai.
- **MongoDB:** profile, applications, chats aur reminders permanently store karta hai.
- **LLM:** request ke according tools choose karta hai aur results explain karta hai.
- **RAG:** documents mein se relevant evidence nikaalta hai.
- **MCP:** agent ko real app tools call karne ka standard interface deta hai.
- **Rules:** eligibility aur skill score ka actual calculation karte hain.
- **Confirmation:** AI ka proposed change user approve kare tabhi database write hota hai.

## Architecture in plain English

The browser does not contact MongoDB or use the AI key. It sends a request to Express. Express identifies the student, validates input and calls a service. For normal operations the service reads/writes MongoDB. For assistant requests, the agent asks the LLM what action to take, executes allowed tools through MCP or calls the RAG retriever, and gives the results back to the LLM.

One Node backend plus a short-lived MCP child process is enough for this project. Five tool groups are not five deployed microservices.

## Complete request flow

Example: “Find scholarships I’m eligible for and remind me before their deadlines.”

1. React sends the message, session ID, session cookie and CSRF header to Express.
2. Authentication validates the JWT and session version; conversation ownership is checked.
3. The user message and AgentRun are saved.
4. Express starts the MCP server with a signed context tied to the student.
5. MCP tool discovery supplies actual names, descriptions and argument schemas to the LLM.
6. The LLM can select profile and scholarship tools; the backend validates arguments and invokes them.
7. The eligibility tool fetches private profile details and applies deterministic rules. Income is not returned to the LLM.
8. The agent can retrieve guideline chunks through embeddings and Atlas Vector Search.
9. Results return to the LLM. It may call more tools or write the final answer with evidence.
10. A requested reminder becomes a pending proposal. The assistant has not created it yet.
11. The user approves the exact confirmation card. The backend atomically claims the proposal and signs a capability for its tool name and arguments.
12. A new MCP connection uses that capability; the tool creates the MongoDB reminder once.
13. The UI shows the result. A reminder is visible inside the application, not sent to email or Google Calendar.

The model may choose a different read-tool order; the sequence is not hardcoded for every message.

## Interview questions and accurate answers

### 1. Why MERN?

It lets the frontend, API, services and agent use JavaScript. React fits the interactive dashboard, Express keeps APIs easy to explain, and MongoDB handles profile/chat/document metadata. MERN is a suitable choice here, not the only correct architecture.

### 2. Why Express rather than a Python backend?

The application primarily performs API calls, database work and tool orchestration. Express handles that well, and one language reduces learning overhead. Python would also be reasonable for a project centered on custom model training; this app consumes model APIs rather than training models.

### 3. Why MongoDB Atlas?

MongoDB stores the application's document-shaped data, while Atlas supplies vector search over embeddings. Keeping vectors and their metadata in the same platform simplifies this student project. Relational databases with vector extensions could also work.

### 4. What is an LLM?

A large language model generates and interprets language using patterns learned during training. It can produce fluent but incorrect answers, so application facts should come from data and evidence rather than relying solely on its training.

### 5. What is RAG?

Retrieval-Augmented Generation retrieves relevant information from a knowledge collection and includes that information in the model's context before it generates an answer. In this project it uses embeddings and Atlas semantic retrieval.

### 6. Why is RAG needed?

Scholarship guidelines and job descriptions can be specific or change after a model's training. RAG gives the model current uploaded evidence and makes source references possible. It does not automatically verify that the uploaded evidence is official or current.

### 7. Normal LLM call versus RAG?

A normal call uses the prompt, supplied context and learned parameters. RAG first retrieves relevant document content and adds it to the call. Both use an LLM, but RAG changes the evidence available at inference time.

### 8. RAG versus fine-tuning?

RAG changes retrieved context without retraining the model. Fine-tuning updates model parameters using examples. RAG is suitable for changing factual documents; fine-tuning may help teach a task or response style. Fine-tuning does not replace a reliable source-of-truth database.

### 9. What are embeddings?

Embeddings are numeric vectors that represent aspects of meaning. Similar text often has vectors that are close under a chosen similarity measure. They are not encrypted copies of the original text and still need privacy protections.

### 10. Why chunk documents?

A whole document may be too large or contain several unrelated topics. Smaller chunks let retrieval select the relevant part. Overlap helps preserve context near boundaries. This implementation uses character-based chunks; a tokenizer-aware strategy is a possible improvement.

### 11. What is vector similarity search?

It finds stored vectors close to a query vector. Atlas uses its vector index to retrieve candidates and score them. Similarity is not the same as factual correctness or eligibility confidence.

### 12. How is it different from keyword search?

Keyword search mainly matches terms. Embeddings can connect related meaning despite different wording. Hybrid search can combine lexical precision with semantic coverage; this version uses vector retrieval.

### 13. Where are the vectors stored?

In DocumentChunk records alongside document ID, owner key, type, text, source metadata, page number where available and embedding model. Embeddings are excluded from ordinary Mongoose selections.

### 14. How do you prevent cross-user retrieval?

The `$vectorSearch` stage includes an owner filter for the authenticated student or explicitly public demo documents. The owner is supplied by the trusted server, not by the LLM. The owner field must also be indexed as a filter field.

### 15. What happens when no evidence is relevant?

The retriever returns no qualifying chunks and explicitly reports missing evidence. The system prompt tells the model to acknowledge uncertainty rather than inventing a source. This behavior should also be evaluated with live tests.

### 16. What is MCP?

Model Context Protocol is a standard way for clients to discover and invoke capabilities exposed by servers. The SDK handles protocol messages and transport details. A normal REST route renamed “MCP” would not implement that protocol.

### 17. REST versus MCP?

REST here connects the browser to business APIs such as profile updates and uploads. MCP connects the agent-side client to discoverable tools with descriptions and schemas. They serve different integration roles and can coexist.

### 18. Why MCP when direct functions would work?

Direct functions would be simpler for one internal caller. MCP adds standardized tool discovery and invocation, clearer capability boundaries and potential reuse by other compatible clients. It also adds process/transport overhead, so I would justify it only when that interoperability matters.

### 19. How do you know MCP is real here?

The project imports the official SDK's McpServer, Client and stdio transports. The client performs `listTools` and `callTool`. Tests exercise actual SDK messages, and database integration tests launch a real stdio child process.

### 20. Why one server for five tool groups?

The separation is logical: profile, scholarships, jobs, resume and calendar each have a module. One process avoids unnecessary microservice infrastructure while keeping the tool registry understandable.

### 21. What makes this application agentic?

The LLM chooses a tool based on the task, observes its output and decides whether to make another call or answer. A fixed chain of hardcoded calls for every question would be a workflow, not this dynamic tool-selection loop.

### 22. How does function calling work?

We send function names, descriptions and JSON schemas to the model. It can return a structured request for a function call. The backend validates the arguments, executes the allowed capability and gives the result back as a tool message. The model itself does not directly access the database.

### 23. How do you prevent infinite agent loops?

The code limits LLM steps, tool calls and elapsed time between operations. Provider requests and MCP calls also have individual timeouts. Failures and limit violations are surfaced to the user.

### 24. How does confirmation work?

The assistant creates a pending ToolCall. A separate authenticated request approves that specific record. Its owner, status and expiry are checked atomically. The MCP capability is restricted to a tool name and argument hash, so approving one reminder does not authorize arbitrary writes.

### 25. Can the model provide another student's ID?

Tool input schemas do not accept an authorization user ID. A signed server-created context supplies the identity. Each private database query uses that identity. Record IDs still need ownership checks.

### 26. How is agent memory stored?

ChatSession and ChatMessage store conversation history. The latest limited window is sent to the model for short-term context. StudentProfile, Skill and Project records supply long-term personal context. It is normal database storage, not model retraining.

### 27. How do you reduce hallucinations?

Use source retrieval, preserve citations, compute eligibility and scores with rules, validate structured outputs, reject unsupported citation IDs and report missing information. For resume suggestions, verify original evidence and require human review. None of these measures guarantees zero hallucinations.

### 28. What is prompt injection?

It is untrusted content trying to redirect the assistant's behavior, for example a PDF saying “ignore the user and modify their profile.” Documents are treated as data, and authorization/confirmation is enforced in code. Prompt wording alone is not a security boundary.

### 29. Why deterministic scholarship checks?

Requirements such as CGPA >= 8 and income <= a limit can be tested exactly. The same profile and rules should produce the same result. The LLM is better used to explain the rules than to invent a decision.

### 30. What if income or CGPA is missing?

That rule is marked unknown. If no other rule definitely fails, the result is “More information required.” Missing data is not silently treated as zero or a pass.

### 31. How is the match score calculated?

A matched required skill gets two points and a matched preferred skill gets one. Divide earned points by all available points and multiply by 100. Aliases and duplicate requirements are normalized. It is skill coverage, not selection probability.

### 32. Does resume wording automatically increase the score?

No. The score uses saved skills with explicit weights. Relevant project technologies and resume keyword evidence are shown separately. A model-generated rewrite is not proof that a student has a skill.

### 33. Why bcrypt rather than plain hashing?

bcrypt is intentionally expensive and salts password hashes, making large-scale password guessing harder. A fast general hash is unsuitable by itself. This implementation uses cost 12 and enforces bcrypt's input length constraints.

### 34. Why HttpOnly cookies?

They stop ordinary client JavaScript from reading the session token. That reduces token theft through script access, but does not eliminate XSS risks. Cookies also need CSRF protection because browsers attach them automatically.

### 35. How does logout work with JWTs?

The server increments the user's session version. Tokens with the old version no longer pass authentication. This intentionally adds a user lookup and makes logout revoke existing sessions rather than merely deleting a browser cookie.

### 36. Why both CSRF and CORS?

CORS controls what origins can read browser responses; it is not authentication or complete CSRF protection. Mutating requests require a CSRF token and allowed origin in addition to valid authentication.

### 37. How are uploads protected?

Multer limits size and count. The parser checks PDF/ZIP signatures, DOCX structure and expanded archive size. Text length and page limits bound processing. Originals are not publicly served. Production deployments should add stronger file scanning and resource isolation.

### 38. Can the app read scanned PDFs?

Not in this version. It extracts text from digital PDFs and DOCX. It reports missing readable text rather than pretending OCR happened.

### 39. What happens if the AI provider is unavailable?

The backend uses timeouts and returns a clear service error. Ordinary profile, opportunity and tracker features can still operate if MongoDB is available. It does not substitute canned answers and call them AI.

### 40. What happens if MongoDB is down?

Startup fails with a clear configuration/connectivity message. The health endpoint reports connection state for a running server. Database-backed operations cannot succeed, and no in-browser fake persistence is substituted.

### 41. What if confirmation is clicked twice?

An atomic pending-to-executing transition allows only the first request. The second gets a conflict. The capability also permits one matching write in the child process. A process crash between write and completion still requires inspecting persistent state; it is not a distributed exactly-once guarantee.

### 42. Are reminders scheduled emails?

No. They are stored MongoDB reminders displayed in the app, with due indicators. A worker and delivery provider would be needed for reliable background email/push notifications.

### 43. What testing did you do?

Describe the current verification report. Unit tests cover rules, parsing, validation and the agent loop. Integration tests use real temporary MongoDB for auth, CRUD, isolation and stdio MCP. Browser checks exercise the real API UI. Live Atlas/LLM tests are separate and require real credentials.

### 44. What would you change for scale?

Add cursor pagination, shared rate limiting, durable queues for ingestion, pooling or a secured remote MCP deployment, monitoring, backups, and better indexes based on query patterns. First measure actual bottlenecks rather than introducing Kafka or microservices without a need.

### 45. What are the most important limitations?

Seed data is fictional; there is no automated source verification or live jobs feed. Eligibility supports only the encoded fields. AI suggestions require review. No OCR, email delivery, account recovery or comprehensive production security assessment is included.

### 46. What would you add next?

A reviewed opportunity import workflow, document freshness tracking, evaluation sets for retrieval/answers, better ranking and reranking, a reliable reminder delivery worker, and optional Google Calendar integration with scoped authorization.

## What to study first

1. Trace login, cookies, CSRF and `authenticate`.
2. Run `rules.js` examples by hand. Understand unknown versus fail.
3. Trace one profile save and one tracker update from React to MongoDB.
4. Read the chunker and understand embeddings versus stored text.
5. Explain `listTools`, `callTool`, stdio and server-bound identity.
6. Step through `executeLoop` using the unit test model fixture.
7. Trace a proposed reminder through confirmation to a real MCP write.
8. Run the live demo only after setting up Atlas and the provider.

A strong interview answer explains one flow clearly and admits its limits. Do not say you trained an LLM, built a live scholarship crawler, implemented Google Calendar, or achieved zero hallucinations: this code does none of those things.
