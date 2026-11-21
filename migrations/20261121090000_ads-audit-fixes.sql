-- Audit iklan 21 November 2026 (keputusan PO: perbaiki semua temuan sebelum
-- iklan dummy dipasang). Tiga perubahan, semuanya bisa dijalankan ulang:
--
-- F3  ad_close_expired_line_items(): line item yang lewat end_at ditandai
--     'ended' oleh cron harian. Penayangannya sudah berhenti karena jendela
--     waktu; yang diperbaiki adalah status di admin yang masih "Aktif".
-- F4  ad_live_creatives(): hitungan tayangan/klik untuk sisa target hanya
--     dihitung bagi line item CPM/CPC yang sedang tayang, lewat indeks
--     ad_events_line_item_idx. Sebelumnya fungsi ini menjumlah SELURUH event
--     90 hari setiap 60 detik. IO yang dihapus lunak ikut disaring.
-- F5  ad_record_events(): batas per sesi anonim (ADS-CONTEXT §8 butir 5).
--     Event di atas batas harian per creative tetap disimpan, tetapi
--     ditandai is_bot = true (tidak ditagihkan, tetap bisa diaudit).
--     session_tag = HMAC(IP + user agent + tanggal WIB), network_tag =
--     HMAC(IP + tanggal WIB). Keduanya dibuat di server dengan rahasia
--     ADS_EVENT_SECRET, berganti setiap hari, dan tidak bisa dibalik menjadi
--     IP; tidak ada IP mentah atau user agent yang disimpan (§11 butir 4).

-- ============================================================ F5: kolom tag
ALTER TABLE public.ad_events ADD COLUMN IF NOT EXISTS session_tag TEXT;
ALTER TABLE public.ad_events ADD COLUMN IF NOT EXISTS network_tag TEXT;
CREATE INDEX IF NOT EXISTS ad_events_session_tag_idx
  ON public.ad_events (session_tag, creative_id, event_type, created_at)
  WHERE session_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS ad_events_network_tag_idx
  ON public.ad_events (network_tag, creative_id, event_type, created_at)
  WHERE network_tag IS NOT NULL;

-- ============================================================ F5: pencatatan
-- p_events: larik objek {creative_id, line_item_id, slot_id, event_type,
-- device, is_bot, dedupe_key, session_tag, network_tag}. Maksimal 10 event per
-- panggilan (dibatasi di aplikasi). Mengembalikan jumlah baris yang tersimpan.
CREATE OR REPLACE FUNCTION public.ad_record_events(
  p_events            JSONB,
  p_session_impr_cap  INTEGER,
  p_session_click_cap INTEGER,
  p_network_impr_cap  INTEGER,
  p_network_click_cap INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev        JSONB;
  day_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
  is_click  BOOLEAN;
  flagged   BOOLEAN;
  seen      INTEGER;
  n         INTEGER;
  saved     INTEGER := 0;
BEGIN
  FOR ev IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    is_click := ev->>'event_type' = 'click';
    flagged := coalesce((ev->>'is_bot')::BOOLEAN, false);

    IF NOT flagged AND ev->>'session_tag' IS NOT NULL THEN
      SELECT count(*) INTO seen FROM public.ad_events
      WHERE session_tag = ev->>'session_tag'
        AND creative_id = (ev->>'creative_id')::UUID
        AND event_type = ev->>'event_type'
        AND created_at >= day_start
        AND NOT is_bot;
      flagged := seen >= CASE WHEN is_click THEN p_session_click_cap ELSE p_session_impr_cap END;
    END IF;

    IF NOT flagged AND ev->>'network_tag' IS NOT NULL THEN
      SELECT count(*) INTO seen FROM public.ad_events
      WHERE network_tag = ev->>'network_tag'
        AND creative_id = (ev->>'creative_id')::UUID
        AND event_type = ev->>'event_type'
        AND created_at >= day_start
        AND NOT is_bot;
      flagged := seen >= CASE WHEN is_click THEN p_network_click_cap ELSE p_network_impr_cap END;
    END IF;

    INSERT INTO public.ad_events
      (creative_id, line_item_id, slot_id, event_type, device, is_bot, dedupe_key, session_tag, network_tag)
    VALUES (
      (ev->>'creative_id')::UUID,
      (ev->>'line_item_id')::UUID,
      (ev->>'slot_id')::UUID,
      ev->>'event_type',
      ev->>'device',
      flagged,
      ev->>'dedupe_key',
      ev->>'session_tag',
      ev->>'network_tag'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
    saved := saved + n;
  END LOOP;
  RETURN saved;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ad_record_events(JSONB, INTEGER, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;

-- ============================================================ F3: tutup line item
CREATE OR REPLACE FUNCTION public.ad_close_expired_line_items()
RETURNS INTEGER
LANGUAGE sql
SET search_path = public
AS $$
  WITH closed AS (
    UPDATE public.line_items
    SET status = 'ended'
    WHERE status IN ('pending', 'active', 'paused') AND end_at <= now()
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM closed
$$;

REVOKE EXECUTE ON FUNCTION public.ad_close_expired_line_items() FROM PUBLIC, anon, authenticated;

-- ============================================================ F4 + saringan IO terhapus
-- Tanda tangan dan kolom hasil sama persis dengan versi lama, jadi hak akses
-- (GRANT ke anon/authenticated) tetap berlaku.
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
  WITH live AS (
    SELECT
      c.id AS creative_id, li.id AS line_item_id, s.code AS slot_code, c.format,
      c.image_url, c.image_url_mobile, c.alt_text, c.destination_url, c.headline,
      c.body, c.cta_label, c.logo_url, a.display_name AS advertiser_label,
      li.priority, li.weight, li.target_brands, li.pricing_model, li.target_quantity
    FROM public.creatives c
    JOIN public.line_items li ON li.id = c.line_item_id
    JOIN public.ad_slots s ON s.id = li.slot_id
    JOIN public.insertion_orders io ON io.id = li.io_id
    JOIN public.contracts k ON k.id = io.contract_id
    JOIN public.advertisers a ON a.id = k.advertiser_id
    WHERE c.review_status = 'approved'
      AND li.status = 'active'
      AND now() >= li.start_at AND now() < li.end_at
      AND io.status IN ('ready', 'live')
      AND io.deleted_at IS NULL
      AND s.is_active
      AND (c.format = 'display' OR s.allows_native)
  ),
  metered AS (
    SELECT DISTINCT line_item_id FROM live WHERE pricing_model IN ('cpm', 'cpc')
  ),
  delivered AS (
    SELECT t.line_item_id, sum(t.impressions)::BIGINT AS impressions, sum(t.clicks)::BIGINT AS clicks
    FROM (
      SELECT e.line_item_id,
             count(*) FILTER (WHERE e.event_type = 'impression' AND NOT e.is_bot) AS impressions,
             count(*) FILTER (WHERE e.event_type = 'click' AND NOT e.is_bot) AS clicks
      FROM public.ad_events e
      JOIN metered m ON m.line_item_id = e.line_item_id
      GROUP BY e.line_item_id
      UNION ALL
      SELECT d.line_item_id, d.impressions, d.clicks
      FROM public.ad_stats_daily d
      JOIN metered m ON m.line_item_id = d.line_item_id
    ) t
    GROUP BY t.line_item_id
  )
  SELECT
    l.creative_id, l.line_item_id, l.slot_code, l.format, l.image_url, l.image_url_mobile,
    l.alt_text, l.destination_url, l.headline, l.body, l.cta_label, l.logo_url,
    l.advertiser_label, l.priority, l.weight, l.target_brands,
    CASE l.pricing_model
      WHEN 'cpm' THEN (l.target_quantity - coalesce(d.impressions, 0))::BIGINT
      WHEN 'cpc' THEN (l.target_quantity - coalesce(d.clicks, 0))::BIGINT
      ELSE NULL
    END
  FROM live l
  LEFT JOIN delivered d ON d.line_item_id = l.line_item_id
$$;
