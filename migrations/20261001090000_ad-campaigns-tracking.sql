-- Iklan sebagai produk bisnis: format native, targeting kontekstual, model
-- harga per kampanye, rate card, dan statistik harian (tayang + klik).
--
-- Metrik yang dipakai untuk tagihan:
-- - Tayangan = viewable impression (standar IAB/MRC): minimal 50% area iklan
--   terlihat selama minimal 1 detik. Iklan yang dirender tetapi tidak pernah
--   terlihat tidak dihitung.
-- - Klik = klik yang lewat pengalihan server /r/iklan/<id>, setelah penyaring
--   bot. Tidak ada cookie pelacak dan tidak ada data pribadi (UU PDP).

-- ============================================================ kampanye
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'display'
    CHECK (format IN ('display', 'native')),
  -- Format native: judul, deskripsi, ajakan, dan logo dirender CekHarga.
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS logo_src TEXT
    CHECK (logo_src IS NULL OR logo_src ~ '^(https://|/)'),
  -- Targeting kontekstual: tampil lebih dulu di halaman merek ini (tanpa data
  -- pengguna). Kosong = semua halaman.
  ADD COLUMN IF NOT EXISTS target_brands TEXT[] NOT NULL DEFAULT '{}',
  -- Kesepakatan bisnis (dari IO/PKS): model harga, tarif, dan kuota.
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'cpm'
    CHECK (pricing_model IN ('cpm', 'cpc', 'flat')),
  -- Rupiah: per 1.000 tayangan (cpm), per klik (cpc), atau total (flat).
  ADD COLUMN IF NOT EXISTS rate_idr BIGINT NOT NULL DEFAULT 0 CHECK (rate_idr >= 0),
  -- Kuota yang dipesan: jumlah tayangan (cpm) atau klik (cpc); null untuk flat.
  ADD COLUMN IF NOT EXISTS booked_quantity INTEGER CHECK (booked_quantity IS NULL OR booked_quantity > 0),
  -- Nomor Insertion Order / PKS sebagai rujukan tagihan.
  ADD COLUMN IF NOT EXISTS contract_ref TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- image_src wajib untuk display; native boleh tanpa gambar besar tapi wajib judul.
ALTER TABLE public.ad_campaigns ALTER COLUMN image_src DROP NOT NULL;
ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_creative_check;
ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_creative_check CHECK (
  (format = 'display' AND image_src IS NOT NULL)
  OR (format = 'native' AND headline IS NOT NULL AND length(headline) > 0)
);

-- ============================================================ rate card
CREATE TABLE IF NOT EXISTS public.ad_rate_card (
  placement     TEXT NOT NULL CHECK (placement IN ('rail', 'leaderboard', 'in-feed')),
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('cpm', 'cpc', 'flat')),
  -- Tarif dasar dalam Rupiah (per 1.000 tayangan, per klik, atau per minggu).
  rate_idr      BIGINT NOT NULL CHECK (rate_idr >= 0),
  min_order     TEXT,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (placement, pricing_model)
);

DROP TRIGGER IF EXISTS ad_rate_card_updated_at ON public.ad_rate_card;
CREATE TRIGGER ad_rate_card_updated_at BEFORE UPDATE ON public.ad_rate_card
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Tarif awal 0 = belum ditetapkan; diisi pemilik bisnis di halaman admin.
INSERT INTO public.ad_rate_card (placement, pricing_model, rate_idr, notes) VALUES
  ('rail',        'cpm',  0, 'Skyscraper 160×600, tampil di layar ≥1680 px'),
  ('rail',        'flat', 0, 'Sewa slot per minggu'),
  ('leaderboard', 'cpm',  0, '970×90 desktop, 320×100 ponsel'),
  ('leaderboard', 'flat', 0, 'Sewa slot per minggu'),
  ('in-feed',     'cpm',  0, 'Native/banner di sela hasil katalog'),
  ('in-feed',     'cpc',  0, 'Bayar per klik')
ON CONFLICT (placement, pricing_model) DO NOTHING;

ALTER TABLE public.ad_rate_card ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ad_rate_card FROM anon, authenticated;

-- ============================================================ statistik harian
CREATE TABLE IF NOT EXISTS public.ad_stats_daily (
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  -- Tanggal menurut zona Asia/Jakarta, supaya laporan cocok dengan invoice.
  day         DATE NOT NULL,
  placement   TEXT NOT NULL CHECK (placement IN ('rail', 'leaderboard', 'in-feed')),
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks      BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  PRIMARY KEY (campaign_id, day, placement)
);

ALTER TABLE public.ad_stats_daily ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ad_stats_daily FROM anon, authenticated;

-- Penambah penghitung atomik. Dipanggil hanya dari server dengan kunci admin;
-- hak eksekusi untuk anon/authenticated dicabut supaya tidak bisa dipalsukan
-- dari browser.
CREATE OR REPLACE FUNCTION public.record_ad_event(
  p_campaign_id UUID,
  p_placement TEXT,
  p_kind TEXT,
  p_count INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_kind NOT IN ('impression', 'click') OR p_count < 1 OR p_count > 50 THEN
    RAISE EXCEPTION 'Peristiwa iklan tidak valid';
  END IF;
  INSERT INTO public.ad_stats_daily (campaign_id, day, placement, impressions, clicks)
  VALUES (
    p_campaign_id,
    (now() AT TIME ZONE 'Asia/Jakarta')::date,
    p_placement,
    CASE WHEN p_kind = 'impression' THEN p_count ELSE 0 END,
    CASE WHEN p_kind = 'click' THEN p_count ELSE 0 END
  )
  ON CONFLICT (campaign_id, day, placement) DO UPDATE SET
    impressions = public.ad_stats_daily.impressions + EXCLUDED.impressions,
    clicks = public.ad_stats_daily.clicks + EXCLUDED.clicks;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_ad_event(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
