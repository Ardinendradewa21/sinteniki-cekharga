-- Ringkasan harga per penawaran di database (rencana kerja impor, Fase 5.1).
--
-- Katalog publik dulu menarik SELURUH riwayat price_observations dan
-- price_checks lalu memangkasnya di JavaScript. Riwayat itu terus bertambah
-- setiap impor, sementara aturan harga (PRD §7) hanya butuh:
--   * pengamatan harga terbaru per penawaran, dan
--   * pemeriksaan BERHASIL terakhir per penawaran.
-- Dua view ini menghitungnya di database (DISTINCT ON + indeks
-- (offer_id, observed_at/attempted_at DESC) yang sudah ada), jadi yang
-- dikirim ke aplikasi hanya satu baris per penawaran.
--
-- security_invoker = true: view dijalankan dengan hak PEMANGGIL, sehingga RLS
-- tabel dasar (hanya harga milik produk terbit untuk anon) tetap berlaku.
-- Tanpa opsi ini view memakai hak pemiliknya dan melewati RLS.

CREATE OR REPLACE VIEW public.offer_latest_price
WITH (security_invoker = true) AS
SELECT DISTINCT ON (offer_id)
  id, offer_id, price_idr, observed_at, origin
FROM public.price_observations
ORDER BY offer_id, observed_at DESC, id;

CREATE OR REPLACE VIEW public.offer_last_success_check
WITH (security_invoker = true) AS
SELECT DISTINCT ON (offer_id)
  id, offer_id, attempted_at, outcome, error_summary
FROM public.price_checks
WHERE outcome = 'success'
ORDER BY offer_id, attempted_at DESC, id;

REVOKE ALL ON public.offer_latest_price, public.offer_last_success_check FROM PUBLIC;
GRANT SELECT ON public.offer_latest_price, public.offer_last_success_check TO anon, authenticated;
