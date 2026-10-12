-- Kelola foto per warna dari halaman admin produk (2026-10-12).
--
-- Dua perubahan yang menyentuh beberapa baris sekaligus dibuat atomik di
-- database (bukan update satu per satu dari aplikasi):
--   - admin_set_photo_order: urutan foto satu warna = urutan id yang dikirim;
--   - admin_set_photo_cover: satu foto jadi sampul warnanya, sampul lama dilepas.
-- Hanya dipanggil server aplikasi (service role) setelah requireStaff.

CREATE OR REPLACE FUNCTION public.admin_set_photo_order(p_product UUID, p_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT id, ordinality - 1 AS position
    FROM unnest(p_ids) WITH ORDINALITY AS t(id, ordinality)
  ), updated AS (
    UPDATE public.product_assets a
    SET sort_order = o.position
    FROM ordered o
    WHERE a.id = o.id AND a.product_id = p_product AND a.kind = 'photo'
    RETURNING a.id
  )
  SELECT count(*)::INTEGER FROM updated
$$;

CREATE OR REPLACE FUNCTION public.admin_set_photo_cover(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target RECORD;
BEGIN
  SELECT product_id, color INTO target FROM public.product_assets WHERE id = p_id AND kind = 'photo';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.product_assets
  SET is_cover = false
  WHERE product_id = target.product_id
    AND color IS NOT DISTINCT FROM target.color
    AND is_cover
    AND id <> p_id;
  UPDATE public.product_assets SET is_cover = true WHERE id = p_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_photo_order(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_photo_cover(UUID) FROM PUBLIC, anon, authenticated;
