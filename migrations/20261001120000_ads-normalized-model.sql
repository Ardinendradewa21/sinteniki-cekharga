-- Modul iklan: model data ternormalisasi sesuai docs/ads/ADS-CONTEXT.md §6.
--
-- Menggantikan tabel prototipe ad_campaigns, ad_stats_daily, dan ad_rate_card
-- (20260929 dan 20261001090000). Pada saat migrasi ini dibuat, ketiganya
-- kosong (rate card hanya berisi tarif 0). Pengaman di bawah membatalkan
-- migrasi bila ternyata sudah ada kampanye atau statistik.
--
-- Prinsip yang ditegakkan di skema:
-- - Uang selalu BIGINT rupiah.
-- - ad_events hanya berisi data anonim (tanpa IP mentah, email, identitas).
-- - Tabel iklan tidak dirujuk oleh tabel atau query katalog/harga.
-- - Publik (anon) hanya bisa membaca iklan yang sedang tayang lewat fungsi
--   ad_live_creatives(), tanpa tarif, kontrak, atau data advertiser lain.

DO $$
BEGIN
  IF to_regclass('public.ad_campaigns') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ad_campaigns) THEN
    RAISE EXCEPTION 'ad_campaigns berisi data; pindahkan dulu sebelum migrasi model baru';
  END IF;
  IF to_regclass('public.ad_stats_daily') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ad_stats_daily) THEN
    RAISE EXCEPTION 'ad_stats_daily berisi data; pindahkan dulu sebelum migrasi model baru';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.record_ad_event(UUID, TEXT, TEXT, INTEGER);
DROP TABLE IF EXISTS public.ad_stats_daily;
DROP TABLE IF EXISTS public.ad_rate_card;
DROP TABLE IF EXISTS public.ad_campaigns;

-- ============================================================ peran staf
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'sales', 'adops', 'finance', 'legal'));

-- ============================================================ advertisers
CREATE TABLE public.advertisers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT NOT NULL CHECK (length(company_name) > 0),
  -- Nama merek yang tampil di label iklan, mis. "Samsung".
  display_name    TEXT NOT NULL CHECK (length(display_name) > 0),
  npwp            TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  prospect_status TEXT NOT NULL DEFAULT 'lead'
                  CHECK (prospect_status IN ('lead', 'proposal', 'active', 'inactive')),
  -- Asal prospek: form di halaman /iklan atau input manual tim sales.
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('form', 'manual')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ contracts (PKS)
CREATE TABLE public.contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id   UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE RESTRICT,
  contract_number TEXT NOT NULL UNIQUE CHECK (length(contract_number) > 0),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  -- Berkas PKS bertanda tangan di bucket privat ad-contracts.
  signed_file_key TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'signed', 'ended', 'terminated')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX contracts_advertiser_idx ON public.contracts (advertiser_id);

-- ============================================================ insertion_orders
CREATE TABLE public.insertion_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  io_number     TEXT NOT NULL UNIQUE CHECK (length(io_number) > 0),
  campaign_name TEXT NOT NULL CHECK (length(campaign_name) > 0),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                  'draft', 'negotiation', 'approved', 'awaiting_payment',
                  'ready', 'live', 'completed', 'cancelled')),
  total_amount  BIGINT NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  tax_included  BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insertion_orders_contract_idx ON public.insertion_orders (contract_id);

-- ============================================================ ad_slots
CREATE TABLE public.ad_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  label         TEXT NOT NULL,
  page          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('banner', 'sponsored_listing')),
  desktop_size  TEXT CHECK (desktop_size IS NULL OR desktop_size ~ '^\d+x\d+$'),
  mobile_size   TEXT CHECK (mobile_size IS NULL OR mobile_size ~ '^\d+x\d+$'),
  -- Slot in-feed boleh menerima creative native (judul + gambar + logo).
  allows_native BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  fallback      TEXT NOT NULL DEFAULT 'none' CHECK (fallback IN ('adsense', 'gam', 'house', 'none')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ad_slots (code, label, page, kind, desktop_size, mobile_size, allows_native, is_active, sort_order) VALUES
  ('home_top',         'Beranda atas',              'Beranda',            'banner',            '728x90',   '320x100', false, true,  10),
  ('home_mid',         'Beranda tengah',            'Beranda',            'banner',            '970x250',  '300x250', false, true,  20),
  ('catalog_top',      'Katalog atas',              'Katalog',            'banner',            '970x90',   '320x100', false, true,  30),
  ('catalog_infeed',   'Katalog di sela hasil',     'Katalog',            'banner',            '1200x150', '320x100', true,  true,  40),
  ('search_sponsored', 'Sponsored listing katalog', 'Hasil pencarian',    'sponsored_listing', NULL,       NULL,      false, false, 50),
  ('product_sidebar',  'Detail produk samping',     'Detail produk',      'banner',            '300x250',  NULL,      false, true,  60),
  ('product_inline',   'Detail produk tengah',      'Detail produk',      'banner',            '728x90',   '320x50',  false, true,  70),
  ('compare_bottom',   'Perbandingan bawah',        'Halaman perbandingan','banner',           '728x90',   '320x50',  false, true,  80),
  ('rail_left',        'Rail kiri',                 'Semua halaman publik','banner',           '160x600',  NULL,      false, false, 90),
  ('rail_right',       'Rail kanan',                'Semua halaman publik','banner',           '160x600',  NULL,      false, false, 91);

-- ============================================================ line_items
CREATE TABLE public.line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id           UUID NOT NULL REFERENCES public.insertion_orders(id) ON DELETE CASCADE,
  slot_id         UUID NOT NULL REFERENCES public.ad_slots(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL DEFAULT '',
  pricing_model   TEXT NOT NULL CHECK (pricing_model IN ('flat', 'cpm', 'cpc')),
  -- Rupiah per 1.000 tayangan (cpm), per klik (cpc), atau total periode (flat).
  rate            BIGINT NOT NULL CHECK (rate >= 0),
  -- Target tayangan (cpm) atau klik (cpc); null untuk flat.
  target_quantity INTEGER CHECK (target_quantity IS NULL OR target_quantity > 0),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  -- Angka kecil = prioritas tinggi.
  priority        INTEGER NOT NULL DEFAULT 10 CHECK (priority BETWEEN 1 AND 100),
  -- Bobot rotasi antar line item berprioritas sama.
  weight          INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  -- Targeting kontekstual (merek halaman), tanpa data pengguna.
  target_brands   TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (pricing_model = 'flat' OR target_quantity IS NOT NULL)
);
CREATE INDEX line_items_io_idx ON public.line_items (io_id);
CREATE INDEX line_items_serving_idx ON public.line_items (slot_id, status, start_at, end_at);

-- ============================================================ creatives
CREATE TABLE public.creatives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id     UUID NOT NULL REFERENCES public.line_items(id) ON DELETE CASCADE,
  format           TEXT NOT NULL DEFAULT 'display' CHECK (format IN ('display', 'native')),
  image_url        TEXT CHECK (image_url IS NULL OR image_url ~ '^(https://|/)'),
  image_url_mobile TEXT CHECK (image_url_mobile IS NULL OR image_url_mobile ~ '^(https://|/)'),
  image_key        TEXT,
  alt_text         TEXT NOT NULL CHECK (length(alt_text) > 0),
  -- Sudah termasuk UTM dari advertiser.
  destination_url  TEXT NOT NULL CHECK (destination_url ~ '^https://'),
  headline         TEXT,
  body             TEXT,
  cta_label        TEXT,
  logo_url         TEXT CHECK (logo_url IS NULL OR logo_url ~ '^(https://|/)'),
  review_status    TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_note      TEXT,
  -- Checklist review yang dicentang Ad Ops (kategori terlarang, klaim, ukuran, tautan).
  review_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (format = 'display' AND image_url IS NOT NULL)
    OR (format = 'native' AND headline IS NOT NULL AND length(headline) > 0)
  )
);
CREATE INDEX creatives_line_item_idx ON public.creatives (line_item_id);
CREATE INDEX creatives_review_idx ON public.creatives (review_status);

-- ============================================================ ad_events
CREATE TABLE public.ad_events (
  id           BIGSERIAL PRIMARY KEY,
  creative_id  UUID NOT NULL REFERENCES public.creatives(id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES public.line_items(id) ON DELETE CASCADE,
  slot_id      UUID NOT NULL REFERENCES public.ad_slots(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  device       TEXT CHECK (device IN ('desktop', 'mobile')),
  -- Event mencurigakan ditandai, tidak dihapus, supaya bisa diaudit.
  is_bot       BOOLEAN NOT NULL DEFAULT false,
  -- hash(sesi anonim + creative + slot + jenis + menit); event ganda diabaikan.
  dedupe_key   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ad_events_report_idx ON public.ad_events (creative_id, event_type, created_at);
CREATE INDEX ad_events_line_item_idx ON public.ad_events (line_item_id, created_at);
CREATE UNIQUE INDEX ad_events_dedupe_idx ON public.ad_events (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ============================================================ ad_stats_daily (arsip ringkasan)
CREATE TABLE public.ad_stats_daily (
  day             DATE NOT NULL,
  creative_id     UUID NOT NULL REFERENCES public.creatives(id) ON DELETE CASCADE,
  line_item_id    UUID NOT NULL REFERENCES public.line_items(id) ON DELETE CASCADE,
  slot_id         UUID NOT NULL REFERENCES public.ad_slots(id) ON DELETE CASCADE,
  impressions     BIGINT NOT NULL DEFAULT 0,
  clicks          BIGINT NOT NULL DEFAULT 0,
  bot_impressions BIGINT NOT NULL DEFAULT 0,
  bot_clicks      BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, creative_id, slot_id)
);

-- Laporan harian (WIB): hari yang eventnya masih ada dihitung dari ad_events,
-- hari yang sudah diringkas diambil dari ad_stats_daily. Satu hari selalu ada
-- di salah satunya saja, karena ringkas dan hapus terjadi dalam satu transaksi.
CREATE VIEW public.ad_daily_report AS
SELECT
  (e.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
  e.creative_id,
  e.line_item_id,
  e.slot_id,
  count(*) FILTER (WHERE e.event_type = 'impression' AND NOT e.is_bot) AS impressions,
  count(*) FILTER (WHERE e.event_type = 'click' AND NOT e.is_bot) AS clicks,
  count(*) FILTER (WHERE e.event_type = 'impression' AND e.is_bot) AS bot_impressions,
  count(*) FILTER (WHERE e.event_type = 'click' AND e.is_bot) AS bot_clicks
FROM public.ad_events e
GROUP BY 1, 2, 3, 4
UNION ALL
SELECT day, creative_id, line_item_id, slot_id, impressions, clicks, bot_impressions, bot_clicks
FROM public.ad_stats_daily;

-- Ringkas event yang lebih tua dari masa retensi, lalu hapus event mentahnya.
CREATE OR REPLACE FUNCTION public.ad_rollup_and_purge(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_day DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date - p_retention_days;
  purged INTEGER;
BEGIN
  INSERT INTO public.ad_stats_daily
    (day, creative_id, line_item_id, slot_id, impressions, clicks, bot_impressions, bot_clicks)
  SELECT
    (created_at AT TIME ZONE 'Asia/Jakarta')::date,
    creative_id, line_item_id, slot_id,
    count(*) FILTER (WHERE event_type = 'impression' AND NOT is_bot),
    count(*) FILTER (WHERE event_type = 'click' AND NOT is_bot),
    count(*) FILTER (WHERE event_type = 'impression' AND is_bot),
    count(*) FILTER (WHERE event_type = 'click' AND is_bot)
  FROM public.ad_events
  WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date < cutoff_day
  GROUP BY 1, 2, 3, 4
  ON CONFLICT (day, creative_id, slot_id) DO UPDATE SET
    impressions = public.ad_stats_daily.impressions + EXCLUDED.impressions,
    clicks = public.ad_stats_daily.clicks + EXCLUDED.clicks,
    bot_impressions = public.ad_stats_daily.bot_impressions + EXCLUDED.bot_impressions,
    bot_clicks = public.ad_stats_daily.bot_clicks + EXCLUDED.bot_clicks;

  DELETE FROM public.ad_events
  WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date < cutoff_day;
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;

-- ============================================================ invoices
CREATE TABLE public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id           UUID NOT NULL REFERENCES public.insertion_orders(id) ON DELETE RESTRICT,
  invoice_number  TEXT NOT NULL UNIQUE CHECK (length(invoice_number) > 0),
  kind            TEXT NOT NULL CHECK (kind IN ('down_payment', 'final')),
  amount          BIGINT NOT NULL CHECK (amount >= 0),
  ppn_amount      BIGINT NOT NULL DEFAULT 0 CHECK (ppn_amount >= 0),
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  pph23_proof_url TEXT,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_io_idx ON public.invoices (io_id);

-- ============================================================ rate card
CREATE TABLE public.ad_rate_card (
  slot_id       UUID NOT NULL REFERENCES public.ad_slots(id) ON DELETE CASCADE,
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('flat', 'cpm', 'cpc')),
  rate          BIGINT NOT NULL DEFAULT 0 CHECK (rate >= 0),
  min_order     TEXT,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_id, pricing_model)
);
INSERT INTO public.ad_rate_card (slot_id, pricing_model)
SELECT id, model FROM public.ad_slots, unnest(ARRAY['cpm', 'flat']) AS model
WHERE kind = 'banner';

-- ============================================================ ads.txt & pengaturan
CREATE TABLE public.ads_txt_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_system_domain  TEXT NOT NULL CHECK (ad_system_domain ~ '^[a-z0-9.-]+$'),
  publisher_id      TEXT NOT NULL CHECK (publisher_id ~ '^[A-Za-z0-9._-]+$'),
  relationship      TEXT NOT NULL CHECK (relationship IN ('DIRECT', 'RESELLER')),
  cert_authority_id TEXT CHECK (cert_authority_id IS NULL OR cert_authority_id ~ '^[a-z0-9]+$'),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_system_domain, publisher_id)
);

CREATE TABLE public.ad_settings (
  key        TEXT PRIMARY KEY CHECK (key IN ('ppn_rate_percent', 'sales_email', 'sales_whatsapp', 'adsense_client')),
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.ad_settings (key, value) VALUES
  ('ppn_rate_percent', NULL), ('sales_email', NULL), ('sales_whatsapp', NULL), ('adsense_client', NULL);

-- ============================================================ penyajian publik
-- Satu-satunya pintu baca publik ke data iklan: creative yang sedang tayang,
-- tanpa tarif, kontrak, atau kontak advertiser. SECURITY DEFINER agar anon
-- tidak perlu hak baca langsung ke tabel-tabel di atas.
CREATE OR REPLACE FUNCTION public.ad_live_creatives()
RETURNS TABLE (
  creative_id      UUID,
  line_item_id     UUID,
  slot_code        TEXT,
  format           TEXT,
  image_url        TEXT,
  image_url_mobile TEXT,
  alt_text         TEXT,
  destination_url  TEXT,
  headline         TEXT,
  body             TEXT,
  cta_label        TEXT,
  logo_url         TEXT,
  advertiser_label TEXT,
  priority         INTEGER,
  weight           INTEGER,
  target_brands    TEXT[],
  remaining        BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH delivered AS (
    SELECT line_item_id, sum(impressions) AS impressions, sum(clicks) AS clicks
    FROM public.ad_daily_report
    GROUP BY line_item_id
  )
  SELECT
    c.id, li.id, s.code, c.format, c.image_url, c.image_url_mobile, c.alt_text,
    c.destination_url, c.headline, c.body, c.cta_label, c.logo_url,
    a.display_name, li.priority, li.weight, li.target_brands,
    CASE li.pricing_model
      WHEN 'cpm' THEN li.target_quantity - coalesce(d.impressions, 0)
      WHEN 'cpc' THEN li.target_quantity - coalesce(d.clicks, 0)
      ELSE NULL
    END
  FROM public.creatives c
  JOIN public.line_items li ON li.id = c.line_item_id
  JOIN public.ad_slots s ON s.id = li.slot_id
  JOIN public.insertion_orders io ON io.id = li.io_id
  JOIN public.contracts k ON k.id = io.contract_id
  JOIN public.advertisers a ON a.id = k.advertiser_id
  LEFT JOIN delivered d ON d.line_item_id = li.id
  WHERE c.review_status = 'approved'
    AND li.status = 'active'
    AND now() >= li.start_at AND now() < li.end_at
    AND io.status IN ('ready', 'live')
    AND s.is_active
    AND (c.format = 'display' OR s.allows_native)
$$;

-- Slot aktif untuk penyajian (ukuran + fallback), tanpa data bisnis.
CREATE OR REPLACE FUNCTION public.ad_active_slots()
RETURNS TABLE (code TEXT, desktop_size TEXT, mobile_size TEXT, fallback TEXT, allows_native BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code, desktop_size, mobile_size, fallback, allows_native FROM public.ad_slots WHERE is_active
$$;

-- ads.txt bersifat publik menurut standar IAB.
CREATE OR REPLACE FUNCTION public.ad_ads_txt()
RETURNS TABLE (ad_system_domain TEXT, publisher_id TEXT, relationship TEXT, cert_authority_id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ad_system_domain, publisher_id, relationship, cert_authority_id
  FROM public.ads_txt_entries WHERE is_active ORDER BY ad_system_domain, publisher_id
$$;

-- ============================================================ hak akses
DROP TRIGGER IF EXISTS advertisers_updated_at ON public.advertisers;
CREATE TRIGGER advertisers_updated_at BEFORE UPDATE ON public.advertisers FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER insertion_orders_updated_at BEFORE UPDATE ON public.insertion_orders FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER ad_slots_updated_at BEFORE UPDATE ON public.ad_slots FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER line_items_updated_at BEFORE UPDATE ON public.line_items FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER creatives_updated_at BEFORE UPDATE ON public.creatives FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER ad_rate_card_updated_at BEFORE UPDATE ON public.ad_rate_card FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER ad_settings_updated_at BEFORE UPDATE ON public.ad_settings FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.advertisers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insertion_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creatives        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_stats_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_rate_card     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_txt_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.advertisers, public.contracts, public.insertion_orders, public.ad_slots,
  public.line_items, public.creatives, public.ad_events, public.ad_stats_daily, public.invoices,
  public.ad_rate_card, public.ads_txt_entries, public.ad_settings, public.ad_daily_report
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ad_rollup_and_purge(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ad_live_creatives() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ad_active_slots() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ad_ads_txt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ad_live_creatives() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_active_slots() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_ads_txt() TO anon, authenticated;
