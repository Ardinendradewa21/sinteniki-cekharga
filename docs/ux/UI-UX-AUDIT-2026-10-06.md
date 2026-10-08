# Audit UI/UX — CekHarga (2026-10-06)

| | |
| --- | --- |
| Cakupan | Situs publik (beranda, katalog, detail, perbandingan, Tanya AI, cara kerja, FAQ, /iklan, login) dan admin (dasbor, produk, Pusat Impor, iklan) |
| Tampilan diperiksa | 29 tampilan halaman: desktop terang, desktop gelap, ponsel 390 px, admin |
| Metode | Skill `ui-ux-pro-max` (aturan prioritas 1–10 + basis data UX), Context7 (shadcn/ui v4, Tailwind CSS v4), axe-core 4.10 (WCAG 2.0–2.2 AA), inventaris gaya hasil render dari browser, dan pemeriksaan kode |
| Acuan yang menang | `docs/CekHarga_PRD_v2.md` §8 dan token di `src/app/globals.css`. Saran skill yang bertentangan dengan PRD tidak dipakai (lihat §5). |

## 1. Ringkasan

Fondasinya sudah kuat:

- Token warna semantik terdokumentasi lengkap dengan rasio kontras.
- axe-core **0 pelanggaran di semua halaman publik**, baik tema terang maupun gelap, termasuk kontras.
- Ada reduced motion, tidak ada scroll horizontal di ponsel, dan tombol utama setinggi 44 px.

Masalah utamanya ada di **konsistensi**. Ada dua bahasa visual yang bercampur, komponen yang sama dibuat ulang dengan gaya berbeda di beberapa tempat, dan skala tipografi serta ukuran target sentuh tidak dikunci sebagai sistem.

| Prioritas skill | Kategori | Status |
| --- | --- | --- |
| 1 | Aksesibilitas | ⚠ 1 kritis (fokus tidak terlihat), 1 struktur admin |
| 2 | Sentuhan & interaksi | ⚠ Target < 44 px di footer dan tombol admin |
| 3 | Performa | ⚠ `backdrop-blur` di setiap tombol (111 pemakaian) |
| 4 | Pemilihan gaya | ⚠ Kaca (glass) vs datar bercampur |
| 5 | Layout & responsif | ✅ Tanpa scroll horizontal; ⚠ perbandingan sangat panjang |
| 6 | Tipografi & warna | ⚠ Teks 10–11 px, skala heading tidak terkunci, `rgba` mentah |
| 7 | Animasi | ✅ Reduced motion; ⚠ durasi 500 ms di luar skala PRD |
| 8 | Form & umpan balik | ⚠ Tiga gaya *disabled* berbeda |
| 9 | Navigasi | ⚠ Dua pola tab di admin |
| 10 | Grafik | ✅ Tidak ada masalah ditemukan |

## 2. Temuan berprioritas

Severity mengikuti TEST-PLAN §7: Kritis, Tinggi, Sedang, Rendah.

### UX-01 · Kritis · Input budget Tanya AI tidak punya indikator fokus

- **Bukti:** diukur di browser. Saat input mendapat fokus keyboard, `outline: none`, ring 0 px, `border: 0`, dan wadahnya tidak berubah.
  - `src/components/assistant/consultation.tsx:232` menambahkan `border-0 … focus-visible:ring-0`.
  - `Input` dasar sudah `outline-none`.
  - Wadah `Composer` (`composer.tsx:37`) tidak punya `focus-within`.
- **Dampak:** langkah pertama Tanya AI tidak bisa dipakai dengan keyboard secara layak. Melanggar WCAG 2.4.7 dan PRD §8 ("focus terlihat"). axe-core tidak mendeteksinya, dan E2E TC-A11Y-03 hanya memeriksa tautan pertama beranda.
- **Rekomendasi:**
  - Pindahkan indikator ke wadah: `focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50` di `Composer`.
  - Tambahkan kasus E2E "setiap kontrol form punya indikator fokus".

### UX-02 · Tinggi · CTA paling penting dibuat ulang di luar komponen `Button`

- **Bukti** (inventaris render): tombol **"Buka" / "Buka situs resmi"** ke toko (`src/components/product/offer-list.tsx:120`), **"Ajukan kerja sama"** (`src/app/(public)/iklan/page.tsx:79`), dan CTA iklan native (`src/components/ads/ad-slot.tsx:134`) memakai `bg-primary` datar.
  - Font weight 600, sementara semua `Button` 500.
  - Hover memakai `opacity-90`, sementara `Button` terangkat dengan bayangan.
- **Dampak:** CTA yang paling bernilai bisnis justru tampil paling berbeda dari sistem. Perbaikan gaya `Button` di masa depan tidak akan ikut ke tombol-tombol ini.
- **Rekomendasi:** pakai `<Button asChild size="lg"><a …/></Button>` atau `buttonVariants()` pada tautan. Ini pola resmi shadcn/ui v4 untuk tautan bergaya tombol (Context7: "use the `buttonVariants` helper to make a link look like a button").

### UX-03 · Tinggi · Dua bahasa visual: *liquid glass* vs datar

- **Bukti:**
  - Semua `Button` (`src/components/ui/liquid-glass-button.tsx`) dan navigasi (`glassmorphism-navigation.tsx`) memakai `backdrop-blur-xl`, gradien putih, dan bayangan `rgba` mentah (14 bayangan arbitrer; 26 warna palet mentah di navigasi).
  - Kartu, tabel, form, CTA toko, dan pil tetap datar.
- **Dampak:**
  - Basis data skill mencatat glassmorphism cocok untuk *navigation / modal overlays* di atas latar yang hidup, dengan syarat kontras dan fokus.
  - Di atas latar polos CekHarga, blur pada tombol tidak terlihat efeknya tetapi tetap dibayar sebagai biaya render. Satu halaman katalog bisa memuat puluhan elemen `backdrop-filter`.
  - Tombol terasa "beda dunia" dengan kartu di sebelahnya.
- **Rekomendasi:**
  - Pertahankan kaca **hanya** untuk navigasi.
  - Jadikan `Button` padat (solid) mengikuti token.
  - Pindahkan bayangan mentah ke token Tailwind v4 (`--shadow-raised`, `--shadow-glass` di `@theme`; Context7: theme variables `--shadow-*` membuat utility), dan ganti `border-white/75` dengan token `--glass-border` per tema.
  - Varian `cool` tidak dipakai di mana pun: hapus.

### UX-04 · Tinggi · Ukuran tombol di bawah 44 px

- **Bukti:**
  - `size="sm"` = 40 px, dipakai 33 kali di admin (Keluar, Terbitkan, Jadikan draft, Hapus terpilih, Edit, paginasi).
  - `size="xs"` dan `icon-xs` = 24 px.
- **Dampak:** PRD §8 mewajibkan 44 px. WCAG 2.2 hanya meminta minimal 24 px (basis data skill: "Target Size Minimum"), dan untuk proyek ini PRD yang berlaku.
- **Rekomendasi:**
  - Naikkan `sm` ke `h-11` dengan padding lebih rapat.
  - Pertahankan `xs` hanya untuk elemen non-sentuh, atau hapus.
  - Bila admin desktop memang butuh tombol padat, PO perlu memutuskannya sebagai pengecualian tertulis.

### UX-05 · Sedang · Pil/badge dibuat ulang 29 kali; teks 10–11 px

- **Bukti:**
  - Komponen `Badge` hanya dipakai di 1 file, sementara ada 29 pil manual dengan kombinasi warna/padding berbeda.
  - `rounded-full` (31×) dan `rounded-pill` (42×) adalah dua nama untuk nilai yang sama.
  - Teks 10–11 px: dasbor admin **64 elemen 10 px**; 2–3 elemen 11 px di setiap halaman publik (lencana "segera", label harga, label iklan).
- **Rekomendasi:**
  - Perluas `Badge` dengan varian status: `brand`, `success`, `warning`, `muted`, `destructive`, dengan teks minimal `text-xs` (12 px).
  - Ganti pil manual dengan `Badge`.
  - Pakai satu nama radius (`rounded-pill`).

### UX-06 · Sedang · Target sentuh tautan footer hanya 16 px

- **Bukti:** "Beriklan" (46×16) dan "Ketentuan Layanan" (108×16) di baris bawah footer, di semua halaman termasuk ponsel. Daftar navigasi footer sudah 44 px.
- **Rekomendasi:** `inline-flex min-h-11 items-center` pada dua tautan itu. Di ponsel, tata navigasi footer menjadi dua kolom agar tidak memanjang.

### UX-07 · Sedang · Skala heading tidak terkunci

- **Bukti** (hasil render):
  - H2 bervariasi 14, 16, 20, 24, dan 30 px antarhalaman.
  - Di `/compare`, **H3 30 px lebih besar dari H2 24 px** (hierarki terbalik).
  - Di `/products`, ada H2 16 px dengan weight 400.
- **Dampak:** pembaca layar dan pemindai visual mendapat hierarki yang tidak konsisten. Basis data skill: *Heading Hierarchy*, severity Medium.
- **Rekomendasi:**
  - Kunci skala: H1 36/48/60, H2 24, H3 18, label seksi 14 semibold sebagai `<p>`, bukan heading.
  - Buat komponen `SectionHeading` agar setiap halaman memakainya.

### UX-08 · Sedang · Pemilih varian punya dua desain

- **Bukti:**
  - Halaman detail: kartu 54 px, radius 20 px, pilihan aktif berwarna gelap (`foreground`).
  - Halaman perbandingan: pil 44 px dengan gaya lain.
  - Warna aktif (hitam/navy) tidak sama dengan warna aksi (teal).
- **Rekomendasi:** satu komponen `VariantPicker` (mode `detail` dan `compact`) dengan state aktif memakai token brand.

### UX-09 · Sedang · Halaman perbandingan sangat panjang dan sulit dipindai

- **Bukti:** 6.378 px untuk dua produk. Setiap atribut ditumpuk vertikal (ikon, label, nilai) dengan jarak sekitar 100 px per atribut.
- **Dampak:** PRD FR-04 meminta "atribut sepadan" yang mudah dibandingkan. Mata harus melompat jauh untuk membandingkan satu baris.
- **Rekomendasi:**
  - Tabel baris per atribut (label kiri, nilai per produk sejajar), tanpa ikon per sel.
  - Header kolom produk lengket (sticky) saat menggulir.
  - Penanda "berbeda" yang sudah ada tetap dipertahankan.

### UX-10 · Sedang · Pola admin tidak seragam

- **Bukti:**
  - Pusat Impor memakai tab bergaris bawah, sedangkan modul Iklan memakai tab pil.
  - Tombol aksi massal yang nonaktif tampil tiga cara: abu padat, teks samar, dan merah muda.
  - Gaya *disabled* tersebar: `opacity-50`, `opacity-60`, `bg-muted`.
- **Rekomendasi:**
  - Satu komponen `Tabs` untuk admin.
  - State nonaktif cukup dari komponen `Button` (`disabled:opacity-50`) tanpa override warna.

### UX-11 · Sedang · Struktur daftar definisi tidak valid di dasbor admin

- **Bukti:** axe-core *serious* `dlitem` (8 node) dan `definition-list` (2 node). Di kartu metrik `HealthMetric` (`src/components/admin/data-health.tsx`), `<dt>`/`<dd>` dibungkus `div` di dalam `div`, dan `<dl>` di `src/app/admin/(workspace)/page.tsx` berisi `<p>` langsung.
- **Rekomendasi:** bungkus pasangan `<dt>`/`<dd>` dalam `div` anak langsung dari `<dl>`, dan pindahkan deskripsi ke dalam `<dd>`.

### UX-12 · Rendah · Empat gaya indikator fokus

- **Bukti:** `focus-visible:ring-2` (28×), `ring-3` (12×), `ring-[3px]` (1×), dan aturan global `outline-2`.
- **Rekomendasi:** satu pola mengikuti shadcn v4: `focus-visible:ring-3 focus-visible:ring-ring/50` (+ `border-ring` untuk kontrol berbingkai).

### UX-13 · Rendah · Placeholder foto merusak ritme grid

- **Bukti:** 6 dari 20 kartu katalog halaman 1 memakai ilustrasi HP generik putih. Bentuknya mirip foto asli, sehingga terlihat seperti produk kosong.
- **Rekomendasi:** tile netral bertuliskan "Foto belum tersedia" dengan latar `muted`, supaya jujur dan jelas bukan foto. Penyelesaian datanya ada di backlog PB-03.

### UX-14 · Rendah · Elemen "belum tersedia" di footer

- **Bukti:** tiga ikon sosial nonaktif bergaris putus-putus dan dua lencana "segera" (email, alamat kantor) di setiap halaman.
- **Rekomendasi:** sembunyikan kanal yang belum ada sampai tersedia. Ini tetap jujur karena tidak mengklaim apa pun, dan mengurangi noise. Bila PO ingin tetap tampil, pakai satu baris teks "Kanal lain menyusul".

### UX-15 · Rendah · Ritme ruang dan detail beranda

- **Bukti:**
  - Jarak antarseksi beranda tidak seragam (± 90–160 px).
  - Kartu "Asisten AI aktif" menyisakan area kosong besar karena tingginya mengikuti kolom kiri.
  - Di tema gelap, latar dekoratif `warmth-blob` membentuk tepi keras antarseksi.
- **Rekomendasi:**
  - Token jarak seksi (`py-16 md:py-24`).
  - Isi kartu asisten dengan contoh pertanyaan, atau ratakan tingginya ke atas (`items-start`).
  - Pudarkan tepi blob dengan `mask-image`.

### UX-16 · Rendah · Label iklan terlalu kecil dan memakai warna mentah

- **Bukti:** `src/components/ads/ad-label.tsx` memakai 11 px dengan `bg-black/70 text-white`.
- **Dampak:** ADS-CONTEXT §2 butir 2 meminta label "terlihat jelas".
- **Rekomendasi:** 12 px dengan token (`bg-foreground/80 text-background`) dan kontras teruji di atas gambar terang maupun gelap.

### UX-17 · Rendah · Durasi animasi di luar skala PRD

- **Bukti:** `duration-500` pada gambar iklan (`ad-slot.tsx`) dan animasi garis hero 500 ms. PRD §8 menetapkan micro 120–180 ms dan entrance 280–420 ms.
- **Rekomendasi:** turunkan ke `duration-300`.

### UX-18 · Rendah · Konfigurasi shadcn menyebut Lucide, proyek memakai Hugeicons

- **Bukti:** `components.json` berisi `"iconLibrary": "lucide"`, sementara 0 import `lucide-react` dan 20 file memakai Hugeicons.
- **Dampak:** komponen baru dari `shadcn add` akan membawa ikon Lucide dan mencampur dua gaya ikon.
- **Rekomendasi:** catat di README komponen bahwa ikon hasil `shadcn add` wajib diganti Hugeicons, atau sesuaikan konfigurasi bila registry mendukung.

## 3. Yang sudah baik (pertahankan)

- Token semantik lengkap untuk tema publik terang/gelap dan admin, dengan rasio kontras tercatat di `globals.css`. axe-core membuktikannya: 0 pelanggaran kontras di 24 tampilan publik (desktop terang, desktop gelap, ponsel).
- Tombol utama dan navigasi setinggi 44 px. Tidak ada scroll horizontal di 390 px.
- Reduced motion dimatikan secara global termasuk delay, dan konten Reveal tetap terlihat tanpa JavaScript.
- Empty state jujur: "Harga belum tersedia", "Belum diketahui", "bukan peringkat". Sesuai PRD.
- Satu pustaka ikon (Hugeicons) secara konsisten.

## 4. Rencana perbaikan

| Gelombang | Isi | Perkiraan |
| --- | --- | --- |
| **1. Perbaikan cepat** (1 hari) | UX-01 fokus Composer, UX-02 CTA → `Button`, UX-06 footer 44 px, UX-11 struktur `<dl>`, UX-16 label iklan, UX-17 durasi, hapus varian `cool` | 3 SP |
| **2. Fondasi sistem** (2–3 hari) | UX-03 token bayangan/kaca + `Button` padat, UX-04 ukuran `sm`, UX-05 varian `Badge`, UX-12 satu pola fokus, UX-07 skala heading + `SectionHeading` | 8 SP |
| **3. Pola komponen** (3–4 hari) | UX-08 `VariantPicker`, UX-09 tabel perbandingan, UX-10 `Tabs` admin dan state nonaktif, UX-13 tile placeholder | 8 SP |
| **4. Polesan** | UX-14, UX-15, UX-18 | 2 SP |

Setiap gelombang ditutup dengan:

1. `pnpm test:e2e`.
2. Audit axe-core ulang.
3. Dua kasus E2E baru: indikator fokus pada **semua** kontrol form, dan target ≥ 44 px pada tautan non-kalimat.

Redesign dilakukan bertahap, bukan menulis ulang (AGENTS.md).

## 5. Status perbaikan

| Temuan | Status | Bukti |
| --- | --- | --- |
| UX-01 Fokus kolom Tanya AI | ✅ Selesai (2026-10-07) | Ring di kotak `Composer` lewat `has-[[data-composer-field]:focus-visible]`; E2E TC-A11Y-04 |
| UX-02 CTA di luar `Button` | ✅ Selesai | Tombol toko dan `/iklan` memakai `<Button asChild>`; CTA iklan native memakai `buttonVariants()`; inventaris render: 0 CTA berlatar penuh di luar `Button` |
| UX-03 Dua bahasa visual | ✅ Selesai (2026-10-07) | `Button` padat bertoken (tanpa blur/gradien/rgba/terangkat), navigasi baru `main-nav.tsx` tanpa glow, header dan panah galeri padat; `liquid-glass-button.tsx` dan `glassmorphism-navigation.tsx` dihapus; 0 kelas `white/…` dan 0 bayangan `rgba` tersisa |
| UX-03 (awal) varian `cool` | ✅ Dihapus | Varian `cva` dipindah ke `button-variants.ts` tanpa `"use client"`, jadi bisa dipakai Server Component |
| UX-06 Tautan footer 44 px | ✅ Selesai | E2E TC-A11Y-05; inventaris ponsel: 0 target < 44 px |
| UX-11 Struktur `<dl>` admin | ✅ Selesai | axe-core: 0 pelanggaran di 29 tampilan |
| UX-16 Label iklan | ✅ Selesai | 12 px, token `bg-foreground/85 text-background` |
| UX-17 Durasi animasi | ✅ Selesai | Gambar iklan 300 ms; garis hero 420 ms |
| UX-04 Tombol < 44 px | ✅ Selesai (tahap 2) | `sm` = 44px; ukuran `xs`, `icon-xs`, `icon-sm`, `xl`, `xxl`, `icon-lg` (tak terpakai, sebagian < 44px) dihapus; tautan nama produk tabel admin 44px; audit: 0 target < 44px, tinggi tombol hanya 44/48px |
| UX-05 Pil manual + teks 10–11px | ✅ Selesai (tahap 2) | `Badge` diperluas (brand/success/warning/destructive/muted), 17 pil status diganti; 0 kelas teks 10–11px tersisa; varian `muted` memakai `text-foreground` (muted-foreground di atas muted hanya 4.4:1); E2E TC-A11Y-06 |
| UX-07 Skala heading | ✅ Selesai (tahap 2) | Utility `heading-page/section-lg/section/sub/card/label` di `globals.css`; 47 heading publik diseragamkan; H3 Bandingkan 30px → 20px; E2E TC-A11Y-07 |
| UX-12 Pola fokus | ✅ Selesai (tahap 2) | Satu pola `focus-visible:ring-2 ring-ring` (38 pemakaian). Temuan tambahan: pola shadcn `ring-ring/50` hanya ±2.15:1 di atas putih (gagal 3:1 WCAG 1.4.11), jadi tidak dipakai |
| UX-08 Pemilih varian | ✅ Selesai (tahap 3) | Komponen bersama `VariantPicker` (mode `detail`/`compact`) di detail dan perbandingan: bentuk `rounded-xl` 44px, aktif = token `primary` + `aria-current` |
| UX-09 Tabel perbandingan | ✅ Selesai (tahap 3) | Baris per atribut dengan peran ARIA table/row/rowheader/cell (pola tabel shadcn v4); label di kiri (≥768px) atau di atas nilai (ponsel, PRD §8); tinggi halaman desktop 6.378 → 4.619 px; E2E TC-CMP-03 |
| UX-10 Pola admin | ✅ Selesai (tahap 3) | Komponen `NavTabs` (tautan + `aria-current`, tampilan varian "line") untuk Pusat Impor dan modul Iklan; tombol ikon admin memakai `Button`; state nonaktif hanya dari `Button` (`disabled:opacity-50`). Temuan tambahan: `Pill` iklan nada netral 4.4:1 dan hitungan review `accent-warm` + teks putih (±3:1, token terlarang untuk teks) diganti `Badge` |
| UX-13 Placeholder foto | ✅ Selesai (tahap 3) | Komponen `DevicePlaceholder`: ilustrasi generik kecil diredupkan (alt kosong) + teks "Foto belum tersedia" di kartu, galeri, dan perbandingan; E2E TC-KAT-09 |
| UX-14 Footer "segera" | ✅ Selesai (tahap 4) | Kanal sosial/kontak yang belum ada tidak dirender; nomor WhatsApp diturunkan dari `site-config` (`formatIndonesianPhone`), tidak ditulis ulang di komponen |
| UX-15 Ritme beranda | ✅ Selesai (tahap 4) | Jarak berlebih ternyata akibat seksi contoh perbandingan yang hilang (lihat §8, UX-19); kartu asisten diisi tiga titik mulai berfungsi; tepi `warmth-blob` dipudarkan dengan `mask-image` |
| UX-18 Ikon shadcn | ✅ Selesai (tahap 4) | `components.json` → `"iconLibrary": "hugeicons"` (didukung resmi shadcn, menurut Context7), jadi `shadcn add` berikutnya memakai Hugeicons |

## 6. Penyimpangan dari PRD — sudah diputuskan (2026-10-07)

Pemilik produk memutuskan: (1) CTA utama **kembali ke charcoal**, (2) grid katalog desktop **tetap 5 kolom** dan PRD diperbarui, (3) **gaya kaca dan glow menu aktif dihapus**. Ketiganya sudah diterapkan dan dicatat di PRD §8 "Keputusan visual". Tabel di bawah adalah catatan kondisi sebelum keputusan.

### Kondisi sebelum keputusan

PRD §8 berstatus **Disepakati**, jadi bagian berikut tidak diubah sepihak (PRD §12: hentikan dan minta keputusan untuk perubahan produk). Sebagian kemungkinan besar pernah disetujui lisan, tetapi PRD belum diperbarui.

| PRD §8 | Implementasi sekarang | Pilihan |
| --- | --- | --- |
| Headline/CTA utama **charcoal** `#303030`; teal "aksen terbatas, bukan warna dominan" | `.public-theme` menjadikan **teal** sebagai `--primary` (warna semua CTA publik). `:root` masih charcoal sesuai PRD. | (a) Pertahankan teal dan perbarui PRD, atau (b) kembalikan CTA ke charcoal |
| Grid katalog **3/2/1** (desktop/tablet/ponsel) | Desktop **5 kolom** | (a) Perbarui PRD (lebih banyak produk per layar), atau (b) kembali ke 3 kolom dengan kartu lebih besar dan foto dominan |
| Motion: "hindari loop, parallax, **glow**" | Indikator menu aktif memakai bayangan bercahaya teal; tombol bergaya kaca (bukan bagian referensi "minimal") | Masuk ke keputusan UX-03 (gaya tombol) |
| Perbandingan: "jangan memaksa tabel lebar yang tak terbaca" | Ditumpuk vertikal, sangat panjang (UX-09) | Tabel baris per atribut **dengan label tetap dekat nilai di ponsel**, tidak melanggar PRD |

## 8. Temuan tambahan tahap 4 (2026-10-07)

| ID | Temuan | Dampak | Status |
| --- | --- | --- | --- |
| UX-19 | Beranda memakai slug fixture demo (`volt-arc-3`, `nusa-aksa-5`). Di data live slug itu tidak ada, sehingga seksi **contoh perbandingan (PRD §4) hilang diam-diam** dan hero memakai produk acak | Tinggi: alur "pahami kompromi" di beranda tidak pernah tampil di produksi | ✅ `src/lib/catalog/showcase.ts`: pasangan dua merek berbeda dengan harga segar paling berdekatan (deterministik); hero = harga segar yang diperiksa paling baru; `pnpm test:catalog` |
| UX-20 | Contoh perbandingan beranda menandai "beda" bila salah satu nilai **belum diketahui** | Sedang: bertentangan dengan FR-04 dan halaman Bandingkan | ✅ "beda" hanya bila kedua nilai diketahui dan berbeda |
| UX-21 | Titik status asisten berdenyut **tanpa henti** dan selalu berwarna `warning`, termasuk saat AI aktif | Sedang: melanggar PRD §8 (hindari loop); warna menyampaikan arti yang salah | ✅ `StatusDot` statis: hijau aktif, amber tidak tersedia |
| UX-22 | Tidak ada `sitemap.xml`, `robots.txt`, `metadataBase`, atau Open Graph | Tinggi untuk bisnis: trafik organik adalah dasar pendapatan iklan (ADS-CONTEXT §1) | ✅ Fondasi: `app/robots.ts`, `app/sitemap.ts`, Open Graph, env `SITE_URL`. Tanpa `SITE_URL` robots menolak semua crawler (cegah preview terindeks). Structured data produk → backlog PB-12 |
| UX-23 | Nama badan hukum berbeda: situs/`site-config` "PT Sinteniki", ADS-CONTEXT "PT Sinteniki Digital Solusi" | Legal/kepercayaan | ✅ Dikonfirmasi 2026-10-08: **PT Sinteniki Digital Solusi**; `site-config`, footer, dan dokumen diseragamkan |
| UX-24 | Batas harga segar 24 jam vs cron harian 06.00 WIB yang bisa terlambat (cron Vercel tidak presisi). Harga bisa sempat tampil "kedaluwarsa" setiap pagi sebelum cron selesai | Sedang: metrik harga segar turun-naik harian | ✅ Diputuskan 2026-10-08: batas **30 jam** (`PRICING_POLICY.freshnessWindowHours`, PRD §7) |

## 7. Saran skill yang tidak dipakai

- **"E-commerce → Vibrant & Block-based" (basis data `product`).** Ditolak. PRD §8 menetapkan identitas teal/navy yang tenang, dan CekHarga adalah alat keputusan, bukan toko.
- **Mengganti font atau palet.** Ditolak. AGENTS.md mewajibkan token `globals.css` dan Plus Jakarta Sans dipertahankan kecuali pemilik produk meminta.
