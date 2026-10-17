# Product Backlog — CekHarga

Diperbarui 2026-10-16 (Sprint 5: PB-31, PB-36, PB-33 selesai; Sprint 4: PB-28 dan PB-29 selesai; Sprint 3 selesai untuk item kode; PB-37 sampai PB-39 dari rancangan Tanya AI; PB-23 sampai PB-36 dari audit kode dan analisis pesaing; rinciannya di `docs/RENCANA-PENGEMBANGAN-2026-10.md`). Pemilik: Product Owner. Diurutkan dengan **WSJF** (Weighted Shortest Job First):

> WSJF = (Nilai bisnis + Urgensi waktu + Pengurangan risiko) ÷ Ukuran

Setiap komponen dinilai dengan skala Fibonacci (1, 2, 3, 5, 8, 13). Angka WSJF dipakai sebagai bahan diskusi saat Backlog Refinement, bukan keputusan otomatis: PO tetap bisa menggeser urutan dengan alasan yang dicatat.

## Backlog berprioritas

| # | ID | Item | Sumber | Nilai | Urgensi | Risiko | Ukuran | WSJF | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PB-11 | Ganti kata sandi akun admin utama (pernah dibagikan lewat chat) | Audit keamanan | 5 | 8 | 13 | 1 | **26.0** | ✅ Selesai 2026-10-15: akun admin baru dengan email pemilik, akses akun lama dicabut dan tercatat di audit |
| 2 | PB-01 | Deploy ke Vercel; isi `CRON_SECRET` dan `IMPORT_WORKER_SECRET`; jadwal worker per menit di InsForge | US-10, TEST-PLAN §4 | 13 | 8 | 8 | 3 | **9.7** | ✅ Sebagian 2026-10-16: deploy Vercel (region sin1), CRON_SECRET berjalan; jadwal worker per menit belum dibuat (opsional sejak cron 300 detik) |
| 3 | PB-05 | Peringatan di dasbor bila pemeriksaan harian sebuah merek gagal | US-33 | 5 | 5 | 8 | 3 | **6.0** | ✅ Selesai 2026-10-16 (Sprint 3): tabel `price_refresh_runs` + peringatan dasbor |
| 4 | PB-08 | Remote git + CI (unit, integrasi di staging, E2E smoke setiap PR); pindahkan register defect ke issue tracker | TEST-PLAN §3 | 5 | 3 | 8 | 3 | **5.3** | ✅ Sebagian 2026-10-17 (Sprint 8): GitHub Actions `.github/workflows/ci.yml` (typecheck, lint, tes unit, knip) di setiap push ke main dan PR. Sisa: integrasi di staging (butuh PB-09) dan E2E smoke (butuh akun QA) |
| 5 | PB-03 | Lengkapi penawaran untuk 29 produk terbit tanpa harga (tarik ulang atau CSV) | SQL-11 | 8 | 5 | 3 | 3 | **5.3** | Siap (tugas data) |
| 6 | PB-04 | Lengkapi NFC/IP rating untuk 34 produk terbit | US-25 | 5 | 3 | 2 | 3 | **3.3** | Siap |
| 7 | PB-09 | Lingkungan uji terpisah (InsForge branch) | US-32 | 3 | 3 | 8 | 5 | **2.8** | Perlu refinement |
| 8 | PB-06 | Tandai dan perbarui URL penawaran resmi yang berganti (Samsung) | US-26, DEF-015 | 3 | 2 | 3 | 3 | **2.7** | Siap |
| 9 | PB-07 | Tanya AI Sprint B | Rencana Tanya AI | 8 | 2 | 2 | 8 | **1.5** | Digantikan PB-37 sampai PB-39 (rancangan ulang Tanya AI, selesai) |
| 10 | PB-02 | Pemeriksaan ulang harga marketplace (69 penawaran > 7 hari) | US-12, SQL-12 | 8 | 5 | 3 | 13 | **1.2** | Perlu refinement (izin sumber) |
| 11 | PB-12 | Structured data `Product` + `Offer`/`AggregateOffer` di halaman detail (tanpa `aggregateRating`/`review` karangan, AGENTS.md) dan uji Rich Results | UX-22 | 8 | 3 | 3 | 3 | **4.7** | ✅ Selesai 2026-10-14 bersama PB-23; uji Rich Results setelah deploy |
| 12 | PB-13 | Konfirmasi nama badan hukum (PT Sinteniki vs PT Sinteniki Digital Solusi) lalu seragamkan situs dan dokumen | UX-23 | 3 | 5 | 5 | 1 | **13.0** | ✅ Selesai 2026-10-08 |
| 13 | PB-14 | Selaraskan batas harga segar dengan jadwal cron (±30 jam atau cron 2×/hari) | UX-24 | 5 | 3 | 3 | 1 | **11.0** | ✅ Selesai 2026-10-08 (30 jam) |
| 14 | PB-15 | Gerbang terbit: tombol Terbitkan menolak produk tanpa varian atau tanpa penawaran aktif, dengan alasan yang jelas (SOP impor §7). Per 2026-10-08 ada 29 produk terbit tanpa penawaran | SOP-IMPOR §10 | 5 | 5 | 3 | 2 | **6.5** | ✅ Selesai 2026-10-15 (Sprint 2): satuan dan massal |
| 15 | PB-16 | Tarik otomatis "harga saja" untuk produk katalog yang sudah ada: membuat penawaran resmi dari lineup tanpa menarik ulang spesifikasi GSMArena (yang sering terkena Turnstile) | SOP-IMPOR §5.1 | 8 | 5 | 5 | 3 | **6.0** | ✅ Selesai 2026-10-16 (Sprint 3): blok "Perbarui harga saja" di Tarik otomatis |
| 16 | PB-17 | Sumber harga e-commerce yang sah (program afiliasi marketplace atau kerja sama toko). Saat ini Shopee/Erafone hanya lewat CSV dan basi setelah 30 jam | SOP-IMPOR §5.1 | 8 | 5 | 5 | 8 | **2.3** | Perlu riset bisnis (urgensi dinaikkan 2026-10-13: juga menjawab beban input manual) |
| 17 | PB-18 | Masalah awal: Soft delete (`deleted_at`) untuk produk, toko, dan kampanye iklan; hapus produk tidak lagi menghanyutkan `price_observations`/`price_checks` lewat ON DELETE CASCADE. Kurasi 2026-10-08 masih hard delete (cadangan di `data/backups/`) | Aturan SD-8 | 8 | 8 | 8 | 5 | **4.8** | ✅ Selesai 2026-10-09 |
| 18 | PB-19 | Masalah awal: Tarik otomatis sebagai background job: `loadLineupAction` dan `resolveModelAction` (kini dihapus) mengambil situs resmi/GSMArena di dalam request admin. Pindahkan ke tabel `scrape_jobs` + worker, UI hanya membaca status. Bagian impor CSV SELESAI 2026-10-11: analisis unggahan di worker (status `analyzing`), baris mentah per baris di `raw_listings` dengan retensi 30 hari | Aturan SD-3 | 5 | 3 | 8 | 5 | **3.2** | ✅ Selesai 2026-10-11: tabel `scrape_jobs` + worker; commit tarik otomatis juga dianalisis di worker |
| 19 | PB-20 | Masalah awal: Hapus pola N+1: detail produk admin membaca 2 query per penawaran (`admin/queries.ts`), dan penulisan per baris di `jobs.ts` (hasil item), `spec-runner.ts` (update produk), `offer-runner.ts` (update harga). Ganti dengan `.in()` + view, atau RPC update massal | Aturan SD-4 | 5 | 3 | 5 | 3 | **4.3** | ✅ Selesai 2026-10-11: RPC massal untuk produk, penawaran, harga, dan hasil item; detail produk admin 2 query total lewat view `offer_recent_checks`. Jalur satu per satu yang tersisa hanya cadangan saat insert massal gagal, untuk menemukan baris penyebabnya |
| 20 | PB-21 | Masalah awal: Asisten AI: kuota harian (per IP dan total) di store bersama, bukan memori proses; retry 1x dengan backoff untuk 429/5xx (sekarang `maxRetries: 0`), fallback ke form tetap | Aturan SD-1, SD-7 | 5 | 5 | 8 | 2 | **9.0** | ✅ Selesai 2026-10-09 |
| 21 | PB-22 | Masalah awal: `politeFetch` (situs resmi/GSMArena): retry terbatas dengan backoff untuk galat jaringan dan 5xx; 403/429/Turnstile tetap berhenti tanpa retry | Aturan SD-7 | 3 | 3 | 5 | 2 | **5.5** | ✅ Selesai 2026-10-10 |
| 22 | PB-23 | SEO halaman produk dan katalog: judul "Harga {produk} Terbaru {bulan} – Mulai Rp… di n Toko", deskripsi dengan varian acuan dan waktu periksa, canonical, Open Graph; dikerjakan bersama PB-12 | Audit 2026-10-13, analisis BigGo | 8 | 5 | 3 | 2 | **8.0** | ✅ Selesai 2026-10-14 (Sprint 1); canonical aktif setelah `SITE_URL` diisi saat deploy |
| 23 | PB-24 | Kebersihan kode: hapus folder kosong `src/app/products/[slug]`, tes E2E menghapus batch ujinya, simpan pengaturan iklan secara atomik (RPC, bukan loop) | Audit 2026-10-13 | 2 | 2 | 3 | 2 | **3.5** | ✅ Selesai 2026-10-14, kecuali simpan pengaturan iklan atomik: ditunda sampai modul iklan dibuka (PB-10) |
| 24 | PB-25 | Tinjau dua `eslint-disable react-hooks/exhaustive-deps` (`batch-progress.tsx`, `scrape-workbench.tsx`): perbaiki atau tulis alasannya | Audit 2026-10-13 | 2 | 1 | 3 | 1 | **6.0** | ✅ Selesai 2026-10-14: diganti `useEffectEvent` (React 19.2), 0 `eslint-disable` tersisa |
| 25 | PB-26 | Impor data Xiaomi Okt 2026 (templat terpadu + galeri foto); perbaiki RAM 17 Ultra lebih dulu | Data pemilik produk | 8 | 5 | 2 | 1 | **15.0** | ✅ Selesai 2026-10-15: spreadsheet dirapikan dan diunggah ulang admin |
| 26 | PB-27 | Filter "hanya garansi resmi Indonesia" dan "sembunyikan stok habis" (filter pilihan pengguna, bukan aturan katalog) + normalisasi teks garansi saat impor | Analisis BigGo | 5 | 2 | 2 | 3 | **3.0** | ✅ Sebagian 2026-10-16 (Sprint 3): filter di halaman produk + normalisasi garansi; filter katalog menunggu data garansi |
| 27 | PB-28 | Halaman perbandingan "A vs B" untuk pasangan pilihan admin, tanpa label pemenang | Analisis BigGo | 8 | 3 | 2 | 3 | **4.3** | ✅ Selesai 2026-10-16 (Sprint 4): `/bandingkan/a-vs-b`, panel admin Perbandingan pilihan |
| 28 | PB-29 | Halaman kebutuhan programatik (mis. "HP 5G di bawah Rp3 juta"), urutan netral, terbit hanya bila ≥3 produk berharga segar | Analisis BigGo | 8 | 3 | 3 | 5 | **2.8** | ✅ Selesai 2026-10-16 (Sprint 4): 5 halaman `/hp/...`, terbit hanya bila ≥3 produk berharga segar |
| 29 | PB-30 | Perluas halaman Cara Kerja: sikap transparansi + statistik hidup (produk, penawaran, toko, % harga segar), tanpa jumlah pengguna | Analisis BigGo | 5 | 3 | 2 | 2 | **5.0** | ✅ Selesai 2026-10-16 (Sprint 3) |
| 30 | PB-31 | Keputusan PO atas fitur yang ditunda PRD §3: grafik riwayat harga publik, pantau harga (email), "harga turun minggu ini", kategori lain, ekstensi browser | Analisis BigGo | 8 | 3 | 3 | 1 | **14.0** | ✅ Diputuskan 2026-10-16: hanya grafik harga publik yang diaktifkan (PRD §3) |
| 31 | PB-32 | Katalog dibaca per halaman/filter di database (bukan seluruh dataset dalam satu cache); dipicu peringatan ukuran dataset atau >500 produk terbit | Audit 2026-10-13 | 5 | 2 | 8 | 8 | **1.9** | Menunggu pemicu |
| 32 | PB-33 | Pecah `src/lib/catalog/queries.ts` (1.388 baris) per fitur tanpa mengubah perilaku; bersama PB-32 | Audit 2026-10-13 | 2 | 1 | 3 | 3 | **2.0** | ✅ Selesai 2026-10-16 (Sprint 5): core, search, product-detail, comparison; queries.ts jadi titik ekspor |
| 33 | PB-34 | Logika harga di pemilih varian: saat harga seri pilih pemeriksaan terbaru (`pricing.ts`), chip kapasitas memuat harga (segar / "Terakhir Rp…" / "Belum ada harga") | UX-20, UX-21 (2026-10-14) | 8 | 5 | 3 | 2 | **8.0** | ✅ Selesai 2026-10-14 (Sprint 1) |
| 34 | PB-35 | Rapikan tata letak: label warna GSMArena di spesifikasi, hero beranda tanpa harga, kartu katalog terlihat tanpa scroll, tinggi foto detail di ponsel, warna terpotong di kartu penawaran | UX-22 sampai UX-26 | 5 | 3 | 2 | 3 | **3.3** | ✅ Selesai 2026-10-15 (Sprint 2) |
| 35 | PB-36 | Grafik riwayat harga per varian (shadcn Chart, garis tangga, ambang ≥5 pemeriksaan dalam ≥7 hari, tabel alternatif) sesuai `docs/ux/ANALISIS-UX-GRAFIK-HARGA-2026-10.md` §3 | Analisis BigGo, UX §3 | 8 | 2 | 3 | 5 | **2.6** | ✅ Selesai 2026-10-16 (Sprint 5): SVG server, ambang 5 titik/7 hari, tabel alternatif |
| 36 | PB-37 | Tanya AI tahap A: mesin rekomendasi v2 (pita budget ±15/30%, skor kegunaan + prioritas berbobot, kelas chipset, keragaman seri/merek, alasan dari posisi harga dan susunan lensa) | `docs/ux/RANCANGAN-TANYA-AI-2026-10.md` §3.4 | 13 | 8 | 5 | 5 | **5.2** | ✅ Selesai 2026-10-15 (Sprint 2) |
| 37 | PB-38 | Tanya AI tahap B: kebijakan bertanya di kode, prioritas berperingkat, kamus sinonim, penyempurnaan setelah hasil, set emas + `pnpm test:assistant-eval` | Rancangan §3.2, §3.3, §3.7 | 13 | 8 | 5 | 5 | **5.2** | ✅ Selesai 2026-10-15 (Sprint 2) |
| 38 | PB-39 | Tanya AI tahap C: penulis balasan terpisah (model lebih fasih), validator nama/harga, menjelaskan hasil ("kenapa nomor 2?"), bandingkan dari chat | Rancangan §3.1, §3.5, §3.6 | 8 | 3 | 5 | 5 | **3.2** | ✅ Selesai 2026-10-16 (Sprint 3): penulis balasan gpt-6-luna + validator + perbandingan |
| 39 | PB-40 | Ulasan YouTube semi-otomatis: whitelist channel terpercaya, pencarian YouTube Data API, antrean persetujuan admin, tag umum/kamera, ringkasan perbandingan AI hanya dari ringkasan disetujui (tanpa transkrip) | Masukan PO 16 Okt 2026, `docs/bisnis/ANALISIS-PENDUKUNG-KEPUTUSAN-2026-10.md` §6 | 13 | 5 | 5 | 8 | **2.9** | ✅ Selesai 2026-10-17 (Sprint 7): PRD §3, migrasi youtube-reviews, sinkronisasi 6 channel (job di scrape_jobs), panel `/admin/ulasan`, ulasan umum/kamera di halaman produk, rangkuman AI di perbandingan; SOP `docs/sop/SOP-ULASAN-YOUTUBE.md` |
| 40 | PB-41 | Tambah produk Infinix, Tecno, itel, dan realme (mulai segmen di bawah Rp3 juta); Transsion memimpin pasar Q2 2026 | Analisis pendukung keputusan §2 | 8 | 3 | 2 | 3 | **4.3** | Siap (tugas data) |
| 41 | PB-42 | Jadwalkan worker impor per menit di InsForge Schedules; per 16 Okt 18.00 WIB enam batch harga cron masih `queued` dan 0 produk berharga segar | Analisis pendukung keputusan §5 | 13 | 13 | 8 | 1 | **34.0** | Siap (bagian sisa PB-01) |
| 42 | PB-43 | CSV gabungan: spesifikasi, penawaran, dan foto per warna dalam satu berkas; pilihan bagian di formulir; foto lewat aturan galeri sebagai tahap terakhir; tab Galeri dan templat lama dihapus dari UI | Masukan PO 17 Okt 2026 | 13 | 8 | 5 | 5 | **5.2** | ✅ Selesai 2026-10-17 (Sprint 8) |
| 43 | PB-44 | CSV gabungan tanpa kolom spesifikasi: produk baru dan spesifikasi hanya lewat Tarik otomatis; kolom spesifikasi sheet lama diabaikan dengan peringatan; berkas spesifikasi format lama ditolak | Masukan PO 17 Okt 2026 | 5 | 5 | 3 | 2 | **6.5** | ✅ Selesai 2026-10-17 (Sprint 9) |
| – | PB-10 | Modul iklan: Fase 3–4 (laporan otomatis, invoice, portal advertiser, sponsored listing) | ADS-CONTEXT §10 | – | – | – | – | – | **Ditahan** oleh pemilik produk |

### Catatan prioritas

- **PB-26 dan PB-31 di atas secara WSJF** karena ukurannya kecil: satu tugas data dan satu keputusan. PB-31 tidak boleh dilewati, karena grafik harga, notifikasi, dan kategori lain berstatus "Ditunda" di PRD §3 dan tidak boleh dikerjakan sebelum PRD diubah.
- **PB-23 menunggu PB-01:** SEO baru berdampak setelah situs bisa dirayapi.

- **PB-11 di urutan pertama** walau nilainya kecil: risikonya besar dan ukurannya paling kecil. Kata sandi yang pernah dikirim lewat percakapan harus dianggap bocor.
- **PB-01 membuka nilai dari pekerjaan yang sudah selesai.** Pemeriksaan harga harian (US-10) sudah dibangun, tapi baru berjalan otomatis setelah ada URL publik dan secret terpasang. Tanpa itu, metrik "harga segar" akan turun lagi ke 0 dalam 24 jam.
- **PB-13 dan PB-14 kecil tetapi bernilai tinggi (WSJF tinggi):** keduanya hanya menunggu keputusan PO, bukan kerja teknis besar. Urutan di tabel mengikuti waktu masuk; saat refinement berikutnya keduanya layak naik ke atas.
- **PB-02 sengaja di bawah** karena ukurannya belum pasti dan ada pertanyaan kepatuhan. Apakah marketplace mengizinkan pengambilan otomatis? Aturan proyek melarang menembus anti-bot. Story ini perlu refinement bersama pemilik produk sebelum bisa diperkirakan.

## Definition of Ready

Sebuah item boleh masuk sprint bila:

1. Ditulis sebagai user story (peran, kemampuan, manfaat) atau tugas teknis dengan alasan bisnis yang jelas.
2. Punya acceptance criteria Gherkin yang disetujui PO dan bisa diuji.
3. Bergantung pada sesuatu yang sudah tersedia (akses, kredensial, keputusan bisnis), atau ketergantungannya tercatat.
4. Sudah diperkirakan tim (story point) dan muat dalam satu sprint. Kalau tidak, dipecah dulu.
5. Tidak bertentangan dengan PRD. Kalau bertentangan, keputusan PO dicatat di story.

## Definition of Done

Sebuah item dianggap selesai bila:

1. Semua acceptance criteria lulus dan punya tes otomatis. Pengecualian (misalnya keluaran model AI) dicatat sebagai kasus manual di TEST-CASES.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test:import`, `pnpm test:assistant` bersih.
3. `pnpm test:e2e:smoke` lulus. Bila menyentuh impor: `pnpm test:integration` lulus.
4. Perubahan skema berupa migration baru dan sudah diterapkan. `pnpm qa:sql` tanpa pelanggaran tingkat `gagal`.
5. Tidak ada defect terbuka berseverity Kritis atau Tinggi yang terkait item ini.
6. Dokumentasi yang terdampak diperbarui (PRD, ADS-CONTEXT §14, `.env.example`, folder ini).
7. Didemokan di Sprint Review dan diterima PO (UAT untuk story yang terlihat pengguna).
