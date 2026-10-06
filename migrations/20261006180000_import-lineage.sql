-- Jejak asal data dan undo terbatas (rencana kerja impor, Fase 4).
--
-- Setiap produk, penawaran, dan catatan harga kini tahu dari mana ia datang:
--   created_by_batch_id  = batch yang membuatnya,
--   updated_by_batch_id  = batch terakhir yang memperbaruinya,
--   last_source          = 'import' (CSV), 'scrape' (tarik otomatis), atau
--                          'manual' (disunting langsung di admin).
-- Dengan ini pertanyaan "data ini dari impor mana?" bisa dijawab, dan undo
-- bisa menghapus hanya yang benar-benar dibuat oleh satu batch.
--
-- FK memakai ON DELETE SET NULL: menghapus batch tidak pernah menghapus data
-- katalog, hanya memutus jejaknya.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_by_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_source TEXT CHECK (last_source IN ('import', 'scrape', 'manual'));

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS created_by_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_source TEXT CHECK (last_source IN ('import', 'scrape', 'manual'));

ALTER TABLE public.price_observations
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.price_checks
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_created_batch_idx ON public.products (created_by_batch_id) WHERE created_by_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_updated_batch_idx ON public.products (updated_by_batch_id) WHERE updated_by_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS offers_created_batch_idx ON public.offers (created_by_batch_id) WHERE created_by_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS offers_updated_batch_idx ON public.offers (updated_by_batch_id) WHERE updated_by_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS price_observations_batch_idx ON public.price_observations (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS price_checks_batch_idx ON public.price_checks (batch_id) WHERE batch_id IS NOT NULL;

-- Status batch yang sudah dibatalkan lewat undo.
ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_status_check;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_status_check
  CHECK (status IN ('draft', 'queued', 'applying', 'applied', 'partial', 'failed', 'discarded', 'reverted'));

-- Catatan: undo memakai products.updated_at dan offers.updated_at untuk
-- memastikan baris belum disentuh setelah batch diterapkan. Kedua trigger
-- updated_at itu sudah dipasang sejak skema awal (create-catalog-schema).
