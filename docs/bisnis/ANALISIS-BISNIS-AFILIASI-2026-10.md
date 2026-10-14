# Analisis Bisnis, Target, dan Riset Afiliasi CekHarga — Oktober 2026

Disusun 14 Oktober 2026 untuk pemilik produk dan pimpinan PT Sinteniki Digital Solusi.

Status angka:

- **Fakta:** diambil dari database atau dokumen proyek, disebut sumbernya.
- **Simulasi:** hitungan dengan asumsi tertulis. Bukan target dan bukan janji. PRD §13 menetapkan target angka bisnis dibuat setelah ada baseline, bukan dikarang sekarang.
- **Belum terverifikasi:** komisi dan fitur afiliasi dari sumber publik, wajib dicek ulang di dasbor resmi masing-masing program sebelum keputusan.

## 1. Kalimat posisi (final)

**Tagline:** **Harga HP yang bisa kamu cek ulang.**

**Kalimat pendukung:** Setiap harga menyebut varian, toko, dan kapan terakhir diperiksa. Iklan selalu berlabel dan tidak mengubah urutan.

**Pernyataan posisi (internal, untuk tim dan materi penjualan):**
> Untuk pembeli HP di Indonesia yang ingin yakin sebelum checkout, CekHarga adalah pembanding harga yang menunjukkan varian, toko, dan waktu pemeriksaan setiap harga, bukan sekadar daftar termurah. Setiap angka bisa ditelusuri, dan iklan tidak pernah mengubah urutan.

Alasan pilihan ini:

- "Cek ulang" bermain dengan nama merek, dan langsung menunjuk keunggulan yang tidak dimiliki BigGo: waktu pemeriksaan dan varian yang jelas.
- Semua isinya bisa dibuktikan di situs. Tidak ada kata "termurah", "terbaik", atau jumlah pengguna (dilarang PRD FR-01/FR-02).
- Judul beranda "Pilih HP yang cocok, lengkap dengan komprominya." tetap dipakai, karena menjelaskan fungsi alat bantu keputusan. Tagline dipakai di deskripsi situs, media sosial, media kit, dan materi penjualan iklan.

## 2. Kondisi sekarang (fakta per 14 Oktober 2026)

| Aspek | Kondisi |
| --- | --- |
| Katalog | 66 produk terbit, 235 penawaran, 8 toko |
| Kesegaran harga | Situs belum di-deploy, jadi pemeriksaan harian belum berjalan; harga yang tampil berstatus "terakhir tercatat" |
| Riwayat harga | Rata-rata 2,6 catatan per penawaran sejak 11 September |
| Sumber harga e-commerce | Diinput manual lewat CSV (Shopee, Erafone) |
| Trafik | **Belum ada angka terukur.** `ADS-CONTEXT.md` menyebut trafik sudah tinggi, tetapi situs belum punya URL publik, jadi klaim itu belum bisa dipakai di media kit (ADS-CONTEXT §12.2 butir 5) |
| Pendapatan | Belum ada. Modul iklan (direct selling, AdSense) sudah dibangun tetapi fase lanjutnya ditahan (PB-10). Belum ada tautan afiliasi |
| Aset pembeda | Waktu pemeriksaan per harga, harga terikat varian, ringkasan reviewer, Tanya AI berkuota, galeri per warna, label iklan wajib |

## 3. Yang diinginkan pimpinan, dan apa artinya

Dari dokumen proyek (`ADS-CONTEXT.md` §1, PRD §2), arah bisnisnya:

1. CekHarga menjadi platform informasi produk dan perbandingan harga gadget untuk konsumen Indonesia.
2. Ruang iklan, terutama **direct selling ke brand dan agensi**, menjadi sumber pendapatan utama, diikuti sponsored listing dan iklan programatik.

Konsekuensinya jelas: **semua model pendapatan bergantung pada trafik, dan trafik bergantung pada data yang segar plus SEO.** Urutan kerja yang sudah disetujui (deploy → data → pembeda) sudah tepat untuk ini.

Yang **belum tertulis** dan perlu dikonfirmasi pimpinan:

- Target angka: kunjungan per bulan, pendapatan, dan kapan.
- Anggaran (konten, iklan berbayar, tim data).
- Prioritas antara iklan brand dan afiliasi.

## 4. Peta jalan target (bertahap)

Target operasional berikut boleh ditetapkan sekarang, karena bisa dikendalikan tim. Target trafik dan pendapatan ditetapkan di akhir Fase A dari baseline 30 hari.

**Metrik utama (north star):** jumlah **klik ke toko dari penawaran berharga segar** per minggu. Metrik ini mengukur nilai bagi pengguna (menemukan penawaran yang masih berlaku) sekaligus menjadi dasar komisi afiliasi. Sejalan dengan PRD §13: "Ukur alur pencarian/rekomendasi sampai membuka penawaran".

### Fase A — "Hidup" (Oktober–November 2026)

| Target | Ukuran selesai |
| --- | --- |
| Situs publik | Deploy Vercel, secret terpasang, worker per menit dan cron harian berjalan (PB-01) |
| Harga segar | ≥80% produk terbit punya harga yang diperiksa ≤30 jam |
| Cakupan | ≥150 produk terbit: HP yang dijual di Indonesia tahun 2026, masing-masing minimal 2 toko |
| Mesin pencari | Search Console terverifikasi; ≥90% halaman produk terindeks; judul dan data terstruktur produk aktif (PB-23, PB-12) |
| Pengukuran | Analitik minimal tanpa data pribadi berjalan → baseline 30 hari |

### Fase B — "Ditemukan" (Desember 2026–Februari 2027)

| Target | Ukuran selesai |
| --- | --- |
| Data otomatis | Pilot feed afiliasi berjalan (bagian 5): harga satu marketplace masuk otomatis, bukan CSV |
| Konten SEO | Halaman "A vs B" (PB-28) dan halaman kebutuhan (PB-29) untuk merek utama |
| Target angka | Target kunjungan dan klik per bulan ditetapkan dari baseline Fase A |
| Media kit | Halaman `/iklan` memuat angka trafik **terukur**, bukan perkiraan |

### Fase C — "Menghasilkan" (Maret–Juni 2027)

| Target | Ukuran selesai |
| --- | --- |
| Iklan brand | Kesepakatan direct selling pertama, misalnya paket peluncuran HP baru |
| Afiliasi | Komisi berjalan dengan pengungkapan jelas di situs (PRD FR-08) |
| Fitur lanjutan | Grafik riwayat harga dan pantau harga, bila disetujui di PB-31 |

## 5. Riset afiliasi (belum terverifikasi; cek dasbor resmi sebelum memutuskan)

| Program | Komisi kategori HP/elektronik (menurut sumber publik) | Akses data | Catatan |
| --- | --- | --- | --- |
| **Shopee Affiliate** | Sumber berbeda-beda: 0,5% (batas Rp10.000/pesanan, jalur media sosial) sampai 4% (batas Rp50.000) untuk Affiliate Partner | Ada **Open API** (GraphQL, domain Indonesia `open-api.affiliate.shopee.co.id`) dan unduhan **product feed** dari dasbor | Cakupan listing terbesar (di BigGo: ±55 ribu listing untuk satu model HP) |
| **Blibli Affiliate** | ±1% untuk HP & tablet; program umum menyebut 3–12% di kategori lain | Lewat Involve Asia (deeplink, laporan); feed data belum terkonfirmasi | Kandidat pilot di PRD §3; banyak toko resmi dan *flagship store* |
| **Tokopedia Affiliate** (kini satu grup dengan TikTok Shop) | ±1% untuk HP & tablet; batas umum disebut Rp50.000/transaksi | Generator link; API/feed untuk situs pembanding belum ditemukan | Ada komisi tambahan dari penjual lewat "Dipromosikan Affiliate" |
| **Lazada (LazAffiliate)** | Angka kategori HP tidak ditemukan; program lebih banyak menyasar kreator | API/feed belum ditemukan | Investasi besar ke program kreator; relevansi untuk situs pembanding rendah |
| **Involve Asia / Accesstrade** (jaringan) | Tergantung pengiklan (Blibli, Tokopedia, dll.) | Deeplink dan laporan; feed perlu ditanyakan ke tim partner | Satu kontrak untuk banyak toko; Shopee dan Lazada umumnya lewat program sendiri |

### Kesimpulan riset

1. **Komisi HP itu kecil**, sekitar 0,5–1% dan sering dibatasi per pesanan. Afiliasi **tidak akan** menjadi sumber pendapatan utama. Ini sejalan dengan arahan pimpinan bahwa iklan brand yang utama.
2. **Nilai terbesar afiliasi adalah akses data.** Feed atau API resmi membuat harga e-commerce masuk otomatis dan legal, sehingga keluhan input manual selesai dan katalog bisa tumbuh tanpa menembus anti-bot.
3. **Rekomendasi pilot:**
   - **Pilot 1: Shopee Affiliate Open API.** Cakupan terbesar dan API-nya ada. Verifikasi dulu: dokumentasi resmi untuk Indonesia, data yang tersedia (harga, varian, stok, toko), batas pemanggilan, dan **izin menampilkan serta menyimpan harga** di situs pembanding.
   - **Pilot 2: Blibli** (langsung atau lewat Involve Asia). Kandidat PRD dan kuat di toko resmi. Tanyakan ketersediaan product feed.
   - Tokopedia/TikTok Shop dan Lazada menyusul setelah ada kejelasan akses data.
4. **Langkah administratif:**
   - Daftar atas nama badan usaha PT Sinteniki Digital Solusi (NPWP), bukan akun pribadi.
   - Baca syarat dan ketentuan soal tampilan harga dan cache.
   - Siapkan label "Tautan afiliasi" di kartu penawaran (PRD FR-08).
   - Pasang atribut `rel="sponsored"` pada tautan afiliasi (pedoman mesin pencari).
   - Pencatatan klik tanpa data pribadi, mengikuti pola modul iklan.

## 6. Simulasi pendapatan (bukan target)

Tujuannya hanya menunjukkan skala, supaya ekspektasi realistis. Contoh memakai **100.000 kunjungan per bulan**.

**Afiliasi:**

| Asumsi | Nilai |
| --- | --- |
| Kunjungan yang mengklik ke toko | 10–20% → 10.000–20.000 klik |
| Klik yang berujung pembelian | 1–3% → 100–600 pesanan |
| Komisi bersih per pesanan HP (setelah batas) | Rp10.000–35.000 |
| **Hasil** | **±Rp1–21 juta per bulan** |

**Iklan display direct (contoh tarif, rate card belum ditetapkan):**

| Asumsi | Nilai |
| --- | --- |
| Impresi viewable per kunjungan | ±2 → 200.000 impresi |
| CPM contoh | Rp20.000–50.000 |
| **Hasil** | **±Rp4–10 juta per bulan**, di luar paket sponsor peluncuran (flat fee) yang nilainya ditentukan rate card |

Pelajaran dari simulasi:

- Rentangnya lebar, karena semua bergantung pada baseline yang belum ada.
- Di 100 ribu kunjungan pun pendapatannya masih moderat. Kenaikan nyata datang dari **trafik yang lebih besar** dan **paket sponsor brand** saat peluncuran HP, yang merupakan kekuatan PT Sinteniki sebagai agensi.

## 7. Peluang tambahan yang cocok dengan PT Sinteniki (butuh keputusan)

**Laporan pemantauan harga untuk brand dan distributor (B2B).** Data agregat harga publik per model, varian, dan toko: sebaran harga, listing di bawah harga resmi, dan kesegaran. Produk ini cocok dengan layanan ORM dan SEO Sinteniki dan tidak bergantung pada trafik konsumen.

Syaratnya ketat:

- Tidak memengaruhi data organik (prinsip independensi ADS-CONTEXT §2).
- Hanya data agregat, sesuai UU PDP.
- Hanya dari sumber yang sah.

## 8. Pertanyaan untuk pimpinan

1. Berapa target kunjungan dan pendapatan, dan untuk kapan? Bisa juga disepakati: target ditetapkan setelah baseline Fase A.
2. Prioritas: iklan brand saja, atau iklan brand ditambah afiliasi sejak Fase B?
3. Anggaran untuk konten, iklan berbayar, atau tenaga data selama Fase A–B.
4. Siapa yang mendaftar dan memegang akun afiliasi atas nama perusahaan?
5. Minat terhadap laporan pemantauan harga B2B (bagian 7)?

## Sumber riset

- BigGo: [biggo.id](https://biggo.id/), [Tentang Kami](https://biggo.id/official/aboutus), [CB Insights](https://www.cbinsights.com/company/biggo)
- Shopee Affiliate: [Dibimbing](https://dibimbing.id/blog/detail/cara-kerja-shopee-affiliate), [Tirto](https://tirto.id/berapa-komisi-affiliate-shopee-dan-tips-maksimalkannya-hcbo), [Gajihub](https://gajihub.com/blog/gaji-shopee-affiliate/), [Shopee Affiliate API (komunitas)](https://github.com/bcat95/shopee-aff), [AffiliateOS issue #376](https://github.com/qaede1992-tech/AffiliateOS/issues/376)
- Blibli: [FAQ resmi](https://www.blibli.com/pages/affiliate-faq), [Panduan YouTube Affiliate](https://www.blibli.com/promosi/youtube-affiliate), [Accesstrade](https://accesstrade.co.id/blogs/affiliate-marketing/komisi-blibli-affiliate), [Involve Asia](https://involve.asia/blog/blibli-affiliate-program-2/), [Ecomobi](https://ecomobi.com/id/ecomobi-x-blibli-campaign-komisi-pasar-atas-hingga-4/), [IDX Channel](https://www.idxchannel.com/ecotainment/blibli-affiliate-tawarkan-komisi-hingga-12-persen-potensi-cuan-sambil-internetan)
- Tokopedia: [Halaman resmi](https://affiliate.tokopedia.com/keuntungan), [Biteship](https://biteship.com/blog/tokopedia-affiliate-cara-daftar-komisi-dan-keuntungannya/), [IndoTelko](https://www.indotelko.com/read/1693961671/tokopedia-luncurkan-fitur-quotdipromosikan-affiliatequot)
- Lazada: [IndoTelko](https://www.indotelko.com/read/1748512640/kembangkan-program-lazaffiliate-lazada-investasikan-rp16-triliun), [PR Newswire](https://www.prnewswire.com/id/rilis-berita/lazada-investasikan-usd100-juta-untuk-kembangkan-program-lazaffiliate-dan-dorong-perdagangan-berbasis-kreator-302465002.html)
- Jaringan: [Involve Asia](https://involve.asia/partners/overview/), [Involve Asia vs Shopee Affiliate](https://involve.asia/blog/involve-asia-vs-shopee-affiliate/)
