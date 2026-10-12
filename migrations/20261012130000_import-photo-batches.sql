-- Batch impor galeri foto (2026-10-12).
--
-- Jenis batch ketiga di samping spesifikasi dan penawaran: berkas galeri foto
-- (satu baris = satu foto untuk satu model + warna). Alurnya sama dengan
-- impor lain: unggah, pratinjau per foto, terapkan (foto diantrekan ke
-- photo_jobs dengan jejak batch), dan undo.

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_kind_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_kind_check CHECK (kind IN ('specs', 'offers', 'photos'));

ALTER TABLE public.import_items DROP CONSTRAINT IF EXISTS import_items_entity_check;
ALTER TABLE public.import_items
  ADD CONSTRAINT import_items_entity_check CHECK (entity IN ('product', 'offer', 'photo'));
