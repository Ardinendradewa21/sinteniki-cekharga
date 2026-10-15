# CekHarga

Alat bantu memilih smartphone untuk konsumen Indonesia: spesifikasi, harga per varian dengan waktu pemeriksaannya, penawaran toko, perbandingan, dan asisten Tanya AI. Dikelola PT Sinteniki Digital Solusi.

- Produksi: https://sinteniki-cekharga.vercel.app
- Kebutuhan produk: [docs/CekHarga_PRD_v2.md](docs/CekHarga_PRD_v2.md). Bila ada yang bertentangan, PRD yang menang.
- Aturan kerja untuk developer dan AI agent: [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md).

## Teknologi

Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4 + shadcn/ui, InsForge (Postgres, Auth, Storage, Schedules), OpenRouter untuk Tanya AI, Vercel untuk hosting. Paket dikelola dengan pnpm.

## Menjalankan di lokal

```bash
pnpm install
cp .env.example .env.local   # isi nilainya, penjelasan tiap variabel ada di file itu
pnpm dev                     # http://localhost:3000
```

Akun admin dibuat lewat skrip, bukan halaman pendaftaran:

```bash
node scripts/create-admin.mjs email@contoh.com          # kata sandi diminta di terminal
node --env-file=.env.local scripts/ganti-sandi-admin.mjs email@contoh.com
```

## Perintah pemeriksaan

| Perintah | Isi |
| --- | --- |
| `pnpm typecheck` | Pemeriksaan tipe TypeScript |
| `pnpm lint` | ESLint |
| `pnpm lint:unused` | Knip: file, export, dan dependensi yang tidak terpakai |
| `pnpm test` | Seluruh tes unit (impor, asisten, katalog) |
| `pnpm test:integration` | Tes integrasi ke database asli (data penanda `QAUji`, dibersihkan otomatis) |
| `pnpm test:assistant-eval` | Evaluasi Tanya AI dengan model sungguhan (memakai kuota OpenRouter) |
| `pnpm test:e2e` | Tes browser Playwright |
| `pnpm qa:sql` | Pemeriksaan integritas data (SQL, hanya baca) |
| `pnpm build` | Build produksi |

Panduan lengkap pengujian: [docs/qa/README.md](docs/qa/README.md).

## Peta folder

```
src/
  app/
    (public)/          halaman publik: beranda, products, compare, assistant, iklan, faq, ...
    admin/             login dan ruang kerja admin (produk, impor, iklan)
    api/               route handler: health, cron/daily, admin/import/worker, ads/*, auth/refresh
    robots.ts, sitemap.ts, ads.txt/
  components/
    ui/                komponen dasar shadcn/ui
    layout/            header, footer, navigasi
    home/ catalog/ product/ compare/ assistant/ ads/ admin/   komponen per fitur
  lib/
    catalog/           data katalog publik: kueri, harga, pencarian, warna, SEO
    assistant/         Tanya AI: kebutuhan, mesin rekomendasi, skor, kamus sinonim, kebijakan dialog
      ai/              panggilan model, prompt, kuota, state percakapan
    import/            Pusat Impor: CSV terpadu, galeri foto, antrean job, undo, laporan
    scrape/            tarik otomatis dari situs resmi dan GSMArena (scrape_jobs)
    admin/             aksi dan kueri admin produk, gerbang terbit, audit
    ads/               modul iklan (dibekukan sementara, lihat PB-10)
    backend/           klien InsForge, pembacaan berhalaman, cache katalog
    auth/              sesi dan peran staf (requireStaff)
migrations/            migrasi SQL berurutan waktu; perubahan skema selalu migrasi baru
scripts/               skrip operasional (buat admin, ganti sandi, evaluasi AI) dan tes (scripts/tests)
e2e/                   tes Playwright: public, security, admin
data/                  dataset contoh dan cadangan kurasi yang dirujuk SOP
public/                aset statis (ilustrasi perangkat, contoh iklan pratinjau)
docs/                  dokumentasi, lihat docs/README.md
```

Modul murni (tanpa jaringan dan database) diberi akhiran `-rules.ts` atau berdiri sendiri seperti `scoring.ts`, `hints.ts`, dan `dialog-policy.ts`, supaya aturan bisnisnya bisa diuji dengan `pnpm test`.

## Deploy

Production dibangun Vercel dari branch `main`. Langkah, variabel lingkungan, jadwal cron, dan worker ada di [docs/sop/SOP-DEPLOY-VERCEL.md](docs/sop/SOP-DEPLOY-VERCEL.md). Commit harus memakai email yang terhubung ke akun GitHub pemilik; kalau tidak, Vercel paket Hobby memblokir deploy dari repo privat.
