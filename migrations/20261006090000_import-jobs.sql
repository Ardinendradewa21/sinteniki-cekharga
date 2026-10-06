-- Penerapan batch impor sebagai job bertahap (rencana kerja impor, Fase 1).
--
-- Penerapan tidak lagi berjalan dalam satu request besar. Item terpilih
-- diproses per potongan kecil oleh worker; setiap potongan dikunci dengan
-- lease, sehingga:
--   * tidak ada request yang bergantung pada batas waktu fungsi serverless,
--   * worker yang mati di tengah jalan dilanjutkan worker lain setelah lease
--     kedaluwarsa,
--   * setiap baris punya hasil sendiri (berhasil / gagal / dilewati).
--
-- Alur status batch:
--   draft -> queued -> applying -> applied | partial | failed
--   partial/failed -> queued (coba ulang baris yang gagal)
--   draft -> discarded

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_status_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_status_check
  CHECK (status IN ('draft', 'queued', 'applying', 'applied', 'partial', 'failed', 'discarded'));

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS progress    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts    INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS import_batches_work_idx
  ON public.import_batches (status, lease_until)
  WHERE status IN ('queued', 'applying');

ALTER TABLE public.import_items
  ADD COLUMN IF NOT EXISTS selected       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result         TEXT CHECK (result IN ('pending', 'done', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS result_action  TEXT CHECK (result_action IN ('created', 'updated', 'unchanged')),
  ADD COLUMN IF NOT EXISTS result_message TEXT,
  ADD COLUMN IF NOT EXISTS entity_id      UUID,
  ADD COLUMN IF NOT EXISTS processed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS import_items_pending_idx
  ON public.import_items (batch_id, position)
  WHERE selected AND result = 'pending';

-- Klaim atomik satu batch untuk satu worker. Memakai jam database, bukan jam
-- server aplikasi, supaya beberapa instance tidak berselisih soal kedaluwarsa.
-- Mengembalikan baris batch yang diklaim, atau kosong bila sedang dipegang
-- worker lain / tidak dalam status yang bisa dikerjakan.
CREATE OR REPLACE FUNCTION public.import_claim_batch(p_batch UUID, p_lease_seconds INTEGER)
RETURNS TABLE (id UUID, attempts INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.import_batches b
  SET status = 'applying',
      lease_until = now() + make_interval(secs => GREATEST(p_lease_seconds, 10)),
      started_at = COALESCE(b.started_at, now()),
      attempts = b.attempts + 1
  WHERE b.id = p_batch
    AND b.status IN ('queued', 'applying')
    AND (b.lease_until IS NULL OR b.lease_until < now())
  RETURNING b.id, b.attempts
$$;

-- Batch yang menunggu dikerjakan (antre, atau lease-nya kedaluwarsa).
CREATE OR REPLACE FUNCTION public.import_pending_batches(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id FROM public.import_batches b
  WHERE b.status IN ('queued', 'applying')
    AND (b.lease_until IS NULL OR b.lease_until < now())
  ORDER BY b.updated_at
  LIMIT GREATEST(p_limit, 1)
$$;

REVOKE EXECUTE ON FUNCTION public.import_claim_batch(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_pending_batches(INTEGER) FROM PUBLIC, anon, authenticated;
