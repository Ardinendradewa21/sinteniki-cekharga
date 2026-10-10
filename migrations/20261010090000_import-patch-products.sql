-- Pembaruan produk dari impor sebagai PATCH massal (langkah 1 rancangan impor
-- terpadu; aturan system design 4 dan PB-20).
--
-- Sebelumnya setiap produk yang sudah ada diperbarui satu per satu (satu query
-- per baris) dan kolom `specs` diganti seluruhnya, sehingga sel CSV kosong
-- menghapus nilai lama. Fungsi ini memperbarui banyak produk dalam satu
-- panggilan dan menggabungkan spesifikasi secara atomik dengan
-- `specs || specs_patch`: kunci yang tidak ada di patch tetap, kunci bernilai
-- null di patch sengaja dikosongkan.
--
-- `specs_source_url` hanya diganti bila patch membawanya. Produk yang dihapus
-- lunak dipulihkan (deleted_at = null), sama dengan perilaku impor sebelumnya.
-- Status terbit dan slug tidak pernah disentuh impor.

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
    last_source TEXT
  )
  WHERE p.id = r.id
  RETURNING p.id
$$;

REVOKE EXECUTE ON FUNCTION public.import_patch_products(JSONB) FROM PUBLIC, anon, authenticated;
