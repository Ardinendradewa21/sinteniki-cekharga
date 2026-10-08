-- Daftar pengecualian katalog (keputusan pemilik produk 2026-10-08).
--
-- Model yang tidak dijual di Indonesia (mis. seri OPPO K dan model khusus
-- pasar Tiongkok/India) dibuang dari katalog. Menghapus barisnya saja tidak
-- cukup: dataset GSMArena dan tarik otomatis akan memunculkannya lagi pada
-- impor berikutnya. Tabel ini menyimpan kunci sumbernya, dan perencana impor
-- spesifikasi melewati baris dengan kunci yang tercantum di sini beserta
-- alasannya.
--
-- Pengecualian bisa dicabut (mis. model itu akhirnya rilis di Indonesia)
-- dengan menghapus barisnya; impor berikutnya akan membuatnya lagi sebagai draft.

CREATE TABLE IF NOT EXISTS public.catalog_exclusions (
  -- Sama dengan products.source_key, mis. "gsmarena:oppo_k15_5g-14810".
  source_key       TEXT PRIMARY KEY CHECK (length(source_key) > 0),
  brand            TEXT NOT NULL CHECK (length(brand) > 0),
  model            TEXT NOT NULL CHECK (length(model) > 0),
  reason           TEXT NOT NULL CHECK (length(reason) > 0),
  created_by_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.catalog_exclusions FROM anon, authenticated;
