# Test Plan — CekHarga

| | |
| --- | --- |
| Versi | 1.0 (2026-10-06) |
| Acuan | `docs/CekHarga_PRD_v2.md` (FR-01 s.d. FR-08, §7 aturan harga, §8 aksesibilitas, §10 keamanan) |
| Cakupan rilis | Situs publik, Tanya AI (Sprint A), admin data dan Pusat Impor (Fase 0–5), pemeriksaan harga harian |
| Di luar cakupan | Modul iklan selain gerbang keamanan dan "slot kosong tidak merender" (pengembangan modul iklan sedang **ditahan**) |

## 1. Tujuan

1. Memastikan setiap acceptance criteria PRD terpenuhi dan bisa dibuktikan dengan tes yang bisa diulang.
2. Menjaga **kejujuran data harga**: harga kosong bukan nol, harga selalu menyebut varian dan waktu pemeriksaan, harga lama dibedakan (PRD §7).
3. Mencegah regresi pada alur yang berisiko tinggi: impor data, undo, akses admin, dan pemeriksaan harga terjadwal.

## 2. Risiko produk dan prioritas uji

Prioritas ditentukan dari dampak ke pengguna dan bisnis kali peluang terjadinya.

| Risiko | Dampak | Prioritas uji | Dicegah oleh |
| --- | --- | --- | --- |
| Harga salah, nol, atau basi tampil sebagai harga aktif | Kepercayaan pengguna hilang, inti produk gagal | Tinggi | TC-KAT-04, TC-KAT-08, TC-DET-01, TC-DET-05, SQL-02, SQL-03, SQL-05 |
| Data admin atau draft bocor ke publik/API | Pelanggaran keamanan, PRD FR-07 | Tinggi | TC-SEC-01 s.d. TC-SEC-07, SQL-06 |
| Staf non-admin bisa mengubah katalog | Integritas data | Tinggi | TC-ROLE-01 |
| Impor/undo menghapus data produk terbit | Halaman publik rusak | Tinggi | INT-01, INT-03, unit undo-rules |
| Pemeriksaan harga harian mencocokkan model yang salah | Harga model lain tercatat | Tinggi | Unit price-refresh-rules dan modelKey, SQL-08 |
| Rekomendasi AI melanggar syarat wajib (budget, RAM) | Saran menyesatkan | Sedang | TC-AI-01, unit assistant |
| Tampilan rusak di ponsel / tidak aksesibel | Pengguna mobile gagal memakai | Sedang | TC-A11Y-01 s.d. TC-A11Y-03 |
| Klaim yang tidak bisa dibuktikan (terlaris, pemenang) | Melanggar PRD FR-01/FR-04 | Sedang | TC-BRD-03, TC-CMP-01 |

## 3. Jenis pengujian

| Jenis | Tujuan | Alat | Lokasi | Kapan dijalankan |
| --- | --- | --- | --- | --- |
| **Unit** | Aturan bisnis murni: aturan harga, impor, undo, pencocokan pemeriksaan harga, kebutuhan Tanya AI | `node --test` | `scripts/tests/*.test.ts` | Setiap perubahan kode |
| **Integrasi** | Alur impor nyata ke database: terapkan, jejak asal, undo, foto, retensi | `node --test` + InsForge | `scripts/tests/integration/` | Setiap perubahan di `src/lib/import`, sebelum rilis |
| **Functional (E2E)** | Fitur dari sisi pengguna sesuai acceptance criteria FR | Playwright | `e2e/public`, `e2e/admin` | Setiap PR (smoke), sebelum rilis (lengkap) |
| **Regression** | Memastikan defect lama tidak kembali | Playwright tag `@regression`, unit | `e2e/`, `scripts/tests/` | Sebelum rilis, setelah perbaikan defect |
| **Smoke** | Jalur kritis tetap hidup setelah deploy | Playwright tag `@smoke` | `e2e/` | Setiap deploy |
| **System** | Sistem utuh: cron harian → batch → worker → katalog publik | Panggilan `/api/cron/daily` + E2E | TEST-REPORT | Sebelum rilis yang menyentuh jadwal/worker |
| **Keamanan** | Gerbang admin, RLS anon, endpoint terjadwal, enumerasi akun | Playwright `request` + REST | `e2e/security` | Setiap PR |
| **Aksesibilitas** | PRD §8: target 44 px, tanpa scroll horizontal, fokus terlihat | Playwright (Pixel 7) | `e2e/public/*.mobile.spec.ts` | Sebelum rilis |
| **Data (SQL)** | Integritas data langsung di database | SQL via InsForge CLI | `scripts/qa/sql-checks.mjs` | Harian/mingguan dan sebelum rilis |
| **UAT** | Pemilik produk menerima fitur dengan skenario bisnis | Manual | [UAT.md](UAT.md) | Akhir sprint (Sprint Review) |
| **Eksploratif** | Mencari celah yang tidak tertangkap skrip | Manual, sesi berbatas waktu 60 menit | Catatan di DEFECTS.md | Setiap sprint |

## 4. Lingkungan dan data uji

| Lingkungan | URL | Database | Catatan |
| --- | --- | --- | --- |
| Lokal | `http://localhost:3100` (otomatis dinyalakan Playwright) | InsForge proyek CekHarga | Dev server Next.js 16 (Turbopack) |
| Produksi | Vercel (menunggu URL publik) | Sama | Hanya smoke test (`E2E_BASE_URL=... pnpm test:e2e:smoke`) |

**Risiko lingkungan:** belum ada database staging terpisah. Uji integrasi menulis ke database yang sama dengan katalog, dengan pengaman berikut:

- Data uji selalu memakai penanda `QAUji` / `QA-UJI` dan dihapus sebelum serta sesudah tes, termasuk objek storage.
- Uji E2E hanya membaca data katalog. Satu-satunya data yang ditulis E2E adalah akun staf sementara pada TC-ROLE-01, dan akun itu dihapus di `afterAll`.
- Backlog **PB-09** mengusulkan InsForge branch sebagai lingkungan uji terpisah.

## 5. Pendekatan per area

### 5.1 Situs publik (FR-01 s.d. FR-05, FR-08)

Tes membaca data katalog nyata, jadi assertion ditulis sebagai **aturan**, bukan angka tetap. Contoh: "semua harga ≤ batas budget", bukan "ada 17 produk". Teks penyangkalan seperti "bukan peringkat atau klaim terlaris" disaring dulu dengan `affirmativeSentences()` sebelum mencari klaim terlarang.

### 5.2 Tanya AI (FR-06)

Jalur formulir (`?tanya=form`) diuji end-to-end karena deterministik dan tidak bergantung model bahasa. Logika penyaringan syarat wajib diuji di level unit (`pnpm test:assistant`). Jalur percakapan AI diuji manual di UAT, karena keluarannya tidak deterministik.

### 5.3 Admin dan impor (FR-07)

Alur penulisan (impor → worker → undo) diuji di level integrasi, bukan lewat klik di browser, supaya cepat dan bisa dibersihkan dengan pasti. Browser dipakai untuk memeriksa tampilan dan gerbang peran.

### 5.4 Integritas data (SQL)

Setiap pemeriksaan mengembalikan baris pelanggaran, dan 0 baris berarti lulus. Tingkat `gagal` menghentikan rilis. Tingkat `peringatan` dicatat sebagai celah data di backlog.

## 6. Kriteria masuk dan keluar

**Masuk** (sebuah story boleh diuji bila):

1. Memenuhi Definition of Ready ([BACKLOG.md](BACKLOG.md#definition-of-ready)).
2. Acceptance criteria Gherkin sudah disepakati PO dan developer.
3. Typecheck dan lint bersih.

**Keluar** (sebuah rilis boleh naik bila):

1. 100% tes `@smoke` lulus, ≥ 95% tes `@regression` lulus, dan setiap yang gagal punya defect tercatat yang disetujui PO untuk ditunda.
2. Tidak ada defect terbuka dengan severity **Kritis** atau **Tinggi**.
3. `pnpm qa:sql` tanpa pelanggaran tingkat `gagal`.
4. UAT ditandatangani pemilik produk untuk story yang dirilis.

## 7. Severity dan prioritas defect

| Severity | Definisi | Contoh |
| --- | --- | --- |
| Kritis | Data bocor, data hilang, atau situs tidak bisa dipakai | Draft terbaca anon; undo menghapus produk terbit |
| Tinggi | Fitur inti salah tanpa jalan pintas | Harga model lain tercatat; staf tidak bisa login |
| Sedang | Fitur salah tetapi ada jalan pintas, atau menyesatkan sebagian | Metrik dasbor selalu 100% |
| Rendah | Kosmetik atau teks | Label salah ketik |

Prioritas (P1–P3) ditentukan PO dari dampak bisnis dan dicatat di [DEFECTS.md](DEFECTS.md).

## 8. Peran

| Peran | Tanggung jawab |
| --- | --- |
| QA | Menyusun dan memelihara test plan/test case/otomasi, menjalankan regresi, mengelola register defect |
| Developer | Unit test untuk kode baru, memperbaiki defect, menambah tes regresi untuk setiap defect yang diperbaiki |
| Product Owner | Menyetujui acceptance criteria, memprioritaskan backlog dan defect, menjalankan dan menandatangani UAT |
