-- Daftar warna produk mengikuti galeri foto (Sprint 12, 21 Oktober 2026).
--
-- Nama warna dari toko resmi Indonesia ("Hitam Malam", "Vibing Blue") hampir
-- tidak pernah sama dengan nama warna GSMArena ("Voyage Black"). Pemilik
-- produk memutuskan warna dari berkas impor (toko resmi Indonesia) yang
-- menjadi acuan: saat batch galeri diterapkan, specs.colorOptions diganti
-- dengan warna yang ada di galeri produk itu.
--
-- Satu panggilan untuk banyak produk (aturan system design 4), idempoten
-- (nilai akhir yang sama bila diulang).

CREATE OR REPLACE FUNCTION public.import_set_color_options(p_rows JSONB)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products AS p
  SET specs = jsonb_set(p.specs, '{colorOptions}', r.colors, true),
      updated_by_batch_id = COALESCE(r.batch_id, p.updated_by_batch_id),
      last_source = 'import'
  FROM jsonb_to_recordset(p_rows) AS r(id UUID, colors JSONB, batch_id UUID)
  WHERE p.id = r.id
    AND jsonb_typeof(r.colors) = 'array'
    AND jsonb_array_length(r.colors) > 0
    AND p.deleted_at IS NULL
  RETURNING p.id
$$;

REVOKE EXECUTE ON FUNCTION public.import_set_color_options(JSONB) FROM PUBLIC, anon, authenticated;
