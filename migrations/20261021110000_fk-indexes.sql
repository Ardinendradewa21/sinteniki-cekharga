-- Indeks untuk foreign key yang dipakai filter atau tumbuh (audit Sprint 12,
-- 21 Oktober 2026). Tanpa indeks, filter per induk dan ON DELETE di induk
-- memindai seluruh tabel anak. Foreign key ke auth.users dan tabel yang tetap
-- kecil (catatan audit, sesi tarik) sengaja tidak diberi indeks.

CREATE INDEX IF NOT EXISTS review_candidates_product_idx ON public.review_candidates (product_id);
CREATE INDEX IF NOT EXISTS review_videos_channel_idx ON public.review_videos (channel_id);
CREATE INDEX IF NOT EXISTS review_summaries_variant_idx ON public.review_summaries (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_assets_variant_idx ON public.product_assets (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS photo_jobs_asset_idx ON public.photo_jobs (asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compare_pairs_product_a_idx ON public.compare_pairs (product_a);
CREATE INDEX IF NOT EXISTS compare_pairs_product_b_idx ON public.compare_pairs (product_b);
CREATE INDEX IF NOT EXISTS ad_events_slot_idx ON public.ad_events (slot_id, created_at);
CREATE INDEX IF NOT EXISTS ad_stats_daily_creative_idx ON public.ad_stats_daily (creative_id);
CREATE INDEX IF NOT EXISTS ad_stats_daily_line_item_idx ON public.ad_stats_daily (line_item_id);
