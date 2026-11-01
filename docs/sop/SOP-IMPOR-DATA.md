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
| Menambah produk baru beserta spesifikasinya | **Tarik otomatis** (situs resmi + GSMArena), lalu sunting di halaman produk | Tarik otomatis |
| Menambah atau memperbarui harga, foto, atau keduanya untuk produk yang sudah ada | **CSV gabungan** (bagian 2a) | Unggah CSV |
| Berkas format lama: templat penawaran/galeri lama, scraper Shopee, ekspor Erafone | Formulir yang sama; dikenali otomatis (bagian 4) | Unggah CSV |
| Mengambil lineup dan harga dari situs resmi merek | Tarik otomatis | Tarik otomatis |
| Memproses ulang atau memantau foto | Antrean foto | Antrean foto |
| Mengurutkan, memilih sampul, memindah warna, atau menghapus foto satu produk | Panel **Foto per warna** di halaman admin produk (bagian 6) | – |
| Melihat, menerapkan, atau membatalkan batch | Riwayat batch | Riwayat batch |

**Satu formulir, satu berkas** (sejak 17 Oktober 2026, Sprint 8). Tab **Unggah CSV** hanya berisi formulir CSV gabungan dan satu tombol **Unduh templat CSV gabungan**. Tab **Galeri foto** dan tombol templat format lama sudah dihapus. Berkas penawaran dan galeri format lama tetap diterima dan dikenali dari isinya.

**Spesifikasi tidak lagi lewat CSV** (Sprint 9, 17 Oktober 2026). Produk baru dan spesifikasinya hanya ditambahkan lewat **Tarik otomatis**, lalu dilengkapi di halaman sunting produk. Berkas spesifikasi format lama (ekspor GSMArena) ditolak dengan arahan ke Tarik otomatis. Kolom spesifikasi di sheet gabungan lama diabaikan, dengan satu peringatan di pratinjau.

Merek yang didukung tarik otomatis: vivo, iQOO, OPPO, Samsung, Xiaomi, Digimap (Apple), dan Infinix. Merek lain memakai CSV.

## 2a. CSV gabungan (sejak 17 Oktober 2026)

Penawaran dan foto untuk produk yang **sudah ada di katalog** cukup diisi dalam **satu sheet**, lalu diekspor sebagai satu CSV. Berkas boleh berisi keduanya, atau salah satunya saja. Unduh contohnya lewat **Unduh templat CSV gabungan** (`templat-csv-gabungan-cekharga.csv`).

### Memilih bagian yang diimpor

Di atas formulir ada dua pilihan, keduanya tercentang secara bawaan:

- **Penawaran & harga**
- **Foto per warna**

Bagian yang tidak dicentang **diabaikan walau kolomnya terisi**. Contohnya, untuk hanya menambah foto dari sheet lengkap, centang **Foto per warna** saja.

Harga dan foto dicocokkan ke produk di katalog lewat merek + model. Baris untuk produk yang belum ada dilewati dengan alasan "belum ada di katalog; tambahkan lewat Tarik otomatis dulu".

### Jenis baris dikenali dari kolom yang terisi

| Kelompok | Kolom | Kapan diisi |
| --- | --- | --- |
| Identitas | `brand`, `model_name`; `ram_gb`, `storage_gb` untuk baris harga; `slug` opsional | selalu |
| Penawaran | `marketplace`, `seller_name`, `offer_url`, `price_idr`, `observed_at`, `warranty`, `listing_status`, `seller_verified`, `color` | satu baris per varian per toko |
| Foto | `color`, `image_url`, `urutan`, `is_cover`, `image_source_url`, `image_usage_basis`, `image_usage_rights` | **satu baris per foto** |

- Satu baris boleh membawa lebih dari satu jenis, misalnya baris harga yang juga mengisi `image_url`.
- **Aturan sel kosong** di 3.2 tetap berlaku: kosong berarti tidak diubah, dan `-` berarti kosongkan.
- **`slug` boleh dikosongkan.** Bila diisi, slug wajib menunjuk produk yang sama dengan merek + model di baris itu; kalau tidak, baris dilewati dengan alasan. Aturan ini ditambahkan setelah sheet vivo berisi slug produk Samsung.

Bentuk sheet yang disarankan per model:

1. Satu baris spesifikasi (bersama varian pertama dan harganya bila ada).
2. Baris harga per varian per toko.
3. Baris foto per warna: `color`, `image_url`, `urutan` 1, 2, 3…, dan `is_cover` `ya` untuk foto depan.

Foto **tidak perlu diulang per varian**. Bila tetap terulang, foto yang sama (model, warna, dan URL sama) dihitung sekali. `urutan`, `is_cover`, dan `image_source_url` dari baris ulangan mengisi yang masih kosong.

### Warna dan foto

- **Warna (`color`, atau header `warna`)** adalah warna listing atau foto di baris itu. Warna **tidak** membentuk varian dan tidak mengubah harga.
- **Foto wajib menyebut warnanya.** Foto tanpa warna dilewati dengan alasan; data lain di baris itu tetap masuk.
- **Samakan nama warna** antara baris harga dan baris foto. Pemilih warna di halaman produk menggabungkan keduanya, jadi beda ejaan menghasilkan dua tombol warna.
- Kolom spesifikasi `colors` (daftar semua warna, header lain `daftar warna`) tidak membuat baris dianggap produk baru.
- Warna yang tidak ada di daftar warna spesifikasi tetap disimpan, tetapi fotonya ditandai **Perlu tinjau** dan tidak tercentang otomatis.
- **Aturan galeri** berlaku untuk semua foto: maksimal 6 foto per warna dan 60 per produk; satu sampul per warna; sampul pilihan admin tidak ditimpa. URL foto yang sama untuk dua warna ditandai **Perlu tinjau**.
- **Host yang diizinkan:**
  - `down-id.img.susercontent.com` (Shopee)
  - `fdn.gsmarena.com` dan `fdn2.gsmarena.com` (GSMArena)
  - `cdnpro.eraspace.com` (Erafone)
  - `i02.appmifile.com` (situs resmi Xiaomi)
  - `images.samsung.com` (situs resmi Samsung; parameter di belakang link dibuang otomatis)
  - `asia-exstatic-vivofs.vivo.com` (situs resmi vivo)

  Wajib HTTPS. Foto dari host lain dilewati dengan alasan.
- Foto kanvas lebar berlatar polos (misalnya galeri vivo 5120×1536) dirapikan otomatis: tepi polos dipotong dan latar terang yang seragam dihapus.
- **Hak pakai:** isi `image_usage_basis` per baris bila sumber fotonya berbeda-beda. Bila kosong, dipakai pilihan di formulir. `written-permission` dan `public-license` wajib disertai `image_usage_rights`.
- Header `url_image`, `url gambar`, `link gambar`, dan `foto` dibaca sebagai `image_url`. `sampul` dibaca sebagai `is_cover`, dan `source_url` sebagai `image_source_url`.

### Mencocokkan produk lewat nama

Baris tanpa `slug` dicocokkan lewat merek + model, memakai aturan yang sama dengan judul listing Shopee:

- **Akhiran jaringan.** "REDMI Note 17 Pro 5G" cocok ke "Redmi Note 17 Pro" bila spesifikasi katalog menyatakan 5G. Akhiran tidak dibuang bila jaringannya berbeda.
- **Merek induk.** "Xiaomi POCO C81 Pro" dan "POCO C81 Pro" sama-sama dikenali. "vivo iQOO 15R" dikenali sebagai iQOO 15R.
- **Beda spasi.** "vivo V70FE" dicocokkan ke "V70 FE" bila hasilnya tunggal, dan ditandai **Perlu tinjau**.
- **Perlu tinjau: model saudara.** Nama tanpa label jaringan ("REDMI Note 17") yang cocok ke satu produk, padahal katalog juga punya "Redmi Note 17 4G", tetap dipasangkan tetapi ditandai **Perlu tinjau**.
- **Perlu tinjau: harga ganda.** Dua baris untuk listing dan varian yang sama dengan harga berbeda juga ditandai **Perlu tinjau**.
- Nama yang cocok ke lebih dari satu produk dilewati dengan alasan; isi `slug`.

### Kolom URL listing

- Header `url` dibaca dari isinya. Tautan GSMArena (`…-12345.php`) dibaca sebagai `gsmarena_url`; tautan lain dibaca sebagai `offer_url`.
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
| Header `Merek`, `Harga`, `Link`, `Toko`, `RAM`, `Penyimpanan`, `Garansi`, `Diperiksa`, `url_image`, `Warna`, `Sampul` | `brand`, `price_idr`, `offer_url`, `seller_name`, `ram_gb`, `storage_gb`, `warranty`, `observed_at`, `image_url`, `color`, `is_cover` |

Yang **tidak** dikoreksi otomatis:

- Harga yang ditulis dengan kata-kata.
- Tanggal yang mustahil, misalnya 31/02.
- Varian yang tidak terbaca.
- Nama model yang mirip tapi tidak sama.

Baris seperti itu dilewati dengan alasan. Bila dua baris memberi nilai berbeda untuk produk yang sama, nilai baris pertama dipakai dan konfliknya ditandai **Konflik**.

### Varian, warna, dan baris per warna (sejak 21 Oktober 2026, Sprint 12)

- **Varian yang belum tercatat** (sering varian khusus Indonesia yang tidak ada di GSMArena, mis. vivo Y500 6/128 GB) tidak lagi dibuang. Barisnya tampil **Perlu tinjau** dengan perubahan "Varian baru" dan tidak dicentang otomatis. Centang bila variannya memang dijual; varian dibuat sekaligus penawarannya saat diterapkan. Kombinasi yang tidak lazim (mis. 16/516 GB) tetap dilewati dengan alasan "tidak lazim, periksa ketikannya".
- **Warna:** nama warna dari toko resmi Indonesia ("Hitam Malam", "Vibing Blue") tidak lagi menahan baris penawaran maupun foto. Saat batch foto diterapkan, **daftar warna produk diganti dengan warna di galeri** (keputusan pemilik produk: warna toko resmi Indonesia yang menjadi acuan, bukan nama warna GSMArena).
  - Warna yang belum ada di spesifikasi diterima otomatis dan ditandai **"Warna baru (belum di spesifikasi)"** di pratinjau.
  - Warna yang **sangat mirip** warna lain produk itu (beda 1 huruf untuk nama pendek, 2 huruf untuk nama panjang, dibandingkan dengan spesifikasi, galeri yang ada, dan baris lain di berkas) ditandai **Perlu tinjau** dengan catatan "mungkin salah ketik" dan tidak dicentang otomatis. Perbaiki ejaannya di sheet, atau centang bila memang warna yang berbeda (mis. "Grey" dan "Gray" dari dua sumber).
- **Satu baris per warna** untuk listing dan varian yang sama tetap satu penawaran. Baris tambahannya tidak lagi tampil sebagai kartu "Dilewati"; penawarannya menulis "N baris digabung (satu listing)", dan foto tiap warna tetap masuk galeri.

### Kolom hak pakai foto

| Kolom | Gunanya | Isi |
| --- | --- | --- |
| `image_usage_basis` | Dasar hukum CekHarga boleh menayangkan foto itu (PRD §6). Foto tanpa dasar hak pakai tidak disimpan | `own-work` (foto atau aset milik sendiri), `written-permission` (izin tertulis pemilik foto), `public-license` (lisensi publik, mis. kit media resmi merek), atau `admin-declared` (dinyatakan admin, bukti belum dicatat) |
| `image_usage_rights` | Keterangan buktinya, supaya bisa ditelusuri bila ada keberatan | Mis. "Kit media resmi vivo Indonesia, diunduh 17 Okt 2026" atau "Email izin dari Toko X, 20 Okt 2026". Wajib untuk `written-permission` dan `public-license` |

Kedua kolom boleh kosong bila sumber fotonya sama untuk seluruh berkas: pilih saja dasar hak pakai di formulir unggah. Untuk foto dari situs resmi merek, pakai `admin-declared` sampai ada bukti izin atau lisensi, lalu lengkapi buktinya (Dashboard menghitung "Foto tanpa bukti hak pakai").

### Alur penerapan: tahap harga, lalu foto

Halaman batch menampilkan penanda **Tahapan berkas** dengan tautan ke tiap tahap.

1. Unggah berkas, lalu klik **Buat pratinjau**. Halaman batch terbuka dengan status **Sedang dianalisis**, dan pratinjau muncul otomatis begitu selesai.
2. Berkas berisi harga: tahap pertama adalah **Harga**. Berkas foto saja langsung menjadi tahap **Foto**.
3. Bila berkas berisi harga dan foto, **batch foto** dibuat berstatus draft setelah harga diterapkan. Buka lewat tombol **Lanjut: tinjau foto**, tinjau, lalu terapkan.

Di pratinjau tahap harga yang punya foto lanjutan ada dua pilihan:

- **Penawaran lalu M foto** (bawaan): batch foto dibuat setelah harga diterapkan.
- **Penawaran saja**: hanya harga yang diterapkan; foto di berkas diabaikan.

## 3. Impor spesifikasi format lama (dataset GSMArena) — tidak dipakai lagi

Sejak 17 Oktober 2026 (Sprint 9) berkas spesifikasi **ditolak** saat diunggah, dengan arahan ke Tarik otomatis. Bagian di bawah dipertahankan sebagai rujukan arti kolom spesifikasi, karena kolom yang sama dipakai hasil Tarik otomatis dan halaman sunting produk.

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
| `image_url` | URL foto HTTPS dari host yang diizinkan (bagian 2a) | – | `product_assets` |
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

Templat penawaran format lama tidak lagi bisa diunduh di Pusat Impor (sejak 17 Oktober 2026); pakai CSV gabungan (bagian 2a). Berkas lama dengan kolom `slug` tetap diterima. Satu baris berisi satu listing toko untuk satu varian.

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

### 5.0a Varian resmi dan model yang belum ada di GSMArena (sejak 21 Oktober 2026)

- Varian yang dijual dengan harga di situs resmi Indonesia tetapi tidak tercatat di GSMArena **ditambahkan ke produk**, dengan catatan kuning di pratinjau. Situs resmi adalah buktinya, jadi ini bukan varian karangan.
- Model yang dijual resmi tetapi **belum ada di GSMArena** (mis. vivo Y31d Pro) dulu ditolak diam-diam. Kini masuk sebagai draft bersumber situs resmi: nama, varian berharga, dan label 5G dari namanya. Lengkapi chipset, layar, baterai, dan kamera di halaman produk sebelum diterbitkan. Saat GSMArena memuat model itu, tarik berikutnya memperbarui **produk yang sama** (pratinjau: "Sumber spesifikasi: situs resmi → GSMArena").
- vivo dan iQOO memakai situs resmi terpisah. Model iQOO (mis. iQOO Z10R) ditarik dengan memilih merek **iQOO**, bukan vivo.

### 5.0 Perbarui harga saja (sejak 16 Oktober 2026, PB-16)

Untuk model yang sudah ada di katalog, harga resmi bisa diperbarui tanpa mengambil spesifikasi GSMArena (yang sering meminta verifikasi anti-bot):

1. Di tab **Tarik otomatis**, pilih merek lalu klik **Muat daftar model**.
2. Pada blok **Perbarui harga saja**, klik **Buat batch harga saja**.
3. Sistem mencocokkan nama resmi ke katalog dengan aturan yang sama seperti templat terpadu, lalu membuat batch penawaran dan membuka halamannya.
4. Tinjau pratinjau, lalu terapkan seperti batch biasa.

Yang tidak dilakukan otomatis:

- Model yang belum ada di katalog dilewati dan namanya disebutkan. Tarik lewat alur lengkap di bawah.
- Varian yang tidak tercatat di katalog tidak dibuat.
- Harga yang hanya menyebut penyimpanan (Samsung) dipasangkan hanya bila penyimpanan itu punya satu pilihan RAM di katalog.
- "Harga mulai" tanpa varian (Infinix) tetap dipilih lewat alur lengkap.

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

### 5.2 Rutinitas harga setiap pagi (ditetapkan 16 Oktober 2026)

Harga dianggap segar selama **30 jam** sejak terakhir diperiksa. Setelah itu label otomatis berubah menjadi "harga terakhir tercatat". Karena itu pembaruan harus terjadi setiap hari.

| Waktu (WIB) | Siapa | Apa |
| --- | --- | --- |
| 06.00–06.59 | Sistem (cron Vercel) | Membaca harga situs resmi vivo, iQOO, OPPO, Samsung, Xiaomi, Infinix, dan Digimap (Apple) untuk penawaran yang sudah ada, lalu menerapkannya |
| 08.00–08.59 dan 10.00–10.59 | Sistem (cron worker Vercel, sejak 17 Oktober 2026) | Menerapkan batch harga yang belum sempat diterapkan cron pagi, lalu memproses antrean foto dan job latar |
| setelah 07.00 | Admin | Buka Dashboard admin. Bila ada panel **Pemeriksaan harga harian perlu dicek**, tindak lanjuti merek yang gagal (lihat di bawah) |
| pagi hari | Admin data | Perbarui harga e-commerce (Shopee dan toko lain) di spreadsheet, unduh CSV, lalu unggah di Pusat Impor. `observed_at` diisi waktu harga dilihat |
| bila ada model baru | Admin | Tarik otomatis lengkap (spesifikasi + harga), atau **Perbarui harga saja** untuk model yang sudah ada |

Yang dikerjakan otomatis dan yang tidak:

- **Otomatis:** hanya harga situs resmi merek, dan hanya untuk penawaran yang sudah tercatat. Sistem tidak membuat penawaran atau produk baru tanpa ditinjau admin.
- **Tidak otomatis:** harga e-commerce. Sistem tidak mengambil data dari Shopee, Tokopedia, Blibli, Lazada, TikTok Shop, atau Erafone, karena halamannya dilindungi dan aturan proyek melarang menembus perlindungan itu. Harga e-commerce hanya masuk lewat CSV, sampai ada jalur resmi (program afiliasi marketplace, PB-17).
- **Worker per menit** (InsForge Schedules, jadwal `worker-impor-per-menit`; per 20 Oktober 2026 menunggu env Vercel `IMPORT_WORKER_SECRET`) tidak mengambil harga. Tugasnya hanya melanjutkan pekerjaan yang sudah antre: menerapkan batch impor, memproses foto, dan menjalankan job tarik otomatis, supaya tetap selesai walau admin menutup tab. Tanpa worker, pekerjaan itu tetap berjalan lewat halaman batch yang terbuka dan cron harian, hanya lebih lambat.
- **Koreksi 16–17 Oktober 2026:** cron pagi membuat satu batch harga per merek, tetapi waktunya sering habis untuk membaca situs resmi sehingga sebagian batch tertahan "antre" (17 Oktober: 2 dari 6). Kini ada **cron worker** pukul 08.xx dan 10.xx WIB yang menerapkannya. Dashboard memperingatkan bila batch harga harian antre lebih dari satu jam. Untuk segera, buka halaman batch itu di Pusat Impor; halaman melanjutkan penerapannya sendiri.

Bila panel peringatan muncul:

- **Situs resmi tidak bisa dibaca / meminta verifikasi anti-bot:** jangan diakali. Coba tarik otomatis manual siang hari; bila tetap gagal, perbarui harga merek itu lewat CSV.
- **Pemeriksaan harian belum berjalan:** cek Vercel → Settings → Cron Jobs dan variabel `CRON_SECRET`.
- **Batch pemeriksaan harga antre lama:** tunggu cron worker berikutnya, atau buka batchnya dari Riwayat batch.
- **Merek lama tidak berhasil diperiksa:** periksa apakah URL produk di situs resmi berubah (penawaran lama perlu diperbarui lewat tarik otomatis).

### 5.3 URL situs resmi berganti dan penawaran ganda (sejak 18 Oktober 2026, PB-06)

Situs resmi, terutama Samsung, mengganti URL perwakilan model (warna/SKU) dari waktu ke waktu, misalnya `galaxy-s26-fe-graphite-128gb` menjadi `galaxy-s26-fe-blueberry-128gb`.

- **Pemeriksaan harian** tetap memperbarui harga lewat nama model, tetapi tidak pernah menimpa URL yang dipilih admin. URL yang tercantum saat ini dicatat sebagai **usulan**.
- **Tarik otomatis dan CSV** untuk penjual resmi (situs merek, Digimap) dan Erafone memindahkan penawaran lama ke URL baru, bukan membuat penawaran kedua. Pratinjau menampilkannya sebagai perubahan **URL listing**. Syaratnya: varian, marketplace, penjual, dan host sama, dan URL lamanya tidak ikut diunggah di berkas yang sama.

Bila Dashboard menampilkan panel **URL situs resmi berganti**:

1. Klik nama produknya. Kartu penawaran yang bersangkutan diberi kotak kuning.
2. **URL di situs resmi berganti:** buka tautan usulannya. Bila benar halaman model yang sama, klik **Pakai URL baru**. Riwayat harga tetap, karena penawarannya sama.
3. **Penawaran ganda:** varian itu sudah punya penawaran lain dari penjual yang sama di URL yang tercantum. Klik **Hapus penawaran ganda ini**. Penawaran dihapus lunak; riwayat harganya tetap tersimpan.
4. Bila usulan keliru, klik **Tetap URL lama**. URL itu tidak diusulkan lagi; URL lain tetap bisa diusulkan.

Selama belum diputuskan, penawaran ganda tetap dicatat **gagal diperiksa** setiap hari dengan alasan "URL ini tidak lagi tercantum…", jadi harganya tidak tampak segar.

## 5a. Alat bantu salin harga (sejak 21 Oktober 2026)

Untuk harga e-commerce yang masih dicatat manual. Buka **Impor data → Salin harga**, seret tombol **Salin ke CekHarga** ke bilah bookmark sekali saja. Lalu di setiap halaman produk marketplace yang kamu buka sendiri: pilih varian dan warna, klik bookmark, lengkapi panelnya, klik **Salin baris**, dan tempel di baris kosong sheet. Satu baris = urutan kolom CSV gabungan; waktu pemeriksaan (WIB) dan URL tanpa parameter pelacak terisi otomatis. Tidak ada pengambilan data otomatis di latar belakang dan tidak ada yang dikirim ke server.

## 6. Foto

- Foto diproses di antrean terpisah: diunduh, diperkecil maksimal 1200 px, latar putih dihapus, lalu disimpan sebagai WebP.
- Status per produk tampil di tab **Antrean foto** dan di halaman admin produk. Ada tiga status: sedang diproses, berhasil, atau gagal beserta alasannya.
- **Foto per warna** (sejak 12 Oktober 2026):
  - Setiap foto boleh punya warna (`product_assets.color`). Foto tanpa warna adalah foto umum.
  - Batas: **6 foto per warna**, **8 foto umum**, dan **60 foto per produk**. Saat batas tercapai, sampul dan urutan terkecil didahulukan; sisanya dilewati dengan alasan, misalnya `Warna "Lotus Purple" sudah berisi 6 foto; foto ke-7 tidak disimpan.`
  - Foto dikenali dari URL asli **dan** warnanya. URL yang sama untuk dua warna dicatat sebagai dua foto (dua berkas storage), supaya menghapus satu warna tidak menghapus foto warna lain.
  - Satu sampul per warna (dijaga indeks unik di database). Sampul tampil paling depan saat warna itu dipilih di situs, lalu foto lain urut `sort_order`.
  - Di situs, warna tanpa foto menampilkan foto umum; bila foto umum juga tidak ada, tampil ilustrasi generik "Foto belum tersedia", bukan foto warna lain.
- **Panel Foto per warna** di halaman admin produk: tombol **Naik**/**Turun** (urutan di dalam warna), **Jadikan sampul**, **Pindah ke warna** (tunduk pada batas per warna), dan **Hapus foto** (dua langkah; berkas storage ikut dihapus). Semua aksi hanya untuk admin dan tercatat di audit.
- Foto gagal dicoba ulang maksimal 3 kali. Kegagalan permanen, misalnya host tidak diizinkan, tidak diulang.
- Produk tanpa foto tetap boleh terbit. Situs menampilkan ilustrasi generik berlabel "Foto belum tersedia".

## 6a. Galeri foto

Sejak 17 Oktober 2026 galeri foto tidak lagi punya tab dan templat sendiri. Foto per warna diisi sebagai **baris foto di CSV gabungan** (bagian 2a): satu baris per foto dengan `color`, `image_url`, `urutan`, dan `is_cover`. Untuk mengimpor foto saja, centang **Foto per warna** saja di formulir. Berkas galeri format lama (kolom `brand`, `model_name`, `color`, `image_url`) tetap dikenali. Pratinjau tahap foto menandai setiap foto **Baru**, **Sama**, **Perlu tinjau**, atau **Dilewati** beserta alasannya.

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
| Warna "…" sudah berisi 6 foto | Wajar bila galeri warna itu penuh. Hapus atau pindahkan foto lewat panel Foto per warna bila ingin menggantinya. |
| Produk "…" tidak ditemukan di katalog (galeri) | Impor spesifikasi produknya dulu, atau samakan merek + model dengan katalog. |
| Dasar hak pakai foto belum dipilih | Pilih dasar hak pakai di formulir, atau isi `image_usage_basis` per baris. |
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
  - `templateTerpadu()` dan `UNIFIED_COLUMNS` di `src/lib/import/unified.ts`
  - `templateGaleri()` dan `GALLERY_COLUMNS` di `src/lib/import/photo-gallery-rows.ts`
- Aturan galeri (batas per warna, identitas foto, sampul) ada di `src/lib/import/photo-rules.ts`; dipakai pratinjau, importer gambar, dan panel admin.
- Tes kontrak di `scripts/tests/import.test.ts` (`pnpm test:import`) memastikan templat lolos importer apa adanya. Bila importer membaca kolom baru, perbarui templat, tabel kolom di dokumen ini, dan tesnya sekaligus.
- Kunci idempoten:
  - Produk memakai `products.source_key` (`gsmarena:<halaman>`).
  - Penawaran memakai `(variant_id, url)`.
  - Mengunggah berkas yang sama dua kali tidak membuat data ganda.
