# Sprint 13: Beranda dan filter katalog yang langsung dimengerti

Disusun 11 November 2026 dari masukan PO (empat poin) dan audit memakai skill `cekharga-antislop` + `antislop`. **Status: dikerjakan 11 November 2026 di branch `sprint-13/beranda-katalog` (dari Sprint 12), belum di-commit dan belum dideploy.**

## 0. Hasil

| Tiket | Status | Catatan |
|---|---|---|
| S13-1 | Selesai | `assistant-intro.tsx`; `?pesan=` mengisi kolom chat lewat `AssistantChat initialMessage`, tidak mengirim. |
| S13-2 | Selesai | `transparency-teaser.tsx` memakai produk hero; rincian batasan dipindah ke `/how-it-works#batasan`, dua kalimat basi di sana diperbaiki. |
| S13-3 | Selesai | `hero-tour.tsx` + `hero-tour-data.ts`; `hero-device.tsx`, `hero-story.tsx`, `concept-glyphs.tsx` dihapus. Adegan tanpa data disembunyikan. |
| S13-4 | Selesai | `catalog-filters.tsx` + `filter-popover-dismiss.tsx`. |
| S13-5 | Selesai | `docs/ux/anti-slop/audit-001-2026-11-11.md`. |

Penyesuaian dari rancangan yang disetujui:

1. **Adegan Cari** mengetik "HP di bawah 5 juta", bukan "NFC di bawah 5 juta", karena hasil yang tampil adalah produk asli berharga di bawah Rp5 juta dan katalog belum tentu bisa membuktikan NFC-nya.
2. **Filter di ponsel**: tiap chip membuka panel dari bawah layar, bukan satu tombol "Filter (n)". Satu tombol akan menggandakan isian form dan membutuhkan JavaScript; bentuk sekarang tetap berfungsi tanpa JavaScript.
3. **Adegan Bandingkan** mendahulukan baris spesifikasi yang berbeda, supaya komprominya terlihat.
4. **Remotion** tidak dipakai di sprint ini; menunggu jumlah karyawan PT Sinteniki (keputusan 3).

**Sprint goal:** *Pengunjung beranda paham dalam beberapa detik apa yang bisa dilakukan CekHarga, tertarik mencoba Tanya AI, dan bisa menyaring katalog tanpa mencari-cari tombol filter.*

## 1. Penilaian masukan PO

| # | Masukan | Penilaian | Alasan |
|---|---|---|---|
| 1 | "Kalau lebih mudah menjelaskan kebutuhan" bertele-tele; Asisten AI harus jadi sorotan | **Setuju** | Empat kartu glyph identik (R-14) menjelaskan cara kerja internal, bukan manfaat. Judulnya abstrak. Tombol "Tanya AI" ada di kartu kecil sebelah kanan, sehingga aksi utama justru kalah menonjol. |
| 2 | "Supaya kamu tahu angkanya dari mana" terlalu panjang | **Setuju** | Pola yang sama (4 kartu glyph, R-14) dipakai dua kali berturut-turut (melanggar RHYTHM). Ada 4 paragraf aturan dan 6 butir batasan dengan kalimat panjang. Isinya penting (PRD FR-08), tapi bentuknya perlu diganti. |
| 3 | Bingkai ponsel di hero tidak perlu; ganti motion yang lebih jelas | **Setuju sebagian** | Bingkai ponsel berisi balok abstrak memang tidak menyampaikan fitur. Tapi video di hero tidak disarankan: memperberat LCP dan bertentangan dengan PRD §8 (bergerak sekali, tanpa loop). Usulan: animasi dari potongan UI asli dengan `motion/react` yang sudah terpasang. Video tetap berguna untuk media sosial. |
| 4 | "Filter lainnya" tidak terlihat seperti tombol | **Setuju** | `<details>` bergaya baris teks, tanpa ikon atau bentuk tombol. Filter terpisah dari kotak cari, sehingga tidak terbaca sebagai satu alat. |

## 2. Tiket

| ID | Tiket | Poin |
|---|---|---|
| S13-1 | Asisten AI jadi sorotan beranda | 5 |
| S13-2 | Transparansi harga dalam bentuk "cara membaca harga" | 5 |
| S13-3 | Hero tanpa bingkai ponsel: cuplikan fitur dari UI asli | 8 |
| S13-4 | Bilah filter di bawah kotak cari | 5 |
| S13-5 | Audit antislop beranda + katalog dan perbaikan temuan ringan | 3 |
| | **Total** | **26** |

### S13-1 Asisten AI jadi sorotan

Berkas: `src/components/home/assistant-intro.tsx`, `src/app/(public)/assistant/page.tsx`.

**Usulan bentuk:** satu panel lebar dengan kotak isian sebagai titik fokus. Empat kartu perilaku diringkas menjadi satu baris jaminan.

**Copy usulan:**

- Judul: **Bingung pilih HP? Ceritakan saja.**
- Sub: Sebut budget dan dipakai untuk apa. Asisten mencarikan kandidat dari katalog CekHarga, lengkap dengan alasan dan komprominya.
- Placeholder kotak isian: *Contoh: budget 4 juta, sering foto anak, baterai awet*
- Tombol: **Carikan HP**
- Pilihan cepat: "Budget 2,5 juta, buat medsos" · "4 juta, utamakan kamera" · "7 juta, buat main game"
- Baris jaminan: Budget yang kamu tegaskan tidak dilanggar. Kalau tidak ada yang cocok, asisten bilang terus terang.
- Status AI aktif: titik hijau kecil + "Asisten AI aktif".
- Status AI tidak tersedia: "Asisten AI sedang tidak tersedia. Jawab beberapa pertanyaan singkat, hasilnya tetap dari katalog." Tombol: **Mulai pertanyaan**.
- Tautan sekunder: Lebih suka menyaring sendiri? **Buka katalog**

**Kriteria selesai:**

- Kotak isian mengirim ke `/assistant?pesan=...`. Pesan hanya **mengisi** kolom chat, tidak terkirim otomatis, supaya tidak ada panggilan LLM tanpa tindakan pengguna (aturan System Design 1). Parameter `pesan` dibatasi panjangnya.
- Pilihan cepat tetap memakai kontrak `?tanya=form&budget=...` yang sudah ada.
- Status AI tetap dari `hasAiCredentials()`; tampilan cocok dengan yang didapat di `/assistant`.
- Satu titik fokus (kotak isian), satu aksen. Lolos Delivery Gate.

### S13-2 Cara membaca harga

Berkas: `src/components/home/transparency-teaser.tsx`, halaman `/how-it-works` menampung detail yang dipindahkan.

**Usulan bentuk:** satu kartu harga **asli** dari katalog (produk yang sama dengan hero) dengan 4 penanda bernomor, lalu daftar "Yang belum bisa" yang pendek. Menunjukkan, bukan menjelaskan panjang.

**Copy usulan:**

- Judul: **Cara membaca harga di CekHarga**
- Sub: Kami bukan toko. Ini arti setiap angka yang kamu lihat.
- Penanda pada kartu:
  1. **Mulai dari**: harga terendah yang kami catat, belum tentu termurah se-internet.
  2. **Varian 8/256 GB**: harga berlaku untuk varian ini saja.
  3. **Diperiksa 9 jam lalu**: bukan real-time. Harga yang sudah lama disembunyikan.
  4. **Tanpa potongan**: voucher, cashback, kupon, dan harga yang butuh login tidak dihitung.
- Judul kecil: **Yang belum bisa**
  - Belum semua model HP masuk
  - Harga marketplace diperbarui berkala, belum otomatis
  - Tidak menguji HP sendiri, kualitas nyata dari reviewer
  - Belum ada notifikasi harga turun
  - Belum menilai penjual dan HP bekas
- Tautan: **Baca cara kerja lengkap**

**Kriteria selesai:**

- Angka pada kartu berasal dari data katalog yang sedang aktif, bukan contoh karangan (C-5). Bila produk tanpa harga, tampil "Harga belum tersedia" dan penanda menyesuaikan.
- Detail yang dibuang dari beranda (merek yang belum masuk, ulasan reviewer) tetap ada di `/how-it-works`.
- Di ponsel, penanda berubah menjadi daftar bernomor di bawah kartu, tanpa scroll horizontal.

### S13-3 Hero: cuplikan fitur dari UI asli

Berkas: `src/components/home/hero-story.tsx`, `hero.tsx`.

**Usulan bentuk:** bingkai ponsel dan balok abstrak dihapus. Diganti panggung 4 adegan yang memakai komponen asli yang diperkecil (kotak cari, baris perbandingan, kartu harga, gelembung Tanya AI), masing-masing dengan satu kalimat.

**Copy adegan usulan:**

1. **Cari dari kebutuhan**: ketik "NFC di bawah 5 juta", katalog langsung tersaring.
2. **Bandingkan 2 sampai 3 HP**: spesifikasi berdampingan, komprominya terlihat.
3. **Harga per varian**: lengkap dengan waktu periksa, lalu beli di toko pilihanmu.
4. **Masih bingung? Tanya AI**: ceritakan kebutuhanmu, kandidatnya dari katalog.

**Kriteria selesai:**

- Diputar sekali (total sekitar 12 detik), berhenti di adegan terakhir, ada tombol jeda dan pilihan langkah (WCAG 2.2.2, PRD §8).
- `prefers-reduced-motion`: tanpa autoplay, adegan dipilih manual.
- Judul hero (elemen LCP) tampil tanpa menunggu JavaScript. Tidak ada file video di hero.
- Data di adegan harga dan perbandingan dari katalog aktif. Kartu overlay produk yang sekarang dipertahankan atau digabung ke adegan 3.

**Riset alat motion:**

| Alat | Cocok untuk | Catatan |
|---|---|---|
| `motion/react` (sudah terpasang) | Hero di situs | Pilihan sprint ini. Tanpa dependensi baru, pakai komponen dan token asli, tajam di semua layar, mudah dihentikan untuk reduced motion. |
| Remotion | Video promosi (Instagram, TikTok, YouTube), video di `/how-it-works` | Video dibuat dari kode React, jadi bisa memakai komponen CekHarga. Gratis untuk individu dan perusahaan sampai 3 orang. Perusahaan 4 orang atau lebih wajib Company License, mulai sekitar USD 100/bulan. Tersedia skill resmi Remotion untuk Claude Code. |
| Canva (konektor claude.ai sudah ada) | Video sosial cepat tanpa kode | Ada `create-video`. Hasil berupa desain Canva, kurang cocok untuk menampilkan UI asli dengan presisi. |
| Lottie / Rive | Ilustrasi animasi buatan desainer | Butuh desainer dan editor khusus. Tidak diperlukan sekarang. |

### S13-4 Bilah filter

Berkas: `src/components/catalog/catalog-filters.tsx`.

**Usulan bentuk:** kotak cari dan filter menjadi satu kartu.

- Baris 1: kotak cari + tombol **Cari**.
- Baris 2: tombol filter berbentuk chip dengan ikon panah bawah: **Merek**, **RAM**, **Penyimpanan**, **Harga**, lalu **Urutkan** di kanan. Chip yang aktif menampilkan jumlah ("Merek · 2") dan warna aksen.
- Di bawahnya, filter aktif tampil sebagai chip yang bisa dihapus satu per satu, plus **Reset semua**.
- Ponsel: satu tombol **Filter (n)** membuka panel dari bawah berisi semua grup, dengan tombol **Tampilkan hasil**.

**Kriteria selesai:**

- Tetap form GET: berfungsi tanpa JavaScript, URL filter tidak berubah (`PARAM` yang sama).
- Tiap chip berupa tombol nyata (kursor pointer, hover, focus, `aria-expanded`), target 44 px, Escape menutup panel.
- Catatan "harga yang tidak diketahui bukan berarti murah" tetap ada di panel Harga.

### S13-5 Audit antislop

- Mode after untuk beranda dan katalog, hasil di `docs/ux/anti-slop/audit-001-2026-11-XX.md`.
- Perbaiki temuan ringan yang tidak tercakup S13-1 sampai S13-4, misalnya em dash di teks tampil dan panah dekoratif.

## 3. Keputusan yang dibutuhkan dari PO

1. **Mode antislop**: `during` untuk pekerjaan UI dan `after` untuk audit sudah ditulis di `.claude/skills/cekharga-antislop/SKILL.md`. Setuju?
2. **Hero**: setuju animasi dari UI asli (tanpa video), dan video Remotion dipisah sebagai materi promosi?
3. **Remotion**: berapa orang di PT Sinteniki? Kalau 4 orang atau lebih, perlu Company License sebelum dipakai untuk video.
4. **Copy**: setuju dengan judul dan teks usulan, atau ada yang diubah?
5. **Branch**: Sprint 12 (`sprint-12/impor-varian-warna`) belum masuk `main`. Sprint 13 dibuat dari `main` setelah Sprint 12 di-merge, atau langsung dari branch Sprint 12?
