-- Warna produk (2026-10-12).
--
-- Harga tetap dicatat per varian memori (PRD §7): warna TIDAK membentuk varian
-- baru dan tidak memengaruhi harga. Warna hanya dicatat sebagai:
--   - product_assets.color: foto ini menampilkan warna apa (galeri per warna);
--   - photo_jobs.color: warna yang dibawa antrean foto sampai fotonya tersimpan;
--   - offers.colors: warna yang tercatat di listing toko ini (mis. satu baris
--     berkas per warna untuk listing yang sama).
-- Nama warna disimpan apa adanya dari sumber (mis. "Lotus Purple"), tidak
-- diterjemahkan atau ditebak.

ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS color TEXT
  CHECK (color IS NULL OR char_length(color) BETWEEN 1 AND 60);

ALTER TABLE public.photo_jobs
  ADD COLUMN IF NOT EXISTS color TEXT
  CHECK (color IS NULL OR char_length(color) BETWEEN 1 AND 60);

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(colors) <= 24);

-- Pembaruan massal penawaran: `colors` NULL berarti "tidak diubah" (sel warna
-- kosong di berkas), sama seperti aturan sel kosong lainnya.
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
      colors              = COALESCE(r.colors, o.colors),
      updated_by_batch_id = r.updated_by_batch_id,
      last_source         = r.last_source,
      deleted_at          = NULL
  FROM jsonb_to_recordset(p_rows) AS r(
    id UUID, marketplace TEXT, seller_name TEXT, warranty TEXT, listing_status TEXT,
    seller_verified BOOLEAN, store_id UUID, url TEXT, colors TEXT[], updated_by_batch_id UUID, last_source TEXT
  )
  WHERE o.id = r.id
  RETURNING o.id
$$;

REVOKE EXECUTE ON FUNCTION public.import_update_offers(JSONB) FROM PUBLIC, anon, authenticated;
