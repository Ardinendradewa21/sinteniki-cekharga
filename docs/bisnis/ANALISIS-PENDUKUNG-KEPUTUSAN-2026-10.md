# Analisis CekHarga sebagai Alat Bantu Keputusan — Oktober 2026

Disusun 16 Oktober 2026 untuk pemilik produk, atas masukan PO: "perlu dianalisis lagi terkait pasar dan kebutuhan dalam pembuatan pendukung keputusan, dan kekurangan website yang masih perlu dibahas."

Status angka, mengikuti `ANALISIS-BISNIS-AFILIASI-2026-10.md`:

- **Fakta database:** diambil dari InsForge pada 16 Oktober 2026 sekitar 18.00 WIB.
- **Data pasar:** dari laporan pihak ketiga, sumber disebut. Angka antarlembaga sering berbeda; pakai sebagai arah, bukan angka pasti.
- **Usulan:** belum keputusan. Yang menyentuh PRD §3 wajib diputuskan PO dulu.

## 1. Ringkasan

1. Pembeli HP di Indonesia memutuskan dari tiga hal: **budget**, **kebutuhan pemakaian** (kamera, baterai, game), dan **kepercayaan pada sumber** (ulasan reviewer, garansi, toko). CekHarga sudah kuat di bagian pertama dan kedua dari sisi spesifikasi, tetapi lemah di bukti pemakaian nyata dan kesegaran harga.
2. Celah paling mendesak bukan fitur baru, tetapi **data yang sudah dijanjikan situs belum terisi**:
   - 0 dari 67 produk punya harga yang berhasil diperiksa dalam 30 jam terakhir. Enam batch harga dari cron 16 Okt 06.39 WIB masih `queued`.
   - 0 ringkasan reviewer di database, padahal halaman produk punya bagian "Pengalaman reviewer".
3. Cakupan merek belum mengikuti pasar. Transsion (Infinix, Tecno, itel) memimpin pengiriman Q2 2026, sedangkan katalog baru punya 1 produk Infinix.
4. Urutan perbaikan yang diusulkan ada di §6: jalankan worker harga, isi ulasan reviewer lewat alur semi-otomatis YouTube, lalu perluas cakupan merek.

## 2. Pasar

| Temuan | Sumber | Dampak ke CekHarga |
| --- | --- | --- |
| Omdia Q2 2026: Transsion 26%, Xiaomi 20%, Samsung 18%, OPPO 17%, vivo 15%. Lima vendor menguasai 96% pengiriman. | [TelecomLead](https://telecomlead.com/smart-phone/indonesia-smartphone-market-q2-2026-transsion-leads-with-26-as-xiaomi-samsung-oppo-and-vivo-battle-rising-prices-127494?amp=1) | Katalog tanpa Infinix/Tecno/itel melewatkan sekitar seperempat pasar, terutama segmen terjangkau. |
| Q1 2026 pengiriman turun 9% (Counterpoint) atau 17% (Omdia), segmen premium naik. | [Counterpoint](https://counterpointresearch.com/cn/insights/indonesia-smartphone-market-q1-2026), [EE Times Asia](https://www.eetasia.com/?p=74412) | Pembeli menunda dan membandingkan lebih lama, sehingga alat bantu keputusan makin relevan. |
| IDC Indonesia memprediksi pengiriman 2026 turun karena harga perangkat naik (kelangkaan memori). | [Bisnis.com](https://teknologi.bisnis.com/read/20260131/280/1948870/idc-indonesia-prediksi-pengiriman-smartphone-turun-pada-2026-efek-harga-kian-mahal) | Harga per varian dan riwayat harga adalah nilai inti, asalkan datanya segar. |
| Beberapa studi lokal (sampel kecil, mahasiswa/Gen Z) menemukan ulasan YouTube dan kredibilitas reviewer berpengaruh signifikan pada keputusan beli, sering lebih kuat dari citra merek. Salah satunya meneliti channel GadgetIn. | [Etikonomi UIN Jakarta](https://journal.uinjkt.ac.id/index.php/etikonomi/article/view/50275), [JMAS Unbari](https://jmas.unbari.ac.id/index.php/jmas/article/view/467), [Jurnal Tazkia](https://jurnal.tazkia.ac.id/index.php/manfaah/article/download/468/390/1434) | Bagian reviewer bukan pelengkap. Bagi banyak pembeli, bagian ini sumber kepercayaan utama. Hasil studi bersifat indikatif, bukan survei nasional. |

## 3. Kebutuhan pembeli saat memutuskan

Diurutkan mengikuti alur keputusan, bukan prioritas teknis:

1. **Menyaring sesuai budget.** "HP 3 jutaan buat main game." Butuh daftar pendek yang jujur soal harga per varian.
2. **Memahami kompromi.** Apa yang dikorbankan di harga ini: kamera, baterai, chipset, layar.
3. **Bukti pemakaian nyata.** Kamera malam, panas saat game, daya tahan baterai. Spesifikasi saja tidak menjawab; pembeli mencari reviewer yang dipercaya.
4. **Kepastian harga dan tempat beli.** Harga untuk varian yang dimaksud, kapan diperiksa, di toko mana, garansi resmi atau tidak.
5. **Waktu beli.** Apakah harga sedang turun atau naik.
6. **Rasa aman setelah beli.** Garansi, layanan purna jual, reputasi penjual.

## 4. Kondisi CekHarga terhadap kebutuhan itu

| Kebutuhan | Yang sudah ada | Celah | Bukti |
| --- | --- | --- | --- |
| 1. Menyaring budget | Katalog dengan filter merek, RAM, penyimpanan, harga, garansi resmi; halaman kebutuhan `/hp/...`; Tanya AI | Halaman kebutuhan hanya terbit bila ≥3 produk berharga segar, jadi saat harga basi semuanya hilang | 0 produk segar hari ini |
| 2. Memahami kompromi | Perbandingan 2–3 produk tanpa skor, baki bandingkan di katalog (Sprint 6), alasan Tanya AI dari posisi harga dan susunan lensa | Kompromi masih dari spesifikasi; belum ada pembanding pemakaian nyata | – |
| 3. Bukti pemakaian nyata | Struktur `review_summaries` (channel, video, aspek, kelebihan, kekurangan, konteks uji) dan tampilannya sudah ada | **Kosong.** Belum ada alur untuk menemukan dan mengisi ulasan. Belum ada pemisahan ulasan umum dan kamera | 0 baris `review_summaries` |
| 4. Harga dan toko | 207 penawaran dari 8 toko, harga terikat varian, waktu periksa, grafik riwayat per varian | Harga resmi menunggu worker; Shopee/Erafone hanya lewat CSV manual (PB-17); belum ada Tokopedia, Blibli, Lazada | 6 batch `queued` sejak 16 Okt 06.39 WIB; sukses terakhir 14 Okt |
| 5. Waktu beli | Grafik riwayat harga publik (PB-36), ambang ≥5 pemeriksaan dalam ≥7 hari | Data riwayat masih tipis; pantau harga lewat email ditunda (PRD §3, PB-31) | – |
| 6. Rasa aman | Filter garansi resmi, label toko resmi | Tidak menilai reputasi penjual marketplace (sengaja, belum ada data sah) | – |

Cakupan katalog per merek (produk terbit): Samsung 18, Xiaomi 15, OPPO 11, Apple 8, iQOO 6, vivo 4, Motorola 3, Infinix 1, Huawei 1. Belum ada realme, Tecno, itel, POCO sebagai merek terpisah (POCO tercatat di bawah Xiaomi).

## 5. Kekurangan yang perlu dibahas

Diurutkan dari dampak terbesar ke pengguna:

1. **Harga tidak segar (kritis).** Cron harian berjalan, tetapi batch harga hasilnya hanya diterapkan oleh worker. Worker per menit lewat InsForge Schedules belum dijadwalkan (PB-01 sebagian), sehingga batch menunggu admin membuka Pusat Impor. Akibatnya semua harga tampil "terakhir tercatat", halaman kebutuhan tidak terbit, dan janji "diperiksa berkala" belum terpenuhi.
2. **Ulasan reviewer kosong (kritis untuk kepercayaan).** Bagian yang menurut riset paling memengaruhi keputusan justru belum berisi. Masukan PO 16 Okt meminta alur semi-otomatis dari channel YouTube terpercaya, dengan ringkasan umum dan kamera dipisah.
3. **Cakupan merek tidak mengikuti pasar.** Segmen terjangkau (Transsion, realme) hampir tidak ada, padahal segmen inilah yang paling sensitif harga.
4. **Sumber harga e-commerce manual.** Marketplace utama belum punya sumber sah otomatis (PB-17 perlu riset bisnis: program afiliasi atau kerja sama).
5. **Spesifikasi belum lengkap.** NFC dan rating IP kosong untuk sebagian produk (PB-04 mencatat 34; perlu dihitung ulang), sehingga filter dan Tanya AI bisa melewatkan produk yang sebenarnya cocok.
6. **Tidak ada uji sendiri.** CekHarga tidak menguji perangkat. Ini sikap yang jujur dan murah, tetapi berarti kualitas nyata sepenuhnya bergantung pada ulasan reviewer (lihat butir 2).
7. **Admin di ponsel belum terverifikasi di browser.** Audit Sprint 6 memeriksa halaman publik di layar 360 px. Halaman admin hanya diperiksa dari kode karena sesi uji kedaluwarsa dan kredensial QA belum ada di `.env.local`.

## 6. Rencana perbaikan yang diusulkan

| Urutan | Usulan | Jenis | Catatan |
| --- | --- | --- | --- |
| 1 | Jadwalkan worker impor per menit di InsForge Schedules (`POST /api/admin/import/worker`, Bearer `IMPORT_WORKER_SECRET`). Sementara itu, terapkan batch yang menunggu. | Operasional (PB-01) | Paling murah, dampak terbesar. Tanpa ini fitur lain tetap tampil dengan harga basi. |
| 2 | Ulasan YouTube semi-otomatis: daftar channel terpercaya dikelola admin, pencarian lewat YouTube Data API resmi, antrean persetujuan admin, tag "umum"/"kamera", ringkasan ditulis atau disetujui admin, ringkasan AI saat membandingkan hanya dari ringkasan yang disetujui. Transkrip video tidak diambil. | Fitur baru (usulan PB-40) | Butuh perubahan PRD §3 dan `YOUTUBE_API_KEY`. Endpoint AI wajib rate limit dan kuota (aturan system design 1). |
| 3 | Tambah produk Infinix, Tecno, itel, dan realme yang paling banyak dicari, mulai dari harga di bawah Rp3 juta. | Data (usulan PB-41) | Lewat SOP impor; sumber resmi tiap merek perlu dicek. |
| 4 | Lengkapi NFC/IP dan spesifikasi kosong. | Data (PB-04) | Hitung ulang jumlahnya dulu. |
| 5 | Riset sumber harga marketplace yang sah. | Bisnis (PB-17) | Prasyarat sebelum klaim "harga dari banyak toko". |
| 6 | Uji admin di ponsel dengan akun QA. | QA | Isi `QA_ADMIN_EMAIL` dan `QA_ADMIN_PASSWORD` di `.env.local`, lalu jalankan proyek E2E admin. |

## 7. Yang ditampilkan ke publik

Sesuai pilihan PO ("dua-duanya"), beranda kini punya bagian **"Yang belum bisa kami bantu"** di panel transparansi. Isinya hanya pernyataan yang benar hari ini dan tidak memuat angka yang cepat basi:

- Katalog belum mencakup semua model, terutama banyak model Infinix, Tecno, itel, dan realme.
- Harga marketplace masih dimasukkan berkala, belum diambil otomatis dari semua toko; voucher dan cashback tidak dihitung.
- Ringkasan reviewer masih sedikit; banyak produk belum punya.
- CekHarga tidak menguji perangkat sendiri.
- Belum bisa memberi tahu saat harga turun.
- Tidak menilai reputasi penjual, dan belum mencakup HP bekas.

Bila salah satu celah tertutup (mis. ulasan sudah terisi untuk sebagian besar produk), hapus atau ubah butirnya di `src/components/home/transparency-teaser.tsx` agar tetap jujur.
