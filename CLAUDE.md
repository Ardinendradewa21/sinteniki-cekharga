@AGENTS.md

## Modul Iklan
Sebelum mengerjakan apa pun terkait iklan, banner, sponsor, slot, kampanye, atau laporan iklan,
baca @docs/ads/ADS-CONTEXT.md dan ikuti seluruh aturan di dalamnya.

## Aturan System Design (wajib diikuti)

Ditetapkan pemilik produk pada 9 Oktober 2026 dan berlaku selama masa pengembangan. Celah kode lama terhadap aturan ini dicatat di `docs/qa/BACKLOG.md` (PB-18 sampai PB-22).

1. Rate limit & kuota: semua endpoint yang memanggil LLM wajib punya rate limit per IP/user dan kuota harian. Jangan buat endpoint AI tanpa pembatas.
2. Caching: data spesifikasi pakai cache-aside dengan TTL panjang. Cache harga WAJIB di-invalidate setiap kali scraper menyimpan harga baru. Tampilkan timestamp "terakhir diperbarui" pada setiap harga.
3. Background job: scraping, normalisasi, dan regenerasi embedding tidak boleh berjalan di dalam request user. Status job dicatat di tabel scrape_jobs.
4. Query: dilarang query database di dalam loop (N+1). Gunakan JOIN atau include. Laporkan jika menemukan pola N+1 di kode lama.
5. Authorization: setiap endpoint admin dan dashboard iklan wajib mengecek hak akses di server, bukan hanya menyembunyikan tombol di UI. Gunakan UUID untuk ID kampanye iklan dan resource milik brand.
6. Idempotency: penyimpanan price_history dan job scraping harus aman jika dijalankan ulang (gunakan unique constraint/upsert).
7. Kegagalan layanan luar: panggilan ke OpenRouter dan marketplace wajib punya timeout, retry terbatas dengan backoff, dan fallback. Dilarang retry tanpa batas.
8. Penghapusan data: produk, toko, dan kampanye iklan memakai soft delete (deleted_at). raw_listings dihapus permanen setelah masa retensi. price_history tidak dihapus.
9. Git: kerjakan setiap tiket di branch terpisah dan commit sebelum perubahan besar.

Padanan nama di kode saat ini: `price_history` = tabel `price_observations` (riwayat harga) dan `price_checks` (riwayat pemeriksaan). Soft delete (PB-18, migrasi `20261009120000_soft-delete.sql`): `deleted_at` di `products`, `offers`, `stores`, `insertion_orders`; `voided_at` di `price_observations` dan `price_checks`. Trigger menolak DELETE pada keenam tabel itu. Helper `selectWhereIn`/`selectAll` otomatis menyaring baris terhapus (opsi `includeDeleted` untuk pengecualian); query `.from()` langsung wajib menambah `.is("deleted_at", null)` atau `.is("voided_at", null)` sendiri. Data uji QA dibersihkan lewat RPC `qa_purge_test_data()`. Job impor dan scraping saat ini tercatat di `import_batches`/`import_items` (status `analyzing` untuk unggahan yang dianalisis di worker), `scrape_sessions`, dan `photo_jobs`. Baris mentah impor ada di `raw_listings` (role `upload`/`row`/`follow_up`, retensi 30 hari lewat `import_purge_raw_listings`), bukan lagi di `import_batches.rows`. Tarik otomatis berjalan sebagai job di `scrape_jobs` (PB-19 selesai 2026-10-11): aksi admin hanya mengantrekan dan membaca status, worker (`processScrapeStep`, dipicu `after()`, worker per menit, dan cron harian) mengambil situs resmi/GSMArena, dan klaim `scrape_claim_job` hanya membolehkan satu job per jenis berjalan di seluruh instance. Skrip operasional yang menulis harga harus lewat endpoint aplikasi (mis. `/api/cron/daily`), bukan skrip Node langsung, karena hanya di dalam aplikasi cache katalog ikut di-invalidate (aturan 2).
