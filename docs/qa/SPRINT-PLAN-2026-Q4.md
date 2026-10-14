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
| 2 | 2–13 Nov | Halaman rapi, situs bisa ditemukan | ≥120 produk terbit; ≥70% harga segar; ≥80% halaman produk terindeks |
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

### Progres Sprint 1 (per 14 Oktober 2026)

| Item | Status |
| --- | --- |
| PB-34 Logika harga | ✅ Harga seri memakai pemeriksaan terbaru; chip kapasitas menampilkan harga segar, "Terakhir Rp…", atau "Belum ada harga" |
| PB-23 + PB-12 SEO + data terstruktur | ✅ Judul dan deskripsi jujur (tanpa "Terbaru" bila harga basi), canonical setelah `SITE_URL` ada, JSON-LD `Product`/`AggregateOffer` dari harga segar saja |
| PB-24 Kebersihan kode | ✅ Folder kosong dihapus; E2E menghapus batch ujinya (24 batch lama ikut bersih). Simpan pengaturan iklan atomik ditunda karena modul iklan ditahan (PB-10) |
| PB-25 `eslint-disable` | ✅ Diganti `useEffectEvent`; 0 tersisa |
| Perbaikan di luar rencana | ✅ Galeri foto melewati semua baris bila `model_name` sudah memuat merek; host `images.samsung.com` diizinkan dan parameter linknya dibuang |
| PB-11, PB-01 | ⏳ Menunggu pemilik produk (kata sandi, akun Vercel, izin publikasi) |
| PB-26 | ⏳ Tugas data; galeri Samsung siap diunggah ulang, dengan catatan kualitas data di laporan 14 Oktober |

## Sprint 2 — 2 sampai 13 November 2026

**Sprint goal:** *Halaman yang rapi dan bisa ditemukan mesin pencari.*

| Item | SP |
| --- | --- |
| PB-35 Rapikan tata letak (warna spesifikasi, hero, katalog, foto ponsel, warna di kartu penawaran) | 3 |
| PB-15 Gerbang terbit | 2 |
| PB-16 Tarik otomatis "harga saja" | 3 |
| PB-05 Peringatan pemeriksaan harian gagal | 3 |
| PB-30 Halaman Cara Kerja + statistik hidup | 2 |
| **Total** | **13** |

**Ukuran keberhasilan:**

- ≥120 produk terbit.
- ≥70% harga segar.
- Search Console: ≥80% halaman produk terindeks.
- Analitik minimal berjalan, sebagai awal baseline.

## Sprint 3 — 16 sampai 27 November 2026

**Sprint goal:** *Harga e-commerce masuk otomatis dari sumber resmi.*

| Item | SP |
| --- | --- |
| PB-17a Pendaftaran Shopee Affiliate atas nama PT, telaah syarat tampil dan simpan harga, uji Open API | 3 |
| PB-17b Penyerapan harga dari API ke batch penawaran (hanya bila 17a lolos) | 5 |
| PB-27 Filter garansi resmi dan stok | 3 |
| **Total** | **11** |

**Ukuran keberhasilan:**

- ≥150 produk terbit.
- ≥80% harga segar.
- Satu marketplace masuk otomatis. Bila syarat program tidak mengizinkan, keputusan tertulis dan jalur cadangan (Blibli) disepakati.

## Sprint 4 — 30 November sampai 11 Desember 2026

**Sprint goal:** *Konten yang membedakan CekHarga, dan angka dasar untuk target berikutnya.*

| Item | SP |
| --- | --- |
| PB-28 Halaman "A vs B" (20 pasangan pilihan admin) | 3 |
| PB-29 Halaman kebutuhan (5 halaman, hanya yang berisi ≥3 produk berharga segar) | 5 |
| PB-31 Keputusan PO atas fitur yang ditunda PRD | 1 |
| PB-36 Grafik riwayat harga (hanya bila PB-31 disetujui dan data ≥30 hari) | 5 |
| **Total** | **9–14** |

**Ukuran keberhasilan:**

- Baseline 30 hari terdokumentasi: kunjungan, klik ke toko, dan halaman teratas.
- Target trafik awal tercapai atau selisihnya dijelaskan.
- Target Fase B ditetapkan bersama pimpinan.

## Setelah Sprint 4

- PB-32 dan PB-33 (skala katalog) dikerjakan saat pemicunya muncul: peringatan ukuran dataset atau >500 produk terbit.
- Fase C (Maret–Juni 2027): kesepakatan iklan brand pertama, komisi afiliasi berjalan.
