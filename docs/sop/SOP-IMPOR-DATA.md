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
| Menambah atau memperbarui produk, harga, atau keduanya | Templat terpadu (bagian 2a), lewat formulir **Unggah data** | Unggah CSV |
| Berkas format lama: ekspor GSMArena, templat penawaran, scraper Shopee, ekspor Erafone | Formulir **Unggah data** yang sama (bagian 3 dan 4) | Unggah CSV |
| Mengambil lineup dan harga dari situs resmi merek | Tarik otomatis | Tarik otomatis |
| Memproses ulang atau memantau foto | Foto | Foto |
| Melihat, menerapkan, atau membatalkan batch | Riwayat batch | Riwayat batch |

**Satu formulir untuk semua berkas** (sejak 11 Oktober 2026). Tab **Unggah CSV** hanya berisi formulir **Unggah data**. Jenis berkas dikenali dari isinya, jadi tidak perlu memilih "spesifikasi" atau "penawaran". Berkas yang mencampur kolom spesifikasi format lama dengan kolom penawaran, atau yang formatnya tidak dikenali, ditolak dengan alasan yang jelas.

Harga selalu menempel ke produk yang sudah ada. Dengan templat terpadu, urutan ini diatur sistem: produk baru diterapkan dulu, lalu harganya ditinjau sebagai batch harga lanjutan. Berkas format lama yang hanya berisi harga untuk produk yang belum ada akan dilewati dengan alasan "slug tidak ditemukan".

Merek yang didukung tarik otomatis: vivo, iQOO, OPPO, Samsung, Xiaomi, Digimap (Apple), dan Infinix. Merek lain memakai CSV.

## 2a. Templat terpadu (disarankan sejak 10 Oktober 2026)

Spesifikasi dan harga cukup diisi dalam **satu berkas**. Unduh lewat tombol **Templat terpadu** di formulir **Unggah data** (`templat-terpadu-cekharga.csv`).

### Bentuk berkas

- **Satu baris = satu varian**, dan opsional satu listing toko untuk varian itu.
- Kolom dibagi empat kelompok. Tidak semua kolom harus diisi.

| Kelompok | Kolom | Kapan diisi |
| --- | --- | --- |
| Identitas | `brand`, `model_name`, `ram_gb`, `storage_gb`; `gsmarena_url` untuk produk baru; `slug` untuk produk yang sudah ada | selalu |
| Spesifikasi | `chipset`, `battery_capacity_mah`, `nfc`, `ip_rating`, dan seterusnya (lihat 3.2) | hanya untuk produk baru atau yang diperbarui; **cukup di satu baris per produk** |
| Warna dan foto | `color`, `image_url`, `image_usage_basis`, `image_usage_rights` | bila ada warna listing atau tautan foto produk (lihat "Warna dan foto di templat terpadu") |
| Penawaran | `marketplace`, `seller_name`, `offer_url`, `price_idr`, `observed_at`, `warranty`, `listing_status`, `seller_verified` | bila ada harga atau listing toko |

Sistem membaca baris menurut kelompok yang terisi:

- **Produk di berkas ini.** Merek + model yang punya kolom spesifikasi (atau `gsmarena_url`) di baris mana pun dianggap produk dalam berkas ini. Semua baris dengan merek + model yang sama menjadi variannya, termasuk baris yang hanya berisi varian dan harga.
- **Harga untuk produk yang sudah ada.** Baris yang hanya berisi identitas dan penawaran dibaca sebagai harga untuk produk di katalog. Isi `slug`, atau merek + model; slug akan dibentuk dari keduanya.
- **Aturan sel kosong** di 3.2 tetap berlaku: kosong berarti tidak diubah, dan `-` berarti kosongkan.

### Warna dan foto di templat terpadu

Kolom warna dan foto tidak menentukan jenis baris. Mengisi `image_url` atau `color` saja tidak membuat atau menimpa produk.

- **Warna (`color`, atau header `warna`)** adalah warna listing di baris itu, ditulis apa adanya dari toko ("Lotus Purple", "Hitam"). Warna **tidak** membentuk varian dan tidak mengubah harga: harga tetap dicatat per kapasitas RAM/penyimpanan.
- Satu baris per warna untuk listing yang sama boleh. Warnanya digabung ke penawaran itu (`offers.colors`), dan foto setiap baris dicatat dengan warnanya (`product_assets.color`).
- Impor ulang dengan kolom warna terisi **menggantikan** daftar warna penawaran itu. Kolom warna kosong tidak menghapus warna yang sudah tercatat.
- Di halaman produk, warna muncul sebagai pilihan **Pilih warna**. Memilih warna hanya mengganti foto yang tampil, dan setiap penawaran menyebut warna yang tercatat di listing-nya.
- Kolom spesifikasi `colors` (daftar semua warna menurut GSMArena) tetap ada, dengan header lain `daftar warna`. Header `warna` sekarang berarti warna per baris.

- **Host yang diizinkan:** `down-id.img.susercontent.com` (Shopee), `fdn.gsmarena.com` dan `fdn2.gsmarena.com` (GSMArena), `cdnpro.eraspace.com` (Erafone), dan `i02.appmifile.com` (situs resmi Xiaomi). Wajib HTTPS. Host lain dilewati dengan alasan; harganya tetap masuk.
- **Produk baru di berkas:** foto pertama untuk produk itu menjadi **foto utama**. Foto berbeda di baris penawaran lain produk yang sama (misalnya per warna) masuk **galeri**, tanpa tanda konflik.
- **Produk yang sudah ada:** foto harus berada di baris yang sama dengan penawarannya, dan masuk **galeri** produk itu. Galeri dibatasi 8 foto per produk.
- **Baris foto saja untuk produk yang sudah ada** (tanpa penawaran) dilewati dengan alasan. Untuk mengganti foto utama produk lama, isi `gsmarena_url` produknya di baris itu.
- **Satu baris per warna:** baris untuk listing yang sama (varian + `offer_url` sama) digabung. Data harga dari baris terakhir yang dipakai, dan foto setiap baris tetap masuk galeri.
- **Hak pakai:** isi `image_usage_basis` per baris bila sumber fotonya berbeda-beda, misalnya Shopee dan situs resmi brand. Bila kosong, dipakai pilihan dasar hak pakai di formulir. `written-permission` dan `public-license` wajib disertai `image_usage_rights`; tanpa itu fotonya dilewati.
- Header `url_image`, `url gambar`, `link gambar`, dan `foto` dibaca sebagai `image_url`.

### Mencocokkan produk lewat nama

Baris harga tanpa `slug` dicocokkan lewat merek + model, memakai aturan yang sama dengan judul listing Shopee:

- **Akhiran jaringan.** "REDMI Note 17 Pro 5G" cocok ke "Redmi Note 17 Pro" bila spesifikasi katalog menyatakan 5G. Akhiran tidak dibuang bila jaringannya berbeda.
- **Merek induk.** "Xiaomi POCO C81 Pro" dan "POCO C81 Pro" sama-sama dikenali.
- **Perlu tinjau: model saudara.** Nama tanpa label jaringan ("REDMI Note 17") yang cocok ke satu produk, padahal katalog juga punya "Redmi Note 17 4G", tetap dipasangkan tetapi ditandai **Perlu tinjau** dan tidak dicentang otomatis.
- **Perlu tinjau: harga ganda.** Dua baris untuk listing dan varian yang sama dengan harga berbeda juga ditandai **Perlu tinjau**. Contohnya satu listing Shopee yang memuat model 4G dan 5G sekaligus. Bila memang dua model berbeda, isi `slug` di masing-masing baris.
- Nama yang cocok ke lebih dari satu produk dilewati dengan alasan; isi `slug`.

### Kolom URL listing

- Header `url` di templat terpadu dibaca dari isinya. Tautan GSMArena (`…-12345.php`) dibaca sebagai `gsmarena_url`; tautan lain dibaca sebagai `offer_url`.
- Parameter tampilan Shopee (`?extraParams=…`) dibuang, supaya satu listing tidak tercatat dua kali.
- Tautan gambar di kolom URL listing ditolak dengan alasan. Pindahkan ke `image_url`.
- Bila marketplace-nya Shopee, Tokopedia, Lazada, Blibli, TikTok Shop, atau Erafone, host URL harus milik marketplace itu. Kalau tidak, baris ditolak.

### Koreksi otomatis

Nilai berikut dirapikan otomatis. Setiap koreksi tampil di panel **Koreksi otomatis** pada halaman pratinjau.

| Ditulis | Dibaca sebagai |
| --- | --- |
| `Rp 7.999.000`, `7.999.000,00`, `7,999,000`, `7,5 jt` | `7999000`, `7999000`, `7999000`, `7500000` |
| `8 GB`, `1TB`, varian `8/256GB` | `8`, `1024`, RAM 8 dan penyimpanan 256 |
| `aktif`, `stok habis`, `nonaktif` | `active`, `out-of-stock`, `inactive` |
| `Yes`, `y`, `1` / `No`, `0` | `ya` / `tidak` |
| `10/10/2026 09:00`, `2026-10-10 09:00` | `2026-10-10T09:00:00+07:00`; waktu tanpa zona diasumsikan WIB |
| `2026-10-10` (tanpa jam) | 00.00 WIB, sehingga harga terlihat lebih tua, bukan lebih segar |
| `https://www.gsmarena.com/oppo_x-123.php` | `oppo_x-123.php` |
| Header `Merek`, `Harga`, `Link`, `Toko`, `RAM`, `Penyimpanan`, `Garansi`, `Diperiksa`, `url_image`, `Warna` | `brand`, `price_idr`, `offer_url`, `seller_name`, `ram_gb`, `storage_gb`, `warranty`, `observed_at`, `image_url`, `color` |

Yang **tidak** dikoreksi otomatis:

- Harga yang ditulis dengan kata-kata.
- Tanggal yang mustahil, misalnya 31/02.
- Varian yang tidak terbaca.
- Nama model yang mirip tapi tidak sama.

Baris seperti itu dilewati dengan alasan. Bila dua baris memberi nilai berbeda untuk produk yang sama, nilai baris pertama dipakai dan konfliknya ditandai **Konflik**.

### Alur penerapan

1. Unggah berkas, lalu klik **Buat pratinjau**. Halaman batch langsung terbuka dengan status **Sedang dianalisis**: baris dirapikan, dicocokkan dengan katalog, dan dibandingkan dengan data yang ada di latar belakang. Pratinjau muncul otomatis begitu selesai, biasanya dalam beberapa detik. Halaman boleh ditutup; analisis tetap berjalan.
2. **Berkas berisi produk:** halaman pratinjau menampilkan produknya. Penawaran untuk produk itu belum bisa dicocokkan, karena produknya belum ada di katalog. Setelah produk diterapkan, sistem membuat **batch harga lanjutan** berstatus draft.
3. Buka batch harga lanjutan dari halaman batch produk, tinjau pratinjaunya, lalu terapkan.

Di pratinjau batch produk yang membawa harga ada tiga pilihan:

- **Spesifikasi + harga** (bawaan): produk diterapkan dulu, lalu batch harga lanjutan dibuat untuk ditinjau.
- **Spesifikasi saja**: hanya produk yang diterapkan; harga di berkas diabaikan.
- **Terapkan harga saja**: spesifikasi di berkas diabaikan, dan langsung dibuat batch penawaran untuk produk yang sudah ada di katalog. Penawaran untuk produk yang belum ada tidak ikut, dan jumlahnya disebutkan di batch baru.
4. **Berkas hanya berisi harga untuk produk yang sudah ada:** langsung menjadi satu batch penawaran biasa.

## 3. Impor spesifikasi format lama (dataset GSMArena)

Bagian ini untuk berkas spesifikasi format lama. Untuk berkas baru, pakai templat terpadu (bagian 2a); kolom spesifikasinya sama.

### 3.1 Siapkan berkas

1. Di formulir **Unggah data**, klik tautan **Templat spesifikasi** di baris "Format lama" untuk mengunduh `templat-spesifikasi-cekharga.csv`.
2. Isi satu baris per model. Ekspor GSMArena lengkap juga diterima apa adanya, karena kolom yang tidak dikenal diabaikan.
3. Simpan sebagai CSV UTF-8 dengan pemisah koma. Di Excel, pilih "CSV UTF-8 (Comma delimited)".

### 3.2 Kolom templat spesifikasi

Kolom wajib ditandai ✱. Baris yang kolom wajibnya kosong akan dilewati beserta alasannya.

**Aturan sel kosong (berlaku sejak 10 Oktober 2026).** Impor ulang produk yang sudah ada bekerja sebagai *patch*:

| Isi sel | Arti untuk produk yang sudah ada |
| --- | --- |
| kosong | tidak diubah; nilai lama di database tetap, termasuk isian manual admin |
| nilai yang tidak terbaca (mis. NFC "market dependent") | tidak diubah |
| `-` (satu tanda minus) | dikosongkan menjadi "tidak diketahui" |
| nilai baru | menggantikan nilai lama; pratinjau menampilkan sebelum dan sesudah |

Jadi berkas tidak perlu lengkap. Cukup isi kolom wajib dan kolom yang ingin diperbarui.

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
| `image_url` | URL foto HTTPS dari host yang diizinkan: `fdn.gsmarena.com`, `fdn2.gsmarena.com`, `down-id.img.susercontent.com`, `cdnpro.eraspace.com`, `i02.appmifile.com` | – | `product_assets` |
| `image_usage_basis` | `written-permission`, `public-license`, `own-work`, atau `admin-declared` | `written-permission` | `product_assets.usage_basis` |
| `image_usage_rights` | Bukti hak pakai, misalnya nomor surat izin atau nama lisensi | `Izin email PT X, 1 Okt 2026` | `product_assets.usage_rights` |

Kolom cadangan yang tetap dibaca bila kolom utamanya kosong:

- `memory_variants_raw` dengan format `128GB 8GB RAM, 256GB 12GB RAM`.
- `status_raw` untuk tahun rilis.

### 3.3 Unggah dan tinjau

Langkah ini berlaku untuk semua berkas: templat terpadu maupun format lama.

1. Buka **Impor data → Unggah CSV**, formulir **Unggah data**.
2. Pilih berkas. Bila berkas membawa foto, pilih dasar hak pakai. Bila hak pakainya belum jelas, lewati. Untuk berkas scraper Shopee tanpa kolom `seller_name`, isi nama toko di **Opsi lanjutan**.
3. Klik **Buat pratinjau**. Halaman batch terbuka dengan status **Sedang dianalisis**, lalu pratinjau muncul otomatis.
4. Pratinjau dikelompokkan **per produk**: satu kartu berisi produk atau semua penawaran produk itu, dengan centang untuk seluruh kartu. Saring dengan tab status:

   | Status | Arti | Dicentang otomatis |
   | --- | --- | --- |
   | **Baru** | belum ada di katalog | ya |
   | **Perbarui** | ada nilai yang berubah; sebelum dan sesudah ditampilkan | ya |
   | **Harga lama** | harga lebih tua dari harga terakhir; hanya masuk riwayat, harga yang tampil tidak berubah | ya |
   | **Perlu tinjau** | varian disimpulkan dari judul listing, nama cocok padahal ada model saudara 4G/5G, baris ganda berbeda harga, atau data terhapus akan dipulihkan | **tidak**, periksa dulu |
   | **Sama** | tidak ada perubahan; centang bila ingin memajukan waktu pemeriksaan | tidak |
   | **Dilewati** | tidak bisa dipakai; alasannya tertulis | tidak bisa dipilih |

5. Hapus centang baris yang ragu, dan centang baris **Perlu tinjau** yang sudah diperiksa.
6. Klik **Terapkan N baris**. Proses berjalan bertahap; bar progres boleh ditinggal, dan tab boleh di-refresh.
7. Setelah selesai, baca kolom **Hasil**. Untuk baris gagal, perbaiki penyebabnya lalu klik **Coba ulang N baris yang gagal**.

## 4. Impor penawaran format lama

Bagian ini untuk berkas penawaran format lama. Untuk berkas baru, pakai templat terpadu (bagian 2a): kolom `offer_url` menggantikan `url`, dan produk bisa dirujuk dengan merek + model, tidak harus slug.

### 4.1 Siapkan berkas

Di formulir **Unggah data**, klik tautan **Templat penawaran** di baris "Format lama" untuk mengunduh `templat-penawaran-cekharga.csv`. Satu baris berisi satu listing toko untuk satu varian.

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
| `image_url` (atau `url_image`) | Opsional. Foto listing dari host yang diizinkan (bagian 2a); masuk galeri produk. Boleh disertai `image_usage_basis` dan `image_usage_rights` | `https://down-id.img.susercontent.com/file/...` | `photo_jobs`, lalu `product_assets` |

Catatan:

- Bila `observed_at` kosong, sistem memakai waktu terakhir berkas diubah. Isi kolom ini supaya label "diperiksa …" di situs jujur.
- Untuk penawaran yang sudah ada, sel `warranty`, `listing_status`, dan `seller_verified` yang kosong **tidak mengubah** nilai lama. Garansi dan badge terverifikasi yang disunting admin tidak hilang. Tulis `-` di `warranty` untuk mengosongkan garansi, dan `tidak` di `seller_verified` untuk mencabut badge.
- Hasil scraper Shopee dan ekspor Erafone tidak membawa garansi dan bukti verifikasi, jadi keduanya selalu mempertahankan nilai lama.
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

Formulir **Unggah data** juga menerima dua format lain dan menyeragamkannya sendiri:

- **Hasil scraper Shopee.** Gunakan tautan **Templat scraper Shopee** di baris "Format lama", dengan kolom `listing_url`, `image_url`, `title`, `price_idr`, `rating`, `sold_text`, `seller_name`, dan `scraped_at`.
  - Produk dicocokkan dari judul.
  - Judul yang cocok ke lebih dari satu produk, atau menyebut beberapa varian, dilewati supaya harga tidak menempel ke produk yang salah.
  - Rating dan jumlah terjual tidak pernah dipakai.
- **Ekspor ekstensi browser dari erafone.com.** Kolom boleh bergeser karena dibaca menurut isinya. Judul tanpa keterangan memori dilewati.

### 4.4 Unggah dan tinjau

Langkahnya sama dengan 3.3. Laporan memisahkan tiga angka: penawaran baru, penawaran diperbarui, dan harga tercatat. Ketiganya dibaca terpisah. Contohnya, penawaran bisa masuk tetapi harganya kosong.

## 5. Tarik otomatis dari situs resmi

1. Buka **Impor data → Tarik otomatis**, lalu pilih merek.
2. Sistem memuat lineup dari situs resmi. Pengambilan berjalan di latar belakang (worker), bukan di halaman; hasilnya tersimpan di server, sehingga tab aman di-refresh atau ditutup.
3. Untuk tiap model yang dipilih, sistem mencari spesifikasinya di GSMArena, satu model pada satu waktu dengan jeda sopan. Progres terlihat di halaman; tombol **Hentikan** membatalkan model yang belum diambil.
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
3. Hapus produknya dari halaman admin produk. Penghapusan bersifat lunak: produk hilang dari situs dan daftar admin, tetapi varian, penawaran, dan riwayat harganya tetap tersimpan (aturan system design 8).

Langkah 2 mencegah model itu muncul lagi. Tanpa langkah 2, impor berikutnya akan memulihkan produk yang dihapus lunak sebagai draft. Impor spesifikasi berikutnya melewati kunci yang tercantum dengan alasan "Dikecualikan dari katalog". Bila model itu belakangan rilis di Indonesia, hapus barisnya dari `catalog_exclusions`, lalu impor ulang.

## 8. Membatalkan impor (undo)

Undo tersedia untuk batch berstatus "Diterapkan" atau "Sebagian gagal", dan hanya oleh admin. Sejak 9 Oktober 2026 undo tidak menghapus permanen; database menolak penghapusan riwayat harga.

- **Yang disembunyikan (hapus lunak) atau ditandai batal:**
  - produk buatan batch itu yang masih draft dan belum disunting (dihapus lunak)
  - penawaran buatan batch itu (dihapus lunak)
  - harga dan pemeriksaan yang ditambahkan batch itu, ditandai batal sehingga tidak tampil di situs
- **Yang dihapus:** foto buatan batch itu, karena foto bukan riwayat harga.
- **Impor ulang** berkas yang sama memulihkan produk, penawaran, dan harga yang tadi diurungkan. Pratinjau menandainya sebagai "Status data: Terhapus, dipulihkan sebagai draft".
- **Yang tidak dikembalikan:**
  - produk yang sudah terbit atau sudah disunting
  - perubahan pada data lama
  - Layar konfirmasi mencantumkan semuanya sebelum undo dijalankan.
- Undo ditolak selama antrean foto batch itu masih berjalan. Tunggu sampai selesai.

Batch draft yang tidak diterapkan selama 14 hari ditandai **Kedaluwarsa** dan tidak bisa diterapkan lagi. Buat pratinjau baru dari berkasnya.

Baris mentah berkas yang diunggah disimpan sementara (tabel `raw_listings`) dan dihapus permanen 30 hari setelah batch dibuat, untuk batch yang sudah diterapkan, gagal, dibatalkan, atau diurungkan. Setelah itu "Coba ulang yang gagal" tidak bisa dipakai lagi; unggah ulang berkasnya. Data katalog dan riwayat harga tidak ikut terhapus.

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
| Kolom URL listing berisi tautan gambar | Pindahkan tautan itu ke `image_url`, lalu isi URL halaman toko. |
| URL listing bukan halaman marketplace-nya | Periksa kolom `marketplace` dan URL; keduanya harus toko yang sama. |
| Nama cocok ke lebih dari satu produk | Isi kolom `slug` untuk baris itu. |
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
- **Status per 11 Oktober 2026** (setelah kurasi):
  - 65 produk terbit, semuanya punya minimal satu penawaran aktif.
  - 4 produk terbit belum punya foto.
  - Seluruh 187 harga aktif sudah lewat 30 jam, karena pemeriksaan harian baru berjalan otomatis setelah deploy (PB-01). Sampai saat itu, jalankan tarik otomatis per merek atau unggah templat terpadu berisi harga terbaru.
- **Catatan 8 Oktober (sebelum kurasi):**
  - 29 produk terbit belum punya penawaran, dan 23 belum punya foto.
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
