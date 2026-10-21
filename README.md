# hangout

Mobile-first event discovery for Tallinn. React, TypeScript, Vite, Supabase pgvector and server-side OpenAI. Real events come from the official Fienta API. No prototype events.

## Setup

Run `pnpm install`. Apply `db/migrations/002_supabase.sql` in the Supabase SQL Editor, configure OPENAI_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then deploy. See [AI setup](docs/AI-SETUP.md) for verification and ingestion. Secrets are server-only.

`pnpm dev` starts the frontend; `pnpm api` starts the local API using `.env`. `pnpm test` checks the server pipeline with mocked provider HTTP. `pnpm build` builds the frontend. Production builds index and verify the full Fienta catalog before publishing; searches only read stored event vectors. A blocked source is reported, never bypassed.

Tailark source attribution and MIT license: `vendor/tailark`.
