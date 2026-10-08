# Scrum — CekHarga

## Ritme

Sprint 2 minggu, mulai Senin.

| Seremoni | Kapan | Durasi | Masukan | Keluaran |
| --- | --- | --- | --- | --- |
| Sprint Planning | Senin minggu 1 | 2 jam | [BACKLOG.md](BACKLOG.md) teratas yang memenuhi Definition of Ready | Sprint goal, item terpilih, rencana tugas |
| Daily Scrum | Setiap hari kerja | 15 menit | Papan sprint | Hambatan yang perlu dibantu hari ini |
| Backlog Refinement | Rabu minggu 2 | 1 jam | Item "Perlu refinement" | Gherkin disetujui, estimasi, item dipecah |
| Sprint Review | Jumat minggu 2 | 1 jam | Item selesai, [UAT.md](UAT.md) | Demo, keputusan PO, backlog diperbarui |
| Retrospective | Jumat minggu 2, setelah review | 45 menit | Data sprint (defect, tes, hambatan) | 1–3 aksi perbaikan dengan penanggung jawab |

Peran QA di setiap seremoni:

- **Planning:** QA memastikan setiap item punya acceptance criteria yang bisa diuji, dan memperkirakan kerja uji di dalam story point.
- **Refinement:** QA menulis skenario negatif dan kasus tepi. Contoh nyata: skenario "S26 vs S26+" menemukan DEF-002 sebelum rilis.
- **Review:** QA menyajikan ringkasan hasil uji dan defect terbuka sebelum PO memutuskan.
- **Retro:** QA membawa metrik: defect lolos ke produksi, waktu jalan suite, dan tes yang flaky.

## Usulan Sprint 1 (mulai Senin berikutnya)

**Sprint goal:** *Harga tetap segar di produksi tanpa kerja manual, dan pengunjung tidak lagi melihat produk terbit tanpa harga atau spesifikasi kunci.*

| Item | Story point | Alasan masuk sprint |
| --- | --- | --- |
| PB-11 Ganti kata sandi admin | 1 | Risiko keamanan, sangat kecil |
| PB-01 Deploy + secret + jadwal worker | 3 | Tanpa ini pemeriksaan harian tidak berjalan otomatis |
| PB-05 Peringatan pemeriksaan harian gagal | 3 | Menjaga sprint goal tetap tercapai setelah sprint selesai |
| PB-03 Lengkapi penawaran 29 produk terbit | 3 | Langsung mengurangi "Terbit tanpa harga" |
| PB-04 Lengkapi NFC/IP 34 produk | 3 | Filter "wajib NFC" di Tanya AI jadi lebih akurat |
| **Total** | **13** | Kapasitas aktual ditetapkan tim saat Planning. Bila kapasitas < 13, PB-04 dikeluarkan lebih dulu. |

Ukuran keberhasilan sprint goal, yang dicek di Sprint Review:

- "Harga masih segar" di dasbor tetap ≥ 60% dari produk berharga selama 3 hari berturut-turut setelah deploy.
- SQL-11 (produk terbit tanpa penawaran) turun dari 29 menjadi ≤ 10.
- Tidak ada defect baru berseverity Kritis atau Tinggi.

## Agenda Backlog Refinement berikutnya

1. **PB-02 Harga marketplace:** putuskan jalur yang patuh (CSV rutin vs kerja sama data). Bila CSV, pecah menjadi pengingat dasbor (3 SP) dan templat CSV per marketplace (2 SP).
2. **PB-07 Tanya AI Sprint B:** tulis ulang lingkupnya sebagai user story dengan Gherkin sebelum diestimasi.
3. **PB-09 Lingkungan uji:** pastikan dukungan InsForge branch di versi backend saat ini.

## Retrospektif periode 2026-09-24 s.d. 2026-10-06

Periode ini mencakup perombakan impor Fase 0–5, Tanya AI Sprint A, dan pemeriksaan harga harian.

**Yang berjalan baik (lanjutkan)**

- Uji integrasi ke database nyata menangkap dua defect Kritis (DEF-007, DEF-011) yang tidak akan terlihat di unit test.
- Menulis skenario negatif lebih dulu menangkap DEF-002 sebelum pemeriksaan harian dirilis.
- Setiap fase ditutup dengan audit, sehingga celah desain (DEF-005, DEF-015) ditemukan sebelum menjadi insiden.

**Yang menghambat (hentikan atau ubah)**

- Uji peran hanya memakai akun admin, sehingga DEF-001 (login terkunci satu email) lolos beberapa fase. **Aksi:** TC-ROLE-01 kini memakai akun staf sementara dan wajib di smoke suite.
- Hasil uji sistem cron awalnya hanya dicek dari angka ringkasan, bukan isi datanya, sehingga DEF-003 hampir lolos. **Aksi:** pemeriksaan SQL (`pnpm qa:sql`) dijalankan setelah setiap uji sistem.
- Uji integrasi masih menulis ke database yang sama dengan katalog. **Aksi:** PB-09 (lingkungan uji terpisah).

**Mulai lakukan**

- Jalankan `pnpm test:e2e:smoke` di CI untuk setiap PR, setelah remote tersedia (PB-08).
- Sesi uji eksploratif 60 menit per sprint dengan fokus bergiliran (TC-M-06).
