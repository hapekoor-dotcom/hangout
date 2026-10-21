# Connecting AI search

Status: prepared for connection. The public static site currently contains **real Fienta records only** and explicitly uses the existing rules engine. AI summaries, embeddings, AI intent parsing, reranking, Postgres feedback and geocoding are **not activated** without server credentials. No paid provider calls were made during preparation.

## Runtime

Use Node 24+, one Postgres database with pgvector, one OpenAI account and optionally OpenCage. The existing Sites deployment remains a static frontend; host the Node API on a server/container and proxy `/api` to it, or supply its HTTPS origin in `VITE_API_URL`. A Postgres/Node backend is not automatically hosted by the static deployment. No browser secrets.

1. Copy `.env.example` to `.env` on the server, set `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_EMBEDDING_MODEL` and `APP_ORIGIN`. Keep `.env` out of Git. Model examples are configurable; the embedding schema expects 1536 dimensions.
2. `pnpm install` then `pnpm db:migrate` (requires permission to enable pgvector).
3. `pnpm ingest:ai`. This explicitly performs paid enrichment/embedding calls once per new or changed event, with a source/model/version hash. It also geocodes unique addresses if an OpenCage key is configured. Run it manually first and inspect updated/failed counts.
4. Start `pnpm api`. By default it listens on loopback port 8787. The local Vite dev server proxies `/api`. For a container set `API_HOST=0.0.0.0`, terminate TLS at the host and restrict DB network access. `APP_ORIGIN` must match the actual frontend origin.
5. Only when `/api/health` returns `configured:true`, build the frontend with `VITE_AI_SEARCH=1` and either same-origin `/api` proxying or `VITE_API_URL=https://your-api-host`. Republish the frontend. Model failures return an honest unavailable state, never unrelated recommendations.
6. Configure **one** scheduled job on the API host to run `pnpm ingest:ai` every six hours. No live scheduler was installed in this preparation. The database advisory lock prevents overlapping ingestion. Fienta failures preserve existing records and stop; no anti-bot bypass or retry loop.

## Data flow

Official Fienta API → conservative normalization → source hash → cached OpenAI structured enrichment → cached geocoding → embedding → Postgres JSONB + pgvector. Search: structured AI intent → factual hard filters → vector candidates (max 25) → structured reranking → deterministic revalidation → minimum relevance 0.75 (max 10). Similarity scores never reach the UI. Explicit budgets, dates, child restrictions, negatives, bounds and distance are enforced in code. The reranker cannot add candidate IDs or reinstate rejected events.

Source metadata remains authoritative. Unknowns stay missing. AI-generated atmosphere fields are separate from source descriptions. The current public site labels no text as AI unless `aiSummary` genuinely comes from enrichment.

## Event details and feedback

The source HTML is retained as `rawDescription` and sanitized on rendering with DOMPurify. Only paragraphs, headings, lists, emphasis, links and line breaks are allowed; source styles, scripts and arbitrary markup are removed. Links are restricted to safe protocols and open with noopener/noreferrer. Plain source text is escaped. The full source description and AI summary render separately.

Feedback controls appear only with the connected API. They insert into Postgres `feedback`, including event ID, query, good/not-for-me and optional reason. No fake local-only confirmation. No profiles or personalization are built.

## Geocoding

OpenCage is optional and server-only. Unique normalized addresses are hashed and cached in Postgres. Missing/low-confidence results stay unlocated. Requests run serially with at least 1.1 seconds between calls; configure your subscription accordingly. Map attribution remains OpenStreetMap. Public Nominatim is not used for scheduled bulk geocoding.

## Verification performed

TypeScript, production static build, Fienta parser tests, real-only dataset checks, strict schemas, hard filters, candidate ID allowlist, duplicate/weak rerank rejection and API health/503 smoke tests without credentials. Live OpenAI calls, pgvector migration/query execution, real geocoding and durable feedback inserts require configured services and remain untested. Do not treat preparation as a live AI deployment.

References:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/embeddings
- https://fienta.com/help/organisers/for-developers
- https://opencagedata.com/api
