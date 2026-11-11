# Sprint 15: perbaikan audit 002 di beranda

Dikerjakan 11 November 2026 di branch `sprint-15/audit-002-beranda` (dari PB-48, di atas Sprint 14). Isinya temuan audit antislop 002 yang disarankan (no 1, 2, 5, 6, 7). PO meminta sprint dilanjutkan tanpa memilih nomor lain, jadi set saran itu yang dipakai. Belum di-merge dan belum dideploy.

## Tiket

| Tiket | Isi | Status |
|---|---|---|
| S15-1 (audit no 1) | Harga sama tidak lagi tampil "Selisih harga Rp0". Beranda: "Harga varian acuan keduanya sama, Rp2.899.000." Halaman perbandingan: judul "Harga sama" dan harga bersamanya (`priceSpread.lowestPriceIdr` baru). | Selesai |
| S15-2 (audit no 2, 3) | Section "Beberapa cara orang memilih" (4 kartu yang mengulang hero) diganti "Cari HP menurut kebutuhan": tautan ke halaman `/hp/...` (PB-29) beserta jumlah produknya. Hanya halaman yang lolos `qualifyingNeedPages` yang ditautkan, jadi tidak ada tautan 404; bila tidak ada yang lolos, tampil arahan ke katalog. Efek hover kartu ikut hilang. | Selesai |
| S15-3 (audit no 5) | Varian acuan di kartu contoh perbandingan hanya ditulis sekali, di baris harga. | Selesai |
| S15-4 (audit no 6) | Kalimat "tidak kedua produk punya penawaran" menjadi "salah satu produk belum punya penawaran yang memenuhi syarat". | Selesai |
| S15-5 (audit no 7) | Tombol "Cari Produk" menjadi "Cari produk" (beranda, hero, style guide). | Selesai |
| S15-6 (temuan uji) | Teks 11 px di beranda (nomor langkah transparansi, label tur hero) dan lencana jumlah filter katalog dinaikkan ke 12 px. TC-A11Y-06 untuk `/` gagal karena ini (masuk di Sprint 13). | Selesai |

## Keputusan teknis

- Data halaman kebutuhan dihitung paralel dengan contoh perbandingan (`Promise.all`). Keduanya membaca dataset katalog yang sudah di-cache, dan pencarian kebutuhan murni di memori (tanpa LLM, tanpa query tambahan per halaman).
- Jumlah produk per halaman adalah hasil pencarian, bukan popularitas (PRD FR-01). Urutan mengikuti `NEED_PAGES`.
- Dokumentasi dicek lewat Context7 (Next.js v16.3.6): `Link` default `prefetch="auto"` untuk rute dinamis hanya mengambil sampai batas `loading.js`, jadi tautan kebutuhan di beranda tidak memicu render penuh halaman `/hp/...` di latar. Suspense tidak diperlukan karena datanya sudah di-cache.

## Hasil pemeriksaan

- Typecheck dan lint bersih. Unit test 73 + 28 + 17 + 10 lolos.
- E2E beranda (4), perbandingan dan asisten, serta aksesibilitas ponsel (17) lolos terhadap dev server.
- Chrome headless 375 px dan 1280 px: 2 halaman kebutuhan lolos saat ini (HP 5G di bawah Rp3 juta, 4 produk; penyimpanan 256 GB di bawah Rp5 juta, 9 produk), keduanya 200, tinggi tautan minimal 44 px, tanpa gulir horizontal dan tanpa error konsol. OPPO A6x vs Xiaomi Redmi 17 tampil "Harga varian acuan keduanya sama" di beranda dan "Harga sama" di halaman perbandingan.

## Belum dikerjakan

- Audit 002 no 4 (contoh perbandingan memakai pasangan yang sama dengan hero), no 8 (reveal kartu), no 9 (penanda "beda" dicocokkan per label).
- Baru 2 dari 5 halaman kebutuhan yang lolos syarat 3 produk berharga segar. Section akan bertambah sendiri begitu harga NFC dan RAM 8 GB terisi.
