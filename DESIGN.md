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
| `--brand-text` | `#0f6c46` | Teks/tautan hijau, 6.45:1 di card |
| `--brand-muted` | `rgba(19, 122, 80, .12)` | Latar chip aktif |
| `--ring` | `#137a50` | Fokus; 4.2:1 di background |
| `--success` / `--warning` / `--destructive` | `#12764a` / `#85560a` / `#b13b22` | 5.65 / 6.30 / 5.97 :1 di card |
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
| `--frost` | `.5` (0 = bening, 1 = sangat buram) |
| `--scene-blur` | `url(/images/scene/day-blur.avif)` / `url(/images/scene/night-blur.avif)`; hanya untuk Hero Price Panel |

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

1. Satu komponen Server Component di layout publik. Scene adalah lapisan `position: absolute` di atas halaman yang **ikut bergulir** (bukan `fixed`, supaya tidak menjadi efek parallax dan tidak memicu repaint).
2. Varian `full` (hero beranda dan `/assistant`): setinggi hero atau sampai composer. Varian `fade` (halaman lain): foto tipis di bagian atas yang memudar ke `--background` lewat `mask-image: linear-gradient(to bottom, #000 0, transparent 480px)`.
3. Foto dirender dengan `next/image`: `fill`, `sizes="100vw"`, `alt=""` (dekoratif), `style={{ objectFit: "cover" }}`. Next membuat srcset dari master 2400px, jadi HP tidak mengunduh versi 2400px.
4. Prioritas muat (Next 16: properti `priority` sudah deprecated, diganti `preload`; dokumentasi menyarankan `fetchPriority="high"` atau `loading="eager"` untuk kebanyakan kasus):
   - Foto tema aktif (dibaca dari cookie tema di server): `fetchPriority="high"`, hanya pada varian `full`. Varian `fade` memakai default (lazy).
   - Foto tema lain: `loading="lazy"` dan disembunyikan dengan CSS (`[data-theme="dark"] .scene-day { display: none }`). Gambar lazy yang tersembunyi tidak diunduh sampai pengguna mengganti tema.
5. Di atas foto selalu ada `--veil`. Zona copy hero memakai gradien `--veil-text`: desktop dari kiri (penuh sampai 45% lebar, memudar ke 0 di 75%), mobile dari atas sampai di bawah CTA.
6. Rekomendasi konfigurasi (dikerjakan di VD-03, bukan VD-00): `images.formats: ["image/avif", "image/webp"]` di `next.config.ts`. `images.qualities` di Next 16 wajib berupa allowlist (bawaan `[75]`); jangan memakai nilai `quality` lain tanpa menambahkannya ke daftar.

### 6.3 Hero Price Panel pre-blurred

1. Panel memuat `--scene-blur` sebagai `background-image` dengan `background-size` dan `background-position` yang disamakan dengan scene lewat CSS variable (`--scene-w`, `--scene-h`, `--panel-x`, `--panel-y`) yang diisi `ResizeObserver` kecil di komponen hero.
2. Sebelum JavaScript jalan, atau bila variabel belum terisi, panel jatuh ke `.glass-text` biasa. Tidak ada layout shift karena ukuran panel tidak bergantung pada gambar.
3. Panel ini tidak memakai entrance dengan `transform` (boleh opacity saja), supaya latar blurnya tidak bergeser.
4. Kartu harga di dalam panel tetap solid (`--card`).

### 6.4 Aset

| Berkas | Ukuran | Batas |
|---|---|---|
| `public/images/scene/day.avif`, `night.avif` | lebar 2400px (master untuk `next/image`) | ≤ 200 KB |
| `public/images/scene/day-blur.avif`, `night-blur.avif` | lebar 1200px, Gaussian sigma 18 (setara blur 36px pada 2400px) | ≤ 40 KB |

Dibuat dengan `node scripts/build-scene.mjs` dari foto milik sendiri atau berlisensi bebas di `design/scene-src/` (di-ignore git). Sumber dan lisensi tiap foto dicatat di `public/images/scene/SOURCES.md`.

## 7. Komponen (nama yang dipakai di prompt)

| Komponen | Isi | Aturan |
|---|---|---|
| Glass Header | Logo, Floating Pill Nav, cari, toggle tema | Sticky, `.glass-text` + `.glass-float`, menu aktif = latar `--brand-muted` + `aria-current` |
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
| Quick Start (Tanya AI) | Chip budget dan kebutuhan + tombol kirim | Pola "quick send". Chip menyebut angka dan kegiatan nyata (gaya copy `cekharga-antislop` §5) |
| Recommendation Card | Kandidat, alasan cocok, kompromi, varian, harga + waktu periksa | Tanpa skor atau peringkat |
| Status Pill | Titik + kata | Harga segar: "Diperiksa 7 jam lalu". Lewat batas 30 jam: "Harga terakhir tercatat · 2 hari lalu" (istilah PRD §7), warna `--warning`. Selalu ada kata |

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
