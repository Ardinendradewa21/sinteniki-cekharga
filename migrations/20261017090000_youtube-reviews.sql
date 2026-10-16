-- Ulasan YouTube semi-otomatis (PB-40, keputusan PRD §3 17 Oktober 2026).
--
-- Sistem hanya MENCARIKAN video kandidat dari channel terpercaya; isi
-- ringkasan tetap ditulis admin di review_summaries. Alurnya:
--
--   review_channels   channel terpercaya yang dikelola admin
--   review_videos     unggahan channel itu (data YouTube API: ID, judul, tanggal)
--   review_candidates pasangan video x produk hasil pencocokan judul oleh kode
--   review_summaries  ringkasan tulisan admin (tabel lama, kini tahu asal videonya)
--   review_digests    cache rangkuman AI di halaman perbandingan
--
-- Sinkronisasi berjalan sebagai job `youtube` di scrape_jobs (aturan system
-- design 3), satu job per channel. Data YouTube yang tidak terlihat lagi lebih
-- dari 30 hari dihapus oleh job harian (YouTube API Services Developer
-- Policies); ringkasan admin tidak ikut terhapus.

-- ------------------------------------------------------------ channel
CREATE TABLE IF NOT EXISTS public.review_channels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle              TEXT NOT NULL UNIQUE CHECK (handle ~ '^[A-Za-z0-9._-]{3,100}$'),
  youtube_channel_id  TEXT UNIQUE,
  title               TEXT,
  uploads_playlist_id TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_synced_at      TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS review_channels_updated_at ON public.review_channels;
CREATE TRIGGER review_channels_updated_at BEFORE UPDATE ON public.review_channels
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Daftar dari pemilik produk, 17 Oktober 2026.
INSERT INTO public.review_channels (handle) VALUES
  ('GadgetIn'), ('JagatReview'), ('YoutuberCupu'), ('BestindotechYT'), ('PixaFocusID'), ('DKIDchannel')
ON CONFLICT (handle) DO NOTHING;

-- ------------------------------------------------------------- video
CREATE TABLE IF NOT EXISTS public.review_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT NOT NULL UNIQUE CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel_id       UUID NOT NULL REFERENCES public.review_channels(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (length(title) > 0),
  published_at     TIMESTAMPTZ NOT NULL,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_videos_seen_idx ON public.review_videos (last_seen_at);

-- --------------------------------------------------------- kandidat
CREATE TABLE IF NOT EXISTS public.review_candidates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id           UUID NOT NULL REFERENCES public.review_videos(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES public.products(id),
  suggested_aspect   TEXT NOT NULL DEFAULT 'umum' CHECK (suggested_aspect IN ('umum', 'kamera')),
  -- Judul memuat kata seperti "review", "unboxing", "vs": diurutkan lebih dulu.
  looks_like_review  BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'rejected')),
  source             TEXT NOT NULL DEFAULT 'otomatis' CHECK (source IN ('otomatis', 'manual')),
  decided_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_email   TEXT,
  decided_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Sinkronisasi berulang tidak membuat kandidat ganda (aturan system design 6).
  UNIQUE (video_id, product_id)
);

CREATE INDEX IF NOT EXISTS review_candidates_status_idx ON public.review_candidates (status, created_at DESC);

-- ---------------------------------------------- ringkasan (tabel lama)
ALTER TABLE public.review_summaries
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES public.review_candidates(id) ON DELETE SET NULL;

-- Aspek kini dua nilai tetap supaya halaman produk bisa memisahkan ulasan
-- keseluruhan dan ulasan kamera. Per 16 Oktober 2026 tabel ini masih kosong;
-- nilai lain (bila ada) dianggap ulasan umum.
UPDATE public.review_summaries SET aspect = 'umum' WHERE aspect NOT IN ('umum', 'kamera');
ALTER TABLE public.review_summaries DROP CONSTRAINT IF EXISTS review_summaries_aspect_check;
ALTER TABLE public.review_summaries
  ADD CONSTRAINT review_summaries_aspect_check CHECK (aspect IN ('umum', 'kamera'));

-- Satu ringkasan per video, produk, dan aspek.
CREATE UNIQUE INDEX IF NOT EXISTS review_summaries_video_unique
  ON public.review_summaries (youtube_video_id, product_id, aspect)
  WHERE youtube_video_id IS NOT NULL;

-- ------------------------------------------------- cache rangkuman AI
CREATE TABLE IF NOT EXISTS public.review_digests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hash produk + ID dan waktu ubah ringkasan yang dipakai: ringkasan berubah,
  -- kuncinya berubah, rangkuman lama otomatis tidak terpakai.
  cache_key   TEXT NOT NULL UNIQUE CHECK (length(cache_key) = 64),
  content     JSONB NOT NULL,
  model       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_digests_created_idx ON public.review_digests (created_at);

-- ------------------------------------------------- job sinkronisasi
ALTER TABLE public.scrape_jobs DROP CONSTRAINT IF EXISTS scrape_jobs_kind_check;
ALTER TABLE public.scrape_jobs
  ADD CONSTRAINT scrape_jobs_kind_check CHECK (kind IN ('lineup', 'resolve', 'youtube'));
ALTER TABLE public.scrape_jobs DROP CONSTRAINT IF EXISTS scrape_jobs_check;
ALTER TABLE public.scrape_jobs
  ADD CONSTRAINT scrape_jobs_check CHECK (
    kind = 'lineup'
    OR (kind = 'youtube' AND official_id IS NOT NULL)
    OR (session_id IS NOT NULL AND official_id IS NOT NULL)
  );

-- Satu job aktif per channel; mengantrekan ulang tidak menggandakan job.
CREATE UNIQUE INDEX IF NOT EXISTS scrape_jobs_youtube_active
  ON public.scrape_jobs (official_id)
  WHERE kind = 'youtube' AND status IN ('queued', 'running');

-- ------------------------------------------------------------- akses
ALTER TABLE public.review_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_digests ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.review_channels FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.review_videos FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.review_candidates FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.review_digests FROM anon, authenticated;
