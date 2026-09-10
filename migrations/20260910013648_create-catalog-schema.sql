-- Skema katalog CekHarga (PRD §6, §7, §10).
--
-- Prinsip yang dikunci di level database, bukan cuma di kode:
--   1. NULL berarti "tidak diketahui", bukan nol. Karena itu tidak ada kolom
--      angka yang diberi DEFAULT 0.
--   2. Harga adalah integer Rupiah non-negatif (CHECK, bukan sekadar tipe).
--   3. Draft tidak boleh terbaca publik. Ditegakkan lewat RLS, bukan lewat
--      filter di aplikasi saja.
--   4. Import ulang tidak boleh menggandakan produk, jadi ada source_key unik.
--
-- Enum ditulis sebagai TEXT + CHECK supaya nilainya persis sama dengan enum Zod
-- di src/lib/catalog/schema.ts dan gampang ditambah tanpa migrasi tipe.

-- ============================================================ products
CREATE TABLE public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand         TEXT NOT NULL CHECK (length(brand) > 0),
  model         TEXT NOT NULL CHECK (length(model) > 0),

  -- Spesifikasi disimpan sebagai JSONB karena bentuknya memang masih berubah
  -- (sudah dua kali bertambah field) dan tidak pernah dipakai memfilter: filter
  -- katalog memakai brand, varian (RAM/penyimpanan), dan harga. Gerbang
  -- validasinya tetap satu, yaitu productSpecsSchema milik Zod di adapter.
  specs         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(specs) = 'object'),

  -- Provenance dipisah jadi kolom nyata, bukan JSONB: PRD §10 meminta asal data
  -- bisa ditelusuri, dan itu lebih baik dijaga tipe serta NOT NULL-nya.
  specs_source       TEXT NOT NULL CHECK (length(specs_source) > 0),
  specs_source_url   TEXT,
  specs_retrieved_at TIMESTAMPTZ NOT NULL,

  -- Kunci stabil dari sumber (mis. slug GSMArena). Dipakai supaya impor ulang
  -- memperbarui baris yang sama, bukan membuat produk kembar (PRD §10).
  source_key    TEXT UNIQUE,

  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_status_idx ON public.products (status);
CREATE INDEX products_brand_idx  ON public.products (brand);

-- ============================================================ variants
CREATE TABLE public.variants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ram_gb     INTEGER NOT NULL CHECK (ram_gb > 0),
  storage_gb INTEGER NOT NULL CHECK (storage_gb > 0),
  -- NULL = atribut pembeda tidak diketahui, bukan "tanpa garansi".
  region     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- PRD §6: jangan membuat kombinasi RAM/penyimpanan yang tidak tercantum.
  -- Unik agar varian yang sama tidak terdaftar dua kali.
  UNIQUE (product_id, ram_gb, storage_gb, region)
);

CREATE INDEX variants_product_idx ON public.variants (product_id);

-- ============================================================ product_assets
CREATE TABLE public.product_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES public.variants(id) ON DELETE SET NULL,
  -- 'generic-illustration' menandai gambar generik, bukan foto produk asli.
  kind         TEXT NOT NULL CHECK (kind IN ('photo', 'generic-illustration')),
  src          TEXT NOT NULL CHECK (length(src) > 0),
  alt          TEXT NOT NULL CHECK (length(alt) > 0),
  source       TEXT NOT NULL CHECK (length(source) > 0),
  source_url   TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL,
  -- PRD §6: hak penggunaan aset harus jelas sebelum dipakai.
  usage_rights TEXT NOT NULL CHECK (length(usage_rights) > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_assets_product_idx ON public.product_assets (product_id);

-- ============================================================ review_summaries
CREATE TABLE public.review_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id        UUID REFERENCES public.variants(id) ON DELETE SET NULL,
  channel_name      TEXT NOT NULL CHECK (length(channel_name) > 0),
  video_url         TEXT NOT NULL CHECK (video_url ~ '^https?://'),
  published_at      TIMESTAMPTZ NOT NULL,
  -- Detik ke titik relevan di video supaya klaim bisa diperiksa. NULL = belum dicatat.
  timestamp_seconds INTEGER CHECK (timestamp_seconds >= 0),
  aspect            TEXT NOT NULL CHECK (length(aspect) > 0),
  summary           TEXT NOT NULL CHECK (length(summary) > 0),
  strengths         TEXT[] NOT NULL DEFAULT '{}',
  limitations       TEXT[] NOT NULL DEFAULT '{}',
  test_context      TEXT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX review_summaries_product_idx ON public.review_summaries (product_id, status);

-- ============================================================ offers
CREATE TABLE public.offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id      UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
  marketplace     TEXT NOT NULL CHECK (length(marketplace) > 0),
  seller_name     TEXT NOT NULL CHECK (length(seller_name) > 0),
  url             TEXT NOT NULL CHECK (url ~ '^https?://'),
  -- Versi awal hanya kondisi baru (PRD §3).
  condition       TEXT NOT NULL DEFAULT 'new' CHECK (condition = 'new'),
  -- NULL = jenis garansi belum diketahui, bukan berarti tanpa garansi.
  warranty        TEXT,
  listing_status  TEXT NOT NULL CHECK (listing_status IN ('active', 'out-of-stock', 'ambiguous', 'inactive')),
  -- Badge terverifikasi hanya boleh true kalau ada bukti verifikasi (PRD FR-05).
  seller_verified BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offers_variant_idx ON public.offers (variant_id, listing_status);

-- ============================================================ price_observations
CREATE TABLE public.price_observations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  -- Rupiah, integer, tidak boleh negatif (PRD §6).
  price_idr   BIGINT NOT NULL CHECK (price_idr >= 0),
  -- Waktu pengamatan yang BERHASIL (PRD §7 butir 6).
  observed_at TIMESTAMPTZ NOT NULL,
  origin      TEXT NOT NULL CHECK (origin IN ('manual', 'automatic')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query terpenting: ambil pengamatan terbaru per penawaran.
CREATE INDEX price_observations_offer_idx ON public.price_observations (offer_id, observed_at DESC);

-- ============================================================ price_checks
CREATE TABLE public.price_checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  attempted_at  TIMESTAMPTZ NOT NULL,
  outcome       TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  -- Ringkasan error yang aman ditampilkan, tanpa detail internal.
  error_summary TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Percobaan gagal wajib punya alasan; percobaan berhasil tidak boleh punya.
  -- Ini menjaga agar waktu "berhasil terakhir" tidak pernah dikarang.
  CHECK (
    (outcome = 'failure' AND error_summary IS NOT NULL)
    OR (outcome = 'success' AND error_summary IS NULL)
  )
);

CREATE INDEX price_checks_offer_idx ON public.price_checks (offer_id, attempted_at DESC);

-- ============================================================ admin_audit
-- PRD §6 dan FR-07: perubahan penting dapat ditelusuri ke admin dan waktunya.
CREATE TABLE public.admin_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Disimpan terpisah supaya jejak tetap terbaca kalau akunnya dihapus.
  actor_email TEXT,
  operation   TEXT NOT NULL CHECK (length(operation) > 0),
  object_type TEXT NOT NULL CHECK (length(object_type) > 0),
  object_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_created_idx ON public.admin_audit (created_at DESC);

-- ============================================================ updated_at otomatis
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON public.variants
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER product_assets_updated_at BEFORE UPDATE ON public.product_assets
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER review_summaries_updated_at BEFORE UPDATE ON public.review_summaries
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ============================================================ RLS
--
-- Model aksesnya sederhana dan sengaja ketat:
--   - anon & authenticated : HANYA boleh membaca baris terpublikasi.
--   - menulis              : tidak seorang pun lewat API publik. Seluruh operasi
--                            admin berjalan di server memakai kunci admin
--                            (project_admin), yang melewati RLS.
--
-- InsForge memberi hak DML luas ke anon/authenticated secara default agar RLS
-- yang memutuskan baris. Karena itu hak tulisnya DICABUT dulu di bawah; kalau
-- tidak, kebijakan "tidak ada yang boleh menulis" hanya jadi niat baik.

ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_summaries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_checks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit        ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.products           FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.variants           FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_assets     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.review_summaries   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.offers             FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.price_observations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.price_checks       FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admin_audit FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.products           TO anon, authenticated;
GRANT SELECT ON public.variants           TO anon, authenticated;
GRANT SELECT ON public.product_assets     TO anon, authenticated;
GRANT SELECT ON public.review_summaries   TO anon, authenticated;
GRANT SELECT ON public.offers             TO anon, authenticated;
GRANT SELECT ON public.price_observations TO anon, authenticated;
GRANT SELECT ON public.price_checks       TO anon, authenticated;

-- Produk: hanya yang terpublikasi.
CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- Anak-anak produk ikut status induknya. Kalau produknya draft, variannya juga
-- tidak boleh bocor, karena nama varian saja sudah mengungkap produk belum rilis.
CREATE POLICY variants_public_read ON public.variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = variants.product_id AND p.status = 'published'
  ));

CREATE POLICY product_assets_public_read ON public.product_assets
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_assets.product_id AND p.status = 'published'
  ));

-- Review punya status sendiri: produk boleh terbit sementara reviewnya masih draft.
CREATE POLICY review_summaries_public_read ON public.review_summaries
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = review_summaries.product_id AND p.status = 'published'
    )
  );

CREATE POLICY offers_public_read ON public.offers
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = offers.variant_id AND p.status = 'published'
  ));

CREATE POLICY price_observations_public_read ON public.price_observations
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.variants v ON v.id = o.variant_id
    JOIN public.products p ON p.id = v.product_id
    WHERE o.id = price_observations.offer_id AND p.status = 'published'
  ));

CREATE POLICY price_checks_public_read ON public.price_checks
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.variants v ON v.id = o.variant_id
    JOIN public.products p ON p.id = v.product_id
    WHERE o.id = price_checks.offer_id AND p.status = 'published'
  ));

-- admin_audit sengaja tanpa policy apa pun: RLS aktif dan tidak ada kebijakan
-- yang mengizinkan, jadi anon/authenticated tidak bisa membacanya sama sekali.
-- Hanya project_admin (kunci server) yang bisa.
