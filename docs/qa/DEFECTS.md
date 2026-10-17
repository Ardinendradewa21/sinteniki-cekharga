# Register Defect — CekHarga

Register ini menjadi defect tracking system selama repo belum punya remote. Setelah remote dan issue tracker tersedia (backlog PB-08), defect baru dibuat sebagai issue dengan templat `.github/ISSUE_TEMPLATE/bug_report.md`. Defect yang masih terbuka di sini dipindahkan ke sana.

## Alur status

`Baru` → `Dikonfirmasi` (bisa direproduksi, severity disepakati) → `Dikerjakan` → `Siap diuji` → `Ditutup` (lulus uji regresi). Status `Ditolak` dipakai untuk perilaku yang memang sesuai PRD, dengan alasan tercatat.

Aturan tim: **setiap defect yang ditutup wajib punya tes regresi otomatis**, kecuali dicatat alasannya.

## Ringkasan

| ID | Judul | Severity | Prioritas | Status | Ditemukan lewat | Perbaikan | Tes regresi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | Form login mengunci satu email admin dan menampilkannya di halaman publik | Tinggi | P1 | Ditutup | E2E peran (TC-ROLE-01) | `fb3c77a` | TC-SEC-02, TC-ROLE-01 |
| DEF-002 | `modelKey` menyamakan "Galaxy S26+" dengan "Galaxy S26" | Tinggi | P1 | Ditutup | Unit test saat membangun US-10 | `6f67886` | unit "modelKey: tanda +" |
| DEF-003 | Pemeriksaan harian mencatat "model hilang" palsu saat Samsung mengganti URL SKU | Sedang | P1 | Ditutup | Inspeksi hasil uji sistem cron | `6f67886` + koreksi data | unit "URL perwakilan berganti" |
| DEF-004 | Riwayat impor di dasbor tidak memuat batch baru | Sedang | P2 | Ditutup | Audit kode Fase 5 | `6f67886` | TC-ADM-03 |
| DEF-005 | Pusat Impor menulis ke database saat halaman dibuka (GET) | Sedang | P2 | Ditutup | Audit desain sistem | `6f67886` | INT-02, unit "status batch" |
| DEF-006 | Metrik "Perlu ditinjau" selalu 100% | Rendah | P3 | Ditutup | Uji browser dasbor | `6f67886` | TC-ADM-01 |
| DEF-007 | Undo menghapus penawaran dan harga milik produk yang sudah terbit | Kritis | P1 | Ditutup | Uji integrasi Fase 4 | `6f67886` | INT-01 |
| DEF-008 | Undo induk saat harga resmi lanjutan masih antre meninggalkan data yatim | Tinggi | P1 | Ditutup | Audit alur Fase 4 | `6f67886` | – (belum ada tes khusus, lihat catatan) |
| DEF-009 | Varian yang tidak dicentang ditandai "harga gagal diperiksa" | Tinggi | P1 | Ditutup | Audit QA impor | `6f67886` | unit "missing prices" |
| DEF-010 | Batch ditandai "applied" sebelum pekerjaannya selesai | Tinggi | P1 | Ditutup | Audit QA impor | `6f67886` | unit "status batch" |
| DEF-011 | Klaim commit tarik otomatis selalu gagal (InsForge menolak `or(and())` pada UPDATE) | Kritis | P1 | Ditutup | Uji integrasi Fase 3 | `6f67886` | – (belum di repo, lihat catatan) |
| DEF-012 | Pembaca bertahap gagal untuk tabel tanpa kolom `id` (`scrape_results`) | Tinggi | P1 | Ditutup | Uji integrasi Fase 3 | `6f67886` | – |
| DEF-013 | Worker dengan anggaran waktu kecil mengklaim batch tanpa memproses apa pun | Sedang | P2 | Ditutup | Uji ketahanan Fase 1 | `6f67886` | INT-01 (diproses bertahap) |
| DEF-014 | Polling progres batch berhenti di React StrictMode | Sedang | P2 | Ditutup | Uji browser Fase 1 | `6f67886` | – (manual TC-M-02) |
| DEF-015 | Foto bisa muncul setelah undo; foto galeri tidak ikut diurungkan | Sedang | P2 | Ditutup | Audit Fase 4 | `6f67886` | INT-03 |
| DEF-016 | Tanya AI mengubah nilai syarat yang tidak dikenal menjadi "garansi resmi" | Tinggi | P1 | Ditutup | Unit test Sprint A | `a206430` | unit assistant |
| DEF-017 | Jalur cadangan Tanya AI kehilangan parameter `tanya=form` | Sedang | P2 | Ditutup | Uji browser Sprint A | `a206430` | TC-AI-03 |
| DEF-018 | Penawaran Samsung tetap memakai URL SKU lama; tarik otomatis membuat penawaran ganda untuk varian yang sama | Sedang | P2 | Ditutup | Inspeksi hasil cron, audit Sprint 10 | PB-06 (Sprint 10) | unit `findRelocatedOffer`, pemeriksaan harga duplikat; INT-15 |
| DEF-019 | Seksi contoh perbandingan beranda hilang di data live (slug fixture demo di-hardcode) | Tinggi | P1 | Ditutup | Audit UI/UX tahap 4 | belum di-commit | unit `pickComparisonPair` (`pnpm test:catalog`) |
| DEF-020 | Contoh perbandingan beranda menandai "beda" untuk nilai yang belum diketahui | Sedang | P2 | Ditutup | Audit UI/UX tahap 4 | belum di-commit | – (verifikasi manual; kandidat E2E) |
| DEF-021 | Titik status asisten berdenyut tanpa henti dan berwarna peringatan saat AI aktif | Sedang | P2 | Ditutup | Audit UI/UX tahap 4 | belum di-commit | – |
| DEF-022 | Indikator fokus pola shadcn `ring-ring/50` hanya ±2.15:1 (gagal 3:1) | Sedang | P2 | Ditutup | Audit UI/UX tahap 2 | belum di-commit | TC-A11Y-04 (fokus terlihat) |
| DEF-023 | Kontras Badge/Pill nada netral 4.4:1 dan hitungan review `accent-warm` + teks putih ±3:1 | Sedang | P2 | Ditutup | axe-core tahap 2–3 | belum di-commit | axe-core (audit browser) |

Total: 23 defect. Semua ditutup. Severity: Kritis 2, Tinggi 9, Sedang 11, Rendah 1.

## Detail defect penting

### DEF-001 — Form login mengunci satu email admin

| | |
| --- | --- |
| Severity / Prioritas | Tinggi / P1 |
| Dampak bisnis | Email akun admin terpampang di halaman publik, sehingga penyerang tinggal menebak kata sandinya. Semua peran staf (sales, adops, finance, legal) tidak bisa masuk, sehingga sistem peran dan modul iklan tidak bisa dipakai siapa pun selain satu akun. |
| Langkah reproduksi | 1. Buka `/admin/login`. 2. Coba ubah kolom email. |
| Diharapkan | Kolom email kosong dan bisa diisi. |
| Aktual | Kolom terisi email admin dan `readOnly`. |
| Akar masalah | Konstanta `DEFAULT_ADMIN_EMAIL` sebagai `value` + `readOnly` di `src/components/admin/login-form.tsx`. Diduga jalan pintas sementara yang terbawa commit. |
| Perbaikan | Email bisa diisi tanpa nilai bawaan; `autocomplete` username/current-password. |
| Pelajaran | Uji peran harus memakai akun yang benar-benar berbeda dari admin. Uji dengan satu akun menutupi defect ini selama beberapa fase. |

### DEF-002 — `modelKey` menyamakan model "+" dengan model dasarnya

| | |
| --- | --- |
| Severity / Prioritas | Tinggi / P1 |
| Dampak bisnis | Harga atau spesifikasi "Galaxy S26+" bisa tercatat ke "Galaxy S26". Ini terjadi di tarik otomatis (sudah ada sejak awal) dan berpotensi juga di pemeriksaan harian. |
| Akar masalah | `modelKey()` membuang semua karakter non-alfanumerik, termasuk "+". |
| Perbaikan | "+" diubah menjadi kata "plus" sebelum normalisasi, sehingga "S26+" sama dengan "S26 Plus" tetapi berbeda dari "S26". |
| Ditemukan | Unit test skenario negatif "dua kandidat (S26 vs S26+)" yang ditulis sebelum fitur dianggap selesai. |

### DEF-003 — "Model hilang" palsu di pemeriksaan harian

| | |
| --- | --- |
| Severity / Prioritas | Sedang / P1 |
| Dampak bisnis | 8 pemeriksaan gagal palsu tercatat untuk model Samsung dan Apple yang masih dijual, sehingga harganya tidak diperbarui hari itu. |
| Akar masalah | Pencocokan hanya lewat URL, padahal Samsung mengganti URL perwakilan model (warna/SKU) dari hari ke hari. |
| Perbaikan | Cadangan pencocokan lewat nama model (satu model, host resmi yang sama). Alasan gagal dibedakan antara "model hilang" dan "varian tanpa harga". |
| Koreksi data | Dry run aturan baru terhadap data hari itu: 8 catatan gagal palsu dihapus, 3 alasan dikoreksi, 4 kegagalan yang benar dibiarkan. |

### DEF-007 — Undo menghapus data produk terbit

| | |
| --- | --- |
| Severity / Prioritas | Kritis / P1 |
| Dampak bisnis | Mengurungkan batch harga bisa menghapus harga yang sedang tampil di halaman publik produk terbit. |
| Perbaikan | `selectRemovable` melindungi penawaran, harga, dan pemeriksaan milik produk terbit. Syarat diulang di setiap query hapus. |

### DEF-011 — Commit tarik otomatis selalu gagal

| | |
| --- | --- |
| Severity / Prioritas | Kritis / P1 (blocker) |
| Dampak bisnis | Tidak ada satu pun hasil tarik otomatis yang bisa disimpan. |
| Akar masalah | Backend menolak filter `or(... and(...))` pada UPDATE dengan pesan menyesatkan "column ... does not exist". |
| Perbaikan | Dipecah menjadi dua UPDATE atomik. Pola ini kini dipakai juga di pembatalan antrean foto. |
| Catatan | Tes integrasinya masih berupa skrip sementara. Tindak lanjut: tambahkan uji integrasi untuk `claimCommit` ke `scripts/tests/integration/` (nomor INT-05 sudah dipakai uji patch impor). |

### DEF-018 — URL penawaran Samsung basi dan penawaran ganda (ditutup 2026-10-18)

| | |
| --- | --- |
| Severity / Prioritas | Rendah / P3 |
| Dampak | Tombol "Situs resmi" bisa membuka halaman warna lain atau, kelak, halaman yang sudah dihapus. Harga tetap benar. |
| Temuan Sprint 10 | Severity dinaikkan ke Sedang. Selain URL basi, tarik otomatis "harga saja" pada 14 Okt membuat penawaran baru di URL "blueberry" untuk Galaxy S26 FE 8/128 dan 8/256, sementara penawaran lama di URL "graphite" tetap ada. Varian itu punya dua penawaran Samsung, dan yang lama dicatat gagal setiap hari. |
| Akar masalah | Importer hanya memindahkan penawaran lama ke URL baru untuk Erafone. Penjual resmi dicocokkan lewat varian + URL, jadi URL baru selalu dianggap penawaran baru. |
| Perbaikan | `findRelocatedOffer` (`src/lib/import/offer-relocation.ts`) memindahkan penawaran penjual resmi (identitas di `src/lib/scrape/official-sellers.ts`) dan Erafone ke URL baru. Pemeriksaan harian mencatat usulan URL dan penawaran ganda di `offer_url_suggestions`; admin memutuskan lewat Dashboard dan halaman produk (`resolveOfferUrlAction`). Dua penawaran ganda S26 FE di produksi sudah ditandai dan menunggu keputusan admin. |

## Templat laporan defect

```markdown
**Judul:** [area] ringkasan satu kalimat
**Severity:** Kritis | Tinggi | Sedang | Rendah    **Prioritas (diisi PO):** P1 | P2 | P3
**Lingkungan:** URL, browser/perangkat, akun/peran, waktu (WIB)
**Story / FR terkait:** US-.., FR-..
**Langkah reproduksi:**
1.
2.
**Diharapkan:**
**Aktual:** (sertakan tangkapan layar / trace Playwright / baris SQL)
**Dampak ke pengguna atau bisnis:**
**Data uji yang dipakai:** (penanda QAUji bila menulis data)
```
