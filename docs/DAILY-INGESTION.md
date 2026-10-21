# Daily ingestion on Vercel Hobby

## Schedule and activation

`vercel.json` schedules GET `/api/cron` once daily at **01:15 UTC** (option A). With Europe/Tallinn this is **03:15 in winter and 04:15 in summer**. Hobby does not support hourly schedules and invocation may be delayed within the hour; exact 03:15 local time cannot be guaranteed on this plan. No DST conversion is silently assumed. Reference: https://vercel.com/docs/cron-jobs/usage-and-pricing

Set **CRON_SECRET** as a random value of at least 32 characters in Vercel Production, then redeploy. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically for cron requests. Missing or incorrect credentials return 401 before any ingestion/provider call. No keys or full error bodies are logged. The frontend never receives the secret.

In Vercel → project → Settings → Cron Jobs, use **Run** to test the authenticated scheduled route. A completed daily run is deduplicated by the current Europe/Tallinn calendar date. POST `/api/ingest` with the same Authorization header provides a protected manual run, bypassing the daily-completed guard. It has no public UI button. For local testing with a trusted `.env`, use `pnpm ingest:ai`. Never paste credentials into a URL.

## Data and retries

One `catalog_ingestion` lease in `hangout_ingestion_jobs` covers the entire refresh and indexing operation. It lasts 300 seconds; work stops accepting new event processing well before that deadline so in-flight provider calls can finish. Another cron, build, or manual job returns `already_running`. The lease is removed only by its owner and expires after a crashed process.

The Fienta adapter requests the documented maximum 1000 records per page, follows all pages sequentially (up to a safety ceiling that throws rather than returning a partial snapshot), and spaces page requests by one second. HTTP 403/429 stops the run without retries or bypass. Reference: https://fienta.com/openapi.yaml

Fienta → conservative normalization → match by source + source ID or URL → content hash. Existing future events that disappear are retained; no missing-source purge. Source failure/empty response returns `source_unavailable`, leaves events intact, and does not complete today's job. This permits manual retries. The previous published records remain searchable during updates.

- **New:** raw normalized row is saved immediately. AI enrichment and embedding are generated; the searchable version is published once both succeed.
- **Changed:** latest normalized source is checkpointed; the last published data/vector stays intact. Enrichment is regenerated only when title, plain description, venue, age or enrichment version changed. Image, price, date, times and coordinate-only edits reuse existing enrichment. Embeddings regenerate only when searchable/enriched text or embedding model changes.
- **Unchanged:** only last_seen_at is touched (an inactive future event is explicitly reactivated when seen again); no OpenAI call.
- **Enrichment failure:** normalized source remains in a retryable checkpoint; other records continue.
- **Embedding failure:** successful enrichment is checkpointed, so retry does not pay for that enrichment again. Existing data/vector remains available.
- **Past events:** marked inactive based on Tallinn local date/end time; rows are retained. Missing future events remain active until factual expiry.

Checkpoints and run summaries reuse `hangout_search_cache` under dedicated `ingest:*` keys with a long retention date. They contain public source event data and generated enrichment, never credentials. This adds no queue or schema migration. Completed checkpoints are deleted; failed ones remain retryable. A run with remaining work/failures returns `partial`, and the next scheduled/manual run resumes. No automatic immediate retry loop.

Published changes update `catalog_revision`; search cache keys include that revision, making changes visible immediately. Cached results are also rechecked against time filters, so past events do not reappear from cache. Searches do not fetch Fienta, enrich records or regenerate event embeddings.

## Logs / health

Safe structured logs include fetched, new, changed, unchanged, enriched, embeddings, published, inactive, failures and pending. Per-event failures log only event ID and phase, without provider response bodies. `/api/health` reports `cronConfigured`, the last safe ingestion summary, and catalog counts. It never returns the secret.

## Verification

`pnpm test`: source deduplication, no OpenAI for unchanged/metadata-only changes, new/changed content indexing, embedding retry without duplicate enrichment, source failure preservation, event expiry, missing future events retained, global overlap protection, daily deduplication, cron/manual authentication, DST offsets, and search reading previously published data during a failed replacement. `pnpm build` also runs the same incremental engine against the configured production services before building the UI; unchanged builds make no event enrichment/embedding calls.

## Stable hashes and recurring search results

Source hashes use canonical JSON with recursively sorted object keys. Property order does not make an event changed. Existing legacy hashes remain compatible, so this rollout does not re-enrich previously indexed records.

Search groups exact normalized titles after time/hard filters and before vector retrieval and reranking. Normalization applies Unicode compatibility normalization, lowercase, whitespace and harmless punctuation cleanup; meaningful symbols and edition numbers remain distinct. Only the nearest eligible occurrence is shown by default. Every instance remains in the database.

Explicit date/occurrence requests (for example next week, every Friday, dates for this event, all upcoming occurrences) keep individual dates. Next-week and every-weekday constraints are applied before retrieval. Later dates on detail pages are not implemented.

Verification includes 500 existing records plus 20 new and 5 changed: 25 enrichment calls and 25 embeddings; a second run with reordered source properties makes zero additional calls. Legacy-hash compatibility, exact-title grouping, nearest-date selection and explicit recurrence requests are covered by tests.
