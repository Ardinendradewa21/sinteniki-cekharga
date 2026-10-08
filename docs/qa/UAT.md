# User Acceptance Test (UAT) — CekHarga

Dokumen ini untuk **pemilik produk dan stakeholder bisnis**. Tidak perlu membaca kode. Setiap skenario cukup dicoba di browser seperti pengunjung atau admin biasa, lalu ditandai **Diterima** atau **Ditolak** beserta catatan.

- **Rilis yang diuji:** `main` per 2026-10-06 (pemeriksaan harga harian, perombakan impor, Tanya AI Sprint A, perbaikan login)
- **Tempat:** situs produksi setelah deploy, atau lingkungan lokal yang disiapkan tim
- **Waktu yang dibutuhkan:** sekitar 45 menit

> Sebelum UAT, tim QA sudah menjalankan 53 tes otomatis, 4 uji integrasi, dan 13 pemeriksaan data. Semuanya lulus ([TEST-REPORT-2026-10-06.md](TEST-REPORT-2026-10-06.md)). UAT memastikan hasilnya **sesuai harapan bisnis**, bukan sekadar "tidak error".

## A. Sebagai pengunjung (pembeli)

| # | Yang dicoba | Yang seharusnya terjadi | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| A1 | Buka beranda di HP. Baca bagian atas. | Langsung jelas bahwa CekHarga membandingkan harga HP, dengan tombol "Cari Produk" dan "Tanya AI". Tidak ada klaim "terlaris" atau jumlah pengguna. | ☐ Diterima ☐ Ditolak | |
| A2 | Di katalog, isi harga maksimal Rp4.000.000. | Hanya HP ≤ Rp4 jt yang tampil. HP yang belum punya harga **tidak** ikut tampil. | ☐ Diterima ☐ Ditolak | |
| A3 | Salin alamat halaman katalog yang sudah disaring, buka di tab baru. | Saringan dan urutannya sama persis. | ☐ Diterima ☐ Ditolak | |
| A4 | Buka satu HP, ganti variannya (misal 8/128 ke 8/256). | Harga berubah sesuai varian. Selalu tertulis varian mana dan kapan harga diperiksa. | ☐ Diterima ☐ Ditolak | |
| A5 | Klik tombol toko di halaman HP. | Toko yang benar terbuka di tab baru. Tidak ada kesan CekHarga yang menjual. | ☐ Diterima ☐ Ditolak | |
| A6 | Bandingkan dua HP. | Perbedaan terlihat berdampingan, tanpa "pemenang" atau skor. | ☐ Diterima ☐ Ditolak | |
| A7 | Tanya AI: budget maksimal 5 juta (batas keras), wajib RAM 8 GB, untuk foto. | Semua kandidat ≤ Rp5 jt dan RAM ≥ 8 GB, masing-masing dengan alasan dan kompromi. HP yang harganya lama dipisah dan diberi tanda. | ☐ Diterima ☐ Ditolak | |
| A8 | Buka halaman "Cara kerja". | Penjelasan sumber data dan keterbatasannya mudah dipahami orang awam. | ☐ Diterima ☐ Ditolak | |

## B. Sebagai admin

| # | Yang dicoba | Yang seharusnya terjadi | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| B1 | Masuk ke `/admin/login` dengan email dan kata sandi admin. | Kolom email kosong dan diisi sendiri. Dasbor terbuka. | ☐ Diterima ☐ Ditolak | |
| B2 | Lihat dasbor: "Harga masih segar", "Terbit tanpa harga", "Celah data produk terbit". | Angkanya masuk akal dan membantu memutuskan apa yang dikerjakan dulu. | ☐ Diterima ☐ Ditolak | |
| B3 | Di "Celah data", buka kelompok "Tanpa penawaran", klik "Tarik ulang" pada satu produk. | Halaman tarik otomatis terbuka dengan merek dan nama model sudah terisi. | ☐ Diterima ☐ Ditolak | |
| B4 | Pusat Impor → Unggah: unggah CSV kecil, tinjau, lalu Terapkan. | Ada pratinjau (baru/berubah/dilewati beserta alasan), bar progres, dan hasil per baris. Produk baru masuk sebagai **draft**. | ☐ Diterima ☐ Ditolak | |
| B5 | Buka batch dari B4, klik "Urungkan batch". | Layar menjelaskan apa yang dihapus dan apa yang tidak. Setelah dikonfirmasi, produk draft dari batch itu hilang. | ☐ Diterima ☐ Ditolak | |
| B6 | Tab Riwayat di Pusat Impor. | Batch "Pemeriksaan harian" terlihat terpisah dari batch buatan admin. | ☐ Diterima ☐ Ditolak | |

## C. Sebagai staf non-admin (misal sales)

| # | Yang dicoba | Yang seharusnya terjadi | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| C1 | Masuk dengan akun berperan sales. | Beranda staf terbuka, hanya modul iklan yang tersedia. | ☐ Diterima ☐ Ditolak | |
| C2 | Ketik manual `/admin/import` di alamat. | Ditolak dan dikembalikan ke dasbor dengan pesan akses. | ☐ Diterima ☐ Ditolak | |

## D. Keputusan bisnis yang perlu jawaban pemilik produk

Bukan bagian lulus/gagal. Jawabannya menentukan backlog berikutnya ([BACKLOG.md](BACKLOG.md)).

1. **Harga marketplace (PB-02):** 69 penawaran dari Shopee/Erafone sudah lebih dari 7 hari tidak diperiksa. Mau diperbarui lewat unggah CSV rutin oleh admin, atau dijajaki kerja sama data resmi dengan marketplace?
2. ~~**Batas "harga segar" 24 jam (PRD §7)**~~ Diputuskan 2026-10-08: **30 jam**.
3. **29 produk terbit tanpa harga (PB-03):** tetap ditampilkan dengan "Harga belum tersedia", atau dikembalikan ke draft sampai harganya ada?

## Persetujuan

| Peran | Nama | Keputusan | Tanggal | Tanda tangan |
| --- | --- | --- | --- | --- |
| Pemilik produk (PT Sinteniki Digital Solusi) | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak | | |
| Product Owner | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak | | |
| QA | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak | | |

Skenario yang ditolak dicatat sebagai defect di [DEFECTS.md](DEFECTS.md) dan dibahas di Sprint Review.
