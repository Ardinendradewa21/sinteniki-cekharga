# Konteks AI: Perbaikan Spreadsheet Data & Foto Produk CekHarga

> Berikan dokumen ini utuh kepada AI yang punya akses edit ke Google Sheets.
> Disusun 14 Oktober 2026 dari kode CekHarga (branch `sprint-1/harga-jujur-seo`) dan uji coba impor tanpa menyimpan terhadap katalog asli pada tanggal yang sama.

## 1. Peran dan tujuan

Kamu adalah editor data untuk CekHarga, situs perbandingan harga HP di Indonesia. Tugasmu merapikan spreadsheet di bawah ini langsung di Google Sheets. Hasilnya harus bisa diunggah ke Pusat Impor admin CekHarga, dan setiap baris harus terbaca benar oleh importer.

- Spreadsheet: **Data & Foto Produk CekHarga**
- Link: https://docs.google.com/spreadsheets/d/1W3E-Ga6GMjRqEbPo_0wvxdvhaCJ3xnUAIqfxOjznzn0/edit
- ID: `1W3E-Ga6GMjRqEbPo_0wvxdvhaCJ3xnUAIqfxOjznzn0`

| Tab | gid | Jenis berkas di sistem | Baris berisi |
| --- | --- | --- | --- |
| Samsung Okt 2026 | 255088926 | Templat terpadu (harga/penawaran) | 49 |
| Xiaomi Okt 2026 | 545795830 | Templat terpadu (harga/penawaran) | 92 |
| Galeri Foto Samsung Okt 2026 | 333788180 | Galeri foto | 343 |
| Galeri Foto Xiaomi Okt 2026 | 1099507052 | Galeri foto | 373 |

Tab Samsung Okt 2026 punya sekitar 1.000 baris kosong berformat di bawah data. Baris itu diabaikan importer, tetapi boleh dihapus.

## 2. Aturan kerja (wajib)

1. **Cadangkan dulu.** Sebelum mengubah satu tab, salin tab itu menjadi `<nama tab> (asli 14 Okt)`. Jangan ubah tab cadangan.
2. **Jangan mengarang data.**
   - Harga, tanggal pemeriksaan, varian memori, warna, dan link hanya boleh diisi dari sumber yang benar-benar kamu buka.
   - Kalau tidak bisa memastikan, biarkan kosong dan catat di tab `Catatan Perbaikan`.
   - Harga kosong berarti "belum ada harga", bukan nol (PRD §7). Jangan pernah menulis `0`.
3. **Jangan menembus perlindungan situs.** Kalau Shopee atau situs lain meminta login, captcha, atau memblokir, berhenti dan catat. Jangan memakai trik untuk melewatinya.
4. **Jangan mengubah urutan atau nama kolom header.** Importer membaca header persis seperti di §3 dan §4.
5. **Jangan menulis klaim pemasaran** ("termurah", "terbaik", "resmi terverifikasi") di sel mana pun.
6. **Catat setiap perubahan.** Buat tab `Catatan Perbaikan` dengan kolom: `tab`, `baris`, `kolom`, `nilai_lama`, `nilai_baru`, `alasan`, `sumber`. Satu perubahan, satu baris catatan. Hal yang perlu keputusan manusia ditulis dengan `nilai_baru` kosong dan `alasan` diawali `PERLU KEPUTUSAN:`.
7. **Bersihkan spasi.** Hapus spasi di awal/akhir semua sel (ditemukan 125 sel di galeri Samsung, contohnya `"tidak "`, `"Samsung Galaxy A17 "`).

## 3. Kontrak tab harga (templat terpadu, 34 kolom)

Header harus persis seperti ini, dengan urutan yang sama:

```
brand, model_name, slug, gsmarena_url, ram_gb, storage_gb, announced, network_technology, display_size_inches, display_type_raw, refresh_rate_hz, chipset, battery_capacity_mah, charging, main_camera_count, main_camera_raw, weight_raw, nfc, ip_rating, jack_3_5mm, os, colors, color, image_url, image_usage_basis, image_usage_rights, marketplace, seller_name, offer_url, price_idr, observed_at, warranty, listing_status, seller_verified
```

Kedua tab harga hanya berisi penawaran: kolom spesifikasi (`gsmarena_url` sampai `os`) kosong. **Biarkan kosong.** Baris yang punya kolom spesifikasi atau `gsmarena_url` akan dibaca sebagai produk baru, padahal produknya sudah ada di katalog.

| Kolom | Aturan |
| --- | --- |
| `brand` | `Samsung` atau `Xiaomi`. Redmi dan POCO tetap ditulis `Xiaomi`. |
| `model_name` | Tanpa merek, ditulis persis seperti kolom "Model" di katalog §6 (mis. `Galaxy A57`, `Redmi Note 17 Pro`, `17T`). Akhiran `5G` boleh ada bila katalog menandai model itu 5G, tetapi lebih aman ditulis persis seperti katalog. |
| `slug` | Opsional. Kalau diisi, harus persis sama dengan slug katalog §6; slug salah membuat baris dilewati. Disarankan diisi untuk model yang punya saudara 4G/5G. |
| `ram_gb`, `storage_gb` | Angka bulat GB (1 TB = `1024`). Pasangan RAM/memori **harus ada** di daftar varian katalog. Varian di luar daftar dilewati ("varian tidak boleh dikarang"). |
| `colors` | Daftar warna listing, dipisah koma. Hanya catatan; tidak membuat varian. |
| `color` | Warna baris ini. Tulis persis seperti ejaan di daftar warna katalog §6 bila warnanya memang sama (lihat §5). |
| `image_url` | Opsional. Harus HTTPS dari host yang diizinkan (§5). |
| `image_usage_basis` | Kosong (admin memilih di form), atau salah satu dari: `written-permission`, `public-license`, `own-work`, `admin-declared`. |
| `image_usage_rights` | Wajib diisi teks bila basis `written-permission` atau `public-license`. |
| `marketplace` | `Shopee`. Host `offer_url` harus cocok dengan marketplace ini. |
| `seller_name` | Wajib, mis. `Samsung Official Store`. |
| `offer_url` | Wajib, link listing (bukan link gambar). Bagian `?extraParams=...` Shopee boleh dibiarkan karena dibuang otomatis. |
| `price_idr` | Harga Rupiah. Format yang diterima: `15999000`, `Rp15.999.000`, `Rp15,999,000`, `15,9 jt`. Batas 1 sampai 500.000.000. Kosong = belum ada harga. |
| `observed_at` | Waktu harga dilihat, ISO 8601 dengan zona: `2026-10-14T09:00:00+07:00`. Tanpa zona dibaca sebagai WIB. Kosong = tanggal unggah dipakai. **Wajib diisi bila `price_idr` diisi.** |
| `warranty` | Opsional, mis. `Resmi SEIN 1 tahun`. |
| `listing_status` | `active`, `out-of-stock`, `ambiguous`, atau `inactive`. |
| `seller_verified` | `ya` atau `tidak`. Isi `ya` hanya bila ada bukti di halaman listing (badge toko resmi/Mall). |

**Satu listing, banyak warna.** Baris dengan model + varian + `offer_url` yang sama digabung menjadi satu penawaran. Warna digabung dan data diambil dari baris terakhir. Ini bukan kesalahan, jadi baris per warna boleh dipertahankan. Syaratnya: `price_idr` dan `observed_at` di baris-baris itu harus sama. Harga yang berbeda membuat baris ditandai "Perlu tinjau".

## 4. Kontrak tab galeri foto

Kolom yang dibaca sistem: `brand`, `model_name`, `color`, `urutan`, `is_cover`, `image_url`, `source_url`, `image_usage_basis`, `image_usage_rights`.

Kolom `image_host` dan `host_diizinkan_saat_ini` **diabaikan** importer, karena host dicek langsung dari `image_url`. Hapus kedua kolom itu, atau samakan isinya dengan host sebenarnya. Saat ini 42 baris galeri Samsung punya `image_host` yang tidak cocok dengan link-nya.

| Kolom | Aturan |
| --- | --- |
| `brand`, `model_name` | Sama dengan §3. Merek yang ikut tertulis di model (`Samsung Galaxy A57 5G`) masih terbaca, tetapi tulis tanpa merek agar seragam. |
| `color` | Wajib; setiap foto galeri terikat ke satu warna. |
| `urutan` | Bilangan bulat ≥ 1, berurutan per model + warna. |
| `is_cover` | `ya` atau `tidak`. **Tepat satu `ya` per model + warna.** |
| `image_url` | HTTPS, host diizinkan (§5), dan harus benar-benar foto model dan warna itu. |
| `source_url` | Halaman asal foto (listing/situs resmi). |

**Batas foto:**

- 6 per warna, 8 tanpa warna, 60 per produk.
- Foto yang sudah tersimpan di situs ikut dihitung.
- Bila lebih dari batas, sampul dan `urutan` terkecil yang disimpan; sisanya dilewati.
- **Rapikan agar setiap model + warna punya paling banyak 6 baris**: sampul + 5 foto terbaik (depan, belakang, samping, detail kamera).

Foto yang sama (link sama + warna sama) hanya disimpan sekali. Hapus baris ganda. Di galeri Samsung ada 91 baris ganda bila link dibandingkan tanpa parameter `?...`.

## 5. Aturan bersama

**Host foto yang diizinkan (HTTPS saja):**

- `down-id.img.susercontent.com` (Shopee)
- `fdn.gsmarena.com`, `fdn2.gsmarena.com`
- `cdnpro.eraspace.com`
- `i02.appmifile.com` (Xiaomi)
- `images.samsung.com` (parameter `?$...$`/`?imbypass=true` dibuang otomatis)

Host lain ditolak. Jangan memakai link Google Drive, Pinterest, atau hasil pencarian gambar.

**Pencocokan produk.** Importer mencari produk berdasarkan `brand` + `model_name` (atau `slug`).

- Produk yang tidak ada di katalog §6 dilewati. Spreadsheet tidak bisa membuat produk baru tanpa data spesifikasi.
- **Model dengan saudara 4G/5G** (Galaxy A07 / A07 4G, Redmi Note 17 / Redmi Note 17 4G): nama tanpa label jaringan dicocokkan ke model 5G dan ditandai "Perlu tinjau". Tulis label jaringannya, atau isi `slug`.

**Warna.**

- Warna bukan varian dan tidak memengaruhi harga.
- Warna yang tidak ada di daftar warna katalog tetap disimpan apa adanya, tetapi ditandai "Perlu tinjau".
- Di situs, tombol warna memakai ejaan katalog. Foto berlabel `Awesome Gray` tidak akan menempel ke tombol `Gray`.
- Aturannya:
  1. Warnanya sama, hanya beda ejaan atau awalan pemasaran (`Awesome Gray` vs `Gray`, `Celestian Purple` vs `Celestial Purple`, `Black` vs `Absolute Black`): ganti dengan ejaan katalog dan catat.
  2. Nama dalam kurung di katalog dihitung sebagai alias, mis. `Deep Blue (Endless Blue)` cocok dengan `Deep Blue` maupun `Endless Blue`.
  3. Warna yang memang tidak ada di katalog (mis. `Oak Green`, `Lotus Purple` untuk Redmi 17): jangan diganti. Tulis `PERLU KEPUTUSAN:`, karena data warna katalog mungkin yang perlu diperbarui admin.

## 6. Katalog saat ini (Samsung dan Xiaomi, 14 Okt 2026)

Format kolom: Model | slug | 5G | varian RAM/memori | warna katalog.

**Samsung**

| Model | slug | 5G | Varian | Warna katalog |
| --- | --- | --- | --- | --- |
| Galaxy A07 | samsung-galaxy-a07 | ya | 4/64, 4/128, 6/128 | Black, Light Violet |
| Galaxy A07 4G | samsung-galaxy-a07-4g | tidak | 4/64, 4/128, 6/128, 8/256 | Gray, Light Violet, Dark Green |
| Galaxy A08 4G | samsung-galaxy-a08-4g | tidak | 4/64, 4/128, 4/256 | Navy Blue, Silver, Green |
| Galaxy A17 | samsung-galaxy-a17 | ya | 4/128, 4/256, 6/128, 8/128, 8/256 | Black, Gray, Blue |
| Galaxy A27 | samsung-galaxy-a27 | ya | 6/128, 8/128, 8/256 | Black, Blue, Light Green, Light Pink |
| Galaxy A37 | samsung-galaxy-a37 | ya | 6/128, 8/128, 8/256, 12/256 | Graygreen, Charkoal, White, Light Violet |
| Galaxy A56 | samsung-galaxy-a56 | ya | 6/128, 6/256, 8/128, 8/256, 12/256 | Pink, Olive, Graphite, Lightgray |
| Galaxy A57 | samsung-galaxy-a57 | ya | 8/128, 8/256, 12/256, 12/512 | Navy, Gray, Icyblue, Lilac |
| Galaxy S25 Edge | samsung-galaxy-s25-edge | ya | 12/256, 12/512 | Titanium Icyblue, Titanium Silver, Titanium Jetblack |
| Galaxy S25 FE | samsung-galaxy-s25-fe | ya | 8/128, 8/256, 8/512 | Icyblue, Jetblack, Navy, White |
| Galaxy S25 Ultra | samsung-galaxy-s25-ultra | ya | 12/256, 12/512, 12/1024, 16/1024 | Titanium Silver Blue, Titanium Black, Titanium White Silver, Titanium Gray, Titanium Jade Green, Titanium Jet Black, Titanium Pink Gold |
| Galaxy S25+ | samsung-galaxy-s25-plus | ya | 12/256, 12/512 | Icy Blue, Mint, Navy, Silver Shadow, Pink Gold, Coral Red, Blue Black |
| Galaxy S26 | samsung-galaxy-s26 | ya | 12/128, 12/256, 12/512 | Cobalt Violet, Sky Blue, Black, White, Silver Shadow, Pink Gold |
| Galaxy S26 FE | samsung-galaxy-s26-fe | ya | 8/128, 8/256, 8/512 | Blueberry, Graphite, Pistachio |
| Galaxy S26 Ultra | samsung-galaxy-s26-ultra | ya | 12/256, 12/512, 16/1024 | Cobalt Violet, Sky Blue, Black, White, Silver Shadow, Pink Gold |
| Galaxy Z Flip7 | samsung-galaxy-z-flip7 | ya | 12/256, 12/512 | Blue Shadow, Jet Black, Coral Red, Mint |
| Galaxy Z Flip8 | samsung-galaxy-z-flip8 | ya | 12/256, 12/512 | Graphite, Cream, Pink, Mint |
| Galaxy Z Fold8 | samsung-galaxy-z-fold8 | ya | 12/256, 12/512, 12/1024, 16/1024 | Graphite, Cream, Lavender, Pistachio |
| Galaxy Z Fold8 Ultra | samsung-galaxy-z-fold8-ultra | ya | 12/256, 12/512, 16/512, 16/1024 | Graphite, Cream, Violet Shadow |

**Xiaomi** (`brand` = `Xiaomi`)

| Model | slug | 5G | Varian | Warna katalog |
| --- | --- | --- | --- | --- |
| 15T | xiaomi-15t | ya | 12/256, 12/512 | Black, Gray, Rose Gold |
| 15T Pro | xiaomi-15t-pro | ya | 12/256, 12/512, 12/1024 | Black, Gray, Mocha Gold |
| 17 | xiaomi-17 | ya | 12/256, 12/512, 16/512, 16/1024 | Black, Venture Green, Alpine Pink, Ice Blue, White |
| 17 Ultra | xiaomi-17-ultra | ya | 16/512, 16/1024 | Black, White, Starlit Green |
| 17T | xiaomi-17t | ya | 12/256, 12/512 | Violet, Blue, Opal White, Black |
| 17T Pro | xiaomi-17t-pro | ya | 12/256, 12/512, 12/1024, 16/512 | Deep Blue, Deep Violet, Black |
| Poco C71 | xiaomi-poco-c71 | tidak | 3/64, 4/64, 4/128, 6/128 | Power Black, Cool Blue, Desert Gold |
| Poco C81 Pro | xiaomi-poco-c81-pro | tidak | 4/64, 4/128, 4/256 | Black, Gold, Green |
| Poco F7 Ultra | xiaomi-poco-f7-ultra | ya | 12/256, 16/512 | Black, Yellow |
| Poco X8 Pro | xiaomi-poco-x8-pro | ya | 8/256, 8/512, 12/256, 12/512 | Black, White, Mint Green, Yellow |
| Poco X8 Pro Max | xiaomi-poco-x8-pro-max | ya | 12/256, 12/512 | Black, White, Blue |
| Redmi 17 | xiaomi-redmi-17 | ya | 4/128, 4/256, 6/128, 6/256, 8/128 | Absolute Black, Deep Blue (Endless Blue), Vivid Orange (Eternal Orange) |
| Redmi A7 Pro | xiaomi-redmi-a7-pro | ya | 4/64, 4/128, 6/128 | Black, Mist Blue, Sunset Orange |
| Redmi Note 15 Pro+ | xiaomi-redmi-note-15-pro-plus | ya | 8/256, 12/256, 12/512 | Glacier Blue, Mocha Brown, Black |
| Redmi Note 17 | xiaomi-redmi-note-17 | ya | 6/128, 6/256, 8/256 | Celestial Purple, Sky Teal, Black |
| Redmi Note 17 4G | xiaomi-redmi-note-17-4g | tidak | 4/128, 4/256, 6/128, 6/256, 8/256 | Celestial Purple, Sky Teal, Black |
| Redmi Note 17 Pro | xiaomi-redmi-note-17-pro | ya | 6/128, 6/256, 8/128, 8/256, 8/512, 12/256 | Sky Blue, Black, Satin Orange, Purple |
| Redmi Note 17 Pro Max | xiaomi-redmi-note-17-pro-max | ya | 8/128, 8/256, 8/512, 12/256 | Black, Purple, Cloud Blush, Green, Secret Sunrise |

**Tidak ada di katalog:** Xiaomi Poco F9 Pro dan Samsung Galaxy A17 4G. Baris untuk model ini akan dilewati sampai admin mengimpor spesifikasinya.

## 7. Temuan per tab dan perbaikan yang diminta

Hasil uji coba impor 14 Oktober (tanpa menyimpan):

| Tab | Hasil uji |
| --- | --- |
| Samsung Okt 2026 | 44 tidak berubah (sudah pernah diimpor), 5 dilewati |
| Xiaomi Okt 2026 | 20 tidak berubah, 2 berubah, 70 dilewati (64 di antaranya gabungan warna yang wajar) |
| Galeri Samsung | 186 baru, 63 tidak berubah, 94 dilewati |
| Galeri Xiaomi | 239 tidak berubah, 134 dilewati |

### 7.1 Samsung Okt 2026

1. **`price_idr` dan `observed_at` kosong di semua 49 baris.** Penawaran tercatat tanpa harga, sehingga situs menampilkan "Belum ada harga".
   - Isi dari halaman listing yang benar-benar kamu buka, beserta waktu kamu melihatnya (WIB, ISO 8601).
   - Tidak bisa membuka listing: biarkan kosong dan catat. **Jangan memperkirakan harga.**
2. **`Galaxy A08` tidak ada di katalog** (5 baris). Katalog punya `Galaxy A08 4G` (slug `samsung-galaxy-a08-4g`), dan judul listing menyebut Helio G99, yang merupakan chip 4G.
   - Ganti `model_name` menjadi `Galaxy A08 4G` dan isi slug-nya.
   - Warna `Dark Blue` tidak ada di katalog (katalog: `Navy Blue`): tandai `PERLU KEPUTUSAN:`.
3. **`Galaxy A07` kemungkinan salah model.**
   - Link foto memakai kode `sm-a075f`, sedangkan Samsung memakai kode A076 untuk A07 5G dan A075 untuk A07 4G.
   - Sistem saat ini mencocokkan baris ini ke **Galaxy A07 (5G)**.
   - Langkah: buka listing dan pastikan jaringannya.
     - Bila 4G: ganti `model_name` menjadi `Galaxy A07 4G` dan isi slug `samsung-galaxy-a07-4g`.
     - Bila tidak bisa dipastikan: tulis `PERLU KEPUTUSAN:`.
   - Catatan untuk admin: penawaran A07 yang sudah terimpor menempel ke produk 5G, jadi perlu dipindah setelah keputusan ini.
4. **`Galaxy A17` kemungkinan A17 4G.** Kode foto `sm-a175f` adalah kode 4G; A17 5G memakai A176. Katalog hanya punya `Galaxy A17` (5G). Pastikan dari listing, lalu tandai `PERLU KEPUTUSAN:`. Jangan mengubah ke model yang tidak ada di katalog.
5. **Warna yang perlu diselaraskan dengan katalog** (aturan §5):
   - A57: `Awesome Gray` → `Gray`, `Awesome Icyblue` → `Icyblue`, `Awesome Navy` → `Navy`, `Awesome Lilac` → `Lilac`.
   - A37: `Awesome Graygreen` → `Graygreen`, `Awesome Charcoal` → `Charkoal` (ejaan katalog; laporkan juga kemungkinan salah ketik di katalog), `Awesome Lavender` → `PERLU KEPUTUSAN:` (katalog tidak punya Lavender).
   - A17: `Light Blue` → `PERLU KEPUTUSAN:` (katalog: `Blue`).
   - A07: `Green` → `PERLU KEPUTUSAN:` (ikut keputusan model di butir 3).
6. Model `Galaxy A27 5G`, `Galaxy A37 5G`, dan `Galaxy A57 5G` sudah terbaca benar. Ubah ke nama katalog (`Galaxy A27`, dst.) hanya untuk keseragaman.

### 7.2 Xiaomi Okt 2026

1. **`17 Ultra` varian 12/512** (3 baris) tidak ada di katalog; katalog hanya punya 16/512 dan 16/1024. Periksa listing:
   - Bila RAM sebenarnya 16 GB: perbaiki `ram_gb`.
   - Bila memang 12/512: tulis `PERLU KEPUTUSAN:`. Admin perlu menambah varian, dan varian tidak boleh dikarang.
2. **`Poco F9 Pro`** (3 baris) tidak ada di katalog. Biarkan barisnya dan tulis `PERLU KEPUTUSAN: impor spesifikasi dulu`.
3. **Baris per warna dengan listing sama** (64 baris digabung): boleh tetap ada. Pastikan `price_idr` dan `observed_at` sama untuk semua baris satu listing.
4. **Warna di luar katalog:**
   - `Redmi Note 17`: `Celestian Purple` → `Celestial Purple`.
   - `Redmi 17`: `Black` → `Absolute Black`. `Oak Green` dan `Lotus Purple` → `PERLU KEPUTUSAN:`.
   - `17T Pro`: `Violet` → `Deep Violet` bila listing memang Deep Violet.
   - `Poco C71`: `Black` → `Power Black`, `Blue` → `Cool Blue`, `Gold` → `Desert Gold`.
   - `Poco X8 Pro`: `Green` → `Mint Green` bila warnanya sama.
   - `Redmi A7 Pro`: `Palm Green` → `PERLU KEPUTUSAN:`.
   - `Redmi Note 17 Pro`: `Cloud Blush` dan `Green` → `PERLU KEPUTUSAN:` (warna itu milik Pro Max; periksa apakah listing tertukar).
   - `Redmi Note 17 Pro Max`: `Sky Blue` → `PERLU KEPUTUSAN:` (warna itu milik Pro; periksa apakah listing tertukar).
5. **`Redmi Note 17`** ditandai karena ada `Redmi Note 17 4G`. Pastikan listing 5G atau 4G, lalu isi slug (`xiaomi-redmi-note-17` atau `xiaomi-redmi-note-17-4g`). Varian 4/128 dan 4/256 hanya ada di versi 4G.
6. Harga di tab ini bertanggal 12 Okt 2026. Sistem menganggap harga segar hanya 30 jam. Bila kamu memeriksa ulang, perbarui `price_idr` dan `observed_at` bersamaan.

### 7.3 Galeri Foto Samsung Okt 2026

1. **Foto Xiaomi di baris A57 Awesome Gray** (baris 2–8; host `i02.appmifile.com` dan `down-id.img.susercontent.com`, bekas foto Xiaomi 17T). Baris 2 bahkan ditandai sampul.
   - Hapus 7 baris itu.
   - Pastikan sampul A57 Gray jatuh ke foto `images.samsung.com` yang benar.
2. **91 baris ganda** (model + warna + link sama, tanpa parameter `?`): sisakan satu.
3. **Sampul lebih dari satu per warna** (A57 semua warna, A07, A08, Z Flip8 Graphite, dll.): sisakan tepat satu `ya` per model + warna.
4. **34 kombinasi model + warna berisi lebih dari 6 foto.** Kurangi menjadi paling banyak 6: sampul + 5 foto, dengan `urutan` 1–6.
5. **`Galaxy A08`** (35 baris): ganti menjadi `Galaxy A08 4G`, dan selaraskan warnanya dengan §7.1 butir 2.
6. **`Galaxy A07` dan `Galaxy A17`**: ikuti keputusan model di §7.1 butir 3–4 agar galeri dan harga menempel ke produk yang sama.
7. **Warna**: pakai pemetaan yang sama dengan §7.1 butir 5.
8. **Kolom `image_host` dan `host_diizinkan_saat_ini`**: hapus kedua kolom (42 baris tidak cocok dengan link).
9. **Spasi**: bersihkan `model_name` (63 sel), `color` (56 sel), dan `is_cover` (6 sel).

### 7.4 Galeri Foto Xiaomi Okt 2026

1. **`Poco F9 Pro`** (29 baris): produknya belum ada. Pindahkan ke tab baru `Galeri Tertunda`, agar tab utama bisa diunggah tanpa baris gagal.
2. **Batas per warna terlampaui di 33 kombinasi** (mis. Poco X8 Pro Max Blue 15 foto, Redmi Note 17 Pro 5G Black 11 foto). Kurangi menjadi paling banyak 6 per warna. Ingat, foto yang sudah tersimpan di situs ikut dihitung: 239 baris sudah tersimpan.
3. **Warna**: pakai pemetaan §7.2 butir 4. `17T Pro` `Violet` → `Deep Violet` bila benar.
4. **`Redmi Note 17`**: isi keputusan 5G/4G yang sama dengan §7.2 butir 5.
5. **Kolom `image_host` dan `host_diizinkan_saat_ini`**: hapus.

## 8. Checklist sebelum selesai

- [ ] Setiap tab yang diubah punya salinan `(asli 14 Okt)`.
- [ ] Header tab harga = 34 kolom persis §3; header galeri memuat minimal `brand, model_name, color, urutan, is_cover, image_url, source_url`.
- [ ] Tidak ada sel dengan spasi di awal/akhir.
- [ ] Setiap `model_name` (atau `slug`) ada di katalog §6, atau barisnya dipindah ke tab tertunda dengan alasan.
- [ ] Setiap pasangan `ram_gb`/`storage_gb` ada di daftar varian katalog.
- [ ] Setiap `image_url` HTTPS dari host §5 dan benar-benar foto model + warna itu.
- [ ] Galeri: tepat satu `is_cover = ya` per model + warna; paling banyak 6 foto per warna; tidak ada link ganda.
- [ ] Setiap `price_idr` yang diisi punya `observed_at` ber-zona waktu dan sumber di `Catatan Perbaikan`.
- [ ] Tidak ada harga `0`, harga perkiraan, atau klaim pemasaran.
- [ ] Semua hal yang butuh keputusan manusia tertulis `PERLU KEPUTUSAN:` di `Catatan Perbaikan`.

## 9. Laporan akhir yang diminta dari AI

Kirim ringkasan berisi:

1. Jumlah baris diubah, dihapus, dan dipindah per tab.
2. Jumlah harga yang berhasil diisi, beserta rentang waktu `observed_at`.
3. Daftar `PERLU KEPUTUSAN:`, dikelompokkan: model 4G/5G, varian tidak ada, warna tidak ada di katalog, produk belum ada.
4. Listing yang tidak bisa dibuka (diblokir, login, atau hilang).

## 10. Setelah spreadsheet beres (dikerjakan admin, bukan AI)

1. Unduh tiap tab sebagai CSV (File → Download → CSV).
2. Unggah di Admin → Impor data:
   - tab harga lewat "Unggah CSV" dengan jenis "Templat terpadu";
   - tab galeri lewat tab "Galeri foto".
3. Baca pratinjau. Baris "Perlu tinjau" boleh diterapkan setelah dicek; baris "Dilewati" berisi alasannya.
4. Putuskan item `PERLU KEPUTUSAN:`:
   - impor spesifikasi Poco F9 Pro / Galaxy A17 4G;
   - tambah varian 17 Ultra 12/512 bila terbukti;
   - perbarui warna katalog;
   - pindahkan penawaran Galaxy A07 bila ternyata 4G.
