# Rencana Sprint Q4 2026 — CekHarga

Disusun 14 Oktober 2026 dari `docs/RENCANA-PENGEMBANGAN-2026-10.md` (tahap disetujui PO 14 Oktober) dan backlog PB-23 sampai PB-36. Sprint berdurasi 2 minggu, mengikuti `SCRUM.md`.

## Prinsip target

- Target di bawah adalah **target awal untuk tahap pengembangan**, dibuat konservatif dari kondisi nyata per 14 Oktober: 66 produk terbit, 235 penawaran, 8 toko, belum deploy, input e-commerce manual oleh satu admin.
- Target trafik dan pendapatan **dikalibrasi ulang di Sprint Review ke-4**, setelah ada baseline 30 hari (PRD §13).
- Setiap target harus bisa dicek dari dasbor admin, Search Console, atau database. Tidak ada target yang diukur dengan perasaan.

## Ringkasan

| Sprint | Tanggal | Sprint goal | Target utama |
| --- | --- | --- | --- |
| 1 | 14–30 Okt | Situs hidup dan harganya tampil jujur | Deploy; ≥60% produk berharga segar 3 hari berturut-turut; ≥90 produk terbit |
| 2 | 15 Okt–13 Nov (dimajukan) | Halaman rapi, gerbang terbit, Tanya AI masuk akal | ≥120 produk terbit; ≥70% harga segar; ≥80% halaman produk terindeks; eval Tanya AI lulus |
| 3 | 16–27 Nov | Data e-commerce masuk otomatis (pilot) | ≥150 produk; ≥80% harga segar; 1 marketplace otomatis, atau keputusan tertulis bila syaratnya tidak memungkinkan |
| 4 | 30 Nov–11 Des | Konten pembeda dan baseline | 20 halaman "A vs B"; 5 halaman kebutuhan; baseline 30 hari; target Fase B ditetapkan bersama pimpinan |

Target trafik awal (dikalibrasi di Sprint 4): domain baru biasanya butuh 2–3 bulan sebelum trafik organiknya stabil. Akhir Sprint 4 ditargetkan **≥1.000 kunjungan organik per bulan** dan **≥50 klik ke toko per minggu**. Pendapatan belum ditargetkan sebelum Fase C (Maret 2027).

## Sprint 1 — 14 sampai 30 Oktober 2026

**Sprint goal:** *Situs hidup di internet, dan setiap harga yang tampil menyebut keadaan sebenarnya.*

| Item | SP | Pemegang | Catatan |
| --- | --- | --- | --- |
| PB-11 Ganti kata sandi admin | 1 | Pemilik produk | Hanya bisa dilakukan pemilik akun |
| PB-01 Deploy Vercel + secret + jadwal worker | 3 | Pemilik produk + dev | Butuh akses akun Vercel dan izin publikasi; dev menyiapkan daftar variabel dan langkahnya |
| PB-34 Logika harga di pemilih varian | 2 | Dev | Harga seri memakai pemeriksaan terbaru; chip kapasitas memuat harga |
| PB-23 + PB-12 SEO halaman produk + data terstruktur | 3 | Dev | Judul "Harga … Terbaru …", deskripsi, canonical, JSON-LD `Product`/`AggregateOffer` tanpa rating karangan |
| PB-24 Kebersihan kode | 2 | Dev | Folder kosong, batch uji E2E dihapus, pengaturan iklan atomik |
| PB-25 Tinjau dua `eslint-disable` | 1 | Dev | Perbaiki atau tulis alasannya |
| PB-26 Impor data Xiaomi dan Samsung Okt 2026 | 2 | Admin data | Galeri Samsung sudah bisa diunggah sejak perbaikan 14 Oktober |
| **Total** | **14** | | |

**Ukuran keberhasilan (dicek di Sprint Review):**

1. Situs punya URL publik dan cron harian tercatat berhasil 3 hari berturut-turut.
2. "Harga masih segar" ≥60% dari produk berharga selama 3 hari berturut-turut setelah deploy. Angka 60% dipilih karena hanya harga situs resmi yang otomatis; harga Shopee masih manual.
3. ≥90 produk terbit, semuanya punya minimal satu penawaran (gerbang PB-15 belum ada, jadi diperiksa lewat dasbor).
4. Tidak ada halaman produk dengan chip kapasitas "Harga belum tersedia" padahal punya harga tercatat.
5. Rich Results Test lulus untuk 3 produk contoh (setelah deploy).
6. Tidak ada defect baru berseverity Kritis atau Tinggi.

### Progres Sprint 1 (per 15 Oktober 2026)

| Item | Status |
| --- | --- |
| PB-34 Logika harga | ✅ Harga seri memakai pemeriksaan terbaru; chip kapasitas menampilkan harga segar, "Terakhir Rp…", atau "Belum ada harga" |
| PB-23 + PB-12 SEO + data terstruktur | ✅ Judul dan deskripsi jujur (tanpa "Terbaru" bila harga basi), canonical setelah `SITE_URL` ada, JSON-LD `Product`/`AggregateOffer` dari harga segar saja |
| PB-24 Kebersihan kode | ✅ Folder kosong dihapus; E2E menghapus batch ujinya (24 batch lama ikut bersih). Simpan pengaturan iklan atomik ditunda karena modul iklan ditahan (PB-10) |
| PB-25 `eslint-disable` | ✅ Diganti `useEffectEvent`; 0 tersisa |
| Perbaikan di luar rencana | ✅ Galeri foto melewati semua baris bila `model_name` sudah memuat merek; host `images.samsung.com` diizinkan dan parameter linknya dibuang |
| PB-11 | ⏳ Skrip `scripts/ganti-sandi-admin.mjs` siap (kode 6 digit lewat email); tinggal dijalankan pemilik akun |
| PB-01 | ⏳ Langkah di `docs/sop/SOP-DEPLOY-VERCEL.md`. Temuan 15 Okt: proyek Vercel yang ada tersambung ke repo lama `cekharga-frontend`, dan `main` belum di-push |
| PB-26 | ✅ Spreadsheet dirapikan (panduan sekali pakai, dihapus 11 Nov 2026; tersedia di riwayat git) dan diunggah ulang oleh admin, 15 Oktober |

## Sprint 2 — dimajukan, dimulai 15 Oktober 2026

**Sprint goal:** *Halaman rapi, gerbang terbit jujur, dan Tanya AI yang hasilnya masuk akal.*

Susunan diubah atas persetujuan PO 15 Oktober 2026 setelah deploy pertama: rekomendasi Tanya AI terbukti ngawur (HP Rp32 juta untuk budget "sekitar 3 juta"), sehingga rancangan ulang Tanya AI tahap A dan B masuk Sprint 2. PB-16, PB-05, dan PB-30 bergeser ke Sprint 3.

| Item | SP | Status |
| --- | --- | --- |
| PB-35 Rapikan tata letak | 3 | ✅ Hero memakai harga terakhir berlabel, kartu katalog terlihat tanpa scroll di 1366×768, foto ponsel 240 px, label warna versi global, warna penawaran 2 baris |
| PB-15 Gerbang terbit | 2 | ✅ Varian + ≥1 penawaran aktif; satuan dan massal. Data live: 67 terbit lolos, 74 draft tertolak |
| PB-37 Tanya AI tahap A (mesin rekomendasi v2) | 5 | ✅ Contoh live "sekitar 3 juta, game": HP di atas +30% pindah ke "di luar budget" |
| PB-38 Tanya AI tahap B (cara bertanya, sinonim, evaluasi) | 5 | ✅ Set emas 30 pesan: ekstraksi 100%, pembuka templat 0% |
| **Total** | **15** | |

**Ukuran keberhasilan (dicek di Sprint Review):**

- ≥120 produk terbit, dan semuanya lolos gerbang terbit.
- ≥70% harga segar (bergantung cron harian berjalan, PB-01).
- Search Console: ≥80% halaman produk terindeks (butuh `SITE_URL` di Vercel).
- Tanya AI: `pnpm test:assistant-eval` lulus, hasil pertama muncul dalam ≤3 pesan pengguna.

## Sprint 3 — dimajukan, dikerjakan 16 Oktober 2026

**Sprint goal:** *Tanya AI yang menjelaskan hasilnya, harga resmi yang terpantau, dan halaman yang jujur soal angkanya.*

Sebelum sprint dimulai, codebase dirapikan (knip: kode mati, export, dependensi, folder kosong, README) dan dua bottleneck diperbaiki (hapus storage massal saat undo, audit draft kedaluwarsa satu entri).

| Item | SP | Status |
| --- | --- | --- |
| PB-39 Tanya AI tahap C | 5 | ✅ Penulis balasan menyebut produk dan harga dari kartu bernomor; validator menolak produk/harga di luar hasil; "kenapa nomor 2?" dan "bandingkan 1 dan 3" |
| PB-05 Peringatan pemeriksaan harian gagal | 3 | ✅ Tabel `price_refresh_runs` (migrasi 20261016090000) + panel peringatan dasbor |
| PB-30 Halaman Cara Kerja + statistik hidup | 2 | ✅ Produk, merek, penawaran, toko, % harga segar, pemeriksaan terakhir; bagian "Sikap kami" |
| PB-16 Tarik "harga saja" | 3 | ✅ Uji baca: sesi Samsung 14 Okt, 15 model cocok, 27 harga |
| PB-27 Filter garansi resmi dan stok | 3 | ✅ Sebagian: filter di halaman produk + normalisasi garansi. Filter katalog menunggu data garansi (0 penawaran mencatat garansi per 16 Okt) |
| PB-17a Pendaftaran Shopee Affiliate atas nama PT | 3 | ⏳ Tugas bisnis/legal PT, bukan kode |
| PB-17b Penyerapan harga dari API | 5 | ⏳ Menunggu PB-17a |

**Pemeriksaan penutup:** typecheck, lint, dan knip bersih; tes unit 58 + 28 + 10; integrasi 13; E2E publik, mobile, dan keamanan 60 lulus (2 dilewati); build produksi lulus.

**Ukuran keberhasilan (dicek setelah cron harian berjalan beberapa hari):**

- ≥150 produk terbit.
- ≥80% harga segar. Per 16 Oktober 0%, karena cron harian proyek Vercel baru belum pernah berjalan (jadwal pertama 16 Oktober 06.00–06.59 WIB).
- Satu marketplace masuk otomatis, atau keputusan tertulis bila syarat program tidak mengizinkan (bergantung PB-17a).

## Sprint 4 — dimajukan, dikerjakan 16 Oktober 2026

**Sprint goal:** *Konten yang membedakan CekHarga, tanpa halaman tipis atau klaim tanpa data.*

| Item | SP | Status |
| --- | --- | --- |
| PB-28 Halaman "A vs B" | 3 | ✅ Tabel `compare_pairs` (migrasi 20261016120000), `/bandingkan/{a}-vs-{b}`, panel admin, sitemap, contoh di /compare |
| PB-29 Halaman kebutuhan | 5 | ✅ 5 halaman `/hp/...` + indeks `/hp`; terbit hanya bila ≥3 produk berharga segar (per 16 Okt semuanya 404 karena belum ada harga segar) |
| PB-31 Keputusan PO atas fitur yang ditunda PRD | 1 | ⏳ Menunggu keputusan pemilik produk |
| PB-36 Grafik riwayat harga | 5 | ⏳ Menunggu PB-31 dan data harian ≥30 hari |

**Temuan bottleneck yang diperbaiki di sprint ini:**

- Region fungsi Vercel dipindah dari `iad1` (Washington) ke `sin1` (Singapura), dekat database InsForge dan pengguna. TTFB live sebelumnya: beranda 1,5 detik, katalog 0,7 detik, detail produk 0,46 detik.
- Daftar pasangan perbandingan di-cache dengan tag, tidak lagi dibaca dari database setiap request.
- Pencarian katalog dan keputusan iklan in-feed berjalan paralel.
- Dicek dan tidak perlu diubah: perhitungan harga per varian (1,6 ms untuk seluruh katalog), cache katalog per request (`cache()` React) dan lintas request (`unstable_cache`), serta pengaturan dan keputusan iklan yang sudah di-cache.

**Pemeriksaan penutup:** typecheck, lint, dan knip bersih; tes unit 58 + 28 + 12; integrasi 13; E2E 61 lulus (2 dilewati); build produksi lulus.

**Ukuran keberhasilan (dievaluasi setelah data 30 hari):**

- Baseline 30 hari terdokumentasi: kunjungan, klik ke toko, dan halaman teratas.
- Target trafik awal tercapai atau selisihnya dijelaskan.
- Target Fase B ditetapkan bersama pimpinan.

## Sprint 5 — dikerjakan 16 Oktober 2026

**Sprint goal:** *Riwayat harga yang jujur di halaman produk, dan kode katalog yang lebih mudah dicek.*

| Item | SP | Status |
| --- | --- | --- |
| PB-31 Keputusan fitur yang ditunda PRD | 1 | ✅ Hanya grafik harga publik yang diaktifkan; syaratnya ditulis di PRD §3 |
| PB-36 Grafik riwayat harga | 5 | ✅ SVG dirender server (tanpa dependensi baru), ambang 5 titik dalam 7 hari, garis tangga per toko, celah >30 jam putus-putus, tabel alternatif, daftar catatan bila data kurang |
| PB-33 Pecah `queries.ts` | 3 | ✅ Empat modul per fitur, API publik tetap |

**Temuan dan perbaikan:**

- Pemuat riwayat harga menjalankan ketiga query-nya paralel; riwayat tidak masuk dataset katalog global (sejalan PB-32) dan di-cache per varian dengan tag `catalog`.
- E2E terhadap server dev tidak stabil saat banyak rute baru dikompilasi (17 timeout di satu putaran). Terhadap build produksi lokal semua lulus. Panduan QA diperbarui.

**Pemeriksaan penutup:** typecheck, lint, knip bersih; tes unit 58 + 28 + 13; integrasi 13; E2E 61 lulus (2 dilewati) terhadap build produksi; build lulus.

## Setelah Sprint 4

- PB-32 dan PB-33 (skala katalog) dikerjakan saat pemicunya muncul: peringatan ukuran dataset atau >500 produk terbit.
- Fase C (Maret–Juni 2027): kesepakatan iklan brand pertama, komisi afiliasi berjalan.
