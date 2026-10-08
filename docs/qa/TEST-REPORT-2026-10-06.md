# Laporan Eksekusi Uji — 2026-10-06

| | |
| --- | --- |
| Build | `main` @ `fb3c77a` + suite QA (folder `e2e/`, `scripts/qa/`, `scripts/tests/integration/`) |
| Lingkungan | Lokal, Next.js 16.3.4 dev (port 3100), Chrome stabil, database InsForge proyek CekHarga |
| Penguji | QA (otomatis) |
| Acuan | [TEST-PLAN.md](TEST-PLAN.md), [TEST-CASES.md](TEST-CASES.md) |

## 1. Ringkasan

| Jenis | Jumlah | Lulus | Gagal | Dilewati | Durasi |
| --- | --- | --- | --- | --- | --- |
| Unit: impor dan pemeriksaan harga (`pnpm test:import`) | 23 | 23 | 0 | 0 | < 1 detik |
| Unit: Tanya AI (`pnpm test:assistant`) | 10 | 10 | 0 | 0 | < 1 detik |
| Integrasi, database nyata (`pnpm test:integration`) | 4 | 4 | 0 | 0 | ± 21 detik |
| E2E: publik, mobile, keamanan, admin, peran (`pnpm test:e2e`) | 53 | 53 | 0 | 0 | ± 2,6 menit |
| Data (`pnpm qa:sql`) | 13 | 11 | 0 | – | ± 1 menit |
| **Total otomatis** | **103** | **101** | **0** | **0** | |

Dua pemeriksaan SQL berstatus **peringatan** (bukan gagal), yaitu celah data yang masuk backlog:

- **SQL-11:** 29 produk terbit belum punya penawaran → PB-03.
- **SQL-12:** 69 penawaran marketplace belum diperiksa ulang lebih dari 7 hari → PB-02. Pemeriksaan harian baru mencakup situs resmi.

Catatan eksekusi E2E:

- Putaran penuh terakhir menghasilkan 52 lulus dan 1 dilewati. TC-DET-05 dilewati karena halaman pertama katalog tidak memuat produk tanpa harga.
- Tes itu diperbaiki agar deterministik (membuka halaman terakhir urutan harga), lalu lulus saat dijalankan ulang.
- Typecheck dan lint bersih setelah perubahan.

## 2. Cakupan per kebutuhan

| Kebutuhan | Story | Otomatis | Manual | Status |
| --- | --- | --- | --- | --- |
| FR-01 Beranda | US-08 | 4 | UAT A1 | Terpenuhi |
| FR-02 Katalog | US-01, US-02 | 8 + 1 aksesibilitas | UAT A2–A3 | Terpenuhi |
| FR-03 Detail | US-03 | 3 | UAT A4 | Terpenuhi |
| FR-04 Perbandingan | US-05 | 2 | UAT A6 | Terpenuhi |
| FR-05 Penawaran | US-04 | 1 | UAT A5 | Terpenuhi |
| FR-06 Asisten AI | US-06 | 3 + 10 unit | TC-M-01, UAT A7 | Jalur formulir terpenuhi; mode percakapan menunggu UAT |
| FR-07 Admin data | US-20–US-24, US-30 | 6 E2E + 4 integrasi + 12 keamanan | TC-M-02–05, UAT B, C | Terpenuhi |
| FR-08 Transparansi | US-07 | 1 | UAT A8 | Terpenuhi |
| PRD §7 Aturan harga | US-10, US-11 | 4 E2E + 9 unit + 5 SQL | TC-M-04 | Terpenuhi; jadwal produksi menunggu PB-01 |
| PRD §8 Aksesibilitas | – | 5 | – | Terpenuhi untuk target 44 px, overflow, dan fokus |

## 3. Defect

- **Siklus ini tidak menemukan defect produk baru.** Semua kegagalan awal E2E (8 kasus) adalah kesalahan skrip uji, lalu diperbaiki di skrip:
  - Teks penyangkalan seperti "bukan peringkat atau klaim terlaris" terdeteksi sebagai klaim. Ditangani dengan helper `affirmativeSentences()`.
  - Ringkasan katalog tanpa filter berbunyi "Menampilkan 1-20 dari 101 produk", bukan "produk yang cocok".
  - Route announcer Next juga ber-role `alert`.
  - Subjudul panel riwayat sengaja menyebut "Pemeriksaan harga harian".
- **Kesimpulan untuk tim:** skrip uji harus membaca makna kalimat, bukan sekadar mencari kata. Pola ini dicatat di TEST-PLAN §5.1.
- **Register defect proyek:** 18 defect, 17 ditutup dan 1 terbuka (DEF-018, Rendah). Rinciannya di [DEFECTS.md](DEFECTS.md).

## 4. Risiko yang tersisa

| Risiko | Mitigasi |
| --- | --- |
| Pemeriksaan harian belum berjalan otomatis di produksi | PB-01 (deploy + `CRON_SECRET`) adalah prioritas ke-2 di backlog |
| Uji integrasi menulis ke database katalog (tanpa staging) | Data penanda QAUji dibersihkan sebelum/sesudah; PB-09 lingkungan terpisah |
| Mode percakapan Tanya AI tidak diotomasi | TC-M-01 dan UAT A7 |
| Kata sandi admin pernah dibagikan lewat percakapan | PB-11, prioritas pertama |

## 5. Rekomendasi

**Layak rilis dengan syarat.** Semua kriteria keluar di TEST-PLAN §6 terpenuhi: smoke 100%, regression 100%, tidak ada defect Kritis/Tinggi terbuka, dan tidak ada pelanggaran SQL tingkat gagal. Syaratnya:

1. PB-11 (ganti kata sandi admin) dikerjakan sebelum atau bersamaan dengan deploy.
2. PB-01 dikerjakan saat deploy, supaya metrik "Harga masih segar" (66/170 setelah uji sistem) tidak turun ke 0 dalam 24 jam.
3. UAT ([UAT.md](UAT.md)) ditandatangani pemilik produk.
