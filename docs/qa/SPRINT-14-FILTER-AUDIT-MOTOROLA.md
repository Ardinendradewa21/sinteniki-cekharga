# Sprint 14: panel filter ponsel, audit 002, salin foto Motorola

Dikerjakan 11 November 2026 di branch `sprint-14/filter-audit-motorola` (dari Sprint 13). Isinya sisa terbuka dari Sprint 13 (audit 001 temuan 8 dan 9) dan rekomendasi analisis sheet "Foto & Penawaran Motorola Nov 2026". Belum di-merge dan belum dideploy.

## Tiket

| Tiket | Isi | Status |
|---|---|---|
| S14-1 | Latar redup di belakang panel filter katalog di ponsel (< 640 px). Ketuk latar menutup panel (pada `click`, supaya ketukan tidak jatuh ke kartu produk di bawahnya), gulir halaman dikunci selama panel terbuka. Desktop tidak berubah. | Selesai |
| S14-2 | Audit antislop 002 untuk section kebutuhan, etalase produk, dan contoh perbandingan di beranda. | Selesai: 9 temuan di `docs/ux/anti-slop/audit-002-2026-11-11.md`, perbaikan menunggu pilihan PO |
| S14-3 | Alat bantu salin foto galeri resmi Motorola: bookmarklet di tab admin "Salin harga & foto" membaca galeri per warna di halaman motorola.com/id yang dibuka admin dan menyalin baris CSV gabungan (maks 6 foto per warna, foto pertama sampul). Host `pN-ofp.static.pub` diizinkan importer lewat pola. | Selesai |

## Keputusan teknis

- S14-3 memakai bookmarklet, bukan pengambilan di server: tidak ada scraping di dalam request (aturan system design 3), dan alurnya sama dengan sheet manual yang sudah dipakai admin.
- Nama warna diambil dari situs resmi tanpa awalan "PANTONE" ("PANTONE Corsair" menjadi "Corsair"). Nama model ditebak dari alamat halaman dan bisa disunting; koreksi diingat per halaman di browser admin.
- Dasar hak pakai foto tidak diisi alat ini; dipilih admin di form unggah, sama seperti alur sebelumnya.
- Host foto bernomor dicocokkan dengan pola berjangkar (`^p\d{1,2}-ofp\.static\.pub$`), jadi subdomain lain di `static.pub` tetap ditolak.
- Dokumentasi terbaru dicek lewat Context7: Next.js v16.3.6 dan Tailwind CSS v4 (utilitas `z-<angka>`).

## Hasil pemeriksaan

- Typecheck dan lint bersih. Unit test impor 73/73 (2 tes baru: salin foto, pola host).
- E2E `TC-IMP-07` dan `TC-IMP-08` (baru) lolos terhadap dev server.
- Chrome headless di halaman Motorola asli: Moto G57 Power 5G (3 warna, 14 foto) dan Razr 60 (4 warna, 24 foto) tersalin 20 kolom per baris, tanpa error.
- Panel filter: 375 px latar tampil dan menutupi header, ketuk latar dan Escape menutup, URL tidak berubah, kunci gulir dilepas; 1280 px latar tidak tampil. Tanpa error konsol dan tanpa badge Issues di overlay dev.

## Belum dikerjakan

- Perbaikan audit 002 (menunggu nomor temuan dari PO). Temuan 1 ("Selisih harga Rp0") disarankan dikerjakan lebih dulu.
- Moto G37 tidak ada di sitemap Motorola Indonesia; fotonya tetap diambil manual atau dari halaman negara lain.
- Ekstensi atau alat bantu harga marketplace untuk Motorola tetap lewat "Salin harga" yang sudah ada.
