# ADS-CONTEXT.md — Modul Monetisasi Iklan CekHarga

> File konteks untuk AI coding agent (Claude Code, dsb.) dan developer.
> Letakkan di `docs/ads/ADS-CONTEXT.md`, lalu tambahkan baris berikut di `CLAUDE.md` utama:
>
> ```
> ## Modul Iklan
> Sebelum mengerjakan apa pun terkait iklan, banner, sponsor, slot, kampanye, atau laporan iklan,
> baca @docs/ads/ADS-CONTEXT.md dan ikuti seluruh aturan di dalamnya.
> ```

---

## 1. Konteks Bisnis

1. CekHarga adalah platform informasi produk dan perbandingan harga (HP, laptop, tablet, iPad) untuk konsumen Indonesia.
2. Pengelola: **PT Sinteniki Digital Solusi** (agensi digital di Yogyakarta, fokus ORM dan SEO).
3. Traffic situs sudah tinggi, sehingga ruang iklan menjadi sumber pendapatan utama di samping fitur inti.
4. Model monetisasi yang dipakai (berurutan sesuai prioritas penayangan):
    1. **Direct Selling**: slot dijual langsung ke brand/agensi, diikat PKS + Insertion Order (IO). Harga paling tinggi.
    2. **Sponsored Listing**: produk brand tampil di posisi khusus dengan label "Sponsor".
    3. **Fallback programatik**: slot yang tidak terjual diisi Google AdSense (fase 1) atau Google Ad Manager + AdX (fase 2).
5. Google Ads **bukan** bagian sistem ini. Google Ads adalah alat untuk pembeli iklan, sedangkan CekHarga adalah penjual ruang iklan.

## 2. Prinsip yang Tidak Boleh Dilanggar

1. **Independensi data harga.** Iklan dan sponsor tidak boleh memengaruhi data harga, skor, ulasan, maupun urutan hasil perbandingan organik. Query perbandingan harga tidak boleh membaca tabel iklan.
2. **Label wajib.** Setiap elemen iklan menampilkan label "Iklan" atau "Sponsor" yang terlihat jelas dan tidak bisa dimatikan lewat konfigurasi kampanye.
3. **Sponsored listing terpisah.** Kartu sponsor ditempatkan di slot khusus (misalnya posisi 1 dan 6 dalam grid) dan tidak menggantikan atau menggeser data organik secara diam-diam.
4. **Performa halaman.** Slot iklan wajib memesan ruang (fixed width/height) untuk mencegah layout shift (CLS), memakai lazy load, dan tidak memblokir render konten utama.
5. **Privasi (UU PDP No. 27/2022).** Laporan untuk brand hanya berisi data agregat. Tidak ada data pribadi pengunjung di tabel event. Script iklan pihak ketiga hanya dimuat setelah consent cookie.
6. **Kejujuran angka.** Tayangan dan klik dari bot, crawler, atau perilaku tidak wajar tidak dihitung dalam laporan dan tagihan.
7. **Kepatuhan isi iklan.** Kategori terlarang ditolak sejak tahap review: judi, pinjol ilegal, obat terlarang, konten dewasa, klaim menyesatkan.

## 3. Istilah (Glossary)

| Istilah | Arti dalam sistem |
| --- | --- |
| Advertiser | Brand atau agensi yang membeli iklan |
| PKS | Perjanjian Kerja Sama, kontrak payung dengan advertiser |
| IO (Insertion Order) | Rincian satu kampanye: slot, periode, target, harga |
| Line Item | Satu baris dalam IO, terikat ke satu slot dan satu skema harga |
| Creative | File materi iklan (gambar, teks, tautan tujuan) |
| Slot | Posisi iklan di halaman, punya ukuran tetap |
| Impression | 1 kali iklan tampil. Dihitung saat minimal 50% area iklan terlihat selama 1 detik |
| Click | 1 kali klik yang melewati endpoint redirect |
| CPM / CPC / Flat fee | Harga per 1.000 tayangan / per klik / per periode |
| CTR | Klik dibagi tayangan, dalam persen |
| Fill rate | Persentase permintaan slot yang terisi iklan |
| eCPM | Pendapatan per 1.000 tayangan dari semua sumber |
| Make-good | Kompensasi tayang tambahan jika iklan gagal tayang karena kesalahan CekHarga |

## 4. Inventaris Slot (Awal)

| Kode slot | Halaman | Desktop | Mobile | Jenis |
| --- | --- | --- | --- | --- |
| `home_top` | Beranda | 728 × 90 | 320 × 100 | Banner |
| `home_mid` | Beranda | 970 × 250 | 300 × 250 | Banner |
| `search_sponsored` | Hasil pencarian | Kartu produk | Kartu produk | Sponsored listing |
| `product_sidebar` | Detail produk | 300 × 250 | – | Banner |
| `product_inline` | Detail produk | 728 × 90 | 320 × 50 | Banner |
| `compare_bottom` | Halaman perbandingan | 728 × 90 | 320 × 50 | Banner |

Inventaris disimpan di database (tabel `ad_slots`), bukan hard-code, agar tim Ad Ops bisa menonaktifkan atau menambah slot tanpa deploy.

## 5. Pemetaan Alur Bisnis ke Fitur Sistem

Alur 12 langkah Direct Selling dan modul sistem yang mendukungnya:

| No | Langkah bisnis | Penanggung jawab | Fitur / modul sistem |
| --- | --- | --- | --- |
| 1 | Media kit & rate card | Sales | Halaman `/iklan` publik + generator media kit dari data GA4 |
| 2 | Prospek | Sales | CRM ringan: daftar advertiser + status prospek |
| 3 | Brief & proposal | Sales | Form brief + template proposal (PDF) |
| 4 | Negosiasi | Sales | Status IO `draft` → `negotiation` |
| 5 | PKS + IO | Legal | Upload PKS bertanda tangan, IO `approved` |
| 6 | Invoice uang muka | Finance | Generate invoice DP, status `awaiting_payment` |
| 7 | Materi & review | Ad Ops | Upload creative, checklist review, status `approved/rejected` |
| 8 | Setup iklan (trafficking) | Ad Ops | Aktivasi line item ke slot + jadwal |
| 9 | Tayang & monitoring | Ad Ops | Ad serving + dashboard real-time + log gangguan |
| 10 | Laporan performa | Ad Ops | Laporan otomatis (PDF/CSV) + portal advertiser read-only |
| 11 | Pelunasan | Finance | Invoice akhir, catat bukti potong PPh 23 |
| 12 | Evaluasi & perpanjangan | Sales | Duplikasi IO menjadi kampanye baru |

## 6. Model Data (PostgreSQL / InsForge)

```sql
-- Pihak pembeli iklan
create table advertisers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  npwp text,
  contact_name text,
  contact_email text,
  contact_phone text,
  prospect_status text not null default 'lead', -- lead | proposal | active | inactive
  created_at timestamptz default now()
);

-- Kontrak payung (PKS)
create table contracts (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid references advertisers(id),
  contract_number text unique not null,         -- 001/PKS-IKL/CH/X/2026
  start_date date not null,
  end_date date not null,
  signed_file_url text,
  status text not null default 'draft'          -- draft | signed | ended | terminated
);

-- Rincian kampanye (Insertion Order)
create table insertion_orders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id),
  io_number text unique not null,
  campaign_name text not null,
  status text not null default 'draft',
  -- draft | negotiation | approved | awaiting_payment | ready | live | completed | cancelled
  total_amount bigint not null default 0,       -- rupiah, tanpa desimal
  tax_included boolean default false
);

-- Inventaris slot
create table ad_slots (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                    -- home_top, product_sidebar, ...
  page text not null,
  kind text not null,                           -- banner | sponsored_listing
  desktop_size text,                            -- "728x90"
  mobile_size text,
  is_active boolean default true,
  fallback text default 'adsense'               -- adsense | gam | house | none
);

-- Baris IO: satu slot, satu skema harga
create table line_items (
  id uuid primary key default gen_random_uuid(),
  io_id uuid references insertion_orders(id),
  slot_id uuid references ad_slots(id),
  pricing_model text not null,                  -- flat | cpm | cpc
  rate bigint not null,                         -- harga per unit (rupiah)
  target_quantity integer,                      -- target tayangan/klik, null untuk flat
  start_at timestamptz not null,
  end_at timestamptz not null,
  priority integer default 10,                  -- angka kecil = prioritas tinggi
  status text not null default 'pending'        -- pending | active | paused | ended
);

-- Materi iklan
create table creatives (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid references line_items(id),
  image_url text,
  alt_text text not null,
  destination_url text not null,                -- sudah termasuk UTM
  review_status text default 'pending',         -- pending | approved | rejected
  review_note text
);

-- Event tayangan & klik (tanpa data pribadi)
create table ad_events (
  id bigserial primary key,
  creative_id uuid references creatives(id),
  slot_id uuid references ad_slots(id),
  event_type text not null,                     -- impression | click
  device text,                                  -- desktop | mobile
  is_bot boolean default false,
  dedupe_key text,                              -- hash(sesi anonim + creative + menit)
  created_at timestamptz default now()
);
create index on ad_events (creative_id, event_type, created_at);

-- Tagihan
create table invoices (
  id uuid primary key default gen_random_uuid(),
  io_id uuid references insertion_orders(id),
  invoice_number text unique not null,
  kind text not null,                           -- down_payment | final
  amount bigint not null,
  due_date date not null,
  status text default 'unpaid',                 -- unpaid | paid | overdue
  pph23_proof_url text
);
```

Catatan:

1. Nominal uang disimpan sebagai `bigint` rupiah, tidak memakai `float`.
2. `ad_events` hanya menyimpan data anonim. Laporan dibuat dari agregasi harian (tabel atau materialized view `ad_daily_stats`).
3. Tabel iklan tidak boleh di-join ke query perbandingan harga organik (lihat Prinsip 1).

## 7. Peran dan Hak Akses

| Peran | Hak akses utama |
| --- | --- |
| `admin` | Semua akses, termasuk pengaturan slot dan pengguna |
| `sales` | Advertiser, proposal, draft IO |
| `adops` | Creative review, aktivasi line item, monitoring, laporan |
| `finance` | Invoice, pembayaran, data pajak |
| `legal` | Upload dan verifikasi PKS |
| `advertiser` | Portal read-only: kampanye miliknya sendiri dan laporannya |

## 8. Arsitektur Teknis Penayangan

1. **Komponen `<AdSlot code="product_sidebar" />`** (shadcn/ui, tema indigo/amber/sage):
    1. Memesan ruang sesuai ukuran slot agar tidak terjadi layout shift.
    2. Meminta keputusan iklan ke `GET /api/ads/decide?slot=...&device=...`.
    3. Jika ada creative direct aktif, render creative tersebut beserta label "Iklan".
    4. Jika kosong, render fallback sesuai kolom `ad_slots.fallback` (AdSense/GAM), hanya setelah consent cookie.
2. **Ad decision (server):** pilih line item `active` dalam rentang waktu, prioritas tertinggi, target belum tercapai. Jika beberapa setara, rotasi berbobot. Hasil boleh di-cache singkat (misalnya 60 detik).
3. **Impression:** dikirim dengan `navigator.sendBeacon` ke `POST /api/ads/impression` setelah IntersectionObserver mendeteksi minimal 50% area terlihat selama 1 detik.
4. **Click:** tautan iklan mengarah ke `GET /api/ads/click/[creativeId]`, mencatat event, lalu redirect 302 ke `destination_url`.
5. **Anti-bot:** cek user agent crawler, rate limit per sesi anonim, dan dedupe per menit. Event mencurigakan ditandai `is_bot = true`, bukan dihapus.
6. **ads.txt:** disajikan di root domain (`/ads.txt`), isinya dikelola dari konfigurasi.
7. **Fase lanjut:** jika volume direct sudah besar, ad decision dipindahkan ke Google Ad Manager (Google Publisher Tag), sementara modul CRM, IO, invoice, dan laporan tetap di sistem internal.

## 9. Struktur Folder (Saran)

```
apps/web/
  app/(public)/iklan/            # halaman media kit & kontak sales
  app/(admin)/ads/               # dashboard internal Sinteniki
    advertisers/
    orders/                      # IO + line items
    creatives/                   # review materi
    slots/
    reports/
    invoices/
  app/(advertiser)/portal/       # portal read-only brand
  app/api/ads/
    decide/route.ts
    impression/route.ts
    click/[creativeId]/route.ts
  components/ads/
    AdSlot.tsx
    SponsoredCard.tsx
    AdLabel.tsx
packages/ads-core/               # logika ad decision, perhitungan tagihan, agregasi laporan
docs/ads/ADS-CONTEXT.md          # file ini
```

## 10. Tahapan Implementasi

1. **Fase 1 — Fondasi (siap jualan):** tabel `ad_slots`, komponen `<AdSlot>` dengan fallback AdSense, `ads.txt`, consent cookie, halaman `/iklan` (media kit).
2. **Fase 2 — Direct Selling:** advertiser, IO, line item, creative review, ad decision, tracking impression/click, label wajib.
3. **Fase 3 — Operasional:** laporan otomatis PDF/CSV, invoice DP dan pelunasan, portal advertiser.
4. **Fase 4 — Skala:** sponsored listing, integrasi Google Ad Manager, eCPM dashboard (direct vs programatik).

## 11. Aturan untuk AI Agent

1. Baca file ini sebelum menyentuh kode terkait iklan.
2. Jangan pernah menambahkan logika yang membuat status iklan atau sponsor memengaruhi urutan, skor, atau harga produk organik.
3. Setiap komponen iklan baru wajib memakai `<AdLabel />`.
4. Jangan menyimpan IP mentah, email, atau identitas pengunjung di `ad_events`.
5. Uang selalu `bigint` rupiah. Perhitungan tagihan CPM: `round(impressions_valid / 1000 * rate)`.
6. Script pihak ketiga (AdSense/GAM) hanya dimuat lewat komponen consent, tidak langsung di `layout`.
7. Perubahan skema database dibuat sebagai migration baru, tidak mengedit migration lama.
8. Jika kebutuhan bisnis tidak jelas, tulis pertanyaan di bagian "Pertanyaan Terbuka" dan jangan mengarang aturan bisnis.

## 12. Keputusan (2026-10-01)

Pertanyaan terbuka sebelumnya sudah dijawab dengan rekomendasi praktik standar. Keputusan bisnis yang belum final ditandai **menunggu konfirmasi**.

### 12.1 Jawaban atas pertanyaan terbuka

1. **Batas sponsored listing.** Maksimal 2 kartu sponsor per halaman hasil, berlabel "Sponsor", disisipkan sebagai kartu tambahan, tidak menggantikan atau menggeser posisi produk organik. Dikerjakan pada Fase 4.
2. **Sumber data laporan.** Sistem internal (`ad_events`) adalah sumber resmi tagihan, karena bisa diaudit per event. GA4 hanya untuk data audiens di media kit. Bila brand meminta verifikasi pihak ketiga (IAS, DoubleVerify), angka tersebut dicantumkan sebagai pembanding dan selisih di atas 10% dibahas lewat make-good.
3. **Persetujuan creative.** Ad Ops menyetujui creative memakai checklist review. Kategori sensitif (keuangan, kesehatan) dan advertiser baru wajib eskalasi ke peran `admin`.
4. **Status PKP.** **Menunggu konfirmasi** dari Finance. Sistem menyimpan `tax_included` per IO dan tarif PPN sebagai konfigurasi, nonaktif sampai status PKP pasti.
5. **Metode bayar.** Transfer bank berbasis invoice (norma B2B, mendukung faktur pajak dan bukti potong PPh 23). Payment gateway dipertimbangkan setelah volume transaksi besar.

### 12.2 Konflik dengan PRD dan AGENTS.md

1. **Cakupan produk.** PRD v1 hanya smartphone. Modul iklan tetap bebas kategori, tetapi slot hanya ada di halaman yang sudah ada.
2. **Sponsored listing.** Mengikuti 12.1 butir 1. Tidak ada kartu sponsor sebelum Fase 4.
3. **Fallback programatik (AdSense/GAM).** Infrastruktur disiapkan (kolom `ad_slots.fallback`, banner consent, `ads.txt`), tetapi default setiap slot `none`. AdSense hanya dimuat bila ID publisher sudah diisi, slot di-set `adsense`, dan pengunjung memberi consent iklan.
4. **Tema warna.** Komponen iklan memakai token desain yang sudah ada di `src/app/globals.css`: CTA charcoal (`--primary`, keputusan 2026-10-07 di PRD §8) dan aksen teal (`--brand`). CTA iklan native memakai `buttonVariants()` agar sama dengan tombol situs. Usulan "indigo/amber/sage" ditunda sampai pemilik produk meminta perubahan tema.
5. **Klaim trafik.** Media kit `/iklan` tidak menampilkan angka trafik sampai ada sumber terukur (GA4 atau `ad_events`). Angka tidak boleh dikarang.
6. **Struktur folder.** Repo bukan monorepo. Padanannya: `src/lib/ads/` (pengganti `packages/ads-core`), `src/app/admin/(workspace)/iklan/`, `src/app/(public)/iklan/`, `src/app/api/ads/`, `src/components/ads/`.

### 12.3 Keputusan teknis

1. **Rail 160×600.** Tetap ada sebagai slot `rail_left` dan `rail_right` di `ad_slots` (ukuran standar IAB), default nonaktif. Ad Ops bisa mengaktifkannya tanpa deploy.
2. **Peran pengguna.** Satu penyedia identitas (InsForge Auth). Staf memakai kolom `role` di `admin_users` (`admin`, `sales`, `adops`, `finance`, `legal`). Portal advertiser memakai tabel terpisah `advertiser_users` pada Fase 3, supaya akun brand tidak pernah punya akses staf.
3. **Retensi event.** `ad_events` disimpan 90 hari. Fungsi `ad_rollup_and_purge()` meringkas event ke `ad_stats_daily` lalu menghapus event yang lebih lama. View `ad_daily_report` menggabungkan keduanya, sehingga laporan tetap utuh walaupun job belum berjalan.
4. **Penjadwalan.** Job harian memanggil `POST /api/ads/maintenance` dengan header `Authorization: Bearer <ADS_CRON_SECRET>` lewat InsForge Schedules (cron `0 1 * * *`, 08.00 WIB). Job baru bisa dibuat setelah aplikasi punya URL publik.
5. **Keputusan iklan.** Render utama di server (SSR) agar tanpa CLS dan tanpa request tambahan. `GET /api/ads/decide` tetap tersedia untuk klien lain.
6. **Format native.** Tabel `creatives` ditambah kolom opsional `format`, `headline`, `body`, `cta_label`, dan `logo_url` untuk iklan native di slot in-feed. Label "Iklan" tetap wajib.
7. **Slot tambahan.** Selain inventaris awal di bagian 4, ditambahkan `catalog_top` (970×90 / 320×100) dan `catalog_infeed` (native atau 1200×150) karena katalog adalah halaman dengan trafik terbanyak.

## 13. Pertanyaan Terbuka

1. Status PKP PT Sinteniki Digital Solusi dan tarif PPN yang berlaku pada invoice.
2. ID publisher AdSense, bila programatik akan dipakai.
3. Alamat email atau WhatsApp tim sales untuk halaman `/iklan`.

## 14. Implementasi (2026-10-02)

Ringkasan kode yang mewujudkan dokumen ini. Ubah bagian ini setiap kali struktur berubah.

### 14.1 Database

- `migrations/20261001120000_ads-normalized-model.sql`: seluruh tabel di §6 plus `ad_slots`, `ad_stats_daily`, `ad_rate_card`, `ads_txt_entries`, `ad_settings`, view `ad_daily_report`, fungsi `ad_rollup_and_purge`, dan tiga fungsi publik `ad_live_creatives()`, `ad_active_slots()`, `ad_ads_txt()` (SECURITY DEFINER, satu-satunya jalur baca anon). Semua tabel ber-RLS dan tertutup untuk anon.
- `migrations/20261001130000_ad-events-dedupe-index.sql`: indeks unik `dedupe_key` dibuat non-parsial agar `upsert ... ignoreDuplicates` bisa dipakai. NULL tetap boleh berulang.

### 14.2 Penyajian publik

| Bagian | Berkas |
| --- | --- |
| Keputusan iklan (prioritas → rotasi berbobot, targeting merek, sisa target, cache 60 detik bertag `ads`) | `src/lib/ads/decision.ts` |
| Pencatatan event (HMAC dedupe, tanda bot, tanpa PII) | `src/lib/ads/events.ts` |
| Komponen `<AdSlot code>`, `<AdBand>`, `<AdRails>`, `<AdLabel>` | `src/components/ads/` |
| Viewable impression (IntersectionObserver ≥50% ≥1 detik, sendBeacon) | `src/components/ads/ad-view-tracker.tsx` |
| Banner consent + AdSense (hanya bila ID penerbit diisi) | `consent-banner.tsx`, `consent-store.ts`, `adsense-unit.tsx` |
| API | `POST /api/ads/impression`, `GET /api/ads/click/[creativeId]` (302, tujuan dari DB), `GET /api/ads/decide`, `POST /api/ads/maintenance` (Bearer `ADS_CRON_SECRET`) |
| ads.txt | `src/app/ads.txt/route.ts` |
| Media kit + form prospek | `src/app/(public)/iklan/page.tsx`, `src/lib/ads/lead-actions.ts` |

Penempatan slot: beranda (`home_top` setelah hero, `home_mid` setelah etalase produk), katalog (`catalog_top`, `catalog_infeed` setelah 10 produk), detail produk (`product_inline` setelah penawaran, `product_sidebar` di kolom kanan, khusus layar lebar), perbandingan (`compare_bottom`), dan rail di layout publik (≥1680 px). Slot tanpa iklan tidak merender apa pun.

### 14.3 Admin (`/admin/iklan`)

| Halaman | Isi | Peran tulis |
| --- | --- | --- |
| Ringkasan | KPI 7 hari, line item berjalan, nilai tertagih | – |
| Advertiser & PKS | CRM, unggah PKS (PDF ke bucket privat `ad-contracts`, dibuka lewat signed URL 5 menit yang tercatat di audit), buat IO | sales, legal |
| Detail IO | Alur status, line item, unggah materi (rasio divalidasi terhadap slot), invoice | sales, legal, finance, adops sesuai langkah |
| Review materi | Checklist wajib; advertiser baru dan kategori sensitif hanya bisa disetujui `admin` | adops |
| Laporan | Per line item dan harian (WIB), ekspor CSV aman dari injeksi formula | – |
| Slot & rate card | Aktif/nonaktif slot, fallback, tarif media kit | adops (slot), sales (tarif) |
| Pengaturan | PPN, kontak sales, ID AdSense, entri ads.txt | admin |

Alur status IO dan peran yang boleh mengubahnya ada di `IO_TRANSITIONS` (`src/lib/ads/admin-schema.ts`). Bahkan `admin` tidak bisa melompati langkah.

### 14.4 Variabel lingkungan

`ADS_EVENT_SECRET`, `ADS_CRON_SECRET`, `CEKHARGA_AD_PREVIEW`, `ADSENSE_SLOT_<KODE_SLOT>`. Penjelasannya ada di `.env.example`.

### 14.5 Keterbatasan yang diketahui

1. ~~Halaman admin lain masih memakai `requireAdmin()`.~~ Selesai (2026-10-06): produk, impor, dan tarik otomatis memakai `requireStaff([])` (hanya `admin`). Form login tidak lagi mengunci satu email, dan akses peran `sales` sudah diuji di browser (iklan terbuka, impor/produk ditolak).
2. Batas kiriman form prospek disimpan di memori proses. Di hosting serverless dengan banyak instance, batas ini hanya meredam spam, bukan perlindungan penuh.
3. Job harian `ad_rollup_and_purge` belum dijadwalkan karena aplikasi belum punya URL publik (lihat 12.3 butir 4). Laporan tetap utuh tanpa job ini.
4. Materi diunggah oleh Ad Ops. Portal advertiser direncanakan pada Fase 3.
