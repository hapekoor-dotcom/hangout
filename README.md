# hangout

A mobile-first event discovery MVP for Tallinn. React, TypeScript, Vite, Tailwind CSS and Leaflet. Real event listings come from the public Fienta API at build time; no prototype events are included.

## Run locally

```sh
pnpm install
pnpm dev
pnpm build
```

The production output is `dist/`. Event ingestion is cached for six hours. `FIENTA_REFRESH=1 pnpm build` forces a refresh. If Fienta refuses access, the app uses the last successful real-event cache or shows an honest empty state. It never invents fallback events.

## AI backend: prepared, not connected

Postgres + pgvector, OpenAI structured enrichment, embeddings, intent parsing, hard filters, retrieval, reranking and feedback storage are prepared in `src/server/`. They require server-side credentials and a separately hosted Node API. Current public search uses deterministic rules and is labelled accordingly.

See [connection instructions](docs/AI-SETUP.md). Copy `.env.example` to `.env` only on your server. Never commit real credentials.

## Checks

```sh
pnpm exec tsc --noEmit
node --experimental-strip-types scripts/test-fienta.ts
node --experimental-strip-types scripts/test-discovery.ts
node --experimental-strip-types scripts/test-ai-preparation.ts
```

Node 24+ is recommended for the TypeScript server scripts.

## Attribution

Tailark-derived hero source is retained under its MIT license in `vendor/tailark/`. Fienta event content remains attributable to its event organisers. Temporary illustrative assets are not official event imagery.
