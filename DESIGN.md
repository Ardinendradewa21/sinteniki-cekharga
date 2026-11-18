# DESIGN.md: CekHarga "Calda"

Aturan gaya untuk semua pekerjaan UI publik CekHarga. Tema **Calda** berlaku sejak 18 November 2026 (CD-00), menggantikan Verdant (13 November 2026).
Urutan prioritas jika bertentangan: `docs/CekHarga_PRD_v2.md` > dokumen ini > skill `cekharga-antislop` > skill `antislop*` > skill pihak ketiga.
Area admin (`.admin-theme`) memakai tema Veyla, rinciannya di `docs/ux/admin/AV-01.md`. Rencana tiket publik ada di `docs/ux/calda/CD-00.md`.

**Revisi CD-00 (18 November 2026, keputusan PO): tema Calda.** Warna, font, bentuk, dan kaca bagian 1 sampai 5 ditulis ulang: abu netral Frost/Smoke, aksen tunggal biru, CTA monokrom, font Urbanist (angka tabular Plus Jakarta Sans). Bagian 6 sampai 9 (kaca hanya bingkai, latar tanpa foto, komponen, motion) tetap berlaku kecuali disebut lain. Catatan B12 di bagian 10.

**Revisi 18 November 2026 (keputusan PO): foto scene dihapus.** Foto tumbuhan (siang) dan lampu (malam) dinilai tidak relevan dengan CekHarga; latar kini gradasi warna merek (`--scene-gradient`). Bagian yang menyebut foto scene, `--veil`, `--veil-text`, dan `--scene-blur` sudah disesuaikan; catatan B11 di bagian 10.

Revisi VD-00 (13 November 2026): resep kaca, foto scene, veil teks hero, CountUp, panggung foto, istilah status, dan angka kontras dikoreksi (lihat bagian 10). API pustaka dicocokkan dengan dokumentasi versi terkunci: Next.js 16.3.4, Motion 13.2.0, sharp 0.35.4, Tailwind CSS 4.3.3.

---

## 1. Identitas

1. Nama tema: **Calda** (terang = Frost, gelap = Smoke).
2. Inspirasi: gaya UI dan motion template Calda (demo.codeandchill.store/calda, dashboard smart-home). Yang diambil hanya warna, font, bentuk, dan pola interaksinya. Kode, foto, ikon, dan teks Calda TIDAK boleh disalin karena produk berbayar. Tema sebelumnya (Verdant, dari template Verdelo) berlaku sampai 18 November 2026.
3. Gaya utama: **Neutral Glass**: permukaan abu netral, panel kaca bertepi tipis dengan kilau diagonal di atas gradasi abu (tanpa foto), aksen tunggal biru, kartu data tetap solid.
4. Gaya pendukung: navigasi kapsul (pill) dengan penanda aktif, Segmented Control dengan thumb bergeser, angka besar dengan satuan kecil, Micro-interaction, Count-up (bukan harga dari 0).
5. Kesan yang dituju: tenang, rapi, modern seperti panel perangkat. Bukan ramai, bukan "gamer".

## 2. Aturan inti (wajib)

1. **Data harga tidak pernah di atas kaca.** Harga, tabel spesifikasi, daftar penawaran, grafik riwayat harga, dan teks panjang selalu di permukaan solid (`--card`). Kaca hanya untuk "bingkai": header, filter bar, compare tray, panel hero, composer AI, chip, dan panel dekoratif.
2. **Foto produk selalu di "panggung" terang** (`--stage`), juga di tema gelap, karena foto produk resmi berlatar putih. Panggung hanya berisi foto. Teks, badge, dan label tidak diletakkan di atas panggung (lihat 3.4).
3. **Kaca tanpa gambar dan tanpa `background-attachment: fixed`.** Panel kaca memakai warna semi-transparan (`--glass` atau `--glass-text`) plus garis tepi dan kilau. Tidak ada lagi versi pre-blurred berisi foto (B11). `backdrop-filter` hanya untuk elemen yang menempel atau melayang (Glass Header, Filter Bar, Compare Tray, header sticky tabel perbandingan), maksimal `blur(16px)`, tidak pernah di dalam daftar yang di-scroll.
4. **Teks di atas kaca memakai `--glass-text`**, bukan `--glass`. `--glass` hanya untuk bidang tanpa teks atau yang teksnya berada di elemen solid di dalamnya.
5. **Teks langsung di atas latar gradasi** (copy hero) memakai `--foreground` dan `--muted-foreground`; gradasinya terang di tema terang dan gelap di tema gelap, jadi kontrasnya setara kanvas (diukur ulang 18 Nov 2026). Tautan dan tombol tetap memakai permukaan solid sendiri.
6. **Satu warna aksen: biru** (`--brand`) untuk status aktif, progres, tautan, dan penanda menu aktif. CTA utama monokrom (`--primary`: hitam di Frost, putih di Smoke), bukan biru. Status (sukses hijau, peringatan amber, bahaya merah) selalu disertai kata atau ikon.
7. Semua aturan PRD tetap berlaku: tanpa skor, peringkat, "terbaik", pemenang, testimonial, atau prediksi harga; harga kosong bukan nol; harga selalu menyebut varian dan waktu pemeriksaan.
8. Aksesibilitas: target sentuh 44 px, input 16 px, kontras teks 4.5:1, elemen UI 3:1, fokus terlihat, `prefers-reduced-motion` dihormati.

## 3. Warna (semantic token di `src/app/globals.css`)

Komponen hanya memakai token, tidak pernah hex langsung. Rasio kontras dihitung ulang pada CD-00 dengan rumus WCAG 2.x, lalu diperiksa di halaman nyata dengan pindai kontras (teks vs latar berlapis) di 8 halaman x 2 tema.

### 3.1 Frost (`.public-theme[data-theme="light"]`)

| Token | Nilai | Catatan |
|---|---|---|
| `--background` | `#d3d5d8` | Kanvas abu netral |
| `--card` | `#f6f7f8` | Permukaan solid untuk data |
| `--foreground` | `#16191d` | 16.4:1 di card, 12.0:1 di background |
| `--muted-foreground` | `#4a4f56` | 7.7:1 di card, 5.6:1 di background |
| `--border` | `rgba(22, 25, 29, .10)` | Dekoratif |
| `--border-strong` | `#737981` | Kontrol form: 4.1:1 di card |
| `--primary` | `#1b1e21` | CTA utama hitam; teks putih 16.7:1 |
| `--primary-foreground` | `#ffffff` | |
| `--brand` | `#0b70c2` | Aksen biru (grafik, penanda aktif): 4.8:1 di card, 3.5:1 di background; teks putih di atasnya 5.1:1. Biru Calda asli `#29a1f7` hanya 2.7:1 di card, jadi dipakai di Smoke saja |
| `--brand-text` | `#08599c` | Teks/tautan biru: 6.7:1 di card, 4.9:1 di background, 5.4:1 di chip `--brand-muted` |
| `--brand-muted` | `rgba(11, 112, 194, .12)` | Latar chip/menu aktif |
| `--ring` | `#08599c` | Fokus: 6.7:1 di card, 4.9:1 di background |
| `--success` / `--warning` / `--destructive` | `#1b6139` / `#7a4e09` / `#9a321c` | Di background 5.07 / 4.89 / 5.02 :1; di card ≥ 6.7:1 (pindai CD-00: nilai awal `#1f6b3d` hanya 4.42:1 di background) |
| `--stage` | `#ffffff` | Panggung foto produk |
| `--glass` | `rgba(246,247,248, calc(.5 + var(--frost) * .2))` | Bingkai tanpa teks |
| `--glass-text` | `rgba(246,247,248,.88)` | Kaca berteks |
| `--glass-rim` | `rgba(255,255,255,.72)` | Garis tepi kaca 1px |
| `--glass-top` | `rgba(255,255,255,.95)` | Kilau diagonal kiri atas (inset 1px 1px) |

### 3.2 Smoke (`.public-theme[data-theme="dark"]`)

| Token | Nilai | Catatan |
|---|---|---|
| `--background` | `#2a2c2f` | Arang |
| `--card` | `#35373b` | Solid untuk data |
| `--foreground` | `#ffffff` | 11.9:1 di card, 14.0:1 di background |
| `--muted-foreground` | `#c9cdd2` | 7.5:1 di card, 8.8:1 di background |
| `--border` | `rgba(255, 255, 255, .11)` | |
| `--border-strong` | `#80868e` | 3.3:1 di card (grafis) |
| `--primary` | `#ffffff` | CTA utama putih |
| `--primary-foreground` | `#1b1e21` | 16.7:1 |
| `--brand` / `--brand-text` | `#29a1f7` / `#8fcfff` | Grafis 4.3:1 di card; teks 7.1:1 di card |
| `--brand-foreground` | `#06233a` | 5.8:1 di atas `--brand` |
| `--brand-muted` | `rgba(41, 161, 247, .16)` | |
| `--ring` | `#8fcfff` | |
| `--success` / `--warning` / `--destructive` | `#93e6b4` / `#ffd486` / `#ffab98` | 8.1 / 8.5 / 6.6 :1 di card |
| `--stage` | `#eceef0` | Panggung foto tetap terang |
| `--glass` | `rgba(58, 60, 64, calc(.55 + var(--frost) * .2))` | Bingkai tanpa teks |
| `--glass-text` | `rgba(50, 52, 56, .90)` | Kaca berteks |
| `--glass-rim` | `rgba(255, 255, 255, .13)` | |
| `--glass-top` | `rgba(255, 255, 255, .30)` | |

### 3.3 Token tambahan

| Token | Nilai |
|---|---|
| `--frost` | `.5` (0 = bening, 1 = sangat buram). `--glass` dihitung di `.public-theme`; untuk mengubah keburaman satu bagian, timpa `--glass`, bukan `--frost` |
| `--scene-gradient` | Gradasi abu netral: dua cahaya putih samar (70%/40% di Frost, 8%/5% di Smoke) di atas `linear-gradient` ke `--background`; latar halaman (6.2) |
| `--stage-foreground` | `#16191d` di kedua tema. Untuk teks yang memang harus di atas panggung, misalnya inisial di tile logo marketplace |
| `--scrim` | `rgba(22,25,29,.48)` / `rgba(0,0,0,.6)`. Latar redup di belakang lembar filter ponsel dan dialog |

Utility Tailwind yang tersedia (VD-01): `text-brand-text`, `bg-stage`/`text-stage-foreground`, `bg-scrim`, serta `glass`, `glass-text`, `glass-float`, dan `stage` (latar panggung + teks gelap).

### 3.5 Token turunan (tidak diatur di tabel atas)

Ditetapkan CD-00 dari palet yang sama dan diukur:

| Token | Frost | Smoke | Kontras terendah |
|---|---|---|---|
| `--muted` | `#e8eaec` | `#3d3f43` | muted-foreground 6.8:1 / 6.6:1 |
| `--secondary` | `#e4e6e9` | `#404246` | foreground ≥ 10:1 |
| `--accent` | `#dfe1e4` | `#45474b` | foreground ≥ 9:1 |
| `--popover` | `#f6f7f8` | `#3a3c40` | |
| `--success-muted` / `--warning-muted` / `--destructive-muted` | `#e2efe6` / `#f4ead6` / `#f6e3de` | `#26372e` / `#3d3627` / `#45302c` | teks status di latarnya ≥ 5.8:1 |
| `--input` | sama dengan `--border-strong` | | |

`--accent-warm*` di `.public-theme` menjadi alias aksen (`--brand`, `--brand-muted`, `--brand-text`) supaya pemakaian yang terlewat tidak memunculkan terracotta; admin memakai nilainya sendiri (peach Veyla).

Warna terracotta lama (`--accent-warm*`) dipensiunkan dari UI publik.

### 3.4 Panggung foto di tema gelap

`--stage` terang di dalam kartu gelap. Teks tema gelap di atasnya gagal kontras (muted `#c9cdd2` di `#eceef0` hanya sekitar 1.4:1). Karena itu label yang harus menempel ke foto (label "Iklan", "Demo", nomor foto) diletakkan di luar panggung, atau memakai pil solid sendiri (`bg-foreground text-background` versi tema terang), bukan token tema aktif.

## 4. Tipografi

1. Font: **Urbanist** (keputusan PO 18 November 2026, mengikuti Calda; alasan: geometris dan lapang, cocok dengan permukaan netral). Dimuat lewat `next/font` di root layout (`src/lib/fonts/urbanist.ts`). Teks biasa berbobot 500 karena Urbanist 400 terlalu tipis di layar.
2. **Angka tabular memakai Plus Jakarta Sans.** Urbanist tidak punya fitur `tnum` (terukur: lebar digit "1" kurang dari separuh digit lain), jadi `.tabular` dan `tabular-nums` memakai `--font-numeric` (Plus Jakarta Sans) supaya kolom harga sejajar.
3. Skala heading memakai utility yang sudah ada (`heading-page`, `heading-section-lg`, dst.); bobotnya 700 (halaman, seksi beranda) dan 600 (lainnya). Jangan membuat ukuran bebas, dan hindari `font-extrabold` pada teks Urbanist.
4. Angka harga: `.tabular`, tebal 700 sampai 800. Harga besar di hero/detail boleh 34 sampai 40 px, bagian "Rp" sedikit lebih kecil dan redup.

## 5. Bentuk, jarak, bayangan

| Hal | Nilai |
|---|---|
| Radius | sm 12px, md 16px, lg 22px, xl 26px, pill 9999px (CD-00, mengikuti Calda: panel 22px, kartu 12 sampai 18px, kapsul untuk navigasi dan tombol) |
| Kartu katalog | radius xl (26px) |
| Gap grid | 16px (mobile 12px) |
| Padding kartu | 20px (mobile 16px) |
| Container | 1200 sampai 1280px, padding mobile 16px |
| `--shadow-sm` | `0 1px 2px rgba(20,24,30,.07)` |
| `--shadow` | `0 1px 2px rgba(20,24,30,.06), 0 18px 40px -26px rgba(20,24,30,.40)` |
| `--shadow-lg` | `0 2px 6px rgba(20,24,30,.10), 0 34px 70px -28px rgba(20,24,30,.50)` |
| Bayangan gelap | ganti warna bayangan dengan `rgba(0,0,0,…)` dan opasitas lebih tinggi |

Implementasi (VD-01): nama `--shadow-*` dan `--radius-*` adalah namespace tema Tailwind, jadi nilainya disimpan di `--ch-shadow-sm|…|xl` dan `--ch-radius-sm|md|lg|xl` lalu dirujuk lewat `@theme inline`. Tema publik menimpa nilai itu; admin memakai nilai bawaan Tailwind dan radius lamanya. Pemetaan utility di UI publik: `shadow-sm` = `--shadow-sm`, `shadow` dan `shadow-md` = `--shadow`, `shadow-lg` dan `shadow-xl` = `--shadow-lg`; `rounded-sm|md|lg|xl` = 12/16/22/26px.

## 6. Kaca dan latar

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

### 6.2 Latar (Scene Backdrop)

Implementasi: `src/components/layout/scene-backdrop.tsx` dan utility `scene-fade`/`scene-gradient` di `globals.css`. Sejak 18 November 2026 **tanpa foto** (B11).

1. Latar adalah lapisan `position: absolute` yang ikut bergulir (bukan `fixed`). Induknya `relative isolate`, latar `-z-10`.
2. Varian `fade` di layout publik untuk semua halaman: `--scene-gradient` setinggi 480px yang memudar ke `--background` lewat `mask-image`.
3. Varian `full` di hero beranda dan layar awal Tanya AI: gradasi setinggi induknya dengan tepi bawah memudar ke kanvas. Halaman yang punya `full` menyembunyikan lapisan `fade` (`.public-theme:has(.scene-full) .scene-fade { display: none }`) supaya tidak menjadi kandidat LCP.
4. Tidak ada gambar latar: tidak ada unduhan foto, tidak ada zona veil, dan teks hero cukup memakai token teks biasa. Bila kelak ada foto yang benar-benar relevan dengan CekHarga, PO yang memutuskan dan aturan zona teks dari revisi VD-00 berlaku lagi.
5. `next.config.ts`: `images.formats: ["image/avif", "image/webp"]` (VD-03). `images.qualities` di Next 16 wajib berupa allowlist (bawaan `[75]`); jangan memakai nilai `quality` lain tanpa menambahkannya ke daftar.
6. Foto produk remote memakai `fill` + `object-contain` di kotak berukuran tetap (rasio aslinya tidak diketahui), bukan `width`/`height` yang lalu diubah CSS di satu sisi (peringatan next/image, 18 Nov 2026; dijaga TC-IMG-01).
7. Glass Header menempel: tinggi total disimpan di `--header-h` (4.75rem, 5.5rem mulai `md`), dipakai `scroll-padding-top` di `html` (anchor dan fokus keyboard tidak tertutup header) dan `top-(--header-h)` untuk elemen sticky lain (header tabel perbandingan).

### 6.3 Hero Price Panel

Implementasi: `src/components/home/hero-panel-frame.tsx` + `.hero-panel` di `globals.css`.

1. Kaca warna (`--glass`) di atas gradasi, tanpa foto blur dan tanpa penyejajaran lewat JavaScript (B11).
2. Tidak ada teks yang langsung di atas kaca panel: isinya kartu solid (adegan + keterangan) dan SegmentedControl bertrack solid.
3. Potongan adegan di dalam kartu hanya bergeser 8px tanpa memudar: teks yang sedang memudar terbaca sebagai kontras rendah oleh pemeriksa aksesibilitas (terukur 1.02:1 saat Lighthouse memeriksa di tengah animasi).

## 7. Komponen (nama yang dipakai di prompt)

| Komponen | Isi | Aturan |
|---|---|---|
| Glass Header | Logo, Floating Pill Nav, cari, toggle tema | Sticky, satu kapsul mengambang `.glass-text` + `.glass-float` (elemen `<header>` transparan dan `pointer-events-none`). Sejak CD-01 (gaya Calda): menu dalam satu track `bg-foreground/5`, ikon + label; menu aktif = kapsul monokrom `--primary` yang bergeser (`layoutId`) + `aria-current`. Mulai `lg` semua berlabel, di `md` hanya menu aktif yang berlabel (lainnya ikon dengan nama `sr-only` dan tooltip). Cari dan tema = tombol bulat bertepi tipis. Di ponsel kapsul hanya berisi logo, cari, tema |
| Mobile Tab Bar | Beranda, Produk, Bandingkan, Tanya AI, Lainnya | CD-01, `mobile-tab-bar.tsx`, hanya di bawah `md`. Kapsul `glass-text glass-float` mengambang di bawah, tab aktif = kapsul `--primary` bergeser. Dirender di layout publik di luar header (`backdrop-filter` header akan menjadikan `fixed` relatif ke kapsul). "Lainnya" = lembar bawah modal (fokus masuk, Tab berputar, Escape) berisi `MORE_NAV`. Tingginya dicadangkan `--tabbar-offset` (78px + safe area) untuk halaman, compare tray, banner persetujuan, composer Tanya AI. Diuji TC-NAV-01..03 |
| Scene Backdrop | Latar gradasi merek | Satu komponen di layout publik (6.2); tanpa foto sejak 18 Nov 2026 |
| Hero Price Panel | Panel kaca berisi kartu harga solid, Segmented Control (Cari, Bandingkan, Harga, Tanya AI) | Harga di kartu solid; harga dirender final di server (bagian 8) |
| Segmented Control | Pilihan berjajar dengan thumb yang bergeser | Thumb pakai `layoutId` Motion; dipakai untuk varian, warna, urutan, periode. Bila pilihan tidak muat di 375px, jatuh ke chip yang membungkus (warna) atau `select` (urutan) |
| Product Card | Panggung foto terang, nama, varian acuan, harga mulai, waktu periksa, aksi Bandingkan | Kartu solid, hover hanya pada elemen yang bisa diklik. Waktu periksa sebagai Status Pill lewat `CardPriceMeta` (VD-05), juga di contoh perbandingan, tabel perbandingan, dan kartu rekomendasi |
| Filter Bar | Cari, chip filter, urutan | Mulai `lg` menempel di `top-(--header-h)`, `.glass-text` + `.glass-float`, `z-[45]` (di atas Compare Tray, di bawah header). Di bawah `lg` kartu solid biasa: `backdrop-filter` membuat lembar bawah filter (`position: fixed`) salah posisi. Teks bantuan, filter aktif, dan tafsiran pencarian di luar bar. Urutan: `SegmentedNav` (tautan, jalan tanpa JavaScript) mulai `lg`, `<select>` di bawahnya (VD-05) |
| Segmented Nav | Versi tautan Segmented Control | `src/components/motion/segmented-nav.tsx`: `<nav>` + `<a aria-current>`, thumb `layoutId`, opsi `replace`/`scroll`. Untuk pilihan yang hidup di URL: urutan katalog, kapasitas (dua baris: kapasitas + harga varian) dan warna (foto kecil di panggung + nama) di detail produk (VD-06). Pilihan membungkus ke baris berikutnya bila tidak muat |
| Catalog Grid | Hasil katalog | `src/components/catalog/catalog-grid.tsx`: saat hasil berubah, kartu tetap bergeser (layout 450ms), kartu baru fade-up, kartu hilang memudar; halaman pertama tanpa animasi di atas lipatan (`useHydrated`) |
| Compare Tray | Kandidat terpilih + tombol Bandingkan | Melayang di bawah, `.glass-text` + `.glass-float`, muncul dengan slide-up |
| Offer Row | Ikon marketplace dalam tile, nama toko, varian/warna, pill waktu periksa, harga, tombol Buka | Gaya "transaction list"; solid. Satu kolom berpemisah di satu kartu, dasar harga segar berlatar `--brand-muted`, muncul stagger lewat `StaggerList` (VD-06, `src/components/product/offer-list.tsx`) |
| Price History | Garis tangga warna aksen (`--brand`), titik = pemeriksaan nyata, celah putus-putus "tidak diperiksa" | Sesuai PRD PB-31; TANPA garis perkiraan. Seri pertama `--brand`, lainnya `--foreground`/`--muted-foreground` dengan bentuk penanda berbeda. Terbuka sekali 900ms lewat klip `translateX` (VD-06, `price-history-chart.tsx`); HTML server berisi grafik lengkap |
| Spec Compare Row | Baris atribut perbandingan: label 15px, nilai 16-17px (headline 18-20px); baris berbeda berlatar `--brand-muted` + label "beda", lalu baris **arah faktual + artinya** | Keputusan PO 18 Nov 2026. Arah dihitung `spec-insight.ts` dari angka tercatat ("A 600 mAh lebih besar dari B") + "Artinya:" dari bank materi `spec-guide.ts`. Tidak pernah "lebih baik", skor, atau pemenang; nilai kosong tidak diberi arah. Penjelasan atribut lewat `<details>` "Apa artinya?" per bagian (`SpecGuideDisclosure`), juga di tabel spesifikasi detail produk |
| Recent Checks | Daftar dengan date tile (tanggal besar, bulan kecil) | Dipakai selama data belum memenuhi ambang grafik (5 pemeriksaan dalam 7 hari), maksimal 5 catatan terbaru (VD-06) |
| Review Carousel | Kartu ringkasan ulasan per channel, indikator halaman, tombol panah | Menyebut channel, tanggal, aspek, label bersponsor. Tanpa autoplay; bisa dioperasikan keyboard. Scroll-snap CSS (jalan tanpa JavaScript), satu kartu per tampilan; satu ulasan = kartu biasa (VD-06, `review-carousel.tsx`) |
| Quick Start (Tanya AI) | Chip budget dan kebutuhan + tombol kirim | Pola "quick send". Chip menyebut angka dan kegiatan nyata (gaya copy `cekharga-antislop` §5). Beranda (VD-04): formulir GET ke `/assistant?tanya=form` dengan radio `budget` (2/3/5 juta, Lainnya = kosong) dan checkbox `kegiatan`; berfungsi tanpa JavaScript; tanpa pilihan bawaan; tidak mengirim `budget_wajib` sehingga asisten tetap menanyakan apakah budget batas keras (PRD FR-06) |
| Recommendation Card | Kandidat, alasan cocok, kompromi, varian, harga + waktu periksa | Tanpa skor atau peringkat |
| Chat Tanya AI | Layar awal (latar gradasi + Quick Start di `glass-text`), percakapan gaya chatbot (jawaban teks polos dengan penanda "CH", gelembung pengguna kanan, kartu menempel di bawah jawabannya), kotak tulis menempel di bawah | VD-08, `src/components/assistant/chat.tsx`: chip Quick Start mengisi kotak tulis (`aria-pressed`), pesan tampil seketika (`useOptimistic`), kartu muncul bertahap saat data nyata tiba (`ArrivalStagger`), gagal = "Coba lagi". Kartu produk yang ditanya/dibandingkan: `product-mini-cards.tsx` |
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
| Reveal | `src/components/motion/use-reveal.ts`, `reveal.tsx` (`Reveal`, `StaggerList`, `StaggerItem`); grid katalog memakai `CatalogGridItem` (VD-05, `RevealItem` dihapus) | HTML server selalu terlihat. Hanya elemen di bawah lipatan yang disembunyikan (layout effect, sebelum paint) lalu dimunculkan sekali lewat `inView` + `animate`. Reduced motion: tanpa animasi. Tidak perlu `<noscript>` |
| CountUp | `src/components/motion/count-up.tsx` | `value`, `format: "idr" \| "number"`. Teks lewat MotionValue (tanpa render ulang React). Untuk "Rp" yang lebih kecil, pakai `format="number"` dan tulis "Rp" di span terpisah |
| Segmented Control | `src/components/motion/segmented-control.tsx` | `label`, `options` (`value`, `label`, `text?`, `disabled?`), `value`, `onValueChange`, `collapseBelow?: "sm" \| "md"`, `fullWidth?`. Pilihan yang hidup di URL memakai versi tautan `SegmentedNav` (VD-05, VD-06) |

Screenshot halaman penuh tidak menggulir, jadi elemen reveal di bawah lipatan tampak kosong di tangkapan semacam itu. Skrip QA harus menggulir halaman dulu sebelum memotret.

## 9. Larangan

1. Kaca di bawah harga, tabel, atau teks panjang.
2. Lebih dari satu warna aksen, gradien pelangi, glow berdenyut. Gradien hanya untuk latar halaman (`--scene-gradient`, abu netral sejak CD-00).
10. Foto latar dekoratif yang tidak berhubungan dengan HP atau belanja (keputusan PO 18 Nov 2026).
3. Garis perkiraan harga, skor, peringkat, badge "terbaik", "terlaris", "harga terendah".
4. Menyalin kode, foto, ikon, atau teks dari Verdelo.
5. Emoji sebagai ikon (pakai Hugeicons yang sudah terpasang).
6. Warna hex langsung di komponen. Pengecualian: warna merek logo marketplace pihak ketiga di `marketplace-logo.tsx` (bagian dari logonya, bukan warna tema; keputusan VD-06).
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
| B11 | Foto scene (tumbuhan siang, lampu malam) di belakang semua halaman, foto tajam di hero, foto blur di Hero Price Panel | Gradasi warna merek `--scene-gradient`; aset `public/images/scene/` dan `scripts/build-scene.mjs` dihapus | Keputusan PO 18 Nov 2026: foto tidak relevan dengan CekHarga. Bonus: LCP beranda tidak lagi menunggu foto (audit 003 no. 4) |
| B12 | Tema Verdant: kanvas hijau keabuan, aksen dan CTA hijau, Plus Jakarta Sans, radius 10/14/22/28 | Tema Calda (CD-00): abu netral Frost/Smoke, aksen biru, CTA monokrom, Urbanist (angka tabular Plus Jakarta Sans), radius 12/16/22/26, kaca berkilau diagonal | Keputusan PO 18 Nov 2026 (referensi template Calda, berbayar: gaya saja, tanpa salin kode/aset). Kontras diukur ulang; `--success/--warning/--destructive` Frost digelapkan agar ≥ 4.5:1 di kanvas |
