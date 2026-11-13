# Rencana Rombak UI Publik CekHarga: Tema Verdant (November 2026)

Lokasi di repo: `docs/ux/REDESIGN-VERDANT-2026-11.md`. Aturan gaya ada di `DESIGN.md` (root). Urutan prompt per tiket ada di `docs/ux/verdant/PROMPTS.md`. Catatan akhir tiap tiket ada di `docs/ux/verdant/VD-xx.md`.

## 1. Latar belakang

1. Pemilik produk menyukai gaya UI dan motion template Verdelo dan ingin menerapkannya ke UI publik CekHarga.
2. Identitas CekHarga sudah dekat: tema teal/navy, navigasi kapsul, kartu membulat 28px, Motion sudah terpasang. Jadi ini **rombak bertahap**, bukan tulis ulang.
3. Rombakan ini mengubah keputusan visual PRD §8 tanggal 7 Oktober 2026 (tanpa kaca, tanpa gradien, entrance 280 sampai 420ms). Perubahan dicatat sebagai keputusan baru di PRD sebelum kode diubah (tiket VD-00).

## 2. Tujuan dan ukuran berhasil

1. UI publik terasa tenang dan premium dengan ciri Verdant: kaca di atas foto latar, aksen mint, motion halus.
2. Tidak ada aturan PRD yang dilanggar (harga, freshness, tanpa skor/peringkat, aksesibilitas).
3. Lighthouse mobile Performance dan Accessibility tetap di atas 90 pada beranda, katalog, dan detail produk.
4. Tidak ada regresi pada test e2e `@smoke` dan `@regression`.

## 3. Cakupan

**Termasuk:** layout publik, header, footer, beranda, katalog `/products`, detail produk, perbandingan `/compare` dan `/bandingkan/[pasangan]`, Tanya AI `/assistant`, halaman kebutuhan `/hp`, halaman statis (cara kerja, FAQ, ketentuan), dan `/style-guide`.

**Tidak termasuk:** admin (`.admin-theme`), logika data, API, scraping, modul iklan (hanya penyesuaian warna slot agar label "Iklan" tetap terbaca; baca `docs/ads/ADS-CONTEXT.md`).

## 4. Pemetaan Verdelo ke CekHarga

| Elemen Verdelo | Padanan di CekHarga | Status |
|---|---|---|
| Foto latar + kaca pre-blurred, variabel `--frost` | Scene Backdrop dan token kaca | Dipakai; pre-blurred hanya panel hero (DESIGN.md §6) |
| Aksen mint, kanvas hijau gelap | Token Verdant Day/Night | Dipakai |
| Header kapsul, tombol ikon bulat | Glass Header (sudah ada navigasi kapsul) | Dipakai |
| Segmented control dengan thumb bergeser | Pilih varian/warna, urutan katalog, tab hero tour | Dipakai |
| Saldo besar + count-up | Harga di detail saat varian berubah | Dipakai, tidak dari 0 dan tidak saat halaman dimuat |
| Daftar transaksi ("Latest payments") | Daftar penawaran (Offer Row) | Dipakai |
| Daftar tagihan dengan date tile ("Coming up") | Riwayat pemeriksaan bila < 5 data | Dipakai |
| Carousel "Noticed" | Carousel ringkasan ulasan | Dipakai |
| Quick send (avatar + chip nominal) | Quick Start Tanya AI (chip budget dan kebutuhan) | Dipakai |
| Tumpukan kartu bank 3D yang bisa dibalik | Opsional: tumpukan produk di hero | Opsional, diputuskan setelah VD-04 |
| Grafik saldo dengan garis perkiraan | Riwayat harga | Hanya gaya garisnya; garis perkiraan DILARANG (PRD PB-31) |
| Bar chart kapsul, bar kategori pengeluaran | Tidak ada padanan yang jujur untuk spesifikasi | Tidak dipakai (bisa terbaca sebagai skor) |
| Aplikasi di dalam "jendela" melayang | Situs konten panjang + SEO | Tidak dipakai |
| GSAP | Motion (sudah terpasang) | Ganti dengan Motion |

## 5. Tahapan dan tiket

Setiap tiket dikerjakan di branch terpisah (`redesign/vd-xx-nama`), commit sebelum perubahan besar, dan diakhiri dengan pengecekan di bagian 6.

| Tiket | Isi | Keluaran |
|---|---|---|
| VD-00 | Keputusan dan dokumen | Amandemen PRD §8, `DESIGN.md` (revisi B1 sampai B10), catatan di `CLAUDE.md`, `cekharga-antislop`, ADS-CONTEXT §12.2, skrip `scripts/build-scene.mjs`; aset scene di `public/images/scene/` menyusul setelah foto sumber tersedia |
| VD-01 | Token dan tema | `globals.css` Verdant Day/Night, token kaca, bayangan, radius; `/style-guide` diperbarui |
| VD-02 | Fondasi motion | `src/lib/motion.ts`, komponen `CountUp`, `SegmentedControl`, penyesuaian `reveal.tsx` dan `StaggerList` |
| VD-03 | Shell | Scene Backdrop, Glass Header, footer, Compare Tray kaca |
| VD-04 | Beranda | Hero Price Panel, hero tour, rail produk, chip kebutuhan, contoh perbandingan, Quick Start AI, transparansi |
| VD-05 | Katalog dan halaman kebutuhan | Filter Bar kaca, Product Card dengan panggung foto, animasi layout saat hasil berubah |
| VD-06 | Detail produk | Segmented varian/warna, harga count-up, Offer Row, Price History, Recent Checks, Review Carousel |
| VD-07 | Perbandingan | Kartu kandidat, penanda "beda", ringkasan selisih harga |
| VD-08 | Tanya AI | Scene penuh, composer kaca, Quick Start, Recommendation Card dengan stagger |
| VD-09 | QA menyeluruh | Screenshot 375/768/1440 dua tema, Lighthouse, kontras, reduced motion, CPU throttle 4x, audit antislop |

## 6. Definisi selesai per tiket

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, dan `pnpm test:e2e:smoke` lolos.
2. Screenshot sebelum dan sesudah di lebar 375px dan 1440px, tema terang dan gelap, disimpan di `qa-shots/verdant/<tiket>/`. Folder ini di-ignore git karena PRD §12 melarang screenshot masuk Git; yang di-commit hanya catatan `docs/ux/verdant/<tiket>.md`. Referensi Verdelo juga tidak di-commit.
3. Tidak ada hex baru di komponen; semua lewat token.
4. Harga, tabel, dan penawaran tetap di permukaan solid.
5. Dengan reduced motion aktif, semua konten tampil tanpa animasi.
6. Catatan singkat di akhir tiket: apa yang berubah, apa yang sengaja tidak diubah, dan sisa pekerjaan.

## 7. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Kaca dan foto latar memperlambat HP kelas menengah ke bawah | Scene lewat `next/image` (srcset, `fetchPriority` hanya tema aktif), master AVIF ≤ 200 KB, kaca tanpa gambar kecuali panel hero, tanpa `background-attachment: fixed`, `backdrop-filter` hanya elemen menempel/melayang, uji CPU throttle 4x |
| Teks di atas foto sulit dibaca | `--veil-text` di zona copy hero, `--glass-text` untuk kaca berteks (angka terburuk di `DESIGN.md` §3), data hanya di permukaan solid, ukur kontras pada kondisi terburuk |
| Count-up menampilkan "Rp0" atau angka palsu | Harga final dirender server; animasi hanya saat varian berubah, dari harga lama ke baru |
| Foto produk berlatar putih terlihat "kotak" di tema gelap | Panggung foto terang (`--stage`) di semua tema |
| Animasi lebih panjang terasa lambat | Elemen di atas lipatan tampil cepat, stagger maksimal 8 item, data reveal hanya sekali |
| Tampilan menyerupai produk berbayar Verdelo | Tidak menyalin kode, foto, ikon, atau teks; foto scene milik sendiri/berlisensi |
