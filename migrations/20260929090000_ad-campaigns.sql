-- Kampanye iklan brand yang bekerja sama dengan CekHarga.
--
-- Iklan ditampilkan di slot tetap (rail kiri/kanan, leaderboard, in-feed),
-- selalu berlabel "Iklan" beserta nama pengiklan, dan TIDAK pernah memengaruhi
-- urutan, harga, atau rekomendasi produk (PRD §3 dan FR-08: tanpa peringkat,
-- dan kemitraan hanya boleh dinyatakan bila memang ada).
--
-- Hanya kampanye berstatus active dan sedang dalam periode tayang yang bisa
-- dibaca publik. Penulisan hanya lewat kunci admin di server.

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nama pengiklan yang tampil di label, mis. "Samsung Indonesia".
  advertiser   TEXT NOT NULL CHECK (length(advertiser) > 0),
  placement    TEXT NOT NULL CHECK (placement IN ('rail', 'leaderboard', 'in-feed')),
  -- Teks alternatif gambar sekaligus judul iklan.
  title        TEXT NOT NULL CHECK (length(title) > 0),
  image_src    TEXT NOT NULL CHECK (image_src ~ '^(https://|/)'),
  -- Versi mobile untuk leaderboard/in-feed (opsional).
  image_src_mobile TEXT CHECK (image_src_mobile IS NULL OR image_src_mobile ~ '^(https://|/)'),
  -- Key Storage bila gambar diunggah lewat admin, agar bisa dihapus.
  image_key    TEXT,
  target_url   TEXT NOT NULL CHECK (target_url ~ '^https://'),
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at      TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  -- Bobot rotasi bila beberapa kampanye berebut slot yang sama.
  weight       INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS ad_campaigns_live_idx
  ON public.ad_campaigns (placement, status, starts_at, ends_at);

DROP TRIGGER IF EXISTS ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.ad_campaigns FROM anon, authenticated;
DROP POLICY IF EXISTS ad_campaigns_public_read ON public.ad_campaigns;
CREATE POLICY ad_campaigns_public_read ON public.ad_campaigns
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );
