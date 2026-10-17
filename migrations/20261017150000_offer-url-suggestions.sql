-- Usulan URL baru untuk penawaran situs resmi (PB-06, DEF-018).
--
-- Situs resmi seperti Samsung mengganti URL perwakilan model (warna/SKU) dari
-- waktu ke waktu. Pemeriksaan harga harian tetap mencocokkan penawaran lewat
-- nama model, tetapi sengaja tidak menimpa URL yang dulu dipilih admin.
-- Tabel ini menyimpan URL yang tercantum saat ini sebagai usulan; admin
-- memutuskan menerimanya (URL penawaran diganti) atau menolaknya.
--
-- Satu baris per penawaran. Pemeriksaan berikutnya memperbarui baris yang sama
-- (idempoten, aturan system design 6), dan menghapusnya bila URL tersimpan
-- tercantum lagi. `dismissed_url` mencegah URL yang sudah ditolak diusulkan
-- ulang; URL lain tetap diusulkan.

CREATE TABLE IF NOT EXISTS public.offer_url_suggestions (
  offer_id       UUID PRIMARY KEY REFERENCES public.offers(id) ON DELETE CASCADE,
  suggested_url  TEXT NOT NULL CHECK (suggested_url ~ '^https://'),
  seen_at        TIMESTAMPTZ NOT NULL,
  dismissed_url  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_url_suggestions_seen_idx ON public.offer_url_suggestions (seen_at DESC);

DROP TRIGGER IF EXISTS offer_url_suggestions_updated_at ON public.offer_url_suggestions;
CREATE TRIGGER offer_url_suggestions_updated_at BEFORE UPDATE ON public.offer_url_suggestions
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.offer_url_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.offer_url_suggestions FROM anon, authenticated;
