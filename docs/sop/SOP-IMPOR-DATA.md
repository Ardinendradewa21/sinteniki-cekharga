# SOP Impor Data Produk dan Harga CekHarga

Dokumen ini adalah prosedur baku tim PT Sinteniki Digital Solusi untuk memasukkan data ponsel dan harga ke CekHarga. Semua langkahnya dijalankan dari halaman admin **Impor data** (`/admin/import`).

- **Pelaksana:** akun berperan `admin`. Peran `sales`, `adops`, `finance`, dan `legal` tidak bisa membuka halaman impor dan produk.
- **Berlaku sejak:** 8 Oktober 2026.
- **Acuan aturan:** `docs/CekHarga_PRD_v2.md`, terutama §3 (cakupan), §6 (varian), §7 (harga), dan FR-05 (penjual).

## 1. Prinsip yang tidak boleh dilanggar

1. **Harga hanya dari penawaran toko di Indonesia** yang dicatat beserta waktu pemeriksaannya. Kolom harga dari dataset spesifikasi (misalnya `price_raw` GSMArena berisi EUR atau INR) tidak pernah diimpor.
2. **Harga kosong bukan nol.** Bila harga belum diketahui, kosongkan sel `price_idr`. Jangan menulis `0`.
3. **Varian tidak boleh dikarang.** Produk hanya punya kombinasi RAM/penyimpanan yang tercantum di sumber. Impor harga tidak pernah membuat varian baru.
4. **Data yang tidak pasti disimpan sebagai "tidak diketahui"**, bukan ditebak. Contoh: NFC "Yes (market/region dependent)" tersimpan kosong, karena belum tentu ada di unit Indonesia.
5. **Semua impor lewat pratinjau.** Berkas tidak langsung menulis ke katalog. Sistem membuat batch, admin meninjau, lalu menerapkan.
6. **Produk hasil impor selalu masuk sebagai draft.** Yang menerbitkan tetap manusia, setelah memeriksa daftar di bagian 7.
7. **Badge penjual terverifikasi butuh bukti.** Isi `seller_verified` dengan `ya` hanya bila buktinya ada.
8. **Foto butuh dasar hak pakai.** Tanpa dasar hak pakai, foto dilewati dan data lain tetap masuk.

## 2. Pilih jalur impor

| Kebutuhan | Jalur | Tab di Pusat Impor |
| --- | --- | --- |
| Menambah produk baru beserta spesifikasi dan varian | CSV spesifikasi | Unggah CSV |
| Menambah atau memperbarui harga di toko mana pun | CSV penawaran | Unggah CSV |
| Mengambil lineup dan harga dari situs resmi merek | Tarik otomatis | Tarik otomatis |
| Memproses ulang atau memantau foto | Foto | Foto |
| Melihat, menerapkan, atau membatalkan batch | Riwayat batch | Riwayat batch |

Urutannya selalu: **produk dulu, baru harga.** CSV penawaran untuk produk yang belum ada akan dilewati dengan alasan "slug tidak ditemukan".

Merek yang didukung tarik otomatis: vivo, iQOO, OPPO, Samsung, Xiaomi, Digimap (Apple), dan Infinix. Merek lain memakai CSV.

## 3. Impor spesifikasi (produk baru)

### 3.1 Siapkan berkas

1. Klik **Templat spesifikasi** di bagian "Spesifikasi produk" untuk mengunduh `templat-spesifikasi-cekharga.csv`.
2. Isi satu baris per model. Ekspor GSMArena lengkap juga diterima apa adanya, karena kolom yang tidak dikenal diabaikan.
3. Simpan sebagai CSV UTF-8 dengan pemisah koma. Di Excel, pilih "CSV UTF-8 (Comma delimited)".

### 3.2 Kolom templat spesifikasi

Kolom wajib ditandai ✱. Baris yang kolom wajibnya kosong akan dilewati beserta alasannya.

| Kolom | Isi | Contoh | Masuk ke database |
| --- | --- | --- | --- |
| `brand` ✱ | Merek. Penulisan dikanonkan otomatis (Oppo → OPPO, Realme → realme, vivo iQOO → iQOO) | `OPPO` | `products.brand` |
| `model_name` ✱ | Nama model. Awalan merek dibuang otomatis | `Reno16c` | `products.model`, `products.slug` |
| `memory_variants_summary` ✱ | Pasangan **penyimpanan/RAM**, dipisah titik koma | `128GB/8GB; 256GB/12GB` | baris `variants` |
| `url` ✱ | Nama halaman GSMArena, tanpa domain. **Ini kunci produk**; jangan diubah setelah diimpor | `oppo_reno16c_5g-14768.php` | `products.source_key`, `specs_source_url` |
| `device_type` | `phone`. Selain itu dilewati (di luar cakupan PRD §3) | `phone` | – |
| `announced` | Tanggal rilis; tahunnya diambil | `2026, July 02` | `specs.releaseYear` |
| `network_technology` | Jaringan | `GSM / HSPA / LTE / 5G` | `specs.is5G` |
| `display_size_inches` | Ukuran layar | `6.57` | `specs.displayInches` |
| `display_type_raw` | Teknologi layar; bagian sebelum koma pertama | `AMOLED, 1B colors, 120Hz` | `specs.displayTechnology` |
| `refresh_rate_hz` | Refresh rate | `120` | `specs.refreshRateHz` |
| `chipset` | Chipset | `Mediatek Dimensity 7300 Energy (4 nm)` | `specs.chipset` |
| `battery_capacity_mah` | Kapasitas baterai | `7000` | `specs.batteryMah` |
| `charging` | Pengisian; diambil watt terbesar | `80W wired, 55W PPS` | `specs.chargingWatt` |
| `main_camera_count` | `Single`, `Dual`, `Triple`, atau `Quad` | `Triple` | `specs.cameraLensCount` |
| `main_camera_raw` | Teks kamera utama; MP pertama, ultrawide, telephoto, dan zoom optik dibaca dari sini | `50 MP, f/1.8 ... 3.5x optical zoom` | `specs.mainCameraMp` dan kolom kamera lain |
| `weight_raw` | Bobot | `195 g (6.88 oz)` | `specs.weightGrams` |
| `nfc` | `Yes`, `No`, atau teks "market dependent" (disimpan tidak diketahui) | `No` | `specs.hasNfc` |
| `ip_rating` | Ketahanan air/debu | `IP68` | `specs.ipRating` |
| `jack_3_5mm` | `Yes` atau `No` | `No` | `specs.has35mmJack` |
| `os` | Sistem operasi | `Android 16, ColorOS 16` | `specs.osVersion` |
| `colors` | Warna, dipisah koma | `Stellar Purple, Starry White` | `specs.colorOptions` |
| `image_url` | URL foto HTTPS dari host yang diizinkan: `fdn.gsmarena.com`, `fdn2.gsmarena.com`, `down-id.img.susercontent.com`, `cdnpro.eraspace.com` | – | `product_assets` |
| `image_usage_basis` | `written-permission`, `public-license`, `own-work`, atau `admin-declared` | `written-permission` | `product_assets.usage_basis` |
| `image_usage_rights` | Bukti hak pakai, misalnya nomor surat izin atau nama lisensi | `Izin email PT X, 1 Okt 2026` | `product_assets.usage_rights` |

Kolom cadangan yang tetap dibaca bila kolom utamanya kosong:

- `memory_variants_raw` dengan format `128GB 8GB RAM, 256GB 12GB RAM`.
- `status_raw` untuk tahun rilis.

### 3.3 Unggah dan tinjau

1. Buka **Impor data → Unggah CSV → Spesifikasi produk**.
2. Pilih berkas. Bila berkas membawa foto, pilih dasar hak pakai. Bila hak pakainya belum jelas, lewati.
3. Klik **Buat pratinjau**. Sistem membuat batch draft lalu membuka halaman tinjau.
4. Periksa kolom aksi tiap baris: **Baru**, **Berubah**, **Sama**, atau **Dilewati** beserta alasannya.
5. Hapus centang baris yang ragu.
6. Klik **Terapkan N baris**. Proses berjalan bertahap; bar progres boleh ditinggal, dan tab boleh di-refresh.
7. Setelah selesai, baca kolom **Hasil**. Untuk baris gagal, perbaiki penyebabnya lalu klik **Coba ulang N baris yang gagal**.

## 4. Impor penawaran dan harga

### 4.1 Siapkan berkas

Klik **Templat CekHarga** di bagian "Penawaran dan harga" untuk mengunduh `templat-penawaran-cekharga.csv`. Satu baris berisi satu listing toko untuk satu varian.

| Kolom | Isi | Contoh | Masuk ke database |
| --- | --- | --- | --- |
| `slug` ✱ | Slug produk yang **sudah ada**. Lihat di halaman admin produk | `oppo-reno16-pro` | mencari `products` |
| `ram_gb` ✱ | RAM varian, angka | `12` | mencari `variants` |
| `storage_gb` ✱ | Penyimpanan varian, angka. 1 TB ditulis `1024` | `256` | mencari `variants` |
| `marketplace` ✱ | Nama toko/marketplace. Tulis sama persis dengan daftar di 4.2 | `Blibli` | `offers.marketplace` |
| `seller_name` ✱ | Nama penjual di marketplace | `OPPO Official Store` | `offers.seller_name` |
| `url` ✱ | URL listing, http/https. **Kunci penawaran** bersama varian | `https://www.blibli.com/p/...` | `offers.url`, `offers.store_id` |
| `warranty` | Keterangan garansi; boleh kosong | `Garansi resmi Indonesia` | `offers.warranty` |
| `listing_status` | `active` (bawaan), `out-of-stock`, `ambiguous`, atau `inactive` | `active` | `offers.listing_status` |
| `seller_verified` | `ya` hanya bila ada bukti; selain itu `tidak` | `tidak` | `offers.seller_verified` |
| `price_idr` | Harga Rupiah tanpa desimal. `Rp7.999.000` juga diterima. **Kosongkan bila belum tahu** | `7999000` | `price_observations.price_idr` |
| `observed_at` | Waktu harga dilihat, ISO 8601 dengan zona waktu | `2026-10-08T10:00:00+07:00` | `price_observations.observed_at` |

Catatan:

- Bila `observed_at` kosong, sistem memakai waktu terakhir berkas diubah. Isi kolom ini supaya label "diperiksa …" di situs jujur.
- Harga di atas Rp500.000.000 ditolak sebagai salah ketik.
- Harga dianggap segar selama **30 jam** sejak `observed_at` (keputusan 8 Oktober 2026). Setelah itu situs menampilkan "perlu dicek ulang".

### 4.2 Nama toko yang terdaftar

Toko dikenali dari domain URL listing (tabel `stores`). Tulis kolom `marketplace` dengan nama berikut supaya tampilan seragam:

| Nama | Domain |
| --- | --- |
| Shopee | shopee.co.id |
| Tokopedia | tokopedia.com, tokopedia.link |
| Blibli | blibli.com |
| Lazada | lazada.co.id |
| TikTok Shop | tiktok.com |
| Erafone | erafone.com |
| Digimap | digimap.co.id |
| Situs resmi OPPO / vivo / iQOO / Samsung / Xiaomi / Infinix Indonesia | domain resmi masing-masing |

Listing dari domain yang belum terdaftar tetap tersimpan, tetapi tanpa toko. Minta developer menambah toko baru ke tabel `stores` bila akan sering dipakai.

### 4.3 Format lain yang diterima

Form yang sama juga menerima dua format lain dan menyeragamkannya sendiri:

- **Hasil scraper Shopee.** Gunakan templat **Templat scraper Shopee**, dengan kolom `listing_url`, `image_url`, `title`, `price_idr`, `rating`, `sold_text`, `seller_name`, dan `scraped_at`.
  - Produk dicocokkan dari judul.
  - Judul yang cocok ke lebih dari satu produk, atau menyebut beberapa varian, dilewati supaya harga tidak menempel ke produk yang salah.
  - Rating dan jumlah terjual tidak pernah dipakai.
- **Ekspor ekstensi browser dari erafone.com.** Kolom boleh bergeser karena dibaca menurut isinya. Judul tanpa keterangan memori dilewati.

### 4.4 Unggah dan tinjau

Langkahnya sama dengan 3.3. Laporan memisahkan tiga angka: penawaran baru, penawaran diperbarui, dan harga tercatat. Ketiganya dibaca terpisah. Contohnya, penawaran bisa masuk tetapi harganya kosong.

## 5. Tarik otomatis dari situs resmi

1. Buka **Impor data → Tarik otomatis**, lalu pilih merek.
2. Sistem memuat lineup dari situs resmi. Hasilnya tersimpan di server, sehingga tab aman di-refresh.
3. Untuk tiap model yang dipilih, sistem mencari spesifikasinya di GSMArena.
   - Pencarian GSMArena kadang diblokir pemeriksaan anti-bot (Turnstile). Itu **tidak boleh diakali**.
   - Bila diblokir, ekspor spesifikasi model itu secara manual lalu impor lewat CSV spesifikasi (bagian 3).
4. Tinjau satu pratinjau gabungan: spesifikasi dan harga resmi.
   - Harga milik produk yang tidak dicentang ikut tidak diterapkan.
5. Klik **Terapkan N baris**, lalu baca kolom Hasil seperti pada 3.3.

Situs resmi juga diperiksa otomatis setiap hari pukul 06.00 WIB (batch berasal "Pemeriksaan harian"). Jadwal ini baru berjalan setelah situs di-deploy dengan `CRON_SECRET` (backlog PB-01). Sebelum itu, jalankan tarik otomatis secara manual minimal sekali sehari, supaya harga tidak basi lewat 30 jam.

### 5.1 Dari mana harga diambil

Tarik otomatis dan pemeriksaan harian **hanya** membaca situs resmi merek di Indonesia, ditambah Digimap untuk Apple. Keduanya tidak membaca e-commerce.

| Merek | Sumber harga otomatis | Bentuk harga di sumber |
| --- | --- | --- |
| vivo, iQOO | vivo.com/id, iqoo.com/id | per varian RAM/penyimpanan, termasuk harga promo |
| OPPO | oppo.com/id | per varian |
| Samsung | samsung.com/id | per penyimpanan; RAM diambil dari katalog bila hanya ada satu pilihan |
| Xiaomi, Redmi, POCO | mi.co.id | per varian |
| Apple | digimap.co.id (penjual resmi, bukan Apple) | per penyimpanan |
| Infinix | toko resmi Infinix Indonesia | satu "harga mulai"; varian dipilih admin di pratinjau |
| itel, Motorola, realme, Huawei | tidak ada | harga hanya lewat CSV penawaran |

Akibatnya:

- **Penawaran e-commerce tidak pernah diperbarui otomatis.** Shopee, Tokopedia, Blibli, Lazada, TikTok Shop, dan Erafone hanya masuk lewat CSV penawaran (bagian 4). Harganya basi 30 jam setelah `observed_at`, kecuali CSV baru diunggah.
- **Pemeriksaan harian hanya memperbarui penawaran yang sudah ada.** Model yang tercantum di situs resmi tetapi belum punya penawaran di CekHarga harus ditarik sekali lewat tarik otomatis dan ditinjau admin. Setelah itu harganya ikut diperiksa setiap hari.
- **API e-commerce tidak bisa dipakai untuk harga toko lain.** Contohnya Shop API di Shopee Open Platform hanya bisa dipanggil untuk toko yang sudah memberi otorisasi. Harga e-commerce yang sah datang dari CSV hasil pemeriksaan tim, program afiliasi marketplace, atau kerja sama dengan toko.

## 6. Foto

- Foto diproses di antrean terpisah: diunduh, diperkecil maksimal 1200 px, latar putih dihapus, lalu disimpan sebagai WebP.
- Status per produk tampil di tab **Foto** dan di halaman admin produk. Ada tiga status: sedang diproses, berhasil, atau gagal beserta alasannya.
- Foto gagal dicoba ulang maksimal 3 kali. Kegagalan permanen, misalnya host tidak diizinkan, tidak diulang.
- Produk tanpa foto tetap boleh terbit. Situs menampilkan ilustrasi generik berlabel "Foto belum tersedia".

## 7. Daftar periksa sebelum menerbitkan produk

Penerbitan dilakukan di halaman admin produk lewat tombol **Terbitkan**. Sistem belum memaksa daftar ini, jadi admin wajib memeriksanya sendiri:

1. Nama merek dan model benar, dan produk ini **dijual di Indonesia**. Buktinya: model tercantum di situs resmi merek Indonesia, atau punya penawaran dari toko Indonesia. Model khusus pasar Tiongkok/India, seperti seri OPPO K dan F, tidak diterbitkan (bagian 7.1).
2. Semua varian RAM/penyimpanan yang dijual di Indonesia ada, dan tidak ada varian karangan.
3. **Minimal satu penawaran aktif** (keputusan pemilik produk 8 Oktober 2026). Harganya sebaiknya diperiksa kurang dari 30 jam lalu. Produk terbit yang kehilangan semua penawaran aktifnya dikembalikan ke draft.
4. Spesifikasi kunci terisi: layar, chipset, baterai, kamera utama, dan 5G. Isi NFC dan IP rating yang kosong secara manual bila sumber Indonesia (situs resmi) menyebutkannya.
5. Bila ada foto, dasar hak pakainya tercatat.

Panel **Data Health** di halaman Ringkasan admin (`/admin`) mendaftar produk terbit yang belum punya penawaran, foto, atau data NFC/IP. Periksa panel ini setiap minggu.

### 7.1 Membuang model yang tidak dijual di Indonesia

1. Pastikan model itu tidak tercantum di situs resmi merek Indonesia dan tidak punya penawaran dari toko Indonesia.
2. Catat kunci sumbernya (`products.source_key`, misalnya `gsmarena:oppo_k15_5g-14810`) di tabel `catalog_exclusions` beserta alasannya.
3. Hapus produknya dari halaman admin produk.

Langkah 2 mencegah model itu muncul lagi. Impor spesifikasi berikutnya melewati kunci yang tercantum dengan alasan "Dikecualikan dari katalog". Bila model itu belakangan rilis di Indonesia, hapus barisnya dari `catalog_exclusions`, lalu impor ulang.

## 8. Membatalkan impor (undo)

Undo tersedia untuk batch berstatus "Diterapkan" atau "Sebagian gagal", dan hanya oleh admin.

- **Yang dihapus:**
  - produk buatan batch itu yang masih draft dan belum disunting
  - penawaran buatan batch itu, beserta harga dan pemeriksaannya
  - harga dan pemeriksaan yang ditambahkan batch itu ke penawaran lama
  - foto buatan batch itu
- **Yang tidak dikembalikan:**
  - produk yang sudah terbit atau sudah disunting
  - perubahan pada data lama
  - Layar konfirmasi mencantumkan semuanya sebelum undo dijalankan.
- Undo ditolak selama antrean foto batch itu masih berjalan. Tunggu sampai selesai.

Batch draft yang tidak diterapkan selama 14 hari ditandai **Kedaluwarsa** dan tidak bisa diterapkan lagi. Buat pratinjau baru dari berkasnya.

## 9. Alasan baris dilewati dan tindakannya

| Alasan di pratinjau | Tindakan |
| --- | --- |
| Bukan smartphone (tablet/watch) | Wajar. Tidak perlu tindakan. |
| Kombinasi RAM/penyimpanan tidak terbaca | Perbaiki `memory_variants_summary` ke format `256GB/12GB; 512GB/12GB`. |
| Merek atau nama model kosong | Lengkapi `brand` dan `model_name`. |
| Slug tidak ditemukan | Impor spesifikasinya dulu, atau salin slug yang benar dari admin produk. |
| Varian tidak ada di produk | Periksa RAM/penyimpanan. Bila varian itu memang dijual, perbarui spesifikasi produk lewat CSV spesifikasi, bukan lewat CSV harga. |
| Judul cocok ke beberapa produk / multi-varian | Masukkan listing itu lewat templat CekHarga dengan slug dan varian yang tegas. |
| URL gambar tidak diizinkan | Pakai host yang diizinkan, atau kosongkan foto. |
| Waktu pengamatan harga tidak valid | Tulis `observed_at` dengan format `2026-10-08T10:00:00+07:00`. |
| Dikecualikan dari katalog | Model sengaja dibuang (bagian 7.1). Tidak perlu tindakan kecuali model itu sudah rilis di Indonesia. |

## 10. Catatan data yang sudah ada (per 8 Oktober 2026)

- **Isi katalog:** 170 produk, semuanya bersumber GSMArena. Terbit per merek:

  | Merek | Terbit | Draft |
  | --- | --- | --- |
  | Xiaomi | 18 | 0 |
  | Samsung | 17 | 0 |
  | Apple | 15 | 1 |
  | OPPO | 14 | 28 |
  | vivo | 14 | 1 |
  | iQOO | 6 | 8 |
  | Infinix | 6 | 0 |
  | Huawei | 5 | 0 |
  | Motorola | 3 | 8 |
  | itel | 3 | 0 |
  | realme | 0 | 23 |

- **Dataset `data/devices_oppo.csv` (50 baris):**
  - 43 baris lolos sebagai smartphone, 7 dilewati (4 tablet, 3 jam tangan).
  - 35 sudah ada di katalog. Delapan sisanya sebagian besar seri K khusus Tiongkok.
  - Kolom `price_raw` berisi EUR/INR dan tidak pernah dipakai.
  - Ada 18 model yang NFC-nya "market dependent", sehingga tersimpan tidak diketahui. Lengkapi dari situs resmi OPPO Indonesia sebelum terbit.
- **Penawaran:**
  - Toko yang sudah tercatat: Digimap, situs resmi OPPO/Xiaomi/Samsung/iQOO/vivo, Shopee, dan Erafone.
  - Belum ada penawaran dari Tokopedia, Blibli, Lazada, maupun TikTok Shop.
- **Celah yang perlu ditutup:**
  - 29 produk terbit belum punya penawaran.
  - 23 produk terbit belum punya foto.
  - Pemeriksaan harga situs resmi dijalankan manual pada 8 Oktober. Hasilnya, 156 penawaran resmi segar lagi (vivo, iQOO, OPPO, Samsung, Xiaomi, Digimap) dan 3 varian Samsung tercatat tidak lagi tercantum.
  - Penawaran Shopee (34) dan Erafone (24) belum diperbarui karena tidak punya sumber otomatis. Perlu CSV baru.
  - Situs resmi sudah mencantumkan harga untuk model katalog yang belum punya penawaran: vivo T5, T5 Pro, V50 Lite, V60 Lite, X Fold5, Y03t, Y19s GT, Y19s Pro, Y29, Y31d, Y500; OPPO A6s 4G, A6t, A6t 4G, A6t Pro 4G, A7 Pro Max, Reno15; POCO X8 Pro; serta iPhone 16e dan 17e (Digimap) dan seluruh model Infinix. Jalankan tarik otomatis per merek untuk membuat penawarannya.
- **Kurasi 8 Oktober (sudah dijalankan atas persetujuan pemilik produk):**
  - 12 draft OPPO tanpa bukti dijual di Indonesia akan dihapus dan dikecualikan: A6s Pro, F31, F31 Pro+, F33, F33 Pro, Find N6, Find X9s Pro, Reno 15c, Reno15 FS, Reno15 Pro Mini, Reno16c, dan Reno16 FS.
  - 7 baris dataset juga dikecualikan supaya tidak pernah masuk: K15, K15 Pro, K15 Pro+, K14, K14x, A6k, dan F31 Pro.
  - 36 produk terbit tanpa penawaran aktif dikembalikan ke draft, sesuai bagian 7 butir 3.
  - Hasilnya, 65 produk terbit, semuanya punya minimal satu penawaran aktif, dan 93 draft.
  - Cadangan data sebelum perubahan ada di `data/backups/2026-10-08-kurasi-katalog.json`. Kedua langkah juga tercatat di audit admin dengan pelaku "sistem: kurasi katalog".
  - Draft yang masih dijual dan harganya tercantum di situs resmi (daftar di atas) bisa terbit lagi setelah penawarannya dibuat lewat tarik otomatis.

## 11. Untuk developer

- Templat dibuat dari kode, bukan berkas statis:
  - `templateSpesifikasi()` dan `SPEC_COLUMNS` di `src/lib/import/gsmarena.ts`
  - `templatePenawaran()`, `templateShopeeScrape()`, dan `OFFER_COLUMNS` di `src/lib/import/offers.ts`
- Tes kontrak di `scripts/tests/import.test.ts` (`pnpm test:import`) memastikan templat lolos importer apa adanya. Bila importer membaca kolom baru, perbarui templat, tabel kolom di dokumen ini, dan tesnya sekaligus.
- Kunci idempoten:
  - Produk memakai `products.source_key` (`gsmarena:<halaman>`).
  - Penawaran memakai `(variant_id, url)`.
  - Mengunggah berkas yang sama dua kali tidak membuat data ganda.
