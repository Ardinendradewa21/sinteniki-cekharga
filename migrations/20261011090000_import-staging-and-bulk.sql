-- Langkah 4 rancangan impor terpadu (aturan system design 3, 4, 8; PB-19, PB-20).
--
-- 1. raw_listings: baris mentah impor disimpan per baris, bukan satu kolom
--    JSON besar di import_batches. Worker hanya membaca baris potongan yang
--    sedang dikerjakan (dulu seluruh berkas dibaca setiap langkah: 817 KB untuk
--    500 baris spesifikasi). Baris mentah dihapus PERMANEN setelah masa
--    retensi (aturan 8: "raw_listings dihapus permanen setelah masa retensi").
--      role 'upload'    = baris berkas apa adanya (templat terpadu, sebelum dikoreksi)
--      role 'row'       = baris yang dipakai rencana dan penulisan (row_indexes item)
--      role 'follow_up' = penawaran yang diterapkan setelah produk batch ini tersimpan
-- 2. Status batch 'analyzing': unggahan langsung disimpan, dan analisis
--    (koreksi, pencocokan, diff) berjalan di worker, bukan di request unggah.
-- 3. RPC massal pengganti satu query per baris (N+1): hasil item, pembaruan
--    penawaran, dan pembaruan harga.
-- 4. View offer_recent_checks: 5 pemeriksaan terakhir per penawaran dalam satu
--    query untuk halaman detail produk admin.

CREATE TABLE IF NOT EXISTS public.raw_listings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('upload', 'row', 'follow_up')),
  position   INTEGER NOT NULL CHECK (position >= 0),
  data       JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, role, position)
);
ALTER TABLE public.raw_listings ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.raw_listings FROM anon, authenticated;

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_status_check;
ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_status_check CHECK (
  status IN ('analyzing', 'draft', 'queued', 'applying', 'applied', 'partial', 'failed', 'discarded', 'reverted')
);

-- Klaim analisis: atomik, satu worker per batch (sama seperti import_claim_batch).
CREATE OR REPLACE FUNCTION public.import_claim_analysis(p_batch UUID, p_lease_seconds INTEGER)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.import_batches b
  SET lease_until = now() + make_interval(secs => GREATEST(p_lease_seconds, 10)),
      attempts = b.attempts + 1
  WHERE b.id = p_batch
    AND b.status = 'analyzing'
    AND (b.lease_until IS NULL OR b.lease_until < now())
  RETURNING b.id
$$;

-- Antrean worker kini juga memuat batch yang menunggu dianalisis.
CREATE OR REPLACE FUNCTION public.import_pending_batches(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id FROM public.import_batches b
  WHERE b.status IN ('analyzing', 'queued', 'applying')
    AND (b.lease_until IS NULL OR b.lease_until < now())
  ORDER BY b.updated_at
  LIMIT GREATEST(p_limit, 1)
$$;

-- Retensi baris mentah: batch yang sudah selesai (atau dibatalkan) dan lebih
-- tua dari p_keep_days. Batch yang masih bisa diterapkan atau dicoba ulang
-- tidak disentuh sebelum umurnya lewat.
CREATE OR REPLACE FUNCTION public.import_purge_raw_listings(p_keep_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.raw_listings r
    USING public.import_batches b
    WHERE r.batch_id = b.id
      AND b.status IN ('applied', 'partial', 'failed', 'discarded', 'reverted')
      AND b.created_at < now() - make_interval(days => GREATEST(p_keep_days, 1))
    RETURNING 1
  )
  SELECT count(*)::int FROM gone
$$;

-- Hasil item batch dalam satu panggilan. Hanya item yang masih 'pending'.
CREATE OR REPLACE FUNCTION public.import_write_outcomes(p_rows JSONB)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH done AS (
    UPDATE public.import_items AS i
    SET result         = r.result,
        result_action  = r.result_action,
        result_message = r.result_message,
        entity_id      = r.entity_id,
        processed_at   = now()
    FROM jsonb_to_recordset(p_rows) AS r(
      id UUID, result TEXT, result_action TEXT, result_message TEXT, entity_id UUID
    )
    WHERE i.id = r.id AND i.result = 'pending'
    RETURNING 1
  )
  SELECT count(*)::int FROM done
$$;

-- Pembaruan penawaran yang sudah ada (impor penawaran). url hanya diganti bila
-- dikirim (penawaran Erafone yang pindah ke warna lain). Penawaran yang dihapus
-- lunak dipulihkan, sama dengan perilaku sebelumnya.
CREATE OR REPLACE FUNCTION public.import_update_offers(p_rows JSONB)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.offers AS o
  SET marketplace         = r.marketplace,
      seller_name         = r.seller_name,
      warranty            = r.warranty,
      listing_status      = r.listing_status,
      seller_verified     = r.seller_verified,
      store_id            = r.store_id,
      url                 = COALESCE(r.url, o.url),
      updated_by_batch_id = r.updated_by_batch_id,
      last_source         = r.last_source,
      deleted_at          = NULL
  FROM jsonb_to_recordset(p_rows) AS r(
    id UUID, marketplace TEXT, seller_name TEXT, warranty TEXT, listing_status TEXT,
    seller_verified BOOLEAN, store_id UUID, url TEXT, updated_by_batch_id UUID, last_source TEXT
  )
  WHERE o.id = r.id
  RETURNING o.id
$$;

-- Koreksi harga pada waktu pengamatan yang sama (berkas yang diperbaiki lalu
-- diimpor ulang). Baris yang dibatalkan undo ikut dipulihkan.
CREATE OR REPLACE FUNCTION public.import_update_observations(p_rows JSONB)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.price_observations AS p
  SET price_idr = r.price_idr,
      origin    = r.origin,
      batch_id  = r.batch_id,
      voided_at = NULL
  FROM jsonb_to_recordset(p_rows) AS r(id UUID, price_idr BIGINT, origin TEXT, batch_id UUID)
  WHERE p.id = r.id
  RETURNING p.id
$$;

-- Lima pemeriksaan terakhir per penawaran (bukan yang dibatalkan).
CREATE OR REPLACE VIEW public.offer_recent_checks
WITH (security_invoker = true) AS
SELECT offer_id, outcome, attempted_at, error_summary, id
FROM (
  SELECT c.*, row_number() OVER (PARTITION BY c.offer_id ORDER BY c.attempted_at DESC, c.id) AS rn
  FROM public.price_checks c
  WHERE c.voided_at IS NULL
) ranked
WHERE rn <= 5;
REVOKE ALL ON public.offer_recent_checks FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.import_claim_analysis(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_pending_batches(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_purge_raw_listings(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_write_outcomes(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_update_offers(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_update_observations(JSONB) FROM PUBLIC, anon, authenticated;
