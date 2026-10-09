-- Soft delete dan riwayat harga permanen (aturan system design 8, PB-18).
--
-- Aturan: produk, toko, dan kampanye iklan memakai soft delete (deleted_at),
-- dan riwayat harga tidak pernah dihapus. Sebelumnya menghapus produk
-- menghanyutkan varian, penawaran, dan SELURUH riwayat harganya lewat
-- ON DELETE CASCADE, dan undo impor menghapus baris harga.
--
-- Sekarang:
--   * products, offers, stores, insertion_orders: kolom deleted_at.
--     Produk terhapus wajib berstatus draft, sehingga semua policy publik yang
--     sudah memeriksa status = 'published' otomatis menyembunyikannya.
--   * price_observations, price_checks: kolom voided_at. Harga dari impor yang
--     dibatalkan ditandai batal, tidak dihapus; view dan policy publik
--     mengabaikannya.
--   * Trigger menolak DELETE pada keenam tabel itu, termasuk DELETE yang datang
--     dari cascade (mis. menghapus varian yang punya penawaran). Satu-satunya
--     pengecualian adalah pembersihan data uji QA lewat qa_purge_test_data(),
--     yang mencatat izin per transaksi di hard_delete_allowance.

ALTER TABLE public.products         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.offers           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.stores           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.insertion_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.price_observations ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.price_checks       ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_deleted_is_draft;
ALTER TABLE public.products ADD CONSTRAINT products_deleted_is_draft
  CHECK (deleted_at IS NULL OR status = 'draft');

CREATE INDEX IF NOT EXISTS products_active_idx ON public.products (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS offers_active_variant_idx ON public.offers (variant_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------ policy publik

DROP POLICY IF EXISTS offers_public_read ON public.offers;
CREATE POLICY offers_public_read ON public.offers FOR SELECT TO anon, authenticated
USING (
  offers.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.variants v JOIN public.products p ON p.id = v.product_id
    WHERE v.id = offers.variant_id AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS price_observations_public_read ON public.price_observations;
CREATE POLICY price_observations_public_read ON public.price_observations FOR SELECT TO anon, authenticated
USING (
  price_observations.voided_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.variants v ON v.id = o.variant_id
    JOIN public.products p ON p.id = v.product_id
    WHERE o.id = price_observations.offer_id AND o.deleted_at IS NULL AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS price_checks_public_read ON public.price_checks;
CREATE POLICY price_checks_public_read ON public.price_checks FOR SELECT TO anon, authenticated
USING (
  price_checks.voided_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.variants v ON v.id = o.variant_id
    JOIN public.products p ON p.id = v.product_id
    WHERE o.id = price_checks.offer_id AND o.deleted_at IS NULL AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS stores_public_read ON public.stores;
CREATE POLICY stores_public_read ON public.stores FOR SELECT TO anon, authenticated
USING (stores.deleted_at IS NULL);

-- ------------------------------------------------- view harga terbaru

-- Admin membaca view ini dengan kunci admin (RLS tidak berlaku), jadi
-- penyaringan baris batal ditulis di view itu sendiri, bukan hanya di policy.
CREATE OR REPLACE VIEW public.offer_latest_price
WITH (security_invoker = true) AS
SELECT DISTINCT ON (offer_id)
  id, offer_id, price_idr, observed_at, origin
FROM public.price_observations
WHERE voided_at IS NULL
ORDER BY offer_id, observed_at DESC, id;

CREATE OR REPLACE VIEW public.offer_last_success_check
WITH (security_invoker = true) AS
SELECT DISTINCT ON (offer_id)
  id, offer_id, attempted_at, outcome, error_summary
FROM public.price_checks
WHERE outcome = 'success' AND voided_at IS NULL
ORDER BY offer_id, attempted_at DESC, id;

-- ------------------------------------------------------ larangan hapus

-- Izin hapus permanen hanya berlaku di dalam satu transaksi yang mencatat
-- ID transaksinya di sini (dipakai qa_purge_test_data). InsForge tidak
-- mengizinkan pengaturan sesi SQL, jadi izinnya disimpan sebagai baris.
CREATE TABLE IF NOT EXISTS public.hard_delete_allowance (
  txid       BIGINT PRIMARY KEY,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hard_delete_allowance ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.hard_delete_allowance FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.forbid_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hard_delete_allowance a WHERE a.txid = txid_current()) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Baris % tidak boleh dihapus permanen; gunakan %.',
    TG_TABLE_NAME,
    CASE WHEN TG_TABLE_NAME IN ('price_observations', 'price_checks') THEN 'voided_at' ELSE 'deleted_at' END
    USING ERRCODE = 'restrict_violation';
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'offers', 'stores', 'insertion_orders', 'price_observations', 'price_checks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_forbid_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.forbid_hard_delete()',
      t || '_forbid_delete', t
    );
  END LOOP;
END;
$$;

-- Pembersihan data uji integrasi (merek penanda "QAUji" saja, tidak bisa
-- diarahkan ke merek lain). Hanya kunci admin yang boleh memanggil.
CREATE OR REPLACE FUNCTION public.qa_purge_test_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO public.hard_delete_allowance (txid, reason) VALUES (txid_current(), 'qa_purge_test_data')
  ON CONFLICT (txid) DO NOTHING;
  WITH gone AS (DELETE FROM public.products WHERE brand = 'QAUji' RETURNING 1)
  SELECT count(*)::int INTO n FROM gone;
  DELETE FROM public.hard_delete_allowance WHERE txid = txid_current();
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_purge_test_data() FROM PUBLIC, anon, authenticated;
