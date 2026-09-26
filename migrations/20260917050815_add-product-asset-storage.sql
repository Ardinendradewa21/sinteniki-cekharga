-- Simpan identitas objek Storage bersama URL publiknya. URL dipakai untuk
-- render, sedangkan key wajib tersedia agar objek bisa diganti atau dihapus
-- tanpa menebak path dari URL.
ALTER TABLE public.product_assets
  ADD COLUMN storage_key TEXT,
  ADD COLUMN original_url TEXT;

CREATE UNIQUE INDEX product_assets_storage_key_idx
  ON public.product_assets (storage_key)
  WHERE storage_key IS NOT NULL;
