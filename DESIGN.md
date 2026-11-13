# DESIGN.md: CekHarga "Verdant"

Aturan gaya untuk semua pekerjaan UI publik CekHarga mulai 13 November 2026.
Urutan prioritas jika bertentangan: `docs/CekHarga_PRD_v2.md` > dokumen ini > skill `cekharga-antislop` > skill `antislop*` > skill pihak ketiga.
Area admin (`.admin-theme`) TIDAK ikut dokumen ini. Rencana bertahap ada di `docs/ux/REDESIGN-VERDANT-2026-11.md`.

Revisi VD-00 (13 November 2026): resep kaca, foto scene, veil teks hero, CountUp, panggung foto, istilah status, dan angka kontras dikoreksi (lihat bagian 10). API pustaka dicocokkan dengan dokumentasi versi terkunci: Next.js 16.3.4, Motion 13.2.0, sharp 0.35.4, Tailwind CSS 4.3.3.

---

## 1. Identitas

1. Nama tema: **Verdant** (terang = Verdant Day, gelap = Verdant Night).
2. Inspirasi: gaya UI dan motion template Verdelo (demo.codeandchill.store/verdelo). Yang diambil hanya bahasa visualnya. Kode, foto, ikon, dan teks Verdelo TIDAK boleh disalin karena produk berbayar.
3. Gaya utama: **Glass on Scene**: panel kaca di atas foto latar, aksen hijau mint, kartu data tetap solid.
4. Gaya pendukung: Bento Grid, Soft Depth (bayangan berlapis), Single Accent, Micro-interaction, Count-up, Segmented Control dengan thumb bergeser.
5. Kesan yang dituju: tenang, premium, bisa dipercaya. Bukan ramai, bukan "gamer".

## 2. Aturan inti (wajib)

1. **Data harga tidak pernah di atas kaca.** Harga, tabel spesifikasi, daftar penawaran, grafik riwayat harga, dan teks panjang selalu di permukaan solid (`--card`). Kaca hanya untuk "bingkai": header, filter bar, compare tray, panel hero, composer AI, chip, dan panel dekoratif.
2. **Foto produk selalu di "panggung" terang** (`--stage`), juga di tema gelap, karena foto produk resmi berlatar putih. Panggung hanya berisi foto. Teks, badge, dan label tidak diletakkan di atas panggung (lihat 3.4).
3. **Kaca tanpa gambar dan tanpa `background-attachment: fixed`.** Panel kaca memakai warna semi-transparan (`--glass` atau `--glass-text`) plus garis tepi dan kilau. Versi pre-blurred (foto blur di dalam panel) hanya untuk Hero Price Panel (resep di bagian 6). `backdrop-filter` hanya untuk elemen yang menempel atau melayang (Glass Header, Filter Bar, Compare Tray, header sticky tabel perbandingan), maksimal `blur(16px)`, tidak pernah di dalam daftar yang di-scroll.
4. **Teks di atas kaca memakai `--glass-text`**, bukan `--glass`. `--glass` hanya untuk bidang tanpa teks atau yang teksnya berada di elemen solid di dalamnya.
5. **Teks yang langsung di atas foto scene** (copy hero) wajib di atas `--veil-text`. Di zona itu hanya `--foreground` dan `--muted-foreground`; tautan dan tombol memakai permukaan solid sendiri.
6. **Satu warna aksen** (hijau mint/hijau tua). Status (sukses, peringatan, bahaya) selalu disertai kata atau ikon; di tema terang `--success` hampir sama dengan `--brand` (1.06:1), jadi kata adalah pembeda utama.
7. Semua aturan PRD tetap berlaku: tanpa skor, peringkat, "terbaik", pemenang, testimonial, atau prediksi harga; harga kosong bukan nol; harga selalu menyebut varian dan waktu pemeriksaan.
8. Aksesibilitas: target sentuh 44 px, input 16 px, kontras teks 4.5:1, elemen UI 3:1, fokus terlihat, `prefers-reduced-motion` dihormati.

## 3. Warna (semantic token di `src/app/globals.css`)

Komponen hanya memakai token, tidak pernah hex langsung. Rasio kontras dihitung ulang pada VD-00 dengan rumus WCAG 2.x.

### 3.1 Verdant Day (`.public-theme[data-theme="light"]`)

| Token | Nilai | Catatan |
|---|---|---|
| `--background` | `#dfe6e1` | Kanvas hijau keabuan |
| `--card` | `#ffffff` | Permukaan solid untuk data |
| `--foreground` | `#0f1d17` | 17.4:1 di card, 13.7:1 di background |
| `--muted-foreground` | `#4a5b52` | 7.2:1 di card, 5.7:1 di background |
| `--border` | `rgba(15, 40, 28, .10)` | Dekoratif |
| `--border-strong` | `#6d827e` | Kontrol form: 4.1:1 di card, 3.2:1 di background |
| `--primary` | `#137a50` | CTA utama; teks putih 5.35:1 |
| `--primary-foreground` | `#ffffff` | |
| `--brand` | `#137a50` | Aksen data dan status harga; 4.2:1 di background |
| `--brand-text` | `#0d6340` | Teks/tautan hijau: 7.3:1 di card, 5.75:1 di background, 4.96:1 di chip `--brand-muted` di atas background (VD-01: semula `#0f6c46`, hanya 4.38:1 di chip) |
| `--brand-muted` | `rgba(19, 122, 80, .12)` | Latar chip aktif |
| `--ring` | `#137a50` | Fokus; 4.2:1 di background |
| `--success` / `--warning` / `--destructive` | `#106d44` / `#85560a` / `#b13b22` | 6.38 / 6.30 / 5.97 :1 di card; di canvas 5.02 / 4.96 / 4.70 :1 (VD-04: `--success` semula `#12764a`, hanya 4.45:1 di canvas) |
| `--stage` | `#f4f7f5` | Panggung foto produk |
| `--glass` | `rgba(255,255,255, calc(.42 + var(--frost) * .2))` | Bingkai tanpa teks |
| `--glass-text` | `rgba(255,255,255,.86)` | Kaca berteks; terburuk (foto hitam): foreground 12.6:1, muted 5.2:1, brand-text 4.7:1 |
| `--glass-rim` | `rgba(255,255,255,.62)` | Garis tepi kaca 1px |
| `--glass-top` | `rgba(255,255,255,.95)` | Kilau tepi atas (inset shadow) |
| `--veil` | `linear-gradient(180deg, rgba(236,243,238,.18), rgba(226,234,229,.32))` | Lapisan di atas seluruh foto latar |
| `--veil-text` | `rgba(223,230,225,.92)` sebagai warna gradien zona teks | Terburuk (foto hitam): foreground ≥ 10.5:1, muted 4.77:1 |

### 3.2 Verdant Night (`.public-theme[data-theme="dark"]`)

| Token | Nilai | Catatan |
|---|---|---|
| `--background` | `#0c1210` | |
| `--card` | `#121b18` | Solid untuk data |
| `--foreground` | `#eef4ee` | 15.7:1 di card |
| `--muted-foreground` | `#a8b9af` | 8.6:1 di card |
| `--border` | `rgba(220, 255, 236, .09)` | |
| `--border-strong` | `#728d88` | 4.9:1 di card, 5.3:1 di background |
| `--primary` | `#6ee0a1` | CTA utama mint |
| `--primary-foreground` | `#062a16` | 9.5:1 di atas mint |
| `--brand` / `--brand-text` | `#6ee0a1` / `#8ee9b7` | 10.7:1 / 12.1:1 di card |
| `--brand-muted` | `rgba(110, 224, 161, .14)` | |
| `--ring` | `#8ee9b7` | |
| `--success` / `--warning` / `--destructive` | `#8ee9b7` / `#f2c770` / `#f6a38e` | 12.1 / 11.0 / 8.8 :1 di card |
| `--stage` | `#eef3f0` | Panggung foto tetap terang |
| `--glass` | `rgba(6, 11, 9, calc(.36 + var(--frost) * .16))` | Bingkai tanpa teks |
| `--glass-text` | `rgba(10, 16, 14, .84)` | Kaca berteks; terburuk (foto putih): foreground 11.0:1, muted 6.0:1 |
| `--glass-rim` | `rgba(225, 255, 238, .10)` | |
| `--glass-top` | `rgba(235, 255, 244, .22)` | |
| `--veil` | `linear-gradient(180deg, rgba(6,10,8,.10), rgba(4,8,6,.34))` | |
| `--veil-text` | `rgba(12,18,16,.85)` sebagai warna gradien zona teks | Terburuk (foto putih): foreground 11.1:1, muted 6.0:1 |

### 3.3 Token tambahan

| Token | Nilai |
|---|---|
| `--frost` | `.5` (0 = bening, 1 = sangat buram). `--glass` dihitung di `.public-theme`; untuk mengubah keburaman satu bagian, timpa `--glass`, bukan `--frost` |
| `--scene-blur` | `url(/images/scene/day-blur.avif)` / `url(/images/scene/night-blur.avif)`; hanya untuk Hero Price Panel |
| `--stage-foreground` | `#0f1d17` di kedua tema (16.1:1 / 15.5:1 di panggung). Untuk teks yang memang harus di atas panggung, misalnya inisial di tile logo marketplace |
| `--scrim` | `rgba(15,29,23,.48)` / `rgba(0,0,0,.62)`. Latar redup di belakang lembar filter ponsel dan dialog |

Utility Tailwind yang tersedia (VD-01): `text-brand-text`, `bg-stage`/`text-stage-foreground`, `bg-scrim`, serta `glass`, `glass-text`, `glass-float`, dan `stage` (latar panggung + teks gelap).

### 3.5 Token turunan (tidak diatur di tabel atas)

Ditetapkan VD-01 dari palet yang sama dan diukur:

| Token | Day | Night | Kontras terendah |
|---|---|---|---|
| `--muted` | `#e9efeb` | `#17221e` | muted-foreground 6.2:1 / 8.0:1 |
| `--secondary` | `#e6eee9` | `#1a2621` | foreground 14.7:1 / 14.0:1 |
| `--accent` | `#dde8e1` | `#1f2e28` | muted-foreground 5.7:1 / 6.9:1 |
| `--popover` | `#ffffff` | `#16211d` | muted-foreground 8.0:1 (gelap) |
| `--success-muted` / `--warning-muted` / `--destructive-muted` | `#e2f1e8` / `#f7ecd8` / `#f8e4df` | `#13291f` / `#2d2412` / `#33201b` | teks status di latarnya ≥ 4.84:1 |
| `--input` | sama dengan `--border-strong` | | |

`--accent-warm*` di `.public-theme` menjadi alias hijau (`--brand`, `--brand-muted`, `--brand-text`) supaya pemakaian yang terlewat tidak memunculkan terracotta; admin tetap memakai nilainya sendiri.

Foto scene tajam TIDAK menjadi token CSS. Foto itu dirender lewat `next/image` (bagian 6.2) agar mendapat srcset, prioritas muat, dan format modern.

Warna terracotta lama (`--accent-warm*`) dipensiunkan dari UI publik.

### 3.4 Panggung foto di tema gelap

`--stage` terang di dalam kartu gelap. Teks tema gelap di atasnya gagal kontras (muted `#a8b9af` di `#eef3f0` hanya 1.83:1). Karena itu label yang harus menempel ke foto (label "Iklan", "Demo", nomor foto) diletakkan di luar panggung, atau memakai pil solid sendiri (`bg-foreground text-background` versi tema terang), bukan token tema aktif.

## 4. Tipografi

1. Font: **Plus Jakarta Sans** tetap dipakai (keputusan PRD, dikonfirmasi 13 November 2026). Rasa Verdelo didapat dari warna, kaca, dan motion, bukan dari font.
2. Skala heading memakai utility yang sudah ada (`heading-page`, `heading-section-lg`, dst.). Jangan membuat ukuran bebas.
3. Angka harga: `font-variant-numeric: tabular-nums`, tebal 700 sampai 800. Harga besar di hero/detail boleh 34 sampai 40 px, bagian "Rp" sedikit lebih kecil dan redup.

## 5. Bentuk, jarak, bayangan

| Hal | Nilai |
|---|---|
| Radius | sm 10px, md 14px, lg 22px, xl 28px, pill 9999px |
| Kartu katalog | radius xl (28px) |
| Gap grid | 16px (mobile 12px) |
| Padding kartu | 20px (mobile 16px) |
| Container | 1200 sampai 1280px, padding mobile 16px |
| `--shadow-sm` | `0 1px 2px rgba(20,50,34,.07)` |
| `--shadow` | `0 1px 2px rgba(20,50,34,.06), 0 18px 40px -26px rgba(20,50,34,.38)` |
| `--shadow-lg` | `0 2px 6px rgba(20,50,34,.10), 0 34px 70px -28px rgba(20,50,34,.48)` |
| Bayangan gelap | ganti warna bayangan dengan `rgba(0,0,0,…)` dan opasitas lebih tinggi |

Implementasi (VD-01): nama `--shadow-*` dan `--radius-*` adalah namespace tema Tailwind, jadi nilainya disimpan di `--ch-shadow-sm|…|xl` dan `--ch-radius-sm|md|lg|xl` lalu dirujuk lewat `@theme inline`. Tema publik menimpa nilai itu; admin memakai nilai bawaan Tailwind dan radius lamanya. Pemetaan utility di UI publik: `shadow-sm` = `--shadow-sm`, `shadow` dan `shadow-md` = `--shadow`, `shadow-lg` dan `shadow-xl` = `--shadow-lg`; `rounded-sm|md|lg|xl` = 10/14/22/28px.

## 6. Kaca dan foto scene

### 6.1 Resep kaca

```css
/* Bingkai tanpa teks */
.glass {
  background: var(--glass);
  border: 1px solid var(--glass-rim);
  box-shadow: inset 0 1px 0 var(--glass-top), var(--shadow);
  border-radius: var(--radius-xl);
}
/* Kaca berteks: header, filter bar, compare tray, composer, strip fakta */
.glass-text {
  background: var(--glass-text);
  border: 1px solid var(--glass-rim);
  box-shadow: inset 0 1px 0 var(--glass-top), var(--shadow);
}
/* Hanya elemen menempel/melayang (aturan 2.3) */
.glass-float { backdrop-filter: blur(16px) saturate(1.2); }
```

Tidak ada `background-attachment: fixed`. Alasannya: (a) latar fixed digambar ulang setiap scroll dan tidak dikomposisi GPU, (b) posisinya hanya cocok bila scene juga terkunci ke layar, sedangkan scene di sini ikut bergulir, (c) di dalam elemen ber-`transform` (entrance Motion) latar fixed bergeser.

### 6.2 Scene Backdrop

Implementasi VD-03: `src/components/layout/scene-backdrop.tsx` (Server Component) dan utility `scene-*` di `globals.css`.

1. Scene adalah lapisan `position: absolute` yang **ikut bergulir** (bukan `fixed`, supaya tidak menjadi efek parallax dan tidak memicu repaint). Induknya `relative isolate`, scene `-z-10`.
2. Varian `fade` dipasang di layout publik untuk semua halaman: foto **blur** (`--scene-blur`, 3–4 KB) lewat CSS setinggi 480px, memudar ke `--background` dengan `mask-image` mulai dari 45% (terukur: 0.75 dan 0.55 membuat teks muted di 375px tema terang turun ke 4.04:1 dan 4.41:1). Tanpa elemen gambar, jadi ikut berganti tema lewat token dan tidak menambah beban LCP.
3. Varian `full` dipasang oleh halaman di dalam section hero-nya (beranda: `src/components/home/hero.tsx`), sehingga tingginya selalu sama dengan hero; ditarik ke atas `-mt-(--header-h)` supaya foto juga tampak di belakang Glass Header. `/assistant` mendapat varian `full` di VD-08 setelah pesan dan kartu rekomendasinya berada di permukaan solid.
4. Foto `full` dirender dengan `next/image`: `fill`, `sizes="100vw"`, `alt=""`, `object-cover`. Next membuat srcset dari master 2400px (HP 412px mengunduh lebar 750, ±11 KB AVIF).
5. Prioritas muat (Next 16: properti `priority` sudah deprecated, diganti `preload`; dokumentasi menyarankan `fetchPriority="high"` atau `loading="eager"`):
   - Foto tema aktif (dibaca dari cookie tema di server): `loading="eager"` + `fetchPriority="high"`.
   - Foto tema lain: `loading="lazy"` + `fetchPriority="low"` dan disembunyikan CSS (`.scene-day`/`.scene-night`). Terverifikasi: tidak diunduh sampai tema diganti.
   - Halaman yang punya `full` menyembunyikan lapisan `fade` (`.public-theme:has(.scene-full) .scene-fade { display: none }`). Tanpa ini, `fade` yang tertutup menjadi kandidat LCP beranda (terukur, render delay 3 detik).
6. Di atas foto `full` selalu ada `--veil`, zona copy `--veil-text` (`scene-text-left`: dari atas di HP sampai 52%, dari kiri mulai `lg` sampai 54% lalu memudar ke 80%; `scene-text-top` untuk judul tengah), dan tepi bawah memudar ke canvas.
7. Teks yang berada di atas foto tetapi di luar zona `--veil-text` (contoh: tab dan keterangan tur hero) wajib di atas `glass-text`.
8. `next.config.ts`: `images.formats: ["image/avif", "image/webp"]` (VD-03). `images.qualities` di Next 16 wajib berupa allowlist (bawaan `[75]`); jangan memakai nilai `quality` lain tanpa menambahkannya ke daftar.
9. Glass Header menempel: tinggi total disimpan di `--header-h` (4.75rem, 5.5rem mulai `md`), dipakai `scroll-padding-top` di `html` (anchor dan fokus keyboard tidak tertutup header) dan `top-(--header-h)` untuk elemen sticky lain (header tabel perbandingan).

### 6.3 Hero Price Panel pre-blurred

Implementasi VD-04: `src/components/home/hero-panel-frame.tsx` + `.hero-panel` di `globals.css`.

1. Panel memuat `--scene-blur` (di bawah rona `--glass` dan `--veil`) sebagai `background-image`. `ResizeObserver` di `HeroPanelFrame` mengisi `--blur-size` dan `--blur-pos` supaya foto blur sejajar dengan foto hero (`object-cover`, tengah) di wilayah `[data-scene-region]`.
2. Latar dipasang **sejak paint pertama** dengan posisi perkiraan (`cover`, tengah); JavaScript hanya menyempurnakan posisinya. Bila latar baru dipasang setelah hydration, panel besar ini terhitung LCP pada saat itu (terukur VD-04).
3. Tidak ada teks yang langsung di atas kaca panel: isinya kartu solid (adegan + keterangan) dan SegmentedControl bertrack solid. Karena itu panel boleh memakai `--glass` (tembus), bukan `--glass-text`.
4. Panel tidak memakai entrance dengan `transform` (hanya opacity), supaya latar blurnya tidak bergeser.
5. Potongan adegan di dalam kartu hanya bergeser 8px tanpa memudar: teks yang sedang memudar terbaca sebagai kontras rendah oleh pemeriksa aksesibilitas (terukur 1.02:1 saat Lighthouse memeriksa di tengah animasi).

### 6.4 Aset

| Berkas | Ukuran | Batas |
|---|---|---|
| `public/images/scene/day.avif`, `night.avif` | 2400×1500 (16:10, master untuk `next/image`) | ≤ 200 KB (saat ini 101 KB / 31 KB) |
| `public/images/scene/day-blur.avif`, `night-blur.avif` | 1200×750, Gaussian sigma 18 (setara blur 36px pada 2400px) | ≤ 40 KB (saat ini 4 KB / 3 KB) |

Dibuat dengan `node scripts/build-scene.mjs` dari foto milik sendiri atau berlisensi bebas di `design/scene-src/` (di-ignore git); foto dipotong 16:10 dengan titik fokus yang bisa diatur (`--position-day`, `--position-night`). Sumber dan lisensi tiap foto dicatat di `public/images/scene/SOURCES.md` (saat ini dua foto Unsplash License).

## 7. Komponen (nama yang dipakai di prompt)

| Komponen | Isi | Aturan |
|---|---|---|
| Glass Header | Logo, Floating Pill Nav, cari, toggle tema | Sticky, satu kapsul mengambang `.glass-text` + `.glass-float` (elemen `<header>` transparan dan `pointer-events-none`), menu aktif = latar `--brand-muted` + `aria-current`, menu ponsel = panel `glass-text` |
| Scene Backdrop | Foto latar + veil | Satu komponen di layout publik (6.2) |
| Hero Price Panel | Panel kaca berisi kartu harga solid, Segmented Control (Cari, Bandingkan, Harga, Tanya AI) | Harga di kartu solid; harga dirender final di server (bagian 8) |
| Segmented Control | Pilihan berjajar dengan thumb yang bergeser | Thumb pakai `layoutId` Motion; dipakai untuk varian, warna, urutan, periode. Bila pilihan tidak muat di 375px, jatuh ke chip yang membungkus (warna) atau `select` (urutan) |
| Product Card | Panggung foto terang, nama, varian acuan, harga mulai, waktu periksa, aksi Bandingkan | Kartu solid, hover hanya pada elemen yang bisa diklik |
| Filter Bar | Cari, chip filter, urutan | Sticky di bawah header, `.glass-text` + `.glass-float` |
| Compare Tray | Kandidat terpilih + tombol Bandingkan | Melayang di bawah, `.glass-text` + `.glass-float`, muncul dengan slide-up |
| Offer Row | Ikon marketplace dalam tile, nama toko, varian/warna, pill waktu periksa, harga, tombol Buka | Gaya "transaction list"; solid |
| Price History | Garis tangga hijau, titik = pemeriksaan nyata, celah putus-putus "tidak diperiksa" | Sesuai PRD PB-31; TANPA garis perkiraan |
| Recent Checks | Daftar dengan date tile (tanggal besar, bulan kecil) | Dipakai bila pemeriksaan < 5 |
| Review Carousel | Kartu ringkasan ulasan per channel, indikator halaman, tombol panah | Menyebut channel, tanggal, aspek, label bersponsor. Tanpa autoplay; bisa dioperasikan keyboard |
| Quick Start (Tanya AI) | Chip budget dan kebutuhan + tombol kirim | Pola "quick send". Chip menyebut angka dan kegiatan nyata (gaya copy `cekharga-antislop` §5). Beranda (VD-04): formulir GET ke `/assistant?tanya=form` dengan radio `budget` (2/3/5 juta, Lainnya = kosong) dan checkbox `kegiatan`; berfungsi tanpa JavaScript; tanpa pilihan bawaan; tidak mengirim `budget_wajib` sehingga asisten tetap menanyakan apakah budget batas keras (PRD FR-06) |
| Recommendation Card | Kandidat, alasan cocok, kompromi, varian, harga + waktu periksa | Tanpa skor atau peringkat |
| Status Pill | Titik + kata | Harga segar: "Diperiksa 7 jam lalu". Lewat batas 30 jam: "Harga terakhir tercatat · 2 hari lalu" (istilah PRD §7), warna `--warning`. Selalu ada kata. Komponen: `src/components/status-pill.tsx` (VD-04) |

## 8. Motion

Library: **Motion** (`motion/react`, versi 13.2.0 terpasang). Jangan menambah GSAP; fitur yang dibutuhkan (layout animation, stagger, spring, `animate()` untuk angka) sudah tersedia di Motion.

| Jenis | Durasi | Easing | Contoh |
|---|---|---|---|
| Micro | 160ms | ease-out-quint | Hover tombol, tekan, thumb segmented (atau spring stiffness 500, damping 40) |
| Entrance | 450ms (rentang 350 sampai 600) | ease-out-quint | Kartu muncul: opacity 0 ke 1, y 12px ke 0 |
| Stagger | 40 sampai 70ms per item, maksimal 8 item | | Grid produk, daftar penawaran |
| Layout | 450ms | ease-out-quint | Hasil filter berubah, kartu kandidat masuk compare tray |
| Data reveal | 800 sampai 1000ms, sekali | ease-out-quint | Garis grafik tergambar, harga count-up |
| Exit | 200ms | ease-in | Toast, modal |

1. Ease-out-quint = `cubic-bezier(.22, 1, .36, 1)`. Simpan semua preset di `src/lib/motion.ts`.
2. Animasi hanya opacity dan transform. Tidak ada loop, parallax, scroll hijacking, atau glow berdenyut.
3. Elemen di atas lipatan pertama tampil langsung atau dengan entrance singkat berbasis opacity; reveal saat scroll hanya untuk elemen di bawah lipatan (audit 002 no 8).
4. **CountUp**:
   - HTML dari server selalu berisi harga final. Tidak pernah mulai dari 0 dan tidak pernah merender "Rp0" (PRD: harga kosong bukan nol; antislop R-40: teks LCP tidak menunggu JavaScript).
   - Animasi hanya saat nilai berubah setelah interaksi (ganti varian kapasitas), dari harga lama ke harga baru, memakai `animate(motionValue, target)` Motion. Ganti warna tidak memicu count-up karena warna tidak memengaruhi harga.
   - Hero tidak menjalankan count-up saat halaman dimuat.
   - Pembaca layar hanya menerima nilai akhir (`aria-live="polite"` pada elemen terpisah yang diperbarui setelah animasi selesai); angka yang beranimasi `aria-hidden`.
   - Harga tidak tersedia ("Harga belum tersedia") tidak pernah dianimasikan.
5. **Reduced motion**: `MotionConfig reducedMotion="user"` (sudah ada di `motion-provider.tsx`) hanya mematikan animasi transform dan layout; animasi opacity tetap berjalan (dokumentasi Motion). Karena itu preset di `src/lib/motion.ts` membaca `useReducedMotion()` dan memakai durasi 0 untuk entrance, stagger, data reveal, dan CountUp. Hasilnya semua konten tampil seketika.

### 8.1 Implementasi (VD-02)

| Bagian | Berkas | Catatan |
|---|---|---|
| Preset | `src/lib/motion.ts` | `easeOutQuint`, `easeIn`, `duration`, `transition.{micro,entrance,layout,dataReveal,exit,thumb}`, `staggerDelay(i)` (50ms, maks. 8 item), `instant`, hook `useMotionPreset()` |
| Reveal | `src/components/motion/use-reveal.ts`, `reveal.tsx` (`Reveal`, `StaggerList`, `StaggerItem`), `reveal-item.tsx` (`RevealItem`) | HTML server selalu terlihat. Hanya elemen di bawah lipatan yang disembunyikan (layout effect, sebelum paint) lalu dimunculkan sekali lewat `inView` + `animate`. Reduced motion: tanpa animasi. Tidak perlu `<noscript>` |
| CountUp | `src/components/motion/count-up.tsx` | `value`, `format: "idr" \| "number"`. Teks lewat MotionValue (tanpa render ulang React). Untuk "Rp" yang lebih kecil, pakai `format="number"` dan tulis "Rp" di span terpisah |
| Segmented Control | `src/components/motion/segmented-control.tsx` | `label`, `options` (`value`, `label`, `text?`, `disabled?`), `value`, `onValueChange`, `collapseBelow?: "sm" \| "md"`, `fullWidth?`. Untuk pilihan yang hidup di URL (varian di halaman detail) tetap dipakai tautan; versi tautan diputuskan di VD-06 |

Screenshot halaman penuh tidak menggulir, jadi elemen reveal di bawah lipatan tampak kosong di tangkapan semacam itu. Skrip QA harus menggulir halaman dulu sebelum memotret.

## 9. Larangan

1. Kaca di bawah harga, tabel, atau teks panjang.
2. Lebih dari satu warna aksen, gradien pelangi, glow berdenyut. Gradien hanya untuk veil di atas foto dan aksen tombol utama.
3. Garis perkiraan harga, skor, peringkat, badge "terbaik", "terlaris", "harga terendah".
4. Menyalin kode, foto, ikon, atau teks dari Verdelo.
5. Emoji sebagai ikon (pakai Hugeicons yang sudah terpasang).
6. Warna hex langsung di komponen.
7. `background-attachment: fixed`, scene `position: fixed`, dan `backdrop-filter` di luar elemen menempel/melayang.
8. CountUp yang dimulai dari 0 atau berjalan saat halaman pertama dimuat.

## 10. Catatan revisi VD-00

| No | Sebelumnya | Sekarang | Alasan |
|---|---|---|---|
| B1 | Kaca pre-blurred dengan `background-attachment: fixed` untuk semua panel besar | Kaca warna semi-transparan; pre-blurred hanya Hero Price Panel, diposisikan lewat CSS variable; scene ikut bergulir | Repaint saat scroll, tidak sejajar dengan scene varian fade, bergeser di elemen ber-transform. Scene `fixed` diganti `absolute` karena latar yang diam saat konten bergulir terbaca sebagai parallax |
| B2 | Foto scene lewat token `--scene: url()` | `next/image` dengan `fill`, `sizes="100vw"`, `fetchPriority="high"` untuk tema aktif | Token CSS tidak bisa srcset atau prioritas LCP; HP akan mengunduh 2400px |
| B3 | Copy hero langsung di atas scene dengan veil 18 sampai 32% | Zona copy di atas `--veil-text` (92% terang, 85% gelap) | Kontras 4.5:1 tidak terjamin pada foto |
| B3b | Teks di atas `--glass` | Kaca berteks memakai `--glass-text` | Terburuk `--glass` gelap di atas foto terang: foreground hanya 2.75:1 |
| B4 | CountUp sekali saat pertama terlihat | Server merender nilai final; animasi hanya saat varian berubah | "Rp0" melanggar PRD, teks LCP menunggu JavaScript, angka antara palsu |
| B5 | Panggung terang tanpa aturan teks | Panggung hanya foto (3.4) | Muted tema gelap di panggung 1.83:1 |
| B6 | Status Pill "Data lama" | "Harga terakhir tercatat" | Istilah PRD §7 dan kode |
| B7 | Segmented Control untuk semua pilihan | Fallback chip/select di 375px | Pilihan banyak meluap |
| B8 | `--brand-text` gelap 10.7:1 | 12.1:1 (10.7 adalah `--brand`) | Koreksi angka |
| B9 | `backdrop-filter` hanya header dan compare tray | Semua elemen menempel/melayang, termasuk Filter Bar dan header sticky tabel perbandingan | Filter Bar sticky tanpa blur membuat kartu di bawahnya terlihat berantakan |
| B10 | Reduced motion "selesai seketika" tanpa cara | `useReducedMotion()` di preset, durasi 0 | `reducedMotion="user"` tidak mematikan opacity |
