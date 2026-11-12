# Sprint 16: sisa audit 002, rilis Sprint 12-15, pendaftaran publik ditutup

Dikerjakan 12 November 2026. Kode di branch `sprint-16/audit-002-sisa` (dari `main` setelah rilis Sprint 15).

## Rilis dan operasional

| Item | Hasil |
|---|---|
| Rilis Sprint 12, 13, 14, PB-48, Sprint 15 | `main` di-fast-forward ke commit "Sprint 15: perbaikan audit 002 di beranda" (e915b24) dan di-push atas persetujuan PO. Sebelumnya: build produksi lokal lulus, migrasi `20261021090000`-`20261021110000` dipastikan sudah terpasang di InsForge. Deploy Vercel produksi READY. |
| Smoke produksi | `/`, `/admin/login/lupa-sandi`, `/hp`, `/api/health`, `/sitemap.xml` 200. Beranda memuat "Cari HP menurut kebutuhan" dan "Harga varian acuan keduanya sama"; halaman masuk admin memuat tautan "Lupa kata sandi?". |
| Akun admin Sinteniki | Dibuat PO sendiri lewat `scripts/create-admin.mjs` (kata sandi tidak lewat chat). Terdaftar di `admin_users` dengan peran `admin`. Akun ini sementara; diganti saat email resmi Sinteniki tersedia. |
| Pendaftaran publik InsForge | Ditutup atas persetujuan PO: `auth.disable_signup = true` lewat `insforge config apply` (satu perubahan, tanpa `skipped`). `GET /api/auth/public-config` kini `disableSignup: true`. Akun admin baru tetap dibuat lewat `scripts/create-admin.mjs` (kunci admin), reset kata sandi tidak terpengaruh. |

## Tiket kode

| Tiket | Isi | Status |
|---|---|---|
| S16-1 (audit no 4) | `pickComparisonPairs(candidates, count)` memilih pasangan lintas merek yang tidak berbagi produk, dari harga paling berdekatan. Section contoh perbandingan memakai pasangan pertama (sama dengan pilihan lama), adegan "Bandingkan" di hero memakai pasangan kedua. Katalog yang hanya cukup untuk satu pasangan memakainya di keduanya. | Selesai |
| S16-2 (audit no 8) | Kartu contoh perbandingan tidak lagi memakai animasi masuk; langsung terlihat tanpa gulir. | Selesai |
| S16-3 (audit no 9) | Penanda "beda" di contoh perbandingan dicocokkan menurut label atribut, sama seperti hero. | Selesai |

## Hasil pemeriksaan

- Typecheck dan lint bersih. Unit test katalog 18/18 (1 tes baru: pasangan kedua terpisah).
- E2E publik terhadap build produksi lokal (`next start -p 3101`): 35 lolos, 2 dilewati, 10 timeout dengan 6 worker saat mesin sedang berat (halaman butuh ±1 menit). Kesepuluhnya diulang dengan `--last-failed --workers=1`: 9 lolos dalam 1 sampai 5 detik per tes, 1 dilewati (data uji tidak tersedia). Kegagalan karena beban, bukan kode.
- Chrome headless 375 px dan 1280 px: section perbandingan OPPO A6x vs Xiaomi Redmi 17, hero OPPO A6s vs vivo V50 Lite; kartu langsung `opacity: 1`; 4 penanda "beda"; tanpa error konsol.

## Temuan baru

- **Situs produksi belum bisa diindeks mesin pencari.** `robots.txt` produksi berisi `Disallow: /` dan `sitemap.xml` kosong, karena `SITE_URL` di Vercel (environment Production) kosong. Ini DEF-025 yang masih terbuka. `robots.txt` diprerender saat build, jadi setelah `SITE_URL` diisi `https://cekharga-id.vercel.app` wajib Redeploy. Akses API Vercel dari sesi ini ditolak (403) untuk membaca env, jadi langkah ini tetap di tangan PO.
- Kebijakan kata sandi InsForge masih minimal 6 karakter, sedangkan aplikasi (reset dan `create-admin.mjs`) memakai minimal 12. Disarankan menyamakan `auth.password.min_length` ke 12 lewat `config apply` (menunggu persetujuan PO).
