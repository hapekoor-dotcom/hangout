CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS events (
 id text PRIMARY KEY, source text NOT NULL, source_url text NOT NULL,
 data jsonb NOT NULL, content_hash text NOT NULL, enrichment_version text,
 embedding vector(1536), embedding_model text, ingested_at timestamptz NOT NULL DEFAULT now(),
 enriched_at timestamptz, last_seen_at timestamptz NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS events_embedding_idx ON events USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS events_date_idx ON events ((data->>'date'));
CREATE TABLE IF NOT EXISTS geocodes (
 address_key text PRIMARY KEY, latitude double precision, longitude double precision,
 provider text NOT NULL, checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS search_cache (
 cache_key text PRIMARY KEY, payload jsonb NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id text NOT NULL REFERENCES events(id),
 query text NOT NULL, verdict text NOT NULL CHECK (verdict IN ('good','not_for_me')),
 reason text CHECK (reason IS NULL OR reason IN ('too_far','too_expensive','wrong_vibe','wrong_type','not_what_i_asked')),
 created_at timestamptz NOT NULL DEFAULT now()
);
