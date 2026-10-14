# Analisis UI/UX dan Rancangan Grafik Riwayat Harga — Oktober 2026

Disusun 14 Oktober 2026. Dasar analisis:

- Tangkapan layar desktop (1366 px) dan ponsel (390 px) dari beranda, katalog, detail Redmi 17 (setelah data Xiaomi diimpor), dan perbandingan.
- Data harga di database per 14 Oktober.
- Dokumentasi terbaru lewat Context7: shadcn/ui Chart dan Next.js 16 `generateMetadata`/JSON-LD, dicocokkan dengan `node_modules/next/dist/docs`.

Audit UX sebelumnya (`UI-UX-AUDIT-2026-10-06.md`, UX-01 sampai UX-18) sudah selesai semua. Dokumen ini hanya memuat temuan baru.

## 1. Kesimpulan singkat

- **Tata letak dasar tidak perlu dirombak.** Struktur detail produk (foto kiri, keputusan kanan, penawaran, spesifikasi) sudah sesuai PRD §8, tanpa scroll horizontal di desktop maupun ponsel. Area kosong di beranda pada tangkapan layar ternyata animasi yang baru muncul saat di-scroll, bukan bug.
- **Yang perlu dirapikan adalah informasi harga di sekitar pemilih varian.** Dua di antaranya salah logika dan membuat halaman terlihat lebih "basi" atau "kosong" dari kenyataannya (UX-20, UX-21).
- **Grafik riwayat harga belum layak ditampilkan sekarang.** Datanya rata-rata baru 2,6 catatan per penawaran (maksimal 4). Rancangannya disiapkan di bagian 3, tetapi baru dibangun setelah pemeriksaan harian berjalan (PB-01) dan PRD dibuka lewat PB-31.

## 2. Temuan baru

### UX-20 · Tinggi · Chip kapasitas menyebut "Harga belum tersedia" padahal ada harga

Di Redmi 17, chip 6/128 dan 6/256 menulis "Harga belum tersedia", padahal ada harga Rp3.299.000 dan Rp3.849.000 yang diperiksa 2 hari lalu (Shopee). Penyebabnya, `variant-selector.tsx` hanya mengenal dua keadaan: `available` → "Ada penawaran", selain itu → "Harga belum tersedia".

**Usulan.** Chip memuat harganya sendiri, seperti kebiasaan pembeli di Erafone dan BigGo, dengan tiga keadaan:

| Keadaan | Teks baris kedua chip |
| --- | --- |
| Harga segar (≤30 jam) | `Rp3,3 jt` |
| Hanya harga lama | `Terakhir Rp3,3 jt` (warna peringatan, `title` menyebut tanggal) |
| Tidak ada harga | `Belum ada harga` |

Ini sejalan dengan PRD §7 butir 5: harga lama boleh tampil, asal terpisah dan berlabel.

### UX-21 · Tinggi · Kartu harga memilih catatan yang lebih lama saat harganya sama

Kartu harga Redmi 17 4/128 menulis "Tercatat 5 hari lalu" (situs resmi), padahal harga yang sama tercatat di Shopee 2 hari lalu. `resolveVariantPrice` di `src/lib/catalog/pricing.ts` memakai `candidate.priceIdr < best.priceIdr`, jadi saat seri yang dipakai adalah penawaran yang lebih dulu terbaca.

**Usulan.** Bila harganya sama, pilih yang waktu pemeriksaan berhasilnya paling baru, baik untuk harga segar maupun harga lama. Tambah tes unit untuk kasus seri.

### UX-22 · Sedang · Dua daftar warna yang saling bertentangan di satu halaman

Pemilih warna menampilkan warna listing toko (Oak Green, Lotus Purple, Deep Blue, Black). Tabel spesifikasi baris "Pilihan warna" menampilkan versi global GSMArena (Absolute Black, Deep Blue (Endless Blue), Vivid Orange). Pembaca bisa mengira salah satunya keliru.

**Usulan.** Bila produk punya warna dari listing toko, ubah label baris spesifikasi menjadi "Warna versi global (GSMArena)". Bila tidak ada, biarkan seperti sekarang.

### UX-23 · Sedang · Hero beranda menampilkan produk tanpa harga

Panel kecil di hero menulis "OPPO A6s · Harga belum tersedia". Kesan pertama situs jadi "tidak ada harga". Akar masalahnya: semua harga basi karena pemeriksaan harian belum berjalan (PB-01).

**Usulan.** Panel memilih produk dengan harga segar. Bila tidak ada sama sekali, tampilkan "Harga terakhir tercatat Rp… · {tanggal}" dengan label yang jujur.

### UX-24 · Sedang · Produk di katalog baru terlihat setelah scroll

Di desktop 900 px, judul, paragraf penjelasan, kotak pencarian, dan "Filter lainnya" mendorong kartu produk ke batas bawah layar. Harga di kartu baru terlihat setelah scroll. Di ponsel lebih jauh lagi.

**Usulan.**

- Ringkas paragraf pembuka menjadi satu kalimat.
- Gabungkan "Filter lainnya" ke baris yang sama dengan pencarian di desktop.
- Target: baris pertama kartu beserta harganya terlihat tanpa scroll di 1366×768.

### UX-25 · Rendah · Harga di halaman detail ponsel tertutup foto

Di 390×844, kartu harga baru muncul di bawah lipatan karena tinggi area foto 288 px ditambah padding. Urutan PRD tetap dipertahankan (foto → identitas → harga), tetapi tinggi foto di ponsel bisa diturunkan sekitar 15%. Dengan begitu, judul dan awal harga terlihat tanpa scroll.

### UX-26 · Rendah · Daftar warna di kartu penawaran terpotong

"Warna: Black, Deep Blue, Lotus Purple, Oak G…" terpotong di desktop. Usulan: tampilkan "4 warna" dengan warna terpilih ditebalkan, dan daftar lengkap di `title`/tooltip, atau biarkan membungkus maksimal 2 baris.

## 3. Rancangan grafik riwayat harga

Status: **rancangan, belum dibangun.** Membutuhkan keputusan PB-31 (PRD §3 menunda "grafik harga publik") dan data harian dari PB-01.

### 3.1 Syarat data agar jujur

| Aturan | Alasan |
| --- | --- |
| Grafik tampil hanya bila varian terpilih punya **≥5 pemeriksaan berhasil dalam ≥7 hari** | Hari ini maksimal 4 titik per penawaran; grafik 2–4 titik lebih menyesatkan daripada membantu |
| Di bawah ambang itu, tampilkan daftar singkat "Catatan harga" (5 catatan terakhir: tanggal, toko, harga) | Riwayat tetap transparan tanpa kesan tren |
| Garis berbentuk **tangga** (step): harga berlaku sampai pemeriksaan berikutnya. Titik = pemeriksaan nyata | Tidak menggambar harga di hari yang tidak diperiksa seolah diketahui |
| Celah lebih dari 30 jam tanpa pemeriksaan berhasil digambar putus-putus dan diberi keterangan "tidak diperiksa" | PRD §7 butir 6: percobaan gagal tidak boleh terlihat sebagai harga baru |
| Terikat **varian terpilih**; ganti kapasitas = ganti grafik | PRD §7 butir 3 |
| Tanpa klaim "harga terendah sepanjang masa", "waktu terbaik membeli", atau prediksi | PRD: tidak ada skor dan pemenang; perubahan harga bukan bukti promo (§7 butir 7) |

### 3.2 Letak di halaman detail

Grafik ditempatkan di **seksi sendiri tepat di bawah "Penawaran"**, sebelum "Spesifikasi". Pengguna yang sudah melihat harga sekarang lalu bertanya "biasanya segini?" langsung menemukan jawabannya. Di kartu harga atas cukup satu baris ringkasan yang menaut ke seksi itu.

```
┌ Kartu harga (kolom kanan) ───────────────────────────┐
│ Rp2.899.000   Untuk varian 4/128 GB                  │
│ ⏱ Diperiksa 2 jam lalu                               │
│ Rentang 30 hari: Rp2,85–2,99 jt · 24 pemeriksaan  →  │  ← hanya bila ambang terpenuhi
└──────────────────────────────────────────────────────┘

Penawaran (2)  … kartu toko …

Riwayat harga · 4/128 GB                [30 hari | 90 hari]
┌──────────────────────────────────────────────────────┐
│ Rp3,0 jt ┤        ●━━━━━┓                            │
│ Rp2,9 jt ┤ ●━━━━━━┛     ┗━━━━━●━━━━━━━━●  Shopee      │
│ Rp2,8 jt ┤ ■━━━━━━━━━━━━━━━━━━■ ┄┄┄┄ ■   Situs resmi  │
│          └──1 Okt────────8 Okt────────14 Okt          │
└──────────────────────────────────────────────────────┘
 ┄┄ = tidak diperiksa · Titik = pemeriksaan berhasil (WIB)
 ▸ Lihat sebagai tabel
```

- Satu garis per toko, maksimal 3. Toko lain lewat pilihan "Tampilkan semua toko".
- Nama toko ditulis di ujung garis dan memakai bentuk penanda berbeda (lingkaran, kotak), jadi tidak bergantung pada warna saja (PRD §8).
- Warna memakai token yang ada: `--brand` (teal) dan `--primary` (charcoal), lalu satu warna netral. Tidak ada palet baru.
- Ponsel: tinggi tetap 220 px, sumbu Y ringkas (Rp2,9 jt), sumbu X 3–4 tanggal.

### 3.3 Aksesibilitas

- Recharts `accessibilityLayer` (dari dokumentasi shadcn Chart) untuk navigasi keyboard dan pembaca layar.
- Ringkasan teks di atas grafik: "Dalam 30 hari, harga 4/128 GB di Shopee berkisar Rp2,85–2,99 jt (24 pemeriksaan)."
- Tabel alternatif di `<details>` "Lihat sebagai tabel", berisi semua titik.
- Kontras garis minimal 3:1 terhadap latar kartu, dan focus ring sama dengan elemen lain.

### 3.4 Teknis (mengacu dokumentasi terbaru)

- **Komponen:** shadcn/ui Chart (Recharts), yaitu `ChartContainer` dengan `ChartConfig`, `ChartTooltip` + `ChartTooltipContent`, dan `<LineChart accessibilityLayer>` dengan `type="stepAfter"`. Recharts belum terpasang; tambahkan lewat `shadcn add chart`. `components.json` sudah memakai Hugeicons.
- **Pemuatan:** komponen klien dimuat malas (lazy) karena letaknya di bawah lipatan, dengan tinggi tetap supaya tidak ada pergeseran tata letak. Situs publik lain tidak ikut membawa Recharts.
- **Data:** riwayat diambil per produk (maksimal 90 hari, semua penawaran varian), **tidak** dimasukkan ke cache katalog global yang batasnya sekitar 2 MB (lihat PB-32). Cache per produk di-invalidate bersama tag katalog setiap harga baru tersimpan (aturan system design 2).
- **Alternatif tanpa JavaScript:** SVG yang dirender server. Lebih ringan, tetapi tanpa tooltip dan navigasi keyboard per titik. Dipilih bila ukuran bundle jadi masalah.
- **Pengujian:** tes unit untuk ambang tampil, celah >30 jam, dan pilihan varian; E2E untuk grafik tersembunyi saat data kurang dan tabel alternatif tersedia.

## 4. Urutan perbaikan yang disarankan

| Urutan | Item | Backlog |
| --- | --- | --- |
| 1 | UX-21 (logika seri) dan UX-20 (chip berharga) | PB-34 |
| 2 | UX-22, UX-23, UX-24, UX-25, UX-26 | PB-35 |
| 3 | Grafik riwayat harga (bagian 3) | PB-36, setelah PB-01 + keputusan PB-31 |
