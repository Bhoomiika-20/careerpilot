# CareerPilot AI — run it locally

## 1. Install

Install Node.js 22+ first. Open a terminal in the extracted `careerpilot-ai` folder:

```bash
npm ci
```

## 2. Configure

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

macOS/Linux:

```bash
cp backend/.env.example backend/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Edit `backend/.env`:

- `MONGODB_URI`: your Atlas connection string with database name `careerpilot`.
- `JWT_SECRET`: the random output generated above.
- `SEED_PASSWORD`: your own demo password, at least 10 characters.
- `OPENAI_API_KEY`: your provider key.
- `OPENAI_MODEL`: a model available to you with function calling and JSON output.
- Confirm `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` match your provider.

AI credentials are not needed for ordinary profile/tracker features. Atlas Vector Search and embeddings are needed for RAG. Never put server keys in `frontend/.env`.

## 3. Prepare data and retrieval

```bash
npm run seed
npm run index:vector
```

Wait for `careerpilot_vector` to become ready in Atlas, then:

```bash
npm run seed -w backend -- --with-embeddings
```

This step calls your embeddings provider. All seeded scholarships/jobs/documents are fictional demo data.

## 4. Run

```bash
npm run dev
```

Open http://localhost:5173. Use `demo@example.test` and your `SEED_PASSWORD`, or register your own account.

The backend runs on port 5000. MCP starts automatically when needed. Reminders appear inside the app only.

## 5. Check

```bash
npm run test:unit
npm run test:integration
npm run build
```

Full live demonstration still needs your configured Atlas/AI services. See `docs/VERIFICATION.md` for what was actually checked during creation and `docs/DEMO_CHECKLIST.md` for your final demo.

## Production build

```bash
npm run build
npm start
```

Use a Node host that supports child processes, HTTPS, production environment variables and Atlas connectivity. Set `CLIENT_URL` to the exact HTTPS origin and `NODE_ENV=production`. Do not deploy only the frontend and expect MCP/database operations to work.
