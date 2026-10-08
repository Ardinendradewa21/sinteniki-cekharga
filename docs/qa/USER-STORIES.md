# User Stories — CekHarga

Format: *Sebagai [peran], saya ingin [kemampuan], agar [manfaat].* Acceptance criteria ditulis dalam Gherkin dialek Indonesia (`# language: id`). Kata kuncinya Fitur, Skenario, Dengan (Given), Ketika (When), Maka (Then), Dan (And), dan Tapi (But). Setiap skenario punya padanan test case di [TEST-CASES.md](TEST-CASES.md).

Status: **Selesai** = sudah dirilis ke `main` dan lulus uji. **Backlog** = belum dikerjakan, prioritasnya ada di [BACKLOG.md](BACKLOG.md).

Peran yang dipakai:

- **Pembeli:** pengunjung yang mencari HP.
- **Admin:** pengelola data katalog.
- **Staf:** sales, adops, finance, legal.
- **Pemilik produk:** PT Sinteniki Digital Solusi.

---

## Epik E1 — Menemukan dan membandingkan produk

### US-01 Cari dan saring katalog (FR-02) — Selesai, 5 SP

Sebagai pembeli, saya ingin mencari dan menyaring HP berdasarkan merek, budget, RAM, dan penyimpanan, agar saya hanya melihat HP yang relevan dan bisa membagikan hasil saringan lewat tautan.

```gherkin
# language: id
Fitur: Pencarian dan filter katalog

  Skenario: Filter tersimpan di URL dan pulih setelah reload
    Dengan saya membuka katalog dengan filter merek "samsung" dan urutan "Harga terendah"
    Ketika saya memuat ulang halaman
    Maka daftar produk dan urutannya sama persis seperti sebelum dimuat ulang

  Skenario: Harga kosong tidak lolos filter budget
    Dengan ada produk terbit yang belum punya harga
    Ketika saya menyaring dengan harga maksimal Rp4.000.000
    Maka tidak ada kartu bertuliskan "Harga belum tersedia"
    Dan semua harga yang tampil paling tinggi Rp4.000.000

  Skenario: Hasil kosong memberi jalan keluar
    Ketika saya menyaring dengan harga maksimal Rp1.000
    Maka saya melihat "0 produk yang cocok"
    Dan ada tautan untuk melepas filter

  Skenario: Parameter URL rusak tidak menjatuhkan halaman
    Ketika saya membuka katalog dengan "ram=abc" dan "hal=-3"
    Maka halaman tetap tampil dengan status 200
```

### US-02 Urutkan hasil (FR-02) — Selesai, 2 SP

Sebagai pembeli, saya ingin mengurutkan hasil berdasarkan harga atau waktu pemeriksaan, agar saya bisa melihat yang termurah atau yang datanya paling baru dulu.

```gherkin
# language: id
Fitur: Urutan katalog

  Skenario: Urut harga terendah
    Ketika saya memilih urutan "Harga terendah"
    Maka harga pada kartu produk tersusun menaik

  Skenario: Relevansi bukan skor kualitas
    Ketika saya melihat pilihan urutan
    Maka label urutannya "Relevansi pencarian", bukan "Terbaik" atau "Rekomendasi"
```

### US-03 Lihat detail dan varian (FR-03) — Selesai, 5 SP

Sebagai pembeli, saya ingin melihat harga per varian beserta waktu pemeriksaannya, agar saya tahu harga itu untuk konfigurasi yang mana dan seberapa baru datanya.

```gherkin
# language: id
Fitur: Detail produk

  Skenario: Harga selalu menyebut varian dan waktu pemeriksaan
    Dengan produk punya harga tercatat
    Ketika saya membuka halaman detailnya
    Maka saya melihat harga, "Varian 8/256 GB" atau yang sejenis, dan kapan harga diperiksa

  Skenario: Ganti varian
    Dengan produk punya lebih dari satu varian
    Ketika saya memilih varian lain
    Maka URL memuat parameter "varian"
    Dan varian itu ditandai sebagai pilihan aktif

  Skenario: Produk tidak ditemukan
    Ketika saya membuka slug yang tidak ada
    Maka saya mendapat halaman 404
```

### US-04 Penawaran toko (FR-05) — Selesai, 3 SP

Sebagai pembeli, saya ingin membuka listing toko yang tepat, agar saya bisa membeli di marketplace tanpa salah varian.

```gherkin
# language: id
Fitur: Daftar penawaran

  Skenario: Tautan aman ke toko
    Ketika saya melihat daftar penawaran
    Maka setiap tombol menuju alamat https di tab baru dengan rel "noopener"
    Tapi tidak ada teks yang menyatakan CekHarga memproses pembayaran
```

### US-05 Bandingkan 2–3 produk (FR-04) — Selesai, 5 SP

Sebagai pembeli, saya ingin membandingkan dua sampai tiga HP berdampingan, agar perbedaannya terlihat tanpa diarahkan ke satu pemenang.

```gherkin
# language: id
Fitur: Perbandingan

  Skenario: Tanpa pemenang tunggal
    Dengan saya membandingkan dua produk
    Maka tidak ada skor atau label pemenang
    Dan selisih harga hanya dihitung dari produk yang harganya layak

  Skenario: Batas tiga pembanding
    Ketika URL perbandingan memuat empat produk
    Maka paling banyak tiga produk dibandingkan
```

### US-06 Tanya AI dengan syarat wajib (FR-06) — Selesai (Sprint A), 8 SP

Sebagai pembeli yang bingung memilih, saya ingin menyebut budget dan fitur wajib, agar kandidat yang muncul pasti memenuhi syarat itu.

```gherkin
# language: id
Fitur: Rekomendasi berbasis syarat wajib

  Skenario: Syarat wajib menyaring secara terstruktur
    Dengan budget saya Rp5.000.000 sebagai batas keras
    Dan RAM minimal 8 GB wajib
    Ketika kandidat ditampilkan
    Maka setiap kandidat yang lolos harganya paling tinggi Rp5.000.000
    Dan RAM-nya minimal 8 GB
    Dan ada keterangan bahwa urutan bukan peringkat kualitas

  Skenario: Harga lama dipisah
    Dengan ada kandidat yang harganya belum diperiksa ulang dalam 24 jam
    Maka kandidat itu tampil di grup "perlu dicek ulang", bukan di daftar utama

  Skenario: Tetap bisa dipakai tanpa model AI
    Ketika model bahasa tidak tersedia
    Maka jalur formulir "?tanya=form" tetap bisa dipakai sampai kandidat muncul
```

### US-07 Transparansi sumber data (FR-08) — Selesai, 2 SP

Sebagai pembeli, saya ingin tahu dari mana data berasal dan apa batasannya, agar saya bisa menilai seberapa jauh harus percaya.

```gherkin
# language: id
Fitur: Halaman cara kerja

  Skenario: Sumber dan keterbatasan dijelaskan
    Ketika saya membuka "Cara kerja"
    Maka saya membaca sumber spesifikasi dan harga, arti "mulai dari", dan keterbatasan data
```

### US-08 Beranda jujur (FR-01) — Selesai, 3 SP

Sebagai pembeli baru, saya ingin langsung paham manfaat CekHarga dan bisa mulai mencari, agar saya tidak tersesat.

```gherkin
# language: id
Fitur: Beranda

  Skenario: Dua CTA bekerja
    Ketika saya klik "Cari Produk"
    Maka katalog terbuka
    Ketika saya kembali dan klik "Tanya AI"
    Maka asisten terbuka

  Skenario: Tanpa klaim yang tidak bisa dibuktikan
    Maka beranda tidak memuat testimonial, jumlah pengguna, "terlaris", atau "#1"
```

---

## Epik E2 — Data harga yang jujur dan segar

### US-10 Pemeriksaan harga harian dari situs resmi (PRD §7) — Selesai, 8 SP

Sebagai pemilik produk, saya ingin harga dari situs resmi diperiksa ulang setiap hari secara otomatis, agar harga di situs tidak basi tanpa admin harus menarik manual.

```gherkin
# language: id
Fitur: Pemeriksaan harga harian

  Skenario: Hanya memperbarui penawaran yang sudah ada
    Dengan situs resmi menampilkan varian baru yang belum ada di katalog
    Ketika pemeriksaan harian berjalan
    Maka varian baru itu tidak dibuat otomatis
    Dan harga penawaran yang sudah ada diperbarui

  Skenario: Suntingan admin tidak ditimpa
    Dengan admin menulis garansi "Resmi 1 tahun" pada sebuah penawaran
    Ketika pemeriksaan harian memperbarui harganya
    Maka garansinya tetap "Resmi 1 tahun"

  Skenario: Idempoten walau cron terpanggil dua kali
    Dengan merek "vivo" sudah diperiksa hari ini
    Ketika cron harian terpanggil lagi di tanggal yang sama
    Maka merek "vivo" dilaporkan "already-checked" dan tidak ada batch baru

  Skenario: URL perwakilan model berganti
    Dengan Samsung mengganti URL model dari warna "light pink" ke "blue"
    Ketika pemeriksaan harian berjalan
    Maka penawaran tetap dicocokkan lewat nama model
    Dan "Galaxy S26" tidak pernah tertukar dengan "Galaxy S26+"

  Skenario: Model hilang dicatat jujur
    Dengan model tidak lagi tercantum di situs resmi
    Ketika pemeriksaan harian berjalan
    Maka pemeriksaan gagal dicatat dengan alasan "tidak lagi tercantum"
    Dan harga lama tidak tampak segar
```

### US-11 Harga kosong dan basi tidak menyesatkan (PRD §7) — Selesai, 3 SP

Sebagai pembeli, saya ingin harga yang belum ada atau sudah lama dibedakan dengan jelas, agar saya tidak tertipu harga lama.

```gherkin
# language: id
Fitur: Penanda harga

  Skenario: Harga kosong bukan nol
    Dengan produk belum punya harga tercatat
    Ketika saya membuka detailnya
    Maka saya melihat "Harga belum tersedia"
    Tapi tidak pernah melihat "Rp0"
```

### US-12 Pemeriksaan ulang harga marketplace — Backlog, 13 SP (perlu refinement)

Sebagai pemilik produk, saya ingin harga dari marketplace (Shopee, Erafone) juga diperiksa ulang secara berkala, agar 69 penawaran marketplace tidak basi lebih dari 7 hari (temuan SQL-12).

```gherkin
# language: id
Fitur: Pemeriksaan ulang harga marketplace

  Skenario: Penawaran marketplace basi terdeteksi
    Dengan penawaran marketplace belum diperiksa lebih dari 7 hari
    Ketika admin membuka dasbor
    Maka penawaran itu tampil di daftar "perlu diperbarui" beserta tautan unggah CSV penawaran
```

> **Pertanyaan terbuka untuk refinement:** apakah marketplace mengizinkan pengambilan otomatis? Sesuai aturan proyek, proteksi anti-bot tidak boleh ditembus. Kalau tidak diizinkan, alurnya tetap unggah CSV penawaran secara manual, dan story ini menyusut menjadi pengingat di dasbor.

---

## Epik E3 — Pengelolaan data oleh admin

### US-20 Impor bertahap dengan hasil per baris (FR-07) — Selesai, 13 SP

Sebagai admin, saya ingin menerapkan impor besar tanpa takut timeout, dan melihat hasil tiap baris, agar saya tahu persis apa yang berhasil dan apa yang gagal.

```gherkin
# language: id
Fitur: Penerapan batch impor

  Skenario: Produk impor tidak langsung terbit
    Ketika saya menerapkan batch spesifikasi
    Maka setiap produk baru berstatus draft

  Skenario: Draft basi tidak bisa diterapkan
    Dengan pratinjau berumur lebih dari 14 hari
    Ketika saya menekan Terapkan
    Maka penerapan ditolak dengan pesan untuk membuat pratinjau baru
    Dan halaman Pusat Impor menampilkan label "Kedaluwarsa"
```

### US-21 Undo terbatas yang aman (FR-07) — Selesai, 8 SP

Sebagai admin, saya ingin membatalkan batch yang salah, agar data keliru bisa dibersihkan tanpa merusak data yang sudah saya terbitkan.

```gherkin
# language: id
Fitur: Undo batch

  Skenario: Produk terbit dilindungi
    Dengan batch membuat tiga produk
    Dan satu produk sudah saya terbitkan, satu sudah saya sunting
    Ketika saya mengurungkan batch
    Maka hanya produk yang masih draft dan belum disentuh yang terhapus
    Dan penawaran milik produk terbit tetap ada

  Skenario: Foto buatan batch ikut dibersihkan
    Dengan batch menambahkan foto ke produk draft dan produk terbit
    Ketika saya mengurungkan batch
    Maka foto di produk draft terhapus dari database dan storage
    Tapi foto di produk terbit tetap ada

  Skenario: Menunggu foto yang sedang diunggah
    Dengan masih ada foto batch yang sedang diproses
    Ketika saya menekan "Urungkan batch"
    Maka saya diminta menunggu sekitar satu menit
```

### US-22 Panel celah data (FR-07) — Selesai, 5 SP

Sebagai admin, saya ingin melihat produk terbit yang datanya belum lengkap, agar saya tahu apa yang harus dilengkapi lebih dulu.

```gherkin
# language: id
Fitur: Celah data produk terbit

  Skenario: Tarik ulang langsung ke model yang tepat
    Dengan produk terbit "Infinix GT 50 Pro" belum punya penawaran
    Ketika saya klik "Tarik ulang"
    Maka tab Tarik otomatis terbuka dengan merek "infinix" terpilih dan pencarian "GT 50 Pro"

  Skenario: Celah spesifikasi diarahkan ke suntingan manual
    Dengan NFC sebuah produk tercatat "tergantung pasar"
    Maka produk itu tampil di kelompok "NFC atau IP rating belum tercatat"
    Tapi tanpa tombol "Tarik ulang", karena sumbernya memang tidak memuat data itu
```

### US-23 Peran staf dibatasi (FR-07) — Selesai, 5 SP

Sebagai pemilik produk, saya ingin staf sales, adops, finance, dan legal hanya membuka modul tugasnya, agar data katalog hanya diubah admin.

```gherkin
# language: id
Fitur: Gerbang peran

  Skenario: Sales tidak bisa membuka impor
    Dengan saya masuk sebagai staf berperan "sales"
    Ketika saya membuka "/admin/import"
    Maka saya dialihkan ke dasbor dengan alasan "akses-ditolak"
    Tapi modul iklan tetap bisa dibuka
```

### US-24 Login staf aman (FR-07) — Selesai, 2 SP

Sebagai staf, saya ingin masuk dengan email saya sendiri, agar setiap perubahan tercatat atas nama saya.

```gherkin
# language: id
Fitur: Halaman masuk admin

  Skenario: Email tidak dibocorkan dan tidak dikunci
    Ketika saya membuka halaman masuk
    Maka kolom email kosong dan bisa diisi

  Skenario: Pesan gagal seragam
    Ketika saya memakai email yang tidak terdaftar
    Maka saya melihat "Email atau kata sandi tidak cocok."
```

### US-25 Lengkapi NFC dan IP rating — Backlog, 3 SP

Sebagai admin, saya ingin mengisi NFC dan IP rating untuk 34 produk terbit dengan cepat dari satu daftar, agar filter "wajib NFC" di Tanya AI tidak melewatkan produk yang sebenarnya punya NFC.

```gherkin
# language: id
Fitur: Lengkapi spesifikasi kunci

  Skenario: Isi dari daftar celah
    Dengan produk ada di kelompok "NFC atau IP rating belum tercatat"
    Ketika saya mengisi NFC "Ada" dan menyimpan
    Maka produk keluar dari kelompok itu
    Dan perubahannya tercatat di audit dengan asal "manual"
```

### US-26 Perbarui URL penawaran resmi yang berganti — Backlog, 3 SP

Sebagai pembeli, saya ingin tombol "Situs resmi" membuka halaman model yang benar, agar saya tidak mendarat di halaman warna lain atau halaman yang sudah hilang.

```gherkin
# language: id
Fitur: Penyesuaian URL penawaran resmi

  Skenario: URL berganti terdeteksi
    Dengan pemeriksaan harian mencocokkan penawaran lewat nama model karena URL berganti
    Maka penawaran itu ditandai "URL perlu ditinjau" di dasbor admin
    Dan admin bisa menerima URL baru dengan satu klik
```

---

## Epik E4 — Keamanan dan operasi

### US-30 Data internal tidak terbaca publik (FR-07, PRD §10) — Selesai, 3 SP

```gherkin
# language: id
Fitur: Row Level Security

  Skenario: Anon tidak bisa membaca tabel internal
    Ketika klien memakai anon key untuk membaca admin_users, admin_audit, import_batches, photo_jobs, atau invoices
    Maka hasilnya kosong

  Skenario: Draft tidak terbaca publik
    Ketika klien membaca produk berstatus draft dengan anon key
    Maka hasilnya kosong
```

### US-31 Endpoint terjadwal terlindungi — Selesai, 1 SP

```gherkin
# language: id
Fitur: Endpoint cron dan worker

  Skenario: Tanpa token yang benar
    Ketika "/api/cron/daily" dipanggil tanpa header Authorization atau dengan token salah
    Maka responsnya 401
```

### US-32 Lingkungan uji terpisah — Backlog, 5 SP

Sebagai QA, saya ingin database uji terpisah dari database katalog, agar uji integrasi tidak pernah berisiko menyentuh data nyata.

```gherkin
# language: id
Fitur: Lingkungan staging

  Skenario: Uji integrasi di branch database
    Dengan branch database "qa" dibuat dari skema produksi
    Ketika "pnpm test:integration" dijalankan dengan konfigurasi branch itu
    Maka tidak ada baris yang tertulis di database produksi
```

### US-33 Peringatan bila pemeriksaan harian gagal — Backlog, 3 SP

Sebagai admin, saya ingin tahu bila pemeriksaan harian sebuah merek gagal (situs diblokir atau berubah format), agar harga merek itu tidak diam-diam basi.

```gherkin
# language: id
Fitur: Pemantauan pemeriksaan harian

  Skenario: Sumber gagal dibaca
    Dengan situs resmi "Samsung" mengembalikan halaman anti-bot
    Ketika pemeriksaan harian berjalan
    Maka dasbor admin menampilkan "Samsung: sumber gagal dibaca" dengan waktu kejadian
```
