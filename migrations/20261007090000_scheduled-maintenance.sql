-- Pekerjaan terjadwal harian dan jejak asal foto (tindak lanjut audit Fase 5).
--
-- 1. origin 'schedule': batch harga yang dibuat pemeriksaan harga harian,
--    bukan oleh admin. Dipisah supaya riwayat dan retensi bisa membedakannya.
--
-- 2. refreshKey unik: cron Vercel tidak mencegah dua pemanggilan tumpang
--    tindih dan tidak mengulang yang gagal. Kunci "<merek>:<tanggal WIB>"
--    membuat pemeriksaan harga idempoten: pemanggilan kedua di hari yang sama
--    gagal di INSERT, bukan menulis harga ganda.
--
-- 3. product_assets.created_by_batch_id: foto yang DIBUAT antrean foto suatu
--    batch. Undo memakainya untuk menghapus foto galeri/utama baru dari batch
--    itu. Foto yang hanya diganti (update) tidak diberi tanda, karena isi
--    lamanya sudah tidak ada dan tidak bisa dikembalikan.

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_origin_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_origin_check CHECK (origin IN ('csv', 'scrape', 'schedule'));

CREATE UNIQUE INDEX IF NOT EXISTS import_batches_refresh_key_idx
  ON public.import_batches ((options->>'refreshKey'))
  WHERE options ? 'refreshKey';

-- Retensi batch terjadwal membaca berdasarkan origin dan umur.
CREATE INDEX IF NOT EXISTS import_batches_origin_created_idx
  ON public.import_batches (origin, created_at);

ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS created_by_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS product_assets_created_by_batch_idx
  ON public.product_assets (created_by_batch_id) WHERE created_by_batch_id IS NOT NULL;

-- Retensi antrean foto membaca job selesai berdasarkan umur.
CREATE INDEX IF NOT EXISTS photo_jobs_finished_idx
  ON public.photo_jobs (status, updated_at) WHERE status IN ('done', 'skipped', 'failed');
