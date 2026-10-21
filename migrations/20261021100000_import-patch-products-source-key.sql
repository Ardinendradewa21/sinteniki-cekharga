-- import_patch_products bisa mengganti source_key (Sprint 12, 21 Oktober 2026).
--
-- Model yang dijual resmi tetapi belum ada di GSMArena kini bisa masuk lewat
-- tarik otomatis dengan spesifikasi minimal dari situs resmi; kunci sumbernya
-- placeholder `gsmarena:<slug>`. Saat GSMArena kemudian memuat model itu,
-- tarik berikutnya mengadopsi produk yang sama (slug sama) dan mengganti
-- kuncinya ke halaman GSMArena, bukan membuat produk ganda.
--
-- Kolom baru `source_key` di p_rows bersifat opsional: NULL = tidak berubah,
-- sehingga pemanggil lama tetap berjalan.

CREATE OR REPLACE FUNCTION public.import_patch_products(p_rows JSONB)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products AS p
  SET brand               = r.brand,
      model               = r.model,
      specs               = p.specs || COALESCE(r.specs_patch, '{}'::jsonb),
      specs_source        = r.specs_source,
      specs_source_url    = COALESCE(r.specs_source_url, p.specs_source_url),
      specs_retrieved_at  = r.specs_retrieved_at,
      updated_by_batch_id = r.updated_by_batch_id,
      last_source         = r.last_source,
      source_key          = COALESCE(r.source_key, p.source_key),
      deleted_at          = NULL
  FROM jsonb_to_recordset(p_rows) AS r(
    id UUID,
    brand TEXT,
    model TEXT,
    specs_patch JSONB,
    specs_source TEXT,
    specs_source_url TEXT,
    specs_retrieved_at TIMESTAMPTZ,
    updated_by_batch_id UUID,
    last_source TEXT,
    source_key TEXT
  )
  WHERE p.id = r.id
  RETURNING p.id
$$;

REVOKE EXECUTE ON FUNCTION public.import_patch_products(JSONB) FROM PUBLIC, anon, authenticated;
