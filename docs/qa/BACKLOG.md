# Product Backlog — CekHarga

Diperbarui 2026-10-06. Pemilik: Product Owner. Diurutkan dengan **WSJF** (Weighted Shortest Job First):

> WSJF = (Nilai bisnis + Urgensi waktu + Pengurangan risiko) ÷ Ukuran

Setiap komponen dinilai dengan skala Fibonacci (1, 2, 3, 5, 8, 13). Angka WSJF dipakai sebagai bahan diskusi saat Backlog Refinement, bukan keputusan otomatis: PO tetap bisa menggeser urutan dengan alasan yang dicatat.

## Backlog berprioritas

| # | ID | Item | Sumber | Nilai | Urgensi | Risiko | Ukuran | WSJF | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PB-11 | Ganti kata sandi akun admin utama (pernah dibagikan lewat chat) | Audit keamanan | 5 | 8 | 13 | 1 | **26.0** | Siap |
| 2 | PB-01 | Deploy ke Vercel; isi `CRON_SECRET` dan `IMPORT_WORKER_SECRET`; jadwal worker per menit di InsForge | US-10, TEST-PLAN §4 | 13 | 8 | 8 | 3 | **9.7** | Siap |
| 3 | PB-05 | Peringatan di dasbor bila pemeriksaan harian sebuah merek gagal | US-33 | 5 | 5 | 8 | 3 | **6.0** | Siap |
| 4 | PB-08 | Remote git + CI (unit, integrasi di staging, E2E smoke setiap PR); pindahkan register defect ke issue tracker | TEST-PLAN §3 | 5 | 3 | 8 | 3 | **5.3** | Perlu remote |
| 5 | PB-03 | Lengkapi penawaran untuk 29 produk terbit tanpa harga (tarik ulang atau CSV) | SQL-11 | 8 | 5 | 3 | 3 | **5.3** | Siap (tugas data) |
| 6 | PB-04 | Lengkapi NFC/IP rating untuk 34 produk terbit | US-25 | 5 | 3 | 2 | 3 | **3.3** | Siap |
| 7 | PB-09 | Lingkungan uji terpisah (InsForge branch) | US-32 | 3 | 3 | 8 | 5 | **2.8** | Perlu refinement |
| 8 | PB-06 | Tandai dan perbarui URL penawaran resmi yang berganti (Samsung) | US-26, DEF-015 | 3 | 2 | 3 | 3 | **2.7** | Siap |
| 9 | PB-07 | Tanya AI Sprint B | Rencana Tanya AI | 8 | 2 | 2 | 8 | **1.5** | Perlu refinement |
| 10 | PB-02 | Pemeriksaan ulang harga marketplace (69 penawaran > 7 hari) | US-12, SQL-12 | 8 | 5 | 3 | 13 | **1.2** | Perlu refinement (izin sumber) |
| 11 | PB-12 | Structured data `Product` + `Offer`/`AggregateOffer` di halaman detail (tanpa `aggregateRating`/`review` karangan, AGENTS.md) dan uji Rich Results | UX-22 | 8 | 3 | 3 | 3 | **4.7** | Siap setelah PB-01 |
| 12 | PB-13 | Konfirmasi nama badan hukum (PT Sinteniki vs PT Sinteniki Digital Solusi) lalu seragamkan situs dan dokumen | UX-23 | 3 | 5 | 5 | 1 | **13.0** | ✅ Selesai 2026-10-08 |
| 13 | PB-14 | Selaraskan batas harga segar dengan jadwal cron (±30 jam atau cron 2×/hari) | UX-24 | 5 | 3 | 3 | 1 | **11.0** | ✅ Selesai 2026-10-08 (30 jam) |
| – | PB-10 | Modul iklan: Fase 3–4 (laporan otomatis, invoice, portal advertiser, sponsored listing) | ADS-CONTEXT §10 | – | – | – | – | – | **Ditahan** oleh pemilik produk |

### Catatan prioritas

- **PB-11 di urutan pertama** walau nilainya kecil: risikonya besar dan ukurannya paling kecil. Kata sandi yang pernah dikirim lewat percakapan harus dianggap bocor.
- **PB-01 membuka nilai dari pekerjaan yang sudah selesai.** Pemeriksaan harga harian (US-10) sudah dibangun, tapi baru berjalan otomatis setelah ada URL publik dan secret terpasang. Tanpa itu, metrik "harga segar" akan turun lagi ke 0 dalam 24 jam.
- **PB-13 dan PB-14 kecil tetapi bernilai tinggi (WSJF tinggi):** keduanya hanya menunggu keputusan PO, bukan kerja teknis besar. Urutan di tabel mengikuti waktu masuk; saat refinement berikutnya keduanya layak naik ke atas.
- **PB-02 sengaja di bawah** karena ukurannya belum pasti dan ada pertanyaan kepatuhan. Apakah marketplace mengizinkan pengambilan otomatis? Aturan proyek melarang menembus anti-bot. Story ini perlu refinement bersama pemilik produk sebelum bisa diperkirakan.

## Definition of Ready

Sebuah item boleh masuk sprint bila:

1. Ditulis sebagai user story (peran, kemampuan, manfaat) atau tugas teknis dengan alasan bisnis yang jelas.
2. Punya acceptance criteria Gherkin yang disetujui PO dan bisa diuji.
3. Bergantung pada sesuatu yang sudah tersedia (akses, kredensial, keputusan bisnis), atau ketergantungannya tercatat.
4. Sudah diperkirakan tim (story point) dan muat dalam satu sprint. Kalau tidak, dipecah dulu.
5. Tidak bertentangan dengan PRD. Kalau bertentangan, keputusan PO dicatat di story.

## Definition of Done

Sebuah item dianggap selesai bila:

1. Semua acceptance criteria lulus dan punya tes otomatis. Pengecualian (misalnya keluaran model AI) dicatat sebagai kasus manual di TEST-CASES.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test:import`, `pnpm test:assistant` bersih.
3. `pnpm test:e2e:smoke` lulus. Bila menyentuh impor: `pnpm test:integration` lulus.
4. Perubahan skema berupa migration baru dan sudah diterapkan. `pnpm qa:sql` tanpa pelanggaran tingkat `gagal`.
5. Tidak ada defect terbuka berseverity Kritis atau Tinggi yang terkait item ini.
6. Dokumentasi yang terdampak diperbarui (PRD, ADS-CONTEXT §14, `.env.example`, folder ini).
7. Didemokan di Sprint Review dan diterima PO (UAT untuk story yang terlihat pengguna).
