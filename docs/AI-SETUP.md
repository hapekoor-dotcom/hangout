# Vercel + Supabase AI search

## Required manual setup

In Supabase → SQL Editor, run the **entire** `db/migrations/002_supabase.sql` file. It is standalone and also works if 001 was already applied. It enables pgvector, creates dedicated hangout_* tables and RPC functions, enables RLS, and grants table/RPC access only to service_role. Existing public.events, feedback and other tables are left untouched, regardless of their schema. If an earlier attempt failed, run this updated file from the beginning. No browser database permissions are required.

Vercel → Production environment:
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Redeploy after changing environment variables. No DATABASE_URL, frontend keys, or Supabase anon key are required. Never prefix secret variables with VITE_. Defaults: gpt-4.1-mini and text-embedding-3-small (1536 dimensions). Optional server model overrides: OPENAI_TEXT_MODEL and OPENAI_EMBEDDING_MODEL.

## Verify

GET `/api/health`: booleans for environment presence, Supabase connectivity/schema readiness, and a minimal real structured OpenAI request. Provider responses, credentials and raw exception text are never returned or logged. Successful OpenAI checks are cached for five minutes; concurrent checks share a database lease. `migration_required` means run 002; `unavailable` requires checking provider setup. Health returns 503 until ready.

POST `/api/search` with JSON:
```json
{"query":"techno","position":{"latitude":59.437,"longitude":24.7536}}
```

Production builds run `scripts/index-catalog.ts` before Vite: refresh Fienta (six-hour cache), enrich all pending records with a five-worker pool, persist embeddings, and verify every active record has a stored vector for the configured model/version. An incomplete index fails the build; the previous deployment remains available. Unchanged records are skipped, and rerunning resumes pending records. Progress logs contain counts only.

Search requests never fetch Fienta or enrich/index event records. They parse intent, create a query embedding, and search the already indexed catalog. No extra secret or public indexing endpoint is required for build-time indexing. Build-only secrets remain on Vercel.

Intent parsing → factual hard filters → pgvector retrieval within approved IDs → AI reranking → factual revalidation → clean results. Scores/vectors do not reach the client. Beer/coffee/techno have mandatory category gates. Unknown coordinates stay missing; no geocoding needed. Search results cache for five minutes. Durable per-IP rate limit: 20 requests/minute.

## Bulk indexing / refresh

Optional: add a random server-only CRON_SECRET. POST `/api/ingest` with `Authorization: Bearer <CRON_SECRET>` refreshes the source and indexes the next ten pending records. Repeat until updated=0. This route is disabled without CRON_SECRET. No scheduler is installed.

Alternatively run `pnpm index:catalog` from a trusted server with the three required environment variables to index and verify all records. Ingestion/indexing uses database leases and source hashes to avoid duplicate work and stale embeddings.

## Verification limits

Local tests use mocked provider HTTP responses. Production credentials exist only in Vercel, not the coding environment. A live end-to-end search is verified only after the deployed health check succeeds, SQL migration is applied, and real Fienta ingestion succeeds from Vercel. The local Fienta API returned HTTP 403 during implementation; no workaround is attempted.
