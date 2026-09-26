-- Batch pratinjau impor (Pusat Impor).
--
-- Sebelumnya impor CSV langsung menulis ke katalog, dan laporan baru muncul
-- sesudahnya; impor penawaran bahkan langsung mengubah harga publik. Sekarang
-- setiap impor (CSV maupun tarik otomatis) lebih dulu disimpan sebagai batch:
-- baris mentah + hasil penyeragaman per baris (baru / berubah / sama /
-- dilewati beserta alasannya). Admin meninjau tabelnya, lalu menerapkan baris
-- yang dipilih. Batch tersimpan, jadi bisa dibuka lagi, dan jejaknya bisa
-- diaudit.
--
-- Hanya kode server dengan kunci admin yang boleh membaca atau menulis kedua
-- tabel ini: RLS aktif tanpa policy apa pun, dan hak anon/authenticated dicabut.

CREATE TABLE IF NOT EXISTS public.import_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             TEXT NOT NULL CHECK (kind IN ('specs', 'offers')),
  origin           TEXT NOT NULL CHECK (origin IN ('csv', 'scrape')),
  -- Nama berkas atau "Tarik otomatis <merek>".
  source_label     TEXT NOT NULL CHECK (length(source_label) > 0),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'applied', 'discarded')),
  -- Pilihan saat unggah (hak pakai foto, nama toko default, waktu pengamatan).
  options          JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options) = 'object'),
  -- Baris mentah berkas, dipakai ulang saat diterapkan (maks. 500 baris).
  rows             JSONB NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
  malformed_lines  INTEGER[] NOT NULL DEFAULT '{}',
  -- Jumlah per aksi saat pratinjau dibuat, untuk daftar batch.
  counts           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Laporan hasil penerapan.
  report           JSONB,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_batches_created_idx ON public.import_batches (created_at DESC);

DROP TRIGGER IF EXISTS import_batches_updated_at ON public.import_batches;
CREATE TRIGGER import_batches_updated_at BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE IF NOT EXISTS public.import_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 0),
  entity      TEXT NOT NULL CHECK (entity IN ('product', 'offer')),
  action      TEXT NOT NULL CHECK (action IN ('create', 'update', 'unchanged', 'skip')),
  label       TEXT NOT NULL CHECK (length(label) > 0),
  -- Wajib untuk baris yang dilewati, supaya tidak ada baris hilang diam-diam.
  reason      TEXT,
  -- Baris mentah yang membentuk item ini (listing warna yang digabung ikut).
  row_indexes INTEGER[] NOT NULL DEFAULT '{}',
  -- Hasil penyeragaman untuk ditampilkan (merek, model, varian, harga, toko).
  view        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Perubahan terhadap data yang ada: [{ "field", "before", "after" }].
  changes     JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
  UNIQUE (batch_id, position),
  CHECK (action <> 'skip' OR reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS import_items_batch_idx ON public.import_items (batch_id, position);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items   ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.import_batches FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.import_items   FROM anon, authenticated;
