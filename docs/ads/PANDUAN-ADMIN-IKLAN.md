# Panduan Admin: Memasang Iklan di CekHarga

Panduan langkah demi langkah untuk staf CekHarga yang memasang iklan lewat panel admin (`/admin/iklan`). Aturan bisnis dan teknis lengkapnya ada di [ADS-CONTEXT.md](ADS-CONTEXT.md).

## Sebelum mulai

- Akun dengan peran `admin` bisa mengerjakan semua langkah. Peran lain dibatasi: `sales` (advertiser, IO), `legal` (PKS), `finance` (pembayaran, invoice), `adops` (line item, materi, review).
- Siapkan:
  - PKS bertanda tangan dalam bentuk PDF (maksimal 10 MB).
  - Materi iklan sesuai ukuran slot (tabel di bawah).
  - URL tujuan https yang sudah diberi UTM.
- Iklan tidak boleh memengaruhi harga, urutan, atau ulasan produk. Label "Iklan" selalu tampil dan tidak bisa dimatikan.

## Ukuran materi per slot

| Slot | Halaman | Desktop | Ponsel |
|---|---|---|---|
| Beranda atas | Beranda | 728×90 | 320×100 |
| Beranda tengah | Beranda | 970×250 | 300×250 |
| Katalog atas | Katalog | 970×90 | 320×100 |
| Katalog di sela hasil | Katalog (setelah 10 produk) | native (judul + gambar) | native |
| Detail produk tengah | Detail produk | 728×90 | 320×50 |
| Detail produk samping | Detail produk, layar lebar | 300×250 | tidak tampil |
| Perbandingan bawah | Perbandingan | 728×90 | 320×50 |

Ketentuan materi:

- Format PNG, JPG, WebP, atau GIF, maksimal 500 KB.
- Ukuran boleh 2× untuk layar retina (mis. 1456×180 untuk 728×90). Rasionya harus sama dengan ukuran slot.
- Sisakan area kosong ±64×32 px di **kiri atas** untuk label "Iklan". Pengecualian: banner ponsel 320×50, karena labelnya tampil di strip terpisah di atas materi.
- Gambar ponsel wajib bila rasio ponsel berbeda dari desktop. Formulir menuliskan "wajib untuk display" pada slot seperti itu.
- Tidak boleh memuat kata "terbaik", peringkat, klaim harga yang tidak bisa dibuktikan, atau kategori terlarang (judi, pinjol ilegal, obat terlarang, konten dewasa).

## Langkah 1: Advertiser

1. Buka **Iklan → Advertiser & PKS**, lalu tambah advertiser.
2. Isi **Nama perusahaan** dan **Nama merek di label iklan**. Nama merek tampil di iklan native, misalnya "Samsung".

## Langkah 2: PKS

1. Buka halaman advertiser, lalu isi formulir **Tambah PKS**: nomor PKS, tanggal mulai dan selesai, serta PDF bertanda tangan. Klik **Simpan PKS**.
2. Di tabel PKS, ubah **Status** menjadi **Ditandatangani**, lalu klik **Perbarui**.

Status ini wajib: IO tidak bisa disetujui sebelum PKS ditandatangani.

## Langkah 3: Insertion Order (IO)

1. Masih di halaman advertiser, isi formulir **Buat IO**: pilih PKS, nomor IO, nama kampanye, dan nilai IO.
2. Klik **Buat IO**. Halaman pindah ke detail IO.
3. Ubah status secara berurutan dengan tombol **Ubah ke …**: Negosiasi, Disetujui, Menunggu pembayaran, lalu Siap tayang. Langkah tidak bisa dilompati, termasuk oleh admin.
4. Bila ada uang muka, buat invoice di bagian **Invoice** sebelum menandai Siap tayang.

## Langkah 4: Line item (satu per slot)

Di detail IO, isi formulir **Tambah line item**:

| Kolom | Isi |
|---|---|
| Slot | Posisi iklan (lihat tabel ukuran). |
| Model harga | **Flat** (total per periode), **CPM** (per 1.000 tayangan), atau **CPC** (per klik). |
| Tarif (Rp) | Angka tanpa desimal, mis. `2.500.000`. |
| Target tayangan/klik | Wajib untuk CPM/CPC. Iklan berhenti tayang saat target tercapai. |
| Target merek | Opsional. Isi mis. `Samsung` supaya iklan hanya tampil di halaman produk Samsung dan katalog yang disaring ke Samsung. Kosong berarti tampil di semua halaman. |
| Mulai / Selesai (WIB) | Jadwal tayang. |
| Prioritas | 1 = tertinggi. Iklan berbayar biasanya 1 sampai 10; iklan internal (house ad) 90. |
| Bobot | Pembagian rotasi bila beberapa iklan berprioritas sama. |

Cara memilih iklan untuk satu slot: prioritas tertinggi menang lebih dulu. Bila prioritasnya sama, iklan yang menargetkan merek halaman itu didahulukan. Sisanya dirotasi menurut bobot.

## Langkah 5: Unggah materi

1. Di kotak line item, buka **Unggah materi**.
2. Isi formulir:
   - Format: **Display** (gambar banner) atau **Native**. Native hanya untuk slot Katalog di sela hasil.
   - URL tujuan https dengan UTM, mis. `https://brand.co.id/promo?utm_source=cekharga&utm_medium=display&utm_campaign=nama_kampanye`.
   - Gambar desktop, dan gambar ponsel bila diminta.
   - Teks alternatif yang menjelaskan isi gambar.
   - Khusus native: judul (maks. 90 karakter), deskripsi (maks. 200), teks tombol (maks. 30), dan logo (opsional).
3. Klik **Unggah ke antrean review**.

## Langkah 6: Review materi

1. Buka **Iklan → Review materi**.
2. Periksa materi, lalu centang kelima butir checklist.
3. Centang **Kategori sensitif** bila materi menyangkut keuangan atau kesehatan.
4. Klik **Setujui**, atau **Tolak** dengan catatan alasan.

Materi pertama dari advertiser baru dan materi kategori sensitif hanya bisa disetujui peran `admin`.

## Langkah 7: Tayangkan

1. Di detail IO, klik **Aktifkan** pada setiap line item.
2. Klik **Ubah ke Tayang** pada IO.
3. Iklan muncul di situs dalam waktu sekitar 1 menit. Cek dengan membuka halaman slotnya, misalnya beranda untuk Beranda atas.

Bila iklan tidak muncul, periksa empat hal:

- Jadwal line item sudah berjalan.
- Materi berstatus Disetujui.
- Line item berstatus Aktif, dan IO berstatus Siap tayang atau Tayang.
- Slot aktif di **Iklan → Slot & rate card**.

Untuk iklan bertarget merek, buka halaman produk merek itu.

## Langkah 8: Pantau, hentikan, dan tutup

- **Iklan → Ringkasan** menampilkan tayangan dan klik 7 hari serta progres tiap line item. **Iklan → Laporan** bisa diunduh sebagai CSV (**Unduh CSV**) untuk dikirim ke advertiser.
- Tayangan dihitung bila minimal 50% iklan terlihat selama 1 detik. Klik dari bot dan klik berulang yang tidak wajar ditandai, dan tidak masuk laporan atau tagihan.
- Untuk menghentikan sementara, klik **Jeda** pada line item.
- Untuk menarik materi yang sudah tayang, gunakan **Tarik dari tayang** dan tulis alasannya.
- Line item yang lewat jadwal ditutup otomatis setiap hari. Setelah kampanye selesai dan laporan dikirim, klik **Ubah ke Selesai** pada IO, lalu buat invoice pelunasan bila perlu.

## Contoh di produksi (uji coba 21–24 November 2026)

Dua kampanye internal Rp0 (prioritas 90) dipasang mengikuti panduan ini:

- `IO-HOUSE-2026-002`, Galaxy S26, tujuan samsung.com/id:
  - Slot: Beranda atas, Katalog atas, Katalog di sela hasil, Perbandingan bawah.
  - Detail produk tengah khusus halaman Samsung.
- `IO-HOUSE-2026-003`, vivo V70, tujuan vivo.com/id:
  - Slot: Beranda tengah, Detail produk samping.
  - Detail produk tengah untuk merek lain. Di halaman Samsung, slot ini tetap menampilkan iklan S26 karena prioritasnya sama dan iklan S26 menargetkan Samsung.

Keduanya berlabel pengiklan "CekHarga" dan bertuliskan "Uji coba iklan CekHarga", karena kedua merek tidak memesan iklan tersebut.
