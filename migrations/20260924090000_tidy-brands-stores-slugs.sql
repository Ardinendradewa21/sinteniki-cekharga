-- Sprint 1 perapian data impor (keputusan pemilik produk 2026-09-24).
--
-- 1. Toko sebagai data, bukan teks bebas. Sebelumnya penawaran hanya menyimpan
--    `marketplace` berupa teks ("Situs resmi OPPO Indonesia", "Shopee"), jadi
--    logo, jenis toko, dan filter per toko harus menebak dari URL.
-- 2. Redirect slug lama. Slug yang membuang tanda "+" dan slug iQOO di bawah
--    vivo diganti; URL lama tetap berfungsi lewat redirect permanen.
-- 3. Dasar hak pakai foto terstruktur (PRD §6). Teks bebas "Izinkan" bukan
--    bukti yang bisa ditelusuri.
-- 4. Penulisan merek resmi: OPPO, realme, dan iQOO sebagai merek sendiri.
--
-- Diperiksa sebelum migrasi dibuat: 20 slug berubah (6 bertanda "+", 14 iQOO)
-- dan tidak satu pun bertabrakan dengan slug yang sudah ada.

-- ============================================================ stores
CREATE TABLE IF NOT EXISTS public.stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       TEXT NOT NULL CHECK (length(name) > 0),
  -- official = situs resmi merek; marketplace = platform banyak penjual;
  -- retailer = toko ritel satu penjual (Erafone, Digimap).
  kind       TEXT NOT NULL CHECK (kind IN ('official', 'marketplace', 'retailer')),
  -- Domain yang dikenali sebagai toko ini, termasuk subdomainnya.
  hosts      TEXT[] NOT NULL CHECK (cardinality(hosts) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS stores_updated_at ON public.stores;
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

INSERT INTO public.stores (slug, name, kind, hosts) VALUES
  ('shopee',           'Shopee',                        'marketplace', ARRAY['shopee.co.id']),
  ('tokopedia',        'Tokopedia',                     'marketplace', ARRAY['tokopedia.com', 'tokopedia.link']),
  ('blibli',           'Blibli',                        'marketplace', ARRAY['blibli.com']),
  ('tiktok-shop',      'TikTok Shop',                   'marketplace', ARRAY['tiktok.com']),
  ('lazada',           'Lazada',                        'marketplace', ARRAY['lazada.co.id']),
  ('erafone',          'Erafone',                       'retailer',    ARRAY['erafone.com']),
  ('digimap',          'Digimap',                       'retailer',    ARRAY['digimap.co.id']),
  ('oppo-resmi',       'Situs resmi OPPO Indonesia',    'official',    ARRAY['oppo.com']),
  ('samsung-resmi',    'Situs resmi Samsung Indonesia', 'official',    ARRAY['samsung.com']),
  ('xiaomi-resmi',     'Situs resmi Xiaomi Indonesia',  'official',    ARRAY['mi.co.id']),
  ('vivo-resmi',       'Situs resmi vivo Indonesia',    'official',    ARRAY['vivo.com']),
  ('iqoo-resmi',       'Situs resmi iQOO Indonesia',    'official',    ARRAY['iqoo.com']),
  ('infinix-resmi',    'Situs resmi Infinix Indonesia', 'official',    ARRAY['infinixmobility.com'])
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS offers_store_idx ON public.offers (store_id);

-- Isi store_id dari domain URL penawaran yang sudah ada.
UPDATE public.offers o
SET store_id = s.id
FROM public.stores s
WHERE o.store_id IS NULL
  AND EXISTS (
    SELECT 1 FROM unnest(s.hosts) AS h(host)
    WHERE lower(substring(o.url FROM '^https?://([^/:?#]+)')) = h.host
       OR lower(substring(o.url FROM '^https?://([^/:?#]+)')) LIKE '%.' || h.host
  );

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.stores FROM anon, authenticated;
DROP POLICY IF EXISTS stores_public_read ON public.stores;
CREATE POLICY stores_public_read ON public.stores
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================ product_slug_redirects
CREATE TABLE IF NOT EXISTS public.product_slug_redirects (
  old_slug   TEXT PRIMARY KEY CHECK (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_slug_redirects_product_idx
  ON public.product_slug_redirects (product_id);

ALTER TABLE public.product_slug_redirects ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.product_slug_redirects FROM anon, authenticated;
DROP POLICY IF EXISTS product_slug_redirects_public_read ON public.product_slug_redirects;
-- Sama seperti varian: redirect produk draft tidak boleh mengungkap produknya.
CREATE POLICY product_slug_redirects_public_read ON public.product_slug_redirects
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_slug_redirects.product_id AND p.status = 'published'
  ));

-- ============================================================ usage_basis
ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS usage_basis TEXT NOT NULL DEFAULT 'admin-declared'
  CHECK (usage_basis IN ('written-permission', 'own-work', 'public-license', 'admin-declared'));

-- Ilustrasi generik adalah karya proyek sendiri. Foto lain hanya punya
-- pernyataan admin tanpa bukti, jadi dicatat apa adanya sebagai itu.
UPDATE public.product_assets
SET usage_basis = 'own-work'
WHERE kind = 'generic-illustration' AND usage_basis = 'admin-declared';

-- ============================================================ merek dan slug
-- Redirect dulu, baru slug diganti.
INSERT INTO public.product_slug_redirects (old_slug, product_id)
SELECT slug, id FROM public.products
WHERE brand = 'vivo' AND model ~* '^iqoo\s'
ON CONFLICT (old_slug) DO NOTHING;

UPDATE public.products
SET brand = 'iQOO',
    model = regexp_replace(model, '^iqoo\s+', '', 'i'),
    slug  = regexp_replace(slug, '^vivo-iqoo-', 'iqoo-')
WHERE brand = 'vivo' AND model ~* '^iqoo\s';

INSERT INTO public.product_slug_redirects (old_slug, product_id)
SELECT slug, id FROM public.products
WHERE model LIKE '%+' AND slug NOT LIKE '%-plus'
ON CONFLICT (old_slug) DO NOTHING;

UPDATE public.products
SET slug = slug || '-plus'
WHERE model LIKE '%+' AND slug NOT LIKE '%-plus';

UPDATE public.products SET brand = 'OPPO'   WHERE brand = 'Oppo';
UPDATE public.products SET brand = 'realme' WHERE brand = 'Realme';

-- Teks alternatif foto mengikuti nama produk yang baru.
UPDATE public.product_assets a
SET alt = 'Foto ' || p.brand || ' ' || p.model
FROM public.products p
WHERE a.product_id = p.id
  AND a.kind = 'photo'
  AND a.alt LIKE 'Foto %'
  AND a.alt <> 'Foto ' || p.brand || ' ' || p.model;
