-- Urutan foto dan foto sampul per warna (2026-10-12).
--
-- Lanjutan 20261012090000_product-colors.sql. Galeri produk kini dikelompokkan
-- per warna: setiap warna punya urutan foto sendiri dan paling banyak satu
-- foto sampul. Foto tanpa warna (color NULL) adalah foto umum dan juga hanya
-- punya satu sampul (NULLS NOT DISTINCT).

ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS product_assets_color_order_idx
  ON public.product_assets (product_id, color, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS product_assets_one_cover_per_color_idx
  ON public.product_assets (product_id, color) NULLS NOT DISTINCT
  WHERE is_cover;

-- Antrean foto membawa warna, urutan, dan tanda sampul sampai fotonya
-- tersimpan. Jenis job tetap 'gallery' (tidak ada jenis 'color-gallery'):
-- cara memproses foto berwarna sama persis dengan foto galeri biasa, yang
-- berbeda hanya kolom color, jadi CHECK kind dan worker tidak perlu cabang baru.
ALTER TABLE public.photo_jobs
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false;

-- Satu URL boleh diantrekan untuk dua warna (berkas Xiaomi memakai foto yang
-- sama untuk beberapa warna), tetapi tetap sekali per (produk, jenis, URL, warna).
ALTER TABLE public.photo_jobs DROP CONSTRAINT IF EXISTS photo_jobs_product_id_kind_image_url_key;
ALTER TABLE public.photo_jobs DROP CONSTRAINT IF EXISTS photo_jobs_product_kind_url_color_key;
ALTER TABLE public.photo_jobs
  ADD CONSTRAINT photo_jobs_product_kind_url_color_key
  UNIQUE NULLS NOT DISTINCT (product_id, kind, image_url, color);

-- Klaim: foto utama dulu, lalu sampul, lalu urutan foto, lalu yang paling
-- lama menunggu. Urutan ini menentukan foto mana yang masuk lebih dulu saat
-- batas foto per warna tercapai.
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
    ORDER BY (c.kind = 'primary') DESC, c.is_cover DESC, c.sort_order, c.created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*
$$;

REVOKE EXECUTE ON FUNCTION public.photo_claim_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
