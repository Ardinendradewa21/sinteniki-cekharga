-- Pasangan perbandingan pilihan admin untuk halaman "A vs B" (PB-28).
--
-- Halaman /bandingkan/{a}-vs-{b} hanya ada untuk pasangan yang dipilih admin,
-- bukan untuk setiap kombinasi produk, supaya tidak ada ribuan halaman tipis
-- dan tidak ada klaim "populer" tanpa data. Urutan pasangan disimpan apa
-- adanya (produk A tampil di kiri); pasangan yang sama dalam urutan terbalik
-- ditolak oleh indeks unik.

CREATE TABLE IF NOT EXISTS public.compare_pairs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_a        UUID NOT NULL REFERENCES public.products(id),
  product_b        UUID NOT NULL REFERENCES public.products(id),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (product_a <> product_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS compare_pairs_unique
  ON public.compare_pairs (LEAST(product_a, product_b), GREATEST(product_a, product_b));

ALTER TABLE public.compare_pairs ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.compare_pairs FROM anon, authenticated;
