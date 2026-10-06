-- Sesi tarik otomatis disimpan di server (rencana kerja impor, Fase 3.1).
--
-- Sebelumnya daftar model, harga resmi, dan hasil spesifikasi hanya hidup di
-- memori browser, lalu DIKIRIM BALIK oleh browser saat disimpan. Akibatnya:
--   * refresh tab menghilangkan seluruh hasil tarik;
--   * server memercayai harga "resmi" yang datang dari browser (bisa diubah);
--   * harga dicap dengan waktu klik Kirim, bukan waktu harga diambil.
-- Sekarang daftar dan hasil disimpan di sini; browser hanya mengirim ID model
-- dan pilihan admin, dan server membangun batch dari data yang ia simpan sendiri.

CREATE TABLE IF NOT EXISTS public.scrape_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand            TEXT NOT NULL CHECK (length(brand) > 0),
  -- Daftar model + harga persis seperti diambil dari situs resmi/GSMArena.
  lineup           JSONB NOT NULL CHECK (jsonb_typeof(lineup) = 'array'),
  -- Kapan daftar dan harganya diambil; dipakai sebagai waktu pengamatan harga.
  fetched_at       TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'committed')),
  batch_id         UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scrape_sessions_recent_idx ON public.scrape_sessions (created_at DESC);

-- Satu baris per model per sesi; upsert per model menghindari tabrakan saat
-- beberapa model diambil berurutan atau diulang.
CREATE TABLE IF NOT EXISTS public.scrape_results (
  session_id  UUID NOT NULL REFERENCES public.scrape_sessions(id) ON DELETE CASCADE,
  official_id TEXT NOT NULL CHECK (length(official_id) > 0),
  -- Hasil pratinjau (PreviewItem) bila berhasil.
  item        JSONB,
  error       TEXT,
  blocked     BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, official_id),
  CHECK (item IS NOT NULL OR error IS NOT NULL)
);

DROP TRIGGER IF EXISTS scrape_sessions_updated_at ON public.scrape_sessions;
CREATE TRIGGER scrape_sessions_updated_at BEFORE UPDATE ON public.scrape_sessions
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.scrape_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_results  ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.scrape_sessions FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.scrape_results  FROM anon, authenticated;
