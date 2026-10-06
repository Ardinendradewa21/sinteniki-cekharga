-- Antrean foto produk (rencana kerja impor, Fase 2).
--
-- Mengunduh, membersihkan latar, dan mengunggah foto adalah bagian paling
-- lambat dari impor. Dulu dikerjakan di dalam penerapan batch, sehingga satu
-- foto yang lambat bisa menahan seluruh potongan. Sekarang runner hanya
-- mengantrekan foto di sini; worker foto memprosesnya terpisah.
--
-- kind:
--   primary   = foto utama dari impor spesifikasi (mengganti foto utama lama)
--   gallery   = foto tambahan dari listing toko (maks. 8 per produk)
--   reprocess = memproses ulang foto lama dengan pipeline terbaru
-- Foto utama selalu diproses sebelum galeri untuk produk yang sama, karena
-- foto utama mengganti foto tertua produk.

CREATE TABLE IF NOT EXISTS public.photo_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('primary', 'gallery', 'reprocess')),
  image_url   TEXT NOT NULL CHECK (image_url ~ '^https://'),
  source      TEXT NOT NULL,
  source_url  TEXT,
  alt         TEXT NOT NULL,
  -- Dasar dan teks hak pakai foto: {"basis": "...", "text": "..."}.
  rights      JSONB NOT NULL CHECK (jsonb_typeof(rights) = 'object'),
  -- Baris product_assets yang diproses ulang (kind = reprocess).
  asset_id    UUID REFERENCES public.product_assets(id) ON DELETE CASCADE,
  batch_id    UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  outcome     TEXT CHECK (outcome IN ('created', 'updated', 'unchanged')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  lease_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Foto yang sama untuk produk yang sama hanya punya satu antrean.
  UNIQUE (product_id, kind, image_url)
);

CREATE INDEX IF NOT EXISTS photo_jobs_work_idx ON public.photo_jobs (status, kind, created_at)
  WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS photo_jobs_batch_idx ON public.photo_jobs (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS photo_jobs_product_idx ON public.photo_jobs (product_id);

DROP TRIGGER IF EXISTS photo_jobs_updated_at ON public.photo_jobs;
CREATE TRIGGER photo_jobs_updated_at BEFORE UPDATE ON public.photo_jobs
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.photo_jobs ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.photo_jobs FROM anon, authenticated;

-- Klaim sejumlah job sekaligus. FOR UPDATE SKIP LOCKED membuat beberapa
-- worker bisa berjalan bersamaan tanpa mengambil job yang sama. Job `running`
-- yang lease-nya habis (worker mati) diklaim ulang selama belum 3 kali dicoba.
-- Urutan: foto utama dulu, lalu yang paling lama menunggu.
CREATE OR REPLACE FUNCTION public.photo_claim_jobs(p_limit INTEGER, p_lease_seconds INTEGER)
RETURNS SETOF public.photo_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.photo_jobs j
  SET status = 'running',
      lease_until = now() + make_interval(secs => GREATEST(p_lease_seconds, 10)),
      attempts = j.attempts + 1
  WHERE j.id IN (
    SELECT c.id FROM public.photo_jobs c
    WHERE c.attempts < 3
      AND (c.status = 'pending' OR (c.status = 'running' AND c.lease_until < now()))
    ORDER BY (c.kind = 'primary') DESC, c.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*
$$;

-- Job `running` yang lease-nya habis setelah 3 percobaan tidak akan pernah
-- diklaim lagi; tandai gagal supaya terlihat, bukan menggantung selamanya.
CREATE OR REPLACE FUNCTION public.photo_fail_exhausted()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.photo_jobs
    SET status = 'failed',
        lease_until = NULL,
        last_error = COALESCE(last_error, 'Berhenti di tengah proses sebanyak 3 kali.')
    WHERE status = 'running' AND attempts >= 3 AND lease_until < now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM updated
$$;

REVOKE EXECUTE ON FUNCTION public.photo_claim_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.photo_fail_exhausted() FROM PUBLIC, anon, authenticated;
