-- Catatan hasil pemeriksaan harga harian per merek (PB-05).
--
-- Sebelumnya kegagalan membaca situs resmi hanya masuk log server, jadi admin
-- tidak tahu bila harga satu merek berhenti diperbarui. Satu baris per merek
-- per tanggal WIB; pemanggilan ulang di hari yang sama memperbarui baris yang
-- sama (idempoten, aturan system design 6). Dasbor admin membaca tabel ini
-- untuk menampilkan peringatan.

CREATE TABLE IF NOT EXISTS public.price_refresh_runs (
  brand            TEXT NOT NULL CHECK (length(brand) > 0),
  run_date         DATE NOT NULL,
  status           TEXT NOT NULL
                   CHECK (status IN ('queued', 'nothing-to-update', 'no-offers', 'source-error', 'blocked', 'error')),
  message          TEXT,
  batch_id         UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  updated_count    INTEGER NOT NULL DEFAULT 0,
  missing_count    INTEGER NOT NULL DEFAULT 0,
  ambiguous_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, run_date)
);

CREATE INDEX IF NOT EXISTS price_refresh_runs_date_idx ON public.price_refresh_runs (run_date DESC);

DROP TRIGGER IF EXISTS price_refresh_runs_updated_at ON public.price_refresh_runs;
CREATE TRIGGER price_refresh_runs_updated_at BEFORE UPDATE ON public.price_refresh_runs
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.price_refresh_runs ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.price_refresh_runs FROM anon, authenticated;
