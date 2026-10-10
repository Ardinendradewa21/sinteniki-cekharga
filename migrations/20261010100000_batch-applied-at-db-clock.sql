-- `import_batches.applied_at` dicap dengan jam DATABASE.
--
-- Undo terbatas memutuskan "belum disunting sejak diterapkan" dengan
-- membandingkan `products.updated_at` / `offers.updated_at` (diisi trigger
-- database, jam server database) dengan `import_batches.applied_at` (dulu
-- diisi aplikasi dengan jam server aplikasi). Bila jam aplikasi lebih cepat
-- beberapa detik, suntingan admin sesudah penerapan terlihat lebih tua dari
-- waktu penerapan, dan produk yang sudah disunting ikut terhitung boleh
-- diurungkan. Terukur 2026-10-10: jam lokal pengembang lebih cepat 1-3 detik
-- dari database, dan uji INT-01 gagal karenanya.
--
-- Trigger ini menimpa nilai dari aplikasi dengan now() setiap kali
-- applied_at diisi, sehingga kedua sisi perbandingan memakai jam yang sama.

CREATE OR REPLACE FUNCTION public.import_batches_stamp_applied_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.applied_at IS NOT NULL AND NEW.applied_at IS DISTINCT FROM OLD.applied_at THEN
    NEW.applied_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS import_batches_stamp_applied_at ON public.import_batches;
CREATE TRIGGER import_batches_stamp_applied_at
  BEFORE UPDATE OF applied_at ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.import_batches_stamp_applied_at();
