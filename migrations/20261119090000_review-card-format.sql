-- RV-02 (keputusan PO 19 November 2026): kartu ulasan "mudah dicerna".
--
-- Kolom baru, semuanya tambahan dan aman untuk kode lama:
--   verdict             "Intinya": satu kalimat kesimpulan reviewer (NULL = ulasan format lama)
--   good_for / not_for  label "Cocok untuk" / "Kurang cocok untuk", maks 3
--   strength_seconds    menit video per poin kelebihan, SEJAJAR dengan strengths
--   limitation_seconds  menit video per poin keterbatasan, SEJAJAR dengan limitations
--
-- Larik detik sejajar dipilih (bukan JSONB) supaya strengths/limitations tetap
-- TEXT[] dan pembaca lama (rangkuman perbandingan, Tanya AI) tidak berubah.
-- Larik kosong = tidak ada menit; NULL di dalam larik = poin itu tanpa menit.

ALTER TABLE public.review_summaries
  ADD COLUMN IF NOT EXISTS verdict TEXT,
  ADD COLUMN IF NOT EXISTS good_for TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS not_for TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS strength_seconds INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS limitation_seconds INTEGER[] NOT NULL DEFAULT '{}';

ALTER TABLE public.review_summaries DROP CONSTRAINT IF EXISTS review_summaries_card_format_check;
ALTER TABLE public.review_summaries
  ADD CONSTRAINT review_summaries_card_format_check CHECK (
    (verdict IS NULL OR length(verdict) BETWEEN 10 AND 200)
    AND cardinality(good_for) <= 3
    AND cardinality(not_for) <= 3
    AND cardinality(strength_seconds) IN (0, cardinality(strengths))
    AND cardinality(limitation_seconds) IN (0, cardinality(limitations))
  );
