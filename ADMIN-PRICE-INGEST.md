# ADMIN-PRICE-INGEST.md
# Context Engineering: Modul Admin Pengambilan Harga Marketplace (CekHarga)

Dokumen ini adalah konteks kerja untuk AI coding agent (Claude Code) dalam membangun modul admin pengambilan data harga produk HP dari marketplace (Tokopedia, Blibli, Shopee). Baca dokumen ini bersama CLAUDE.md, architecture.md, PRD, dan SRS yang sudah ada. Jika ada konflik, konvensi di CLAUDE.md dan architecture.md yang berlaku, lalu catat konfliknya di bagian "Open Questions".

---

## 1. Tujuan Modul

1. Admin dapat memasukkan URL produk atau kata kunci pencarian dari marketplace, lalu sistem mengambil data listing beserta seluruh varian (RAM/storage) dan harganya.
2. Data varian yang formatnya beragam dinormalisasi menjadi format standar: `ram_gb`, `storage_gb`, `price_idr`.
3. Setiap listing dicocokkan (matching) ke data device dari GSMArena yang sudah ada di database.
4. Hasil matching dengan tingkat keyakinan rendah masuk antrean review agar admin bisa menyetujui, mengoreksi, atau menolak.
5. Harga yang disetujui disimpan sebagai riwayat harga (price history) dan ditampilkan di sisi publik CekHarga.

Di luar cakupan (jangan dikerjakan pada modul ini):
1. Tampilan publik halaman perbandingan harga (sudah ada di tiket lain).
2. Checkout, afiliasi otomatis, atau notifikasi harga ke pengguna.
3. Bypass captcha, rotasi akun login, atau teknik penghindaran anti-bot yang agresif.

---

## 2. Prinsip Inti (Wajib Dipahami Sebelum Menulis Kode)

1. **Ambil data dari JSON, bukan dari HTML atau tombol.** Halaman produk marketplace memuat data varian lengkap melalui respons API internal (JSON/GraphQL) atau JSON yang tertanam di HTML. Scraper harus menangkap data tersebut, bukan mengklik tombol varian satu per satu.
2. **Simpan data mentah terlebih dahulu.** Setiap respons JSON asli disimpan apa adanya di tabel `raw_listings`. Parsing dan normalisasi dijalankan terpisah sehingga jika logika parsing berubah, data bisa diproses ulang tanpa scraping ulang.
3. **Adapter per marketplace.** Setiap marketplace punya adapter sendiri dengan antarmuka yang sama. Menambah marketplace baru tidak boleh mengubah kode inti.
4. **Endpoint tidak di-hardcode sebagai kebenaran mutlak.** Struktur API marketplace bisa berubah kapan saja. Lokasi field dan pola URL ditaruh di konfigurasi adapter dan diberi komentar tanggal verifikasi terakhir.
5. **Manusia sebagai penentu akhir.** Hasil otomatis dengan confidence di bawah ambang batas tidak boleh langsung tampil ke publik.
6. **Sopan terhadap server.** Wajib ada rate limit, jeda acak, dan batas jumlah request per job.

---

## 3. Arsitektur

```
[Admin UI (Next.js, shadcn/ui)]
        |  buat job / lihat hasil / review
        v
[API Route / Server Action]  ---->  [Database: scrape_jobs, raw_listings, ...]
                                              ^
                                              |  polling job berstatus "queued"
                                    [Scraper Worker (Python + Playwright)]
                                              |
                                              v
                              [Pipeline: parse -> normalize -> match]
                                              |
                                  confidence tinggi -> auto-approve
                                  confidence rendah -> review_queue
```

Keputusan arsitektur:
1. **Scraper worker ditulis dengan Python** (Playwright), terpisah dari aplikasi Next.js, konsisten dengan scraper GSMArena yang sudah ada. Worker berjalan sebagai proses terpisah (lokal, VPS, atau container), bukan di serverless function Vercel, karena Playwright butuh browser dan waktu eksekusi panjang.
2. **Komunikasi Next.js dan worker melalui database** (pola job queue sederhana): admin membuat baris di `scrape_jobs` dengan status `queued`, worker mengambil dan memperbarui statusnya. Tidak perlu message broker pada tahap awal.
3. **Normalisasi dan matching** dijalankan di worker Python setelah data mentah tersimpan. LLM fallback memakai OpenRouter (model murah) melalui HTTP biasa dari Python.
4. **Embedding untuk matching** memakai pgvector yang sudah ada. Gunakan model embedding yang sama dengan yang dipakai untuk tabel device agar vektor sebanding.

---

## 4. Skema Database

Sesuaikan penamaan dengan konvensi yang sudah ada. Tipe di bawah ini bersifat acuan.

```sql
-- Sumber marketplace dan pengaturannya
marketplaces (
  id            text primary key,        -- 'tokopedia' | 'blibli' | 'shopee'
  display_name  text not null,
  enabled       boolean default false,
  rate_limit_ms integer default 4000,    -- jeda minimum antar-request
  max_pages_per_job integer default 30,
  notes         text                     -- catatan struktur API, tanggal verifikasi
)

-- Job scraping yang dibuat admin
scrape_jobs (
  id            uuid primary key,
  marketplace_id text references marketplaces(id),
  job_type      text not null,           -- 'url' | 'keyword'
  input         text not null,           -- URL produk atau kata kunci
  status        text not null,           -- 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  total_found   integer default 0,
  total_parsed  integer default 0,
  error_message text,
  created_by    uuid,
  created_at    timestamptz default now(),
  started_at    timestamptz,
  finished_at   timestamptz
)

-- Data mentah apa adanya
raw_listings (
  id             uuid primary key,
  job_id         uuid references scrape_jobs(id),
  marketplace_id text,
  external_id    text not null,          -- ID produk di marketplace
  url            text,
  title          text,
  shop_name      text,
  payload        jsonb not null,         -- respons JSON asli
  parser_version text,                   -- versi parser terakhir yang memproses
  fetched_at     timestamptz default now(),
  unique (marketplace_id, external_id, fetched_at)
)

-- Varian hasil normalisasi
listing_variants (
  id              uuid primary key,
  raw_listing_id  uuid references raw_listings(id),
  variant_label   text,                  -- teks asli, misal "8GB+256GB"
  ram_gb          integer,               -- null jika tidak tersedia (misal iPhone)
  storage_gb      integer,
  price_idr       bigint not null,
  stock           integer,
  parse_method    text,                  -- 'regex' | 'llm' | 'manual'
  created_at      timestamptz default now()
)

-- Hasil pencocokan ke device GSMArena
variant_matches (
  id                uuid primary key,
  listing_variant_id uuid references listing_variants(id),
  device_id         uuid references devices(id),
  confidence        numeric(4,3),        -- 0.000 - 1.000
  match_method      text,                -- 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'manual'
  status            text not null,       -- 'auto_approved' | 'pending_review' | 'approved' | 'rejected'
  reviewed_by       uuid,
  reviewed_at       timestamptz
)

-- Riwayat harga yang sudah disetujui (sumber data sisi publik)
price_history (
  id             uuid primary key,
  device_id      uuid references devices(id),
  ram_gb         integer,
  storage_gb     integer,
  marketplace_id text,
  shop_name      text,
  url            text,
  price_idr      bigint not null,
  recorded_at    timestamptz default now()
)
```

Indeks yang disarankan:
1. `raw_listings (marketplace_id, external_id)`
2. `variant_matches (status)` untuk antrean review.
3. `price_history (device_id, ram_gb, storage_gb, recorded_at desc)`

---

## 5. Kontrak Adapter Marketplace (Python)

Setiap adapter wajib mengimplementasikan antarmuka berikut:

```python
class MarketplaceAdapter(Protocol):
    id: str

    def search(self, keyword: str, max_pages: int) -> list[str]:
        """Mengembalikan daftar URL produk dari hasil pencarian."""

    def fetch_product(self, url: str) -> RawProduct:
        """Membuka halaman produk, menangkap JSON data produk, mengembalikan data mentah."""

    def extract_variants(self, payload: dict) -> list[RawVariant]:
        """Mengambil daftar varian (label teks asli, harga, stok) dari payload mentah."""
```

Struktur data:

```python
@dataclass
class RawProduct:
    external_id: str
    url: str
    title: str
    shop_name: str | None
    payload: dict          # JSON asli

@dataclass
class RawVariant:
    label: str             # teks asli varian, misal "8/256" atau "Hitam, 8GB+256GB"
    price_idr: int         # sudah dikonversi ke rupiah penuh
    stock: int | None
```

Teknik pengambilan data di `fetch_product`:
1. Buka halaman dengan Playwright, pasang listener `page.on("response", ...)`.
2. Tangkap respons yang cocok dengan pola URL di konfigurasi adapter (misalnya request GraphQL atau `/api/...`).
3. Jika tidak ada respons API yang cocok, fallback ke JSON yang tertanam di HTML (tag `<script>` berisi JSON, termasuk `application/ld+json`).
4. Jangan mengklik tombol varian kecuali kedua cara di atas gagal, dan catat di log bahwa fallback ini dipakai.

Catatan per marketplace (wajib diverifikasi ulang lewat DevTools sebelum implementasi, lalu isi tanggal verifikasi di kolom `marketplaces.notes`):
1. **Tokopedia**: data produk dimuat lewat GraphQL. Varian biasanya terdiri dari daftar opsi dan daftar "children" yang masing-masing punya harga dan stok.
2. **Blibli**: data produk tersedia lewat endpoint backend produk atau JSON tertanam. Setiap varian tampil sebagai item dengan atribut.
3. **Shopee**: data produk lewat API internal. Pilihan varian ada di struktur `tier_variations`, kombinasi dan harga ada di `models`. Harga umumnya disimpan dalam satuan yang dikali 100.000 sehingga harus dibagi. Perlindungan anti-bot paling ketat; adapter ini dibuat terakhir dan default `enabled = false`.

Urutan implementasi adapter: Blibli, lalu Tokopedia, lalu Shopee.

---

## 6. Pipeline Normalisasi Varian

Input: `RawVariant.label` dan judul produk. Output: `ram_gb`, `storage_gb`, `parse_method`.

Urutan proses:
1. Bersihkan teks: ubah ke huruf besar, hapus spasi berlebih, samakan pemisah (`+`, `/`, `|`, `-`).
2. Coba regex pola RAM dan storage berpasangan (`8/256`, `8GB+256GB`, `RAM 8GB ROM 256GB`, `8+256`).
3. Jika gagal, coba regex storage tunggal (`256GB`, `1TB`) dengan `ram_gb = null`.
4. Jika label varian tidak mengandung info memori (misalnya varian hanya warna), coba ekstrak dari judul produk.
5. Jika semua regex gagal, panggil LLM fallback dengan output JSON ketat: `{"ram_gb": int|null, "storage_gb": int|null}`.
6. Konversi TB ke GB (1 TB = 1024 GB).
7. Validasi: RAM wajar di rentang 1 sampai 24 GB, storage termasuk nilai umum (16, 32, 64, 128, 256, 512, 1024, 2048). Di luar itu, tandai untuk review.

Kasus uji wajib (buat sebagai unit test):

| Input label            | ram_gb | storage_gb |
|------------------------|--------|------------|
| `8/256`                | 8      | 256        |
| `8GB+256GB`            | 8      | 256        |
| `RAM 12GB ROM 512GB`   | 12     | 512        |
| `8 + 128`              | 8      | 128        |
| `256GB`                | null   | 256        |
| `1TB`                  | null   | 1024       |
| `Hitam, 8/256GB`       | 8      | 256        |
| `12GB/1TB`             | 12     | 1024       |
| `Biru` (judul: `... 8/128 ...`) | 8 | 128     |
| `Paket Hemat`          | gagal regex, lanjut LLM |  |

Normalisasi harga:
1. Semua harga disimpan dalam rupiah penuh sebagai `bigint`.
2. Jika marketplace menyediakan harga coret dan harga diskon, simpan harga yang benar-benar dibayar pembeli.
3. Varian dengan stok 0 tetap disimpan, tetapi tidak dipakai untuk harga terendah di sisi publik.

---

## 7. Pipeline Matching ke Device GSMArena

Tujuan: menentukan `device_id` untuk setiap listing.

Urutan proses:
1. **Bersihkan judul**: hapus kata tidak relevan seperti "Garansi Resmi", "Resmi", "Promo", "BNIB", "Original", "Free", "Cicilan", "COD", nama toko, emoji, dan tanda baca berlebih. Simpan daftar kata ini di file konfigurasi agar mudah ditambah.
2. **Deteksi brand** dari judul (daftar brand diambil dari tabel device).
3. **Exact/fuzzy match** nama model dalam brand yang sama (gunakan rasio kemiripan string, misalnya rapidfuzz).
4. **Embedding match** dengan pgvector jika fuzzy match tidak meyakinkan: ambil 5 kandidat terdekat.
5. **LLM tie-breaker** (opsional) jika ada beberapa kandidat dengan skor mirip: kirim judul dan daftar kandidat, minta LLM memilih satu atau menjawab "tidak ada".
6. **Validasi varian**: kombinasi `ram_gb`/`storage_gb` harus ada di spesifikasi device GSMArena. Jika tidak ada, turunkan confidence.

Ambang batas (simpan di konfigurasi, bukan hardcode):
1. `confidence >= 0.90` menjadi `auto_approved` dan langsung masuk `price_history`.
2. `0.60 <= confidence < 0.90` menjadi `pending_review`.
3. `confidence < 0.60` menjadi `pending_review` dengan penanda "kemungkinan tidak cocok".

Pada tahap awal, admin boleh menonaktifkan auto-approve sepenuhnya melalui halaman pengaturan.

---

## 8. Halaman Admin

Semua halaman berada di bawah route `/admin/price-ingest` dan hanya bisa diakses role admin. Gunakan komponen shadcn/ui dan tema yang sudah ada.

1. **Dashboard** (`/admin/price-ingest`)
   1. Ringkasan: jumlah job hari ini, listing terkumpul, antrean review, job gagal.
   2. Status tiap marketplace (aktif/nonaktif, waktu scraping terakhir berhasil).

2. **Buat Job** (`/admin/price-ingest/jobs/new`)
   1. Pilih marketplace (hanya yang `enabled`).
   2. Pilih tipe: URL produk (bisa banyak, satu per baris) atau kata kunci.
   3. Batas halaman untuk tipe kata kunci.
   4. Tombol "Masukkan ke antrean".

3. **Daftar Job** (`/admin/price-ingest/jobs`)
   1. Tabel: marketplace, input, status, jumlah ditemukan, jumlah diparse, waktu.
   2. Status diperbarui otomatis (polling setiap beberapa detik saat ada job `running`).
   3. Aksi: batalkan job, ulangi job gagal, lihat detail.

4. **Detail Job** (`/admin/price-ingest/jobs/[id]`)
   1. Daftar listing hasil job beserta varian ternormalisasi.
   2. Tombol "Lihat JSON mentah" untuk debug.
   3. Tombol "Proses ulang" untuk menjalankan ulang parsing dengan parser versi terbaru.

5. **Antrean Review** (`/admin/price-ingest/review`)
   1. Setiap baris menampilkan: judul asli, label varian asli, hasil normalisasi (RAM/storage/harga), device kandidat, confidence.
   2. Aksi per baris: Setujui, Ganti device (combobox pencarian device), Koreksi RAM/storage, Tolak.
   3. Aksi massal untuk baris yang dipilih.
   4. Filter: marketplace, rentang confidence, brand.
   5. Pintasan keyboard untuk setujui dan tolak agar review cepat.

6. **Riwayat Harga** (`/admin/price-ingest/prices`)
   1. Cari device, lihat harga per kombinasi RAM/storage per marketplace.
   2. Grafik tren harga sederhana.

7. **Pengaturan** (`/admin/price-ingest/settings`)
   1. Aktif/nonaktif per marketplace.
   2. Rate limit dan batas halaman per marketplace.
   3. Ambang batas confidence dan saklar auto-approve.
   4. Daftar kata yang dihapus saat pembersihan judul.

---

## 9. Aturan Keamanan, Etika, dan Keandalan

1. Rate limit per marketplace wajib dipatuhi, ditambah jeda acak 20 sampai 50 persen dari nilai dasar.
2. Satu worker hanya menjalankan satu job per marketplace dalam satu waktu.
3. Jika menerima respons blokir (HTTP 403/429, halaman captcha), job dihentikan dengan status `failed` dan pesan jelas. Jangan mencoba bypass captcha.
4. Tidak menyimpan data pribadi (nama pembeli, ulasan dengan identitas). Cukup data produk, toko, dan harga.
5. Semua fitur scraping bisa dimatikan total lewat satu saklar di pengaturan.
6. Log setiap job: jumlah request, durasi, error. Simpan cukup untuk debugging, bukan seluruh HTML.
7. Kredensial (API key OpenRouter, koneksi database) hanya dari environment variable.
8. Tambahkan catatan di README worker bahwa scraping marketplace berpotensi melanggar syarat layanan platform, dan sumber data resmi (program afiliasi, feed produk) lebih disarankan untuk penggunaan produksi jangka panjang.

---

## 10. Titik Ekstensi: Sumber Data Non-Scraping

Rancang pipeline agar sumber data tidak harus berasal dari scraper:
1. Sediakan adapter `csv_import` yang menerima file CSV (kolom: marketplace, url, title, variant_label, price_idr, stock).
2. Data dari impor CSV masuk ke `raw_listings` dengan `job_type = 'import'` dan melewati pipeline normalisasi dan matching yang sama.
3. Tujuannya agar data dari program afiliasi atau feed resmi bisa masuk tanpa mengubah pipeline.

---

## 11. Rencana Tiket Implementasi

Kerjakan berurutan. Setiap tiket harus lulus test sebelum lanjut.

1. **PI-01** Migrasi database: seluruh tabel di bagian 4 beserta indeks dan seed tabel `marketplaces`.
2. **PI-02** Modul normalisasi varian (Python) beserta unit test dari tabel kasus uji di bagian 6. Belum ada LLM fallback.
3. **PI-03** Kerangka worker: polling `scrape_jobs`, update status, logging, rate limiter, penanganan error blokir.
4. **PI-04** Adapter Blibli (`fetch_product`, `extract_variants`), diuji dengan 5 URL produk HP nyata. Simpan contoh payload sebagai fixture test.
5. **PI-05** Pipeline matching: pembersihan judul, fuzzy match, embedding match, validasi varian, perhitungan confidence.
6. **PI-06** Admin UI: Dashboard, Buat Job, Daftar Job, Detail Job.
7. **PI-07** Admin UI: Antrean Review beserta aksi setujui, ganti device, koreksi, tolak, aksi massal.
8. **PI-08** Penulisan ke `price_history` dari hasil `approved`/`auto_approved` dan halaman Riwayat Harga.
9. **PI-09** LLM fallback untuk normalisasi dan tie-breaker matching via OpenRouter, dengan batas biaya per job.
10. **PI-10** Adapter Tokopedia beserta fixture test.
11. **PI-11** Halaman Pengaturan dan saklar global.
12. **PI-12** Adapter impor CSV.
13. **PI-13** Adapter Shopee (default nonaktif), hanya dikerjakan setelah semua tiket di atas stabil.

---

## 12. Definition of Done

1. Semua unit test normalisasi lulus, termasuk kasus uji di bagian 6.
2. Adapter yang dibuat punya fixture payload asli dan test `extract_variants` yang tidak memerlukan akses internet.
3. Job yang gagal menampilkan pesan error yang bisa dipahami admin.
4. Tidak ada harga yang tampil di sisi publik tanpa melewati status `approved` atau `auto_approved`.
5. Data mentah bisa diproses ulang dari halaman Detail Job.
6. Tidak ada kredensial di dalam kode.

---

## 13. Open Questions

Isi bagian ini selama implementasi jika menemukan hal yang belum jelas:
1. Lokasi hosting worker Python (lokal, VPS, atau layanan container).
2. Model embedding yang dipakai tabel `devices` saat ini.
3. Frekuensi update harga yang diinginkan (manual saja, atau terjadwal harian).
4. Sistem role admin yang sudah ada dan cara memeriksanya di route.
