-- Daftar admin CekHarga (PRD FR-07 dan §10).
--
-- Kenapa perlu tabel terpisah, bukan sekadar "sudah login = admin"?
--
-- InsForge Auth membolehkan siapa pun mendaftar. Kalau otorisasi hanya
-- mengandalkan status login, siapa pun yang membuat akun langsung memegang
-- kendali data katalog. Karena itu "terautentikasi" dan "berwenang" dipisah:
-- login membuktikan siapa kamu, keanggotaan tabel ini membuktikan kamu boleh
-- apa. FR-07 mensyaratkan pengguna biasa tidak dapat membaca maupun mengubah
-- data admin lewat API.
--
-- Tabel ini TIDAK punya policy untuk anon maupun authenticated, dan haknya
-- dicabut. Artinya daftar admin tidak bisa dibaca dari klien sama sekali;
-- hanya kode server dengan kunci admin yang bisa memeriksanya.

CREATE TABLE public.admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Disalin saat pemberian akses supaya jejak audit tetap terbaca kalau
  -- akunnya kelak dihapus.
  email      TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;
