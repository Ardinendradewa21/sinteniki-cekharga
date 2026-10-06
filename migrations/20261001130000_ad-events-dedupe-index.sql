-- Ganti indeks unik parsial dedupe_key menjadi indeks unik biasa.
--
-- Alasan: PostgREST `upsert(..., { onConflict: "dedupe_key", ignoreDuplicates: true })`
-- menghasilkan `ON CONFLICT (dedupe_key) DO NOTHING` tanpa predikat WHERE,
-- sehingga Postgres tidak bisa memakai indeks parsial dan menolak query.
-- Indeks unik biasa tetap mengizinkan banyak baris dengan dedupe_key NULL
-- (NULL tidak dianggap sama), jadi perilaku bisnisnya tidak berubah.

DROP INDEX IF EXISTS public.ad_events_dedupe_idx;
CREATE UNIQUE INDEX ad_events_dedupe_idx ON public.ad_events (dedupe_key);
