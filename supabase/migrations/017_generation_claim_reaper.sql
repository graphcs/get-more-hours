-- Stale-claim reclamation for AI generation + OCR.
--
-- Problem this fixes: runDocumentGeneration claimed a row by flipping
-- generation_status to 'generating' and only ever left that state from its
-- catch block. If the serverless function died mid-flight (timeout, cold kill,
-- deploy) the catch never ran, and the claim filter
-- `.in('generation_status', ['pending','failed'])` could never match the row
-- again — the document was unreclaimable forever and the UI spun forever.
--
-- Two pieces:
--   1. *_started_at timestamps so "how long has this been claimed?" is answerable.
--   2. claim_document_generation() — an atomic claim that ALSO reclaims rows
--      stuck in 'generating' past a staleness threshold. The Supabase JS client
--      cannot express that OR condition in a single filter, hence the RPC.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ocr_started_at TIMESTAMPTZ;

-- Backfill so pre-existing mid-flight rows are eligible for reaping instead of
-- being invisible to a `started_at < cutoff` filter (NULL never matches `<`).
UPDATE documents
  SET generation_started_at = COALESCE(updated_at, created_at)
  WHERE generation_status = 'generating' AND generation_started_at IS NULL;

UPDATE documents
  SET ocr_started_at = COALESCE(updated_at, created_at)
  WHERE ocr_status = 'processing' AND ocr_started_at IS NULL;

-- Partial indexes: the reaper only ever scans non-terminal rows.
CREATE INDEX IF NOT EXISTS documents_generating_started_idx
  ON documents (generation_started_at)
  WHERE generation_status = 'generating';

CREATE INDEX IF NOT EXISTS documents_ocr_processing_started_idx
  ON documents (ocr_started_at)
  WHERE ocr_status = 'processing';

-- Atomically claim a document for generation.
--
-- Claims when the row is pending / failed / never-started, OR when it is
-- already 'generating' but the claim is older than stale_seconds (the previous
-- worker is presumed dead). `FOR UPDATE` takes a row lock so two concurrent
-- invocations serialise: exactly one sees a claimable prev_status.
--
-- Returns zero rows when the claim was refused (row missing, already 'ready',
-- or a *live* generation is in flight). Callers distinguish those cases by
-- re-reading the row.
CREATE OR REPLACE FUNCTION claim_document_generation(
  doc_id uuid,
  stale_seconds integer DEFAULT 300
)
RETURNS TABLE (document_id uuid, reclaimed boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT
      d.id,
      d.generation_status AS prev_status,
      COALESCE(d.generation_started_at, d.created_at) AS claimed_at
    FROM documents d
    WHERE d.id = doc_id
    FOR UPDATE
  ),
  claimable AS (
    SELECT t.id, t.prev_status
    FROM target t
    WHERE t.prev_status IS NULL
       OR t.prev_status IN ('pending', 'failed')
       OR (
         t.prev_status = 'generating'
         AND t.claimed_at < now() - make_interval(secs => GREATEST(stale_seconds, 1))
       )
  ),
  updated AS (
    UPDATE documents d
    SET generation_status = 'generating',
        generation_error = NULL,
        generation_started_at = now()
    FROM claimable c
    WHERE d.id = c.id
    RETURNING d.id
  )
  SELECT u.id AS document_id, (c.prev_status = 'generating') AS reclaimed
  FROM updated u
  JOIN claimable c ON c.id = u.id;
$$;

-- Only the service role (server-side code) may claim. Clients must go through
-- the API routes, which enforce auth + the stage payment gate.
REVOKE ALL ON FUNCTION claim_document_generation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_document_generation(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_document_generation(uuid, integer) TO service_role;
