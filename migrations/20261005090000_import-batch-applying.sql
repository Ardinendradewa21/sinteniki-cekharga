-- Status penerapan batch impor yang jujur (rencana kerja impor, Fase 0.2).
--
-- Sebelumnya batch langsung ditandai 'applied' SEBELUM pekerjaannya dimulai.
-- Kalau proses mati di tengah (mis. batas waktu fungsi serverless), batch
-- tampak "Sudah diterapkan" tanpa laporan. Sekarang:
--   draft  -> applying (dikunci, started_at diisi)
--   applying -> applied (berhasil) | failed (gagal, laporan berisi galat)
--   failed -> applying (coba lagi) | discarded
-- Batch 'applying' yang lebih tua dari batas waktu boleh diklaim ulang.

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_status_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_status_check
  CHECK (status IN ('draft', 'applying', 'applied', 'failed', 'discarded'));

ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
