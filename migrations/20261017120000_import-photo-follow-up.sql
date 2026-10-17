-- CSV gabungan (Sprint 8, 17 Oktober 2026): satu berkas boleh berisi baris
-- spesifikasi, penawaran, dan foto. Baris foto disimpan sebagai baris mentah
-- lanjutan (role follow_up_photo) dan menjadi batch galeri setelah tahap
-- sebelumnya (produk atau penawaran) diterapkan, sama seperti penawaran
-- lanjutan (role follow_up).

ALTER TABLE public.raw_listings DROP CONSTRAINT IF EXISTS raw_listings_role_check;
ALTER TABLE public.raw_listings
  ADD CONSTRAINT raw_listings_role_check CHECK (role IN ('upload', 'row', 'follow_up', 'follow_up_photo'));
