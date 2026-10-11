-- Tarik otomatis sebagai background job (aturan system design 3, sisa PB-19).
--
-- Sebelumnya daftar model (situs resmi) dan spesifikasi (GSMArena) diambil di
-- dalam request admin: satu klik = satu request yang menunggu situs orang
-- lain, dan menutup tab menghentikan pekerjaan. Sekarang setiap pengambilan
-- adalah baris di scrape_jobs; worker mengerjakannya, browser hanya membaca
-- status.
--
--   kind 'lineup'  = daftar model + harga resmi satu merek -> membuat sesi
--   kind 'resolve' = spesifikasi satu model sebuah sesi    -> scrape_results
--
-- Kesopanan ke situs sumber dijaga di database, bukan hanya di memori satu
-- proses: hanya SATU job per jenis yang boleh berjalan pada satu waktu di
-- seluruh instance (klaim diserialkan dengan advisory lock transaksi), dan
-- jeda per host tetap berlaku di dalam worker.

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             TEXT NOT NULL CHECK (kind IN ('lineup', 'resolve')),
  brand            TEXT NOT NULL CHECK (length(brand) > 0),
  session_id       UUID REFERENCES public.scrape_sessions(id) ON DELETE CASCADE,
  official_id      TEXT,
  path_override    TEXT,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'done', 'failed', 'blocked', 'cancelled')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  lease_until      TIMESTAMPTZ,
  error            TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  CHECK (kind = 'lineup' OR (session_id IS NOT NULL AND official_id IS NOT NULL))
);

-- Satu job spesifikasi per model per sesi; mengambil ulang = mengantrekan ulang
-- baris yang sama (idempoten, aturan system design 6).
CREATE UNIQUE INDEX IF NOT EXISTS scrape_jobs_resolve_key
  ON public.scrape_jobs (session_id, official_id) WHERE kind = 'resolve';
CREATE INDEX IF NOT EXISTS scrape_jobs_pending_idx
  ON public.scrape_jobs (created_at) WHERE status IN ('queued', 'running');

DROP TRIGGER IF EXISTS scrape_jobs_updated_at ON public.scrape_jobs;
CREATE TRIGGER scrape_jobs_updated_at BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.scrape_jobs FROM anon, authenticated;

-- Klaim satu job: yang antre, atau yang lease-nya habis (worker mati di
-- tengah jalan). Tidak diklaim bila job sejenis masih berjalan dengan lease
-- sah. SKIP LOCKED + advisory lock: dua worker tidak pernah memegang job yang
-- sama, dan tidak pernah dua job sejenis berjalan bersamaan.
CREATE OR REPLACE FUNCTION public.scrape_claim_job(p_lease_seconds INTEGER)
RETURNS SETOF public.scrape_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('scrape_claim_job'));
  RETURN QUERY
  UPDATE public.scrape_jobs AS j
  SET status = 'running',
      lease_until = now() + make_interval(secs => GREATEST(p_lease_seconds, 10)),
      attempts = j.attempts + 1
  WHERE j.id = (
    SELECT c.id FROM public.scrape_jobs c
    WHERE (c.status = 'queued' OR (c.status = 'running' AND c.lease_until < now()))
      AND NOT EXISTS (
        SELECT 1 FROM public.scrape_jobs r
        WHERE r.kind = c.kind AND r.status = 'running' AND r.lease_until >= now() AND r.id <> c.id
      )
    ORDER BY c.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scrape_claim_job(INTEGER) FROM PUBLIC, anon, authenticated;
