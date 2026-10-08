# Test Cases — CekHarga

Setiap kasus uji terlacak ke user story ([USER-STORIES.md](USER-STORIES.md)) dan ke FR di PRD. Kolom **Otomasi** menunjuk berkas skrip. Kolom **2026-10-06** berisi hasil eksekusi terakhir ([TEST-REPORT-2026-10-06.md](TEST-REPORT-2026-10-06.md)).

Singkatan jenis: F = Functional, R = Regression, S = Smoke, Sec = Keamanan, A11y = Aksesibilitas, Int = Integrasi, D = Data (SQL), M = Manual.

## 1. Situs publik

| ID | Story / FR | Skenario | Hasil yang diharapkan | Jenis | Otomasi | 2026-10-06 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-BRD-01 | US-08 / FR-01 | Klik CTA "Cari Produk" di beranda | Katalog terbuka dan ringkasan jumlah produk tampil | F, S | `e2e/public/home.spec.ts` | Lulus |
| TC-BRD-02 | US-08 / FR-01 | Klik CTA "Tanya AI" | Halaman asisten terbuka | F, S | `home.spec.ts` | Lulus |
| TC-BRD-03 | US-08 / FR-01 | Baca seluruh teks beranda | Tidak ada testimonial, jumlah pengguna, "terlaris", "#1" (kalimat penyangkalan tidak dihitung) | F, R | `home.spec.ts` | Lulus |
| TC-BRD-04 | ADS §14.2 | Buka beranda tanpa kampanye iklan aktif | Tidak ada elemen `data-ad-slot` (tidak ada ruang kosong) | R | `home.spec.ts` | Lulus |
| TC-KAT-01 | US-01 / FR-02 | Cari "Galaxy" dari katalog | `q=Galaxy` di URL, jumlah hasil > 0 dan lebih kecil dari total | F, S | `e2e/public/catalog.spec.ts` | Lulus |
| TC-KAT-02 | US-01 / FR-02 | Buka `?merek=samsung&urut=price-asc` lalu reload | Urutan produk identik sebelum dan sesudah reload, semua Samsung | F, R | `catalog.spec.ts` | Lulus |
| TC-KAT-03 | US-02 / FR-02 | Urutkan "Harga terendah" | Harga kartu menaik | F, R | `catalog.spec.ts` | Lulus |
| TC-KAT-04 | US-01, US-11 / §7 | Filter `harga_max=4000000` | Tidak ada kartu "Harga belum tersedia", semua harga ≤ Rp4.000.000 | F, S | `catalog.spec.ts` | Lulus |
| TC-KAT-05 | US-01 / FR-02 | Buka URL dengan parameter rusak (`ram=abc`, `hal=-3`) | Status 200, katalog tetap tampil | R | `catalog.spec.ts` | Lulus |
| TC-KAT-06 | US-01 / FR-02 | Filter yang tidak cocok dengan produk apa pun | "0 produk yang cocok", pesan, dan tautan untuk melepas filter | F, R | `catalog.spec.ts` | Lulus |
| TC-KAT-07 | US-01 / FR-02, §8 | Ubah filter | Ringkasan hasil ada di wilayah `aria-live="polite"` | A11y, R | `catalog.spec.ts` | Lulus |
| TC-KAT-08 | US-11 / §7 | Lihat kartu berharga | Kartu menyebut "Varian x/y GB" dan waktu pemeriksaan | F, S | `catalog.spec.ts` | Lulus |
| TC-DET-01 | US-03 / FR-03 | Buka detail produk berharga | Harga, varian acuan, dan waktu pemeriksaan tampil | F, S | `e2e/public/product.spec.ts` | Lulus |
| TC-DET-02 | US-03 / FR-03 | Pilih varian lain | URL memuat `varian=`, varian terpilih ditandai `aria-current` | F, R | `product.spec.ts` | Lulus |
| TC-DET-03 | US-03 / FR-03 | Buka slug yang tidak ada | Status 404 | F, S | `product.spec.ts` | Lulus |
| TC-DET-04 | US-04 / FR-05 | Periksa tombol penawaran | Semua `https://`, buka tab baru dengan `noopener`, tanpa klaim transaksi oleh CekHarga | F, R | `product.spec.ts` | Lulus |
| TC-DET-05 | US-11 / §7 | Buka produk tanpa harga (halaman terakhir urutan harga) | Halaman terbaca, "Harga belum tersedia", tidak ada "Rp0" | F, R | `product.spec.ts` | Lulus |
| TC-CMP-01 | US-05 / FR-04 | Bandingkan dua produk lewat URL | Varian tampil, tanpa klaim pemenang/skor | F, S | `e2e/public/compare-assistant.spec.ts` | Lulus |
| TC-CMP-02 | US-05 / FR-04 | Kirim empat produk di URL | Halaman 200, maksimal tiga produk dibandingkan | R | `compare-assistant.spec.ts` | Lulus |
| TC-CMP-03 | US-05 / UX-09 | Bandingkan dua produk | Spesifikasi berupa tabel ARIA: tiap baris satu rowheader dan satu cell per produk | A11y, R | `compare-assistant.spec.ts` | Lulus (2026-10-07) |
| TC-KAT-09 | US-11 / UX-13 | Kartu produk tanpa foto asli | Teks "Foto belum tersedia", ilustrasi `alt=""` | R | `catalog.spec.ts` | Lulus (2026-10-07) |
| TC-AI-01 | US-06 / FR-06 | Budget wajib Rp5 jt, RAM wajib 8 GB | Kandidat lolos ≤ Rp5 jt dan RAM ≥ 8 GB, ada pernyataan "bukan peringkat kualitas" | F, S | `compare-assistant.spec.ts` | Lulus |
| TC-AI-02 | US-06 / FR-06 | Kandidat dengan harga lama | Dipisah ke grup "perlu dicek ulang" | F, R | `compare-assistant.spec.ts` | Lulus |
| TC-AI-03 | US-06 / FR-06 | Isi budget di jalur formulir | Lanjut ke langkah berikutnya tanpa model AI | F, R | `compare-assistant.spec.ts` | Lulus |
| TC-TRN-01 | US-07 / FR-08 | Buka "Cara kerja" | Menjelaskan sumber dan keterbatasan | F, R | `compare-assistant.spec.ts` | Lulus |
| TC-TRN-02 | ADS §8 | Ambil `/ads.txt` | 200, `text/plain` | R | `compare-assistant.spec.ts` | Lulus |
| TC-TRN-03 | §13 | Ambil `/api/health` | 200 di mode live | S | `compare-assistant.spec.ts` | Lulus |
| TC-A11Y-01 | §8 | Beranda, katalog, asisten di Pixel 7 | Tanpa scroll horizontal | A11y | `e2e/public/a11y.mobile.spec.ts` | Lulus (3/3) |
| TC-A11Y-02 | §8 | Tautan kartu katalog di ponsel | Tinggi ≥ 44 px | A11y | `a11y.mobile.spec.ts` | Lulus |
| TC-A11Y-03 | §8 | Tekan Tab di beranda | Elemen fokus punya outline atau ring | A11y | `a11y.mobile.spec.ts` | Lulus |
| TC-A11Y-04 | §8 / UX-01 | Fokus kolom budget Tanya AI | Kotak composer menampilkan ring fokus | A11y, R | `a11y.mobile.spec.ts` | Lulus (2026-10-07) |
| TC-A11Y-06 | §8 / UX-05 | 5 halaman utama | Tidak ada teks di bawah 12 px | A11y, R | `a11y.mobile.spec.ts` | Lulus (5/5, 2026-10-07) |
| TC-A11Y-07 | §8 / UX-07 | 5 halaman utama | H2 ≤ H1 dan H3 ≤ H2 | A11y, R | `a11y.mobile.spec.ts` | Lulus (5/5, 2026-10-07) |
| TC-A11Y-05 | §8 / UX-06 | Ukur tautan "Beriklan" dan "Ketentuan Layanan" di footer | Tinggi ≥ 44 px | A11y, R | `a11y.mobile.spec.ts` | Lulus (2026-10-07) |

## 2. Keamanan

| ID | Story / FR | Skenario | Hasil yang diharapkan | Jenis | Otomasi | 2026-10-06 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-SEC-01 | US-23 / FR-07 | Buka `/admin`, `/admin/import`, `/admin/products`, `/admin/iklan` tanpa sesi | Dialihkan ke `/admin/login` | Sec, S | `e2e/security/access.spec.ts` | Lulus |
| TC-SEC-02 | US-24 / DEF-001 | Buka halaman login | Email kosong, bisa diisi, `autocomplete` username/current-password | Sec, S, R | `access.spec.ts` | Lulus |
| TC-SEC-03 | US-24 | Login dengan email tak terdaftar | Pesan seragam "Email atau kata sandi tidak cocok." | Sec, R | `access.spec.ts` | Lulus |
| TC-SEC-04 | US-31 | Panggil `/api/cron/daily`, worker impor, maintenance iklan tanpa/dengan token salah | 401 | Sec, S | `access.spec.ts` | Lulus (3/3) |
| TC-SEC-05 | US-30 / FR-07 | Baca 8 tabel internal dengan anon key | 0 baris | Sec, R | `access.spec.ts` | Lulus (8/8) |
| TC-SEC-06 | US-30 / FR-07 | Baca produk draft dengan anon key | 0 baris | Sec, S | `access.spec.ts` | Lulus |
| TC-SEC-07 | US-30 / FR-07 | Tulis produk dengan anon key | Ditolak | Sec, R | `access.spec.ts` | Lulus |

## 3. Admin, impor, dan peran

| ID | Story / FR | Skenario | Hasil yang diharapkan | Jenis | Otomasi | 2026-10-06 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-ADM-01 | US-22 | Buka dasbor admin | Metrik "Harga masih segar", "Terbit tanpa harga", dan tiga kelompok celah data tampil | F, S | `e2e/admin/admin.spec.ts` | Lulus |
| TC-ADM-02 | US-22 | Klik "Tarik ulang" di kelompok tanpa penawaran | Tab Tarik terbuka dengan merek terpilih | F, R | `admin.spec.ts` | Lulus |
| TC-ADM-03 | US-22 / DEF-004 | Lihat riwayat impor dasbor | Hanya batch buatan admin, tanpa pemeriksaan harian | R | `admin.spec.ts` | Lulus |
| TC-IMP-01 | US-20 | Buka Pusat Impor | Empat tab, tab riwayat menampilkan asal batch | F, S | `admin.spec.ts` | Lulus |
| TC-IMP-02 | US-20 | Buka `/admin/scrape` | Dialihkan ke `?tab=tarik` | R | `admin.spec.ts` | Lulus |
| TC-ROLE-01 | US-23 | Masuk sebagai `sales` sementara | Beranda staf; impor dan produk ditolak; iklan terbuka; akun dihapus setelah tes | Sec, S | `admin.spec.ts` | Lulus |
| INT-01 | US-20, US-21 | Tarik otomatis → terapkan → harga resmi lanjutan → sunting/terbitkan → undo | Jejak asal tercatat; undo hanya menghapus draft yang belum disentuh; penawaran produk terbit dilindungi; undo kedua ditolak | Int, R | `scripts/tests/integration/import-flow.test.ts` | Lulus |
| INT-02 | US-20 / DEF-005 | Terapkan draft berumur 20 hari | Ditolak server | Int, R | `import-flow.test.ts` | Lulus |
| INT-03 | US-21 | Undo saat foto sedang diunggah, lalu setelah selesai | Ditolak dulu; kemudian foto draft dihapus (DB + storage), foto produk terbit tetap, antrean dibatalkan | Int, R | `import-flow.test.ts` | Lulus |
| INT-04 | US-10 | Retensi dan kunci harian | Job foto > 30 hari dan batch terjadwal > 30 hari terhapus; kunci harian ganda ditolak DB | Int, R | `import-flow.test.ts` | Lulus |

## 4. Integritas data (SQL)

Dijalankan dengan `pnpm qa:sql`. Definisi query ada di `scripts/qa/sql-checks.mjs`.

| ID | Pemeriksaan | Tingkat | 2026-10-06 |
| --- | --- | --- | --- |
| SQL-01 | Produk terbit tanpa varian | gagal | Lulus |
| SQL-02 | Harga ≤ 0 | gagal | Lulus |
| SQL-03 | Pengamatan harga bertanggal masa depan | gagal | Lulus |
| SQL-04 | URL penawaran bukan https | gagal | Lulus |
| SQL-05 | `offer_latest_price` tidak sama dengan riwayat | gagal | Lulus |
| SQL-06 | View tanpa `security_invoker` yang bisa dibaca anon | gagal | Lulus |
| SQL-07 | Peran staf tidak dikenal | gagal | Lulus |
| SQL-08 | Pemeriksaan harian ganda per merek per tanggal | gagal | Lulus |
| SQL-09 | Batch impor macet > 15 menit | peringatan | Lulus |
| SQL-10 | Antrean foto macet > 1 jam | peringatan | Lulus |
| SQL-11 | Produk terbit tanpa penawaran | peringatan | **29 produk** → PB-03 |
| SQL-12 | Penawaran aktif belum diperiksa > 7 hari | peringatan | **69 penawaran** (marketplace) → PB-02 |
| SQL-13 | Draft kedaluwarsa belum dibatalkan | peringatan | Lulus |

## 5. Kasus manual

Kasus berikut tidak diotomasi karena keluarannya tidak deterministik (model AI), bergantung situs pihak ketiga, atau butuh penilaian manusia.

### TC-M-01 Mode percakapan Tanya AI (US-06, FR-06)

- **Prekondisi:** `OPENROUTER_API_KEY` terpasang.
- **Langkah:**
  1. Buka `/assistant`.
  2. Tulis "budget maksimal 4 juta, wajib NFC, buat foto".
  3. Jawab pertanyaan lanjutan sampai kandidat muncul.
- **Diharapkan:**
  - AI tidak menanyakan ulang budget yang sudah disebut.
  - Semua kandidat ≤ Rp4 jt dan NFC "Ada".
  - Kandidat di luar budget diberi label.
  - Tidak ada harga atau review karangan.
  - Bila model gagal, ada tombol coba lagi dan tautan ke jalur formulir.

### TC-M-02 Unggah CSV spesifikasi sampai diterapkan (US-20)

- **Langkah:**
  1. Admin membuka Pusat Impor → Unggah.
  2. Unggah CSV GSMArena kecil (3 baris).
  3. Tinjau pratinjau: Baru, Berubah, Dilewati beserta alasannya.
  4. Klik Terapkan.
- **Diharapkan:**
  - Bar progres berjalan sampai "Diterapkan".
  - Kolom hasil per baris terisi.
  - Produk baru berstatus draft.
  - Halaman produk menampilkan "Asal data: batch …".

### TC-M-03 Tarik otomatis tahan refresh (US-20)

- **Langkah:**
  1. Buka tab Tarik.
  2. Pilih vivo, lalu klik "Muat daftar".
  3. Ambil spesifikasi 3 model.
  4. Refresh tab di tengah proses.
- **Diharapkan:** hasil yang sudah diambil tetap ada (dibaca dari sesi server), dan proses bisa dilanjutkan.

### TC-M-04 Pemeriksaan harga harian, uji sistem (US-10)

- **Prekondisi:** `CRON_SECRET` terpasang.
- **Langkah:**
  1. `curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/daily`.
  2. Panggil ulang di hari yang sama.
- **Diharapkan:**
  - Panggilan pertama selesai < 60 detik, mengembalikan status per merek, dan batch berstatus "Diterapkan".
  - Panggilan kedua mengembalikan `already-checked` untuk merek yang sudah diperiksa.
  - Metrik "Harga masih segar" di dasbor naik.

### TC-M-05 Undo dari layar (US-21)

- **Langkah:**
  1. Buka batch yang sudah diterapkan.
  2. Baca ringkasan undo.
  3. Klik "Urungkan batch" dan konfirmasi dialog.
- **Diharapkan:**
  - Ringkasan menyebut yang dihapus dan yang tidak dikembalikan (produk terbit, foto yang diganti).
  - Status menjadi "Diurungkan".
  - Halaman publik produk terbit tidak berubah.

### TC-M-06 Eksplorasi (setiap sprint, 60 menit)

Fokus bergiliran: input ekstrem di filter katalog, URL perbandingan yang dimanipulasi, klik ganda pada tombol Terapkan/Urungkan, dan tampilan di layar 320 px. Temuan dicatat di [DEFECTS.md](DEFECTS.md).
