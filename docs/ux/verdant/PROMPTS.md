# Urutan Prompt untuk Claude Code: Rombak UI CekHarga ke Tema Verdant

Jalankan berurutan. Satu prompt = satu tiket = satu sesi kerja. Setelah Claude Code memberi rencana, baca dulu, koreksi bila perlu, baru balas "lanjut".

Direvisi 13 November 2026 (VD-00): menyesuaikan `DESIGN.md` revisi B1 sampai B10, menghapus sisa audit 002 yang sudah ditutup Sprint 16, dan memindahkan screenshot ke `qa-shots/` (PRD §12).

---

## Persiapan sebelum mulai

1. `DESIGN.md` di root repo, rencana di `docs/ux/REDESIGN-VERDANT-2026-11.md`, prompt ini di `docs/ux/verdant/PROMPTS.md` (sudah, VD-00).
2. Siapkan foto latar milik sendiri atau berlisensi bebas (misalnya Unsplash), dua suasana: siang (terang, hijau/natural) dan malam (gelap, ruangan hangat). Resolusi minimal 2400px. Simpan di `design/scene-src/` dengan nama `day.*` dan `night.*`, lalu catat sumber dan lisensinya untuk `public/images/scene/SOURCES.md`.
3. Ambil screenshot Verdelo (overview, kartu, daftar pembayaran, quick send, segmented control) di lebar 1440px dan 375px. Simpan di `design/references/verdelo/`. Folder ini di-ignore git karena repo publik dan Verdelo produk berbayar.
4. Skill `cekharga-antislop` dan `antislop` ada di `.claude/skills/` (folder `.claude` tidak dilacak git; salin manual bila pindah mesin).

---

## VD-00: Keputusan dan dokumen (selesai 13 November 2026)

Lihat `docs/ux/verdant/VD-00.md`. Sisa: jalankan `node scripts/build-scene.mjs` setelah foto di `design/scene-src/` tersedia.

## VD-01: Token dan tema

```
Tiket VD-01 (branch redesign/vd-01-tokens). Ikuti DESIGN.md bagian 3, 5, dan 6.1.

Analisis dulu, belum coding:
1. Petakan token lama di src/app/globals.css (.public-theme light/dark) ke token Verdant. Tunjukkan token yang berubah, yang baru (--stage, --glass, --glass-text, --glass-rim, --glass-top, --veil, --veil-text, --frost, --scene-blur, --brand-text, --shadow*), dan yang dipensiunkan (--accent-warm*).
2. Cari komponen publik yang memakai hex langsung, --accent-warm, gradien, backdrop-blur, atau warna Tailwind mentah. Mulai dari daftar di docs/ux/verdant/VD-00.md.
3. Usulkan utility baru: glass, glass-text, glass-float, stage.

Setelah saya setujui:
- Ubah token tema publik saja; .admin-theme jangan disentuh.
- Ganti gradien --accent-warm di ad-slot.tsx dengan token Verdant (label "Iklan" tetap terbaca).
- Perbarui halaman /style-guide supaya menampilkan semua token, contoh kaca (glass dan glass-text), panggung foto, dan bayangan, di dua tema.
- Hitung ulang rasio kontras dan tulis di komentar globals.css seperti format yang sudah ada.

Selesai jika: /style-guide rapi di 375px dan 1440px dua tema, lint/typecheck/test/e2e smoke lolos, screenshot sebelum-sesudah di qa-shots/verdant/VD-01/.
```

## VD-02: Fondasi motion

```
Tiket VD-02 (branch redesign/vd-02-motion). Ikuti DESIGN.md bagian 8.

Analisis dulu: baca src/components/motion/* (reveal, reveal-item, motion-provider), hero-tour.tsx, main-nav.tsx, compare-tray.tsx, product-gallery.tsx. Jelaskan pola motion yang sudah ada dan rencana penyatuannya.

Lalu buat:
1. src/lib/motion.ts: konstanta easing (easeOutQuint = [0.22, 1, 0.36, 1]), durasi (micro, entrance, layout, dataReveal, exit), varian fadeUp, staggerContainer (40-70ms, maksimal 8 anak), spring untuk thumb. Preset membaca useReducedMotion() dan memakai durasi 0 (MotionConfig reducedMotion="user" tidak mematikan opacity).
2. <CountUp value={number} format="idr" />: render awal = nilai final (aman untuk SSR, tidak pernah "Rp0"); animasi hanya saat value berubah setelah mount, dari nilai lama ke baru, memakai animate(motionValue, target); angka beranimasi aria-hidden, nilai akhir untuk pembaca layar; tabular-nums; durasi 0 saat reduced motion.
3. <SegmentedControl>: radio group aksesibel (roving tabindex, panah kiri/kanan), thumb bergeser memakai layoutId, target 44px, fallback chip/select bila tidak muat di 375px.
4. Pastikan Reveal/StaggerList membuat elemen di atas lipatan tampil langsung (Sprint 16 sudah melepas animasi di contoh perbandingan; jadikan perilaku umum).

Tampilkan semua komponen ini di /style-guide. Jangan dulu memasang ke halaman lain.
```

## VD-03: Shell

```
Tiket VD-03 (branch redesign/vd-03-shell). Ikuti DESIGN.md bagian 6 dan 7 (Glass Header, Scene Backdrop, Compare Tray).
Referensi visual: design/references/verdelo/ (lihat saja, jangan salin).

Analisis dulu: site-header, main-nav, site-footer, compare-tray, layout (public). Usulkan struktur Scene Backdrop: penuh di beranda dan /assistant, tipis memudar di halaman lain.

Lalu kerjakan:
1. <SceneBackdrop variant="full" | "fade"> di layout publik (DESIGN.md 6.2): lapisan absolute yang ikut bergulir, next/image dengan fill, sizes="100vw", fetchPriority="high" hanya untuk tema aktif pada varian full, tema lain loading="lazy" dan disembunyikan CSS. Tanpa layout shift. Tambahkan images.formats ["image/avif", "image/webp"] di next.config.ts.
2. Glass Header: kapsul navigasi .glass-text + .glass-float (blur 16px), menu aktif latar --brand-muted + aria-current, tombol ikon bulat 44px.
3. Footer: panel solid, tetap memuat transparansi.
4. Compare Tray: kaca, muncul dengan slide-up 450ms, kandidat masuk dengan layout animation.

Selesai jika: semua halaman publik tetap terbaca di dua tema, header tidak menutupi fokus keyboard, Lighthouse mobile beranda >= 90.
```

## VD-04: Beranda

```
Tiket VD-04 (branch redesign/vd-04-beranda). Ikuti DESIGN.md dan PRD FR-01.

Analisis dulu: baca src/app/(public)/page.tsx dan src/components/home/*. Untuk tiap section beri usulan versi Verdant: apa yang dipertahankan, apa yang berubah, komponen yang dipakai. (Audit antislop 002 sudah tertutup di Sprint 16; jangan mundurkan perbaikannya.)

Arah yang saya inginkan:
1. Hero: copy dan dua CTA (Cari produk = primary hijau, Tanya AI = sekunder) di kiri di atas --veil-text; di kanan Hero Price Panel (DESIGN.md 6.3) di atas scene penuh. Di dalamnya kartu harga SOLID dengan harga final dari server (tanpa count-up saat dimuat), varian acuan, Status Pill waktu periksa, dan SegmentedControl untuk adegan hero tour (Cari, Bandingkan, Harga, Tanya AI).
2. Tiga fakta (harga terikat varian, diperiksa berkala, beli di marketplace) sebagai strip .glass-text tipis.
3. Chip kebutuhan /hp/... dengan titik warna kecil.
4. Rail produk: Product Card dengan panggung foto terang, muncul stagger saat masuk layar (di bawah lipatan saja).
5. Contoh perbandingan: dua kartu solid, baris "beda" disorot --brand-muted; pasangan tetap berbeda dari hero (sudah sejak Sprint 16).
6. Pengenalan AI: Quick Start (chip budget + kebutuhan seperti yang sudah ada, misalnya "4 juta, utamakan kamera", plus chip "lainnya") yang langsung membuka /assistant dengan isian terisi.
7. Transparansi: tetap ada, panel solid.

Kerjakan per section, tunjukkan screenshot setiap section sebelum lanjut ke section berikutnya.
```

## VD-05: Katalog dan halaman kebutuhan

```
Tiket VD-05 (branch redesign/vd-05-katalog). Ikuti DESIGN.md dan PRD FR-02.

Analisis dulu: src/app/(public)/products/page.tsx, src/components/catalog/*, product-card.tsx, price-display.tsx, src/app/(public)/hp/*.

Lalu:
1. Filter Bar sticky .glass-text + .glass-float di bawah header: kolom cari, chip filter (Merek, RAM, Penyimpanan, Harga), urutan memakai SegmentedControl di desktop dan select di HP.
2. Product Card: panggung foto terang radius 22px di dalam kartu solid 28px, nama, varian acuan, harga mulai, Status Pill waktu periksa, tombol Bandingkan 44px. Tidak ada label di atas panggung (DESIGN.md 3.4).
3. Saat filter berubah: kartu bergeser dengan layout animation 450ms, kartu baru fade-up, perubahan jumlah hasil diumumkan lewat aria-live (sudah ada, pastikan tetap).
4. Grid 5/4/3/2 kolom tetap sesuai PRD.
5. Halaman /hp/[kebutuhan] memakai komponen yang sama.

Jangan mengubah logika query, URL state, atau pagination.
```

## VD-06: Detail produk

```
Tiket VD-06 (branch redesign/vd-06-detail). Ikuti DESIGN.md dan PRD FR-03, FR-05, §7, PB-31, PB-40.

Analisis dulu: src/app/(public)/products/[slug] dan src/components/product/*.

Lalu:
1. Galeri tetap di panggung terang; pemilih kapasitas memakai SegmentedControl, pemilih warna memakai SegmentedControl atau chip bila tidak muat.
2. Blok harga: CountUp saat varian kapasitas berubah (dari harga lama ke baru; ganti warna tidak memicu), varian acuan dan Status Pill waktu periksa selalu terlihat.
3. Penawaran sebagai Offer Row: tile ikon marketplace, nama toko, warna/varian, pill waktu periksa ("Harga terakhir tercatat" + warna peringatan bila lewat 30 jam), harga, tombol Buka. Muncul stagger.
4. Riwayat harga: restyle saja. Garis tangga warna --brand, titik = pemeriksaan nyata, celah putus-putus berlabel "tidak diperiksa", garis tergambar sekali 900ms. TANPA garis perkiraan atau label "terendah". Bila pemeriksaan < 5, tampilkan Recent Checks dengan date tile. Alternatif tabel tetap ada.
5. Ulasan: Review Carousel per aspek (umum, kamera), tanpa autoplay, tiap kartu menyebut channel, tanggal, label bersponsor, dan tautan menit video.

Jangan mengubah logika varian, freshness, atau pemilihan penawaran.
```

## VD-07: Perbandingan

```
Tiket VD-07 (branch redesign/vd-07-compare). Ikuti DESIGN.md dan PRD FR-04.

Analisis dulu: src/app/(public)/compare, bandingkan/[pasangan], src/components/compare/*.

Lalu: kartu kandidat solid berdampingan (header kandidat sticky di HP memakai .glass-text + .glass-float), baris berbeda disorot --brand-muted dengan label "beda", ringkasan selisih harga sebagai kalimat (bila sama: "Harga varian acuan keduanya sama"), tambah/hapus kandidat dengan layout animation. Tanpa pemenang, skor, atau bar yang membandingkan nilai spesifikasi.
```

## VD-08: Tanya AI

```
Tiket VD-08 (branch redesign/vd-08-assistant). Ikuti DESIGN.md dan PRD FR-06.

Analisis dulu: src/app/(public)/assistant dan src/components/assistant/*.

Lalu:
1. Scene penuh sebagai latar halaman, judul di atas --veil-text dan composer di panel .glass-text.
2. Quick Start: chip budget dan kebutuhan yang mengisi composer.
3. Pesan dan Recommendation Card di permukaan solid, kartu muncul stagger saat hasil nyata tiba. Indikator memuat hanya saat benar-benar menunggu (PRD: loading mewakili proses nyata).
4. Tombol bagikan hasil tetap ada. Periksa apakah state gagal sudah punya tombol coba lagi (wajib menurut PRD FR-06); bila belum, laporkan dan usulkan desainnya.
```

## VD-09: QA menyeluruh

```
Tiket VD-09 (branch redesign/vd-09-qa). Lakukan pemeriksaan menyeluruh tema Verdant:
1. Playwright screenshot semua halaman publik di 375, 768, 1440px, tema terang dan gelap, simpan di qa-shots/verdant/VD-09/ (tidak masuk Git).
2. Lighthouse mobile untuk beranda, /products, satu detail produk, /compare, /assistant.
3. Ukur kontras teks di atas kaca dan scene pada kondisi terburuk, bandingkan dengan angka DESIGN.md §3.
4. Uji dengan prefers-reduced-motion: reduce dan CPU throttle 4x.
5. Jalankan audit cekharga-antislop mode after, simpan sebagai docs/ux/anti-slop/audit-003-YYYY-MM-DD.md.
6. Daftar sisa masalah beserta prioritas. Jangan langsung memperbaiki, tunggu persetujuan.
```

---

## Prompt revisi cepat (dipakai kapan saja)

```
Revisi [komponen/halaman]:
- Yang terlihat sekarang: [jelaskan atau lampirkan screenshot]
- Yang saya mau: [spesifik: ukuran, jarak, warna token, durasi]
- Acuan: DESIGN.md bagian [x]; referensi design/references/verdelo/[file].png
Tetap ikuti PRD. Tunjukkan screenshot sebelum dan sesudah.
```
