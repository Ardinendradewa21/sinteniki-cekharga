-- Kunci identitas penawaran dan riwayat harga di level database.
--
-- Sebelumnya pencegahan duplikat hanya ada di kode impor ("cek dulu, lalu
-- tulis"). Dua impor yang berjalan bersamaan bisa lolos pengecekan yang sama
-- dan menulis baris kembar. Constraint di bawah membuat duplikat mustahil, dan
-- sekaligus memungkinkan impor menulis secara massal lewat upsert
-- (ON CONFLICT) alih-alih beberapa query berurutan per baris.
--
-- Sudah diperiksa sebelum migrasi ini dibuat: tidak ada baris kembar pada
-- keempat kunci di bawah, jadi pembuatan constraint tidak akan gagal.

-- Penawaran dikenali dari pasangan varian + URL listing (PRD §10).
ALTER TABLE public.offers
  ADD CONSTRAINT offers_variant_url_key UNIQUE (variant_id, url);

-- Satu pengamatan harga per penawaran per waktu pengamatan. Menggantikan
-- indeks non-unik lama dengan kolom yang sama; urutan DESC tidak diperlukan
-- karena btree bisa dipindai mundur.
ALTER TABLE public.price_observations
  ADD CONSTRAINT price_observations_offer_observed_key UNIQUE (offer_id, observed_at);
DROP INDEX IF EXISTS public.price_observations_offer_idx;

-- Satu catatan per penawaran, waktu percobaan, dan hasil. Prefiks
-- (offer_id, attempted_at) melayani query "pemeriksaan terakhir" yang dulu
-- dilayani price_checks_offer_idx.
ALTER TABLE public.price_checks
  ADD CONSTRAINT price_checks_offer_attempt_key UNIQUE (offer_id, attempted_at, outcome);
DROP INDEX IF EXISTS public.price_checks_offer_idx;

-- Varian: constraint lama tidak menahan duplikat ketika region NULL, karena
-- Postgres menganggap NULL selalu berbeda. NULLS NOT DISTINCT (Postgres 15+)
-- membuat "region tidak diketahui" dihitung sebagai satu nilai yang sama.
ALTER TABLE public.variants
  DROP CONSTRAINT IF EXISTS variants_product_id_ram_gb_storage_gb_region_key;
ALTER TABLE public.variants
  ADD CONSTRAINT variants_product_ram_storage_region_key
  UNIQUE NULLS NOT DISTINCT (product_id, ram_gb, storage_gb, region);
