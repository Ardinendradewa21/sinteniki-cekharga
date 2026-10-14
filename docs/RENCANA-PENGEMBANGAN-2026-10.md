# Rencana Pengembangan CekHarga — Oktober 2026

Disusun 13 Oktober 2026 dari dua sumber:

1. Audit kode CekHarga per 12 Oktober 2026 (branch `feat/galeri-foto-warna`).
2. Analisis pesaing BigGo (biggo.id). Datanya diambil dari halaman yang dirender server, karena BigGo memblokir browser otomatis.

**Status:** urutan tahap 0–2 disetujui pemilik produk pada 14 Oktober 2026. Analisis lanjutan: `docs/ux/ANALISIS-UX-GRAFIK-HARGA-2026-10.md` (UI/UX dan rancangan grafik) dan `docs/bisnis/ANALISIS-BISNIS-AFILIASI-2026-10.md` (target, riset afiliasi, posisi).

Setiap pekerjaan di sini sudah dicatat sebagai item backlog (PB-23 sampai PB-36) di `docs/qa/BACKLOG.md` dan diurutkan dengan WSJF. Dokumen ini menjelaskan alasan, urutan, dan kriteria selesainya. Backlog tetap menjadi sumber kebenaran untuk status.

## 1. Posisi bersaing

BigGo menang di **jumlah**: 8 marketplace, puluhan ribu listing per pencarian, banyak kategori, aplikasi, dan ekstensi browser. Katalog CekHarga baru 66 produk terbit, 235 penawaran, dan 8 toko. Adu banyak jelas kalah.

CekHarga bisa menang di **kejujuran dan relevansi**, karena di sinilah BigGo lemah:

| Kelemahan BigGo | Keunggulan CekHarga yang sudah ada |
| --- | --- |
| Tidak ada waktu pemeriksaan harga; hanya "Terbaru Okt 2026" di judul | Setiap harga menyebut kapan diperiksa |
| Hasil pencarian HP tercampur casing dan aksesori, sampai perlu tombol "Sembunyikan Spam"; harga "mulai dari" ikut terseret | Harga terikat varian RAM/penyimpanan yang benar-benar dicocokkan |
| Penjual bisa bayar agar naik ke atas, tanpa label "Sponsor" yang jelas di hasil | Iklan wajib berlabel dan tidak boleh mengubah urutan harga |
| Spesifikasi tanpa sumber; penafian melepas tanggung jawab akurasi | Sumber spesifikasi dicatat; data kosong ditulis "belum diketahui" |
| Tidak ada ringkasan ulasan | Ringkasan reviewer dengan atribusi |
| Garansi resmi tidak dibedakan, hanya terselip di judul listing | Jenis garansi dicatat per penawaran |
| Lokalisasi Indonesia setengah jadi (halaman "Semua Toko" berisi 0 toko) | Sepenuhnya lokal |

**Kalimat posisi (final 14 Oktober 2026):**

- Tagline: **"Harga HP yang bisa kamu cek ulang."**
- Kalimat pendukung: "Setiap harga menyebut varian, toko, dan kapan terakhir diperiksa. Iklan selalu berlabel dan tidak mengubah urutan."

Alasannya ada di `docs/bisnis/ANALISIS-BISNIS-AFILIASI-2026-10.md` §1. "Garansi jelas" tidak dipakai sebagai janji, karena belum semua penawaran mencatat jenis garansi.

Yang sengaja **tidak** ditiru dari BigGo:

- Label "lebih baik" dan "unggul di 3 dari 15 spesifikasi". PRD melarang skor dan pemenang tunggal.
- Posisi berbayar tanpa label.
- Mengindeks semua listing tanpa kurasi.

## 2. Ringkasan urutan kerja

| Tahap | Isi | Perkiraan | Syarat mulai |
| --- | --- | --- | --- |
| 0. Benahi dulu | Ganti kata sandi admin, deploy, SEO halaman produk, data Xiaomi, kebersihan kode | 1–2 minggu | – |
| 1. Data | Sumber harga afiliasi resmi, tarik "harga saja", gerbang terbit | 2–4 minggu, sebagian riset bisnis | Tahap 0 selesai (deploy) |
| 2. Pembeda | Filter garansi resmi, halaman "A vs B", halaman kebutuhan, halaman transparansi | 2–3 minggu | Tahap 0 (SEO dasar) |
| 3. Keputusan PO | Fitur yang ditunda PRD: grafik harga, pantau harga, kategori lain | – | Keputusan pemilik produk |
| 4. Skala teknis | Katalog dibaca per halaman di database, pecah `queries.ts` | 1–2 minggu | Dipicu ukuran katalog |

Jalur pemasaran (bagian 7) berjalan paralel dan tidak menunggu kode.

## 3. Tahap 0 — Benahi dulu

### PB-11 Ganti kata sandi admin utama (sudah ada di backlog)

Kata sandinya pernah dikirim lewat chat dan dipakai di banyak perintah uji. Anggap sudah bocor. Ganti, lalu simpan hanya di variabel lingkungan `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD` di mesin penguji.

### PB-01 Deploy ke Vercel (sudah ada di backlog)

Tanpa deploy, pemeriksaan harga harian dan worker impor tidak berjalan otomatis, sehingga semua harga menjadi basi setelah 30 jam. Semua pekerjaan SEO di bawah ini juga baru berdampak setelah situs bisa dirayapi Google.

### PB-23 SEO halaman produk dan katalog

**Masalah.** Judul halaman produk hanya nama produk (`title: detail.name`), dan katalog berjudul "Produk". Padahal orang mencari dengan kata "harga". BigGo menangkap pencarian itu dengan judul "Harga redmi note 15 pro Terbaru Okt 2026".

**Dikerjakan:**

- Judul halaman produk: `Harga {Merek Model} Terbaru {Bulan Tahun} – Mulai Rp{harga} di {n} Toko`. Bila belum ada harga: `Harga {Merek Model} {Bulan Tahun} – Spesifikasi dan Varian`. Bulan diambil dari waktu pemeriksaan harga terakhir, bukan dari tanggal hari ini, supaya tidak mengklaim kesegaran palsu.
- Deskripsi menyebut varian acuan dan waktu periksa (PRD §7).
- `canonical` per produk. Parameter `?varian=` dan `?warna=` tidak membuat URL kanonik baru.
- Open Graph memakai foto sampul produk.
- Digabung dengan **PB-12** (data terstruktur `Product` + `AggregateOffer`, tanpa rating karangan).

**Diterima bila:** judul dan deskripsi setiap produk terbit sesuai pola di atas; harga kosong tidak ditulis "Rp0"; Rich Results Test lulus tanpa galat; tes E2E memeriksa judul satu produk.

### PB-26 Impor data Xiaomi Oktober 2026 (tugas data)

Berkas `templat-terpadu-cekharga-xiaomi-shopee-okt2026.csv` dan `galeri-foto-xiaomi-shopee-okt2026.csv` sudah bisa diunggah sejak 12 Oktober. Langkahnya:

1. Ubah RAM 17 Ultra dari 12 menjadi 16.
2. Unggah templat terpadu, lalu pilih dasar hak pakai foto.
3. Tinjau baris **Perlu tinjau**: ejaan warna dan listing Redmi Note 17/5G yang memakai satu link.
4. Setelah antrean foto selesai, unggah berkas galeri.

Hasil uji coba tanpa menyimpan: 22 penawaran dan 236 foto baru.

### PB-24 Kebersihan kode

- Hapus folder kosong sisa struktur lama `src/app/products/[slug]`.
- Tes E2E yang membuat batch (TC-IMP-04, 05, 06) menghapus batch-nya sendiri, bukan hanya membatalkan. Per 12 Oktober sudah ada 24 batch `qa-e2e` yang menumpuk.
- Simpan pengaturan iklan dalam satu panggilan atomik (RPC). Saat ini `src/lib/ads/admin-actions.ts` menyimpan satu kunci per query di dalam loop, sehingga kegagalan di tengah meninggalkan pengaturan setengah tersimpan (aturan system design 4).

### PB-25 Tinjau dua `eslint-disable` aturan dependensi hook

Lokasinya `batch-progress.tsx:99` dan `scrape-workbench.tsx:321`. Pastikan tidak ada data basi di layar. Bila memang aman, tulis alasannya di komentar. Bila tidak, perbaiki dengan `useEffectEvent` atau ref.

## 4. Tahap 1 — Data (masalah terbesar)

Skala data adalah jarak terbesar dengan BigGo. Selama harga e-commerce diinput manual, katalog tidak akan tumbuh.

### PB-17 Sumber harga e-commerce yang sah (sudah ada, urgensi dinaikkan)

- Riset program afiliasi resmi: Shopee Affiliate, Tokopedia/TikTok Shop Affiliate, Blibli Affiliate, dan jaringan seperti Involve Asia atau Accesstrade. Untuk setiap program, catat apakah menyediakan **feed produk atau API harga**, tidak hanya link komisi.
- Keluaran riset: satu pilihan pilot (PRD §3 menyebut Blibli sebagai kandidat awal) beserta syarat teknis dan kontraknya.
- Tautan afiliasi wajib diungkapkan dengan jelas di situs (PRD FR-08).
- Urgensi dinaikkan dari 3 ke 5, karena ini sekaligus menyelesaikan keluhan input manual dan membuka pendapatan dari klik.

### PB-16 Tarik otomatis "harga saja" (sudah ada)

Memperbarui harga situs resmi untuk produk yang sudah ada tanpa menarik ulang spesifikasi GSMArena (yang sering terkena Turnstile). Harga resmi jadi lebih sering segar.

### PB-15 Gerbang terbit (sudah disetujui PO)

Tombol Terbitkan menolak produk tanpa varian atau tanpa penawaran aktif. Produk kosong di indeks Google merusak kesan "bisa dipercaya".

## 5. Tahap 2 — Pembeda (dalam batas PRD)

### PB-27 Filter garansi resmi dan stok

- Di daftar penawaran halaman produk: pilihan "Hanya garansi resmi Indonesia" dan "Sembunyikan stok habis".
- Di katalog: filter yang sama di tingkat produk (punya minimal satu penawaran bergaransi resmi).
- PRD §3: batas "hanya garansi resmi" sebagai aturan katalog belum ditetapkan. Ini hanya **filter pilihan pengguna**, bukan penyaringan paksa.
- Syarat data: kolom garansi harus konsisten. Normalisasi teks garansi ("Garansi Resmi", "Resmi Indonesia", "TAM") ke beberapa nilai baku dikerjakan di impor.

### PB-28 Halaman perbandingan populer "A vs B"

- Halaman statis dengan URL rapi, misalnya `/bandingkan/xiaomi-redmi-note-17-pro-vs-xiaomi-redmi-note-17-pro-max`, untuk pasangan yang memang sering dibandingkan: varian satu seri dan pesaing di rentang harga yang sama.
- Isinya memakai komponen perbandingan yang sudah ada: perbedaan dicetak tebal, tanpa label pemenang atau skor.
- Pasangan dipilih admin. Tidak ada klaim "populer" tanpa data.
- Judul SEO: `{A} vs {B}: Beda Spesifikasi dan Harga {Bulan Tahun}`.

### PB-29 Halaman kebutuhan (programatik, terbatas)

- Halaman seperti "HP 5G di bawah Rp3 juta" dan "HP dengan NFC di bawah Rp2,5 juta", dibangun dari filter katalog yang sudah ada.
- Urutan tetap netral (harga atau nama), tanpa kata "terbaik", sesuai PRD §4 "pilih sesuai kebutuhan".
- Halaman hanya terbit bila berisi minimal 3 produk dengan harga segar, supaya tidak ada halaman tipis.

### PB-30 Halaman transparansi "Cara CekHarga memeriksa harga"

Halaman `how-it-works` sudah ada. Perluas dengan:

- Perbandingan sikap: waktu periksa, varian, label iklan, sumber spesifikasi. Tanpa menyebut nama pesaing.
- Statistik hidup yang jujur: jumlah produk, penawaran, toko, dan persentase harga yang diperiksa dalam 30 jam terakhir. Bukan jumlah pengguna (PRD FR-01).

Halaman ini menjadi bahan utama pemasaran (bagian 7).

## 6. Tahap 3 — Butuh keputusan pemilik produk (PB-31)

PRD §3 menunda fitur berikut. Fitur-fitur ini jelas menjadi kekuatan BigGo, tetapi **tidak boleh dikerjakan sebelum PRD diubah**:

| Fitur | Nilai bersaing | Biaya dan risiko | Usulan |
| --- | --- | --- | --- |
| Grafik riwayat harga publik per varian | Tinggi: data `price_observations` sudah ada, dan BigGo hanya menampilkan teks "Riwayat Harga" tanpa grafik di hasil pencarian | Kecil secara teknis, tapi riwayat yang bolong (input manual) bisa menyesatkan | Buka setelah PB-01 dan PB-17 membuat harga terisi rutin. Grafik hanya menampilkan titik yang benar-benar diamati, tanpa garis interpolasi palsu |
| Pantau harga (notifikasi email saat harga turun) | Tinggi: alasan orang kembali | Butuh data email (UU PDP), anti-spam, dan pemeriksaan harga yang rutin | Buka setelah PB-17, tanpa akun penuh: cukup email dan konfirmasi |
| "Harga turun minggu ini" | Sedang: bahan konten mingguan | Bersinggungan dengan "pelacakan promo" yang ditunda | Putuskan bersama grafik harga |
| Kategori lain (tablet, laptop) | Tinggi jangka panjang | Skema spesifikasi berbeda; PRD v1 hanya smartphone | Tunda sampai data smartphone stabil |
| Ekstensi browser | Sedang | Mahal dirawat | Tunda |

**Diterima bila:** keputusan PO untuk setiap baris dicatat di PRD §3 beserta tanggalnya. Fitur yang dibuka dipecah menjadi item backlog baru.

## 7. Jalur pemasaran (paralel, tanpa kode)

1. **Konten pendek mingguan** (TikTok, Reels, Shorts): "Cek dulu sebelum checkout", "Varian 8/256 vs 12/256: selisihnya berapa?", dengan tangkapan layar waktu periksa CekHarga.
2. **SEO konten** mengikuti PB-23, PB-28, dan PB-29: kalender per merek setiap ada peluncuran HP baru, karena halaman produk baru adalah peluang pencarian terbesar.
3. **Kekuatan PT Sinteniki** di SEO dan ORM dipakai untuk membangun otoritas domain: tautan dari media teknologi lokal dan kerja sama reviewer yang ringkasannya sudah kita kurasi.
4. **Klaim yang boleh dipakai** hanya yang bisa dibuktikan: "harga menyebut waktu periksa", "iklan selalu berlabel". Klaim yang dilarang: "termurah", "terbaik", jumlah pengguna, dan testimonial (PRD).
5. **Google "sumber pilihan"**: BigGo memasang ajakan ini. CekHarga bisa menambahkannya setelah deploy.

## 8. Tahap 4 — Skala teknis

### PB-32 Katalog dibaca per halaman di database

**Masalah.** `fetchCatalogFromBackend` memuat semua produk, penawaran, dan harga ke satu cache (batas data cache Next.js sekitar 2 MB, peringatan di 1,5 MB). Aman untuk 66 produk, tetapi tidak untuk ribuan.

**Pemicu:** peringatan ukuran dataset muncul di log, atau katalog melewati 500 produk terbit.

**Dikerjakan:** query katalog dan detail dipindah ke view atau RPC per halaman dan filter, dengan cache per halaman produk yang di-invalidate saat harga produk itu berubah (aturan system design 2).

### PB-33 Pecah `src/lib/catalog/queries.ts`

1.388 baris berisi katalog, detail, dan perbandingan sekaligus. Pecah per fitur (`catalog-list`, `product-detail`, `compare`) tanpa mengubah perilaku, dengan tes katalog sebagai pengaman. Kerjakan bersamaan dengan PB-32 supaya tidak dua kali menyentuh berkas yang sama.

## 9. Keputusan

| Pertanyaan | Keputusan |
| --- | --- |
| Urutan tahap 0–2 | Disetujui (14 Oktober 2026) |
| Riset afiliasi PB-17 | Dikerjakan tim internal dulu; hasil awal di `docs/bisnis/ANALISIS-BISNIS-AFILIASI-2026-10.md` §5 (rekomendasi pilot Shopee Open API, lalu Blibli) |
| Kalimat posisi | Final di bagian 1 |
| PB-31 (fitur yang ditunda PRD) | Belum diputuskan. Rancangan grafik sudah siap, tetapi data baru layak setelah PB-01 berjalan ±7–30 hari |
| Target angka bisnis | Menunggu pimpinan; usulan peta jalan Fase A–C ada di dokumen bisnis §4 |

## 10. Perbaikan UI/UX baru (dari analisis 14 Oktober)

- **PB-34:** logika harga di sekitar pemilih varian. Saat harga seri, pilih catatan terbaru, karena kartu Redmi 17 menulis "5 hari lalu" padahal ada catatan 2 hari lalu. Chip kapasitas juga perlu memuat harganya sendiri, karena sekarang chip 6/128 menulis "Harga belum tersedia" padahal ada harga lama.
- **PB-35:** rapikan tata letak:
  - label warna versi GSMArena di tabel spesifikasi;
  - hero beranda yang menampilkan produk tanpa harga;
  - produk katalog baru terlihat setelah scroll;
  - tinggi foto detail di ponsel;
  - warna terpotong di kartu penawaran.
- **PB-36:** grafik riwayat harga sesuai rancangan, setelah PB-01 dan keputusan PB-31.
