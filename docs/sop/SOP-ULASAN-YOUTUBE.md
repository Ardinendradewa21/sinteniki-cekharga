# SOP Kurasi Ulasan YouTube

Disusun 17 Oktober 2026 untuk admin CekHarga. Berlaku sejak PB-40 (keputusan PRD §3, 17 Oktober 2026).

## 1. Cara kerjanya

1. Setiap hari pukul 06.00 WIB, sistem membaca unggahan 18 bulan terakhir dari channel terpercaya. Admin juga bisa memicunya dengan tombol **Sinkronkan**.
2. Video yang judulnya menyebut produk di katalog masuk ke antrean **Kandidat** di **Admin → Ulasan YouTube**.
3. Admin memilih video yang memang mengulas produk itu, menontonnya, lalu menulis ringkasan. Hanya ringkasan yang diterbitkan admin yang tampil di situs.
4. Di halaman perbandingan, pengunjung bisa meminta **rangkuman AI**. Rangkuman ini disusun hanya dari ringkasan yang sudah terbit.

Sistem tidak mengambil transkrip dan tidak meringkas video secara otomatis. Isi ulasan selalu tulisan admin.

Channel terpercaya per 17 Oktober 2026:

- GadgetIn
- Jagat Review
- Youtuber Cupu
- Bestindotech
- Pixa Focus ID
- DKID Media

## 2. Rutinitas harian (sekitar 15–30 menit)

1. Buka **Admin → Ulasan YouTube**, tab **Kandidat**. Kandidat bertanda **Tampak ulasan** ada di atas.
2. Untuk setiap kandidat, putuskan satu dari dua tindakan:
   - **Bukan ulasan produk ini**: berita rilis, bocoran, video promo, tutorial, unboxing tanpa pengujian, atau video yang hanya menyebut produk sekilas.
   - **Tulis ringkasan**: video review, perbandingan, atau pemakaian jangka panjang yang benar-benar menguji produk itu.
3. Video perbandingan (misalnya "A vs B") muncul sebagai dua kandidat, satu per produk. Tulis ringkasan terpisah untuk tiap produk, hanya dari bagian yang membahas produk itu.

## 3. Menulis ringkasan

1. Pilih aspek:
   - **Ulasan keseluruhan**: pemakaian harian, performa, baterai, layar.
   - **Ulasan kamera**: hasil foto dan video.

   Satu video boleh punya dua ringkasan (umum dan kamera) bila keduanya dibahas cukup dalam.
2. **Ringkasan temuan** (40–1.200 karakter): tulis ulang dengan kalimat sendiri apa yang diuji dan apa hasilnya. Jangan menyalin ucapan reviewer kata per kata.
3. **Kelebihan** dan **kekurangan**: satu poin per baris, maksimal 6. Hanya yang memang disebut reviewer.
4. **Konteks pengujian**: lama pemakaian, jenis game, kondisi uji. Kosongkan bila reviewer tidak menyebutnya; situs akan menulis "tidak dicatat reviewer".
5. **Menit yang dirujuk**: menit bagian terpenting, ditulis seperti `4:35`. Pembaca diarahkan langsung ke menit itu.
6. **Berlaku untuk**: pilih varian bila reviewer menguji varian tertentu dan hasilnya bergantung pada varian (misalnya RAM). Selain itu biarkan "Seluruh varian".
7. Centang **Video bersponsor** bila video menyebut kerja sama, sponsor, atau unit dari brand untuk ditinjau dengan syarat tertentu.
8. Klik **Terbitkan ringkasan**. Ringkasan langsung tampil di halaman produk dan bisa dipakai rangkuman AI.

Larangan, sesuai PRD:

- Tidak ada kata "terbaik", "pemenang", skor, atau nilai.
- Tidak ada kesimpulan sendiri yang tidak dikatakan reviewer.
- Perbedaan pendapat antarreviewer tetap dipertahankan; jangan dilebur jadi satu.

## 4. Video yang tidak tertangkap sistem

Pencocokan judul sengaja ketat, misalnya "iPhone 17" tidak dicocokkan ke "iPhone 17 Pro". Akibatnya ada video yang bisa terlewat. Untuk menambahkannya:

1. Di tab **Kandidat**, isi **Tambah dari tautan** dengan tautan videonya, lalu pilih produknya.
2. Video hanya diterima bila berasal dari channel terpercaya yang aktif.
3. Setelah ditambahkan, halaman tulis ringkasan langsung terbuka.

## 5. Mengelola channel

Semua tindakan berikut ada di tab **Channel**:

- **Menambah channel**: isi handle (`@NamaChannel`) atau tautan channel. Channel baru langsung disinkronkan. Tambahkan hanya channel yang disetujui pemilik produk.
- **Menonaktifkan channel**: sinkronisasi channel itu berhenti. Ringkasan yang sudah terbit tetap tampil.
- **Galat terakhir**: bila muncul "Kuota harian YouTube API habis", tunggu sampai besok. Kuota default adalah 10.000 unit per hari, dan satu sinkronisasi semua channel memakai sekitar 100 unit.

## 6. Hal teknis yang perlu diketahui

- `YOUTUBE_API_KEY` wajib ada di Vercel (Production) dan `.env.local`. Batasi key itu hanya untuk YouTube Data API v3. Jangan pernah mengirim key lewat chat.
- **Data YouTube yang disimpan** hanya ID video, judul, channel, dan tanggal. Video yang tidak terlihat lagi selama 30 hari dihapus otomatis, sesuai kebijakan YouTube API. Ringkasan admin tidak ikut terhapus.
- **Rangkuman AI** memakai kuota harian yang sama dengan Tanya AI. Rangkuman yang sudah pernah dibuat disimpan dan tidak memanggil AI lagi. Bila admin mengubah ringkasan, rangkuman dibuat ulang saat diminta.
- Semua tindakan admin tercatat di audit.
