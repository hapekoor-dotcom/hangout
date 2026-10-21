-- Run this ENTIRE file in Supabase SQL Editor. Safe to rerun.
-- Uses dedicated hangout_* tables. Existing public.events and other tables are untouched.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
CREATE TABLE IF NOT EXISTS public.hangout_events (
 id text PRIMARY KEY, source text NOT NULL, source_url text NOT NULL,
 data jsonb NOT NULL, content_hash text NOT NULL, enrichment_version text,
 embedding vector(1536), embedding_model text, ingested_at timestamptz NOT NULL DEFAULT now(),
 enriched_at timestamptz, last_seen_at timestamptz NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS hangout_events_embedding_idx ON public.hangout_events USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS hangout_events_date_idx ON public.hangout_events ((data->>'date'));
CREATE TABLE IF NOT EXISTS public.hangout_search_cache(cache_key text PRIMARY KEY,payload jsonb NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.hangout_feedback (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_id text NOT NULL REFERENCES public.hangout_events(id),query text NOT NULL,
 verdict text NOT NULL CHECK(verdict IN ('good','not_for_me')),
 reason text CHECK(reason IS NULL OR reason IN ('too_far','too_expensive','wrong_vibe','wrong_type','not_what_i_asked')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hangout_ingestion_jobs(name text PRIMARY KEY,owner text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.hangout_request_limits(bucket_key text PRIMARY KEY,requests integer NOT NULL,expires_at timestamptz NOT NULL);
ALTER TABLE public.hangout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hangout_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hangout_events,public.hangout_search_cache,public.hangout_feedback,public.hangout_ingestion_jobs,public.hangout_request_limits FROM anon,authenticated;
GRANT ALL ON public.hangout_events,public.hangout_search_cache,public.hangout_feedback,public.hangout_ingestion_jobs,public.hangout_request_limits TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.hangout_feedback_id_seq TO service_role;
CREATE OR REPLACE FUNCTION public.hangout_match_events(query_embedding vector(1536),eligible_ids text[],model_name text,match_count integer DEFAULT 25)
RETURNS TABLE(data jsonb) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$
 SELECT e.data FROM public.hangout_events e WHERE e.active AND e.id=ANY(eligible_ids)
 AND e.embedding IS NOT NULL AND e.embedding_model=model_name
 AND e.data->>'date'>=to_char(now() AT TIME ZONE 'Europe/Tallinn','YYYY-MM-DD')
 ORDER BY e.embedding <=> query_embedding LIMIT least(greatest(match_count,1),25)
$$;
CREATE OR REPLACE FUNCTION public.hangout_claim_job(job_name text,job_owner text,lease_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE acquired text;
BEGIN
 INSERT INTO public.hangout_ingestion_jobs(name,owner,expires_at) VALUES(job_name,job_owner,now()+make_interval(secs=>least(lease_seconds,300)))
 ON CONFLICT(name) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at
 WHERE hangout_ingestion_jobs.expires_at<now() RETURNING owner INTO acquired;
 RETURN acquired=job_owner;
END $$;
CREATE OR REPLACE FUNCTION public.hangout_allow_request(bucket_key text,request_limit integer DEFAULT 20)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 DELETE FROM public.hangout_request_limits WHERE expires_at<now()-interval '1 hour';
 INSERT INTO public.hangout_request_limits AS r(bucket_key,requests,expires_at) VALUES(bucket_key,1,now()+interval '1 minute')
 ON CONFLICT ON CONSTRAINT hangout_request_limits_pkey DO UPDATE SET requests=CASE WHEN r.expires_at<now() THEN 1 ELSE r.requests+1 END,
 expires_at=CASE WHEN r.expires_at<now() THEN now()+interval '1 minute' ELSE r.expires_at END RETURNING requests INTO n;
 RETURN n<=least(request_limit,20);
END $$;
CREATE OR REPLACE FUNCTION public.hangout_schema_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.hangout_match_events(vector,text[],text,integer),public.hangout_claim_job(text,text,integer),public.hangout_allow_request(text,integer),public.hangout_schema_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hangout_match_events(vector,text[],text,integer),public.hangout_claim_job(text,text,integer),public.hangout_allow_request(text,integer),public.hangout_schema_ready() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
