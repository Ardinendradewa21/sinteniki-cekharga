# CekHarga — PRD dan Kebutuhan Sistem

Versi: 2.0 • Tanggal: 3 September 2026 • Pembaruan §8: 7 Oktober 2026 (keputusan pemilik produk, lihat "Keputusan visual" di §8)

Status: baseline perencanaan untuk implementasi AI Agent, berdasarkan keputusan produk dalam percakapan. Dokumen ini bukan laporan audit repository atau bukti bahwa fitur telah tersedia.

## 1. Cara memakai dokumen ini

PRD ini menyatukan tujuan produk, kebutuhan frontend/backend, aturan data, AI, dan acceptance criteria. Belum diperlukan SRS terpisah untuk mulai membangun; detail teknis cukup dicatat dekat implementasi bila memang dibutuhkan.

- Baca ringkasan produk, aturan data, dan bagian fitur yang sedang dikerjakan. Jangan membaca ulang seluruh dokumentasi setiap task.
- Untuk arah produk dan visual yang sedang dirombak, gunakan baseline ini ketika dokumen perencanaan lama bertentangan. Jangan menghapus dokumen atau kode lama secara otomatis.
- Patuhi instruksi repository dan batas izin pengguna. Laporkan konflik yang memengaruhi keamanan, data, atau keputusan produk.
- Label **Disepakati** menunjukkan keputusan produk. Label **Usulan teknis** menunjukkan default implementasi yang dapat disesuaikan, bukan keputusan server atau fakta pasar.
- Permintaan satu fitur bukan izin mengerjakan seluruh roadmap. Caveman tidak termasuk kebutuhan atau dependency proyek.

## 2. Masalah, pengguna, dan tujuan

### Rumusan masalah

Calon pembeli gadget mempunyai pertimbangan berbeda: kebutuhan, budget, spesifikasi, nilai terhadap harga, dan pengalaman penggunaan. Mereka harus menggabungkan informasi dari banyak sumber sebelum dapat menentukan produk yang sesuai. CekHarga menyatukan informasi tersebut agar pengguna memahami pilihan dan komprominya, lalu menemukan penawaran yang relevan.

Empat pendekatan berikut berasal dari pengamatan awal pemilik produk, bukan hasil riset pengguna formal. Satu orang dapat memakai beberapa pendekatan sekaligus.

| Pendekatan pengguna | Dukungan CekHarga |
| --- | --- |
| Kebutuhan dan budget, tanpa mendalami spesifikasi | Konsultasi AI dan penjelasan sederhana |
| Spesifikasi yang sudah diketahui | Pencarian, filter, detail varian, dan perbandingan |
| Harga dibanding kemampuan yang diperoleh | Penawaran sebanding, perbedaan produk, dan kompromi |
| Pengalaman reviewer | Ringkasan kurasi dengan sumber, konteks pengujian, dan timestamp video |

**Tujuan utama:** membantu pengguna menjawab “produk mana yang cocok untuk saya, apa komprominya, dan di mana saya bisa melihat penawarannya?”

CekHarga adalah alat bantu keputusan, **bukan marketplace**. Transaksi dilakukan di marketplace tujuan. Harga diperiksa berkala, bukan real-time.

## 3. Batas versi awal — Disepakati

**Termasuk:** smartphone, bahasa Indonesia, Rupiah, produk baru, katalog, detail dan varian, perbandingan, penawaran, konsultasi AI, transparansi sumber, serta admin data.

- Pengguna dapat mencari, membandingkan, dan berkonsultasi tanpa akun.
- Versi awal gratis, tanpa paket berbayar atau kuota AI komersial. Tetap ada pembatasan teknis internal untuk keamanan dan biaya; jangan menjanjikan penggunaan tanpa batas.
- Mulai dari satu marketplace pilot dengan akses data yang layak. Blibli adalah kandidat awal; Shopee dan Tokopedia kandidat berikutnya. Jangan menganggap ketiganya sudah terintegrasi.
- Penawaran didaftarkan admin secara manual. Target pembaruan harga adalah otomatis berkala; pembaruan manual tetap menjadi fallback yang sah bila akses otomatis belum tersedia.
- Hanya kondisi baru. Jenis garansi tetap dicatat; batas “hanya garansi resmi Indonesia” belum ditetapkan.

**Ditunda:** laptop/kategori lain, barang bekas/refurbished/open-box, pembayaran dan langganan, checkout, akun konsumen dan favorit lintas perangkat, notifikasi, pelacakan promo/voucher/cashback, grafik harga publik, ranking/skor numerik, dan pengambilan review otomatis.

## 4. Alur layanan dan halaman

Pengguna memiliki dua pintu masuk yang setara: mencari langsung atau menjelaskan kebutuhan kepada AI. Chat bukan syarat untuk memakai katalog.

| Halaman | Isi dan tindakan utama |
| --- | --- |
| `/` | Hero, pencarian/CTA, contoh cara memilih, produk, contoh perbandingan, pengenalan AI, transparansi |
| `/products` | Pencarian, filter, urutan hasil, detail produk, pilih pembanding |
| `/products/[slug]` | Visual, varian, spesifikasi, ringkasan pengalaman, penawaran |
| `/compare` | Bandingkan 2–3 produk/varian dan pahami perbedaannya |
| `/assistant` | Klarifikasi kebutuhan, rekomendasi beralasan, tautan produk |
| `/how-it-works` | Sumber data, arti harga/freshness, metode kurasi, keterbatasan |
| `/admin` | Akses terproteksi untuk produk, review, penawaran, dan kualitas data |

Alur pembelian: pilih kebutuhan atau cari produk → pelajari kandidat → bandingkan bila diperlukan → pilih penawaran → buka marketplace. Tidak ada keranjang atau pembayaran di CekHarga.

Hanya tampilkan navigasi yang memiliki tujuan berfungsi. Rekomendasi atau fitur yang belum tersedia harus dinyatakan jelas, bukan dipalsukan sebagai kontrol aktif.

## 5. Kebutuhan fitur dan acceptance criteria

### FR-01 — Beranda

Hero menjelaskan manfaat CekHarga, bukan sekadar ajakan belanja. CTA utama **Cari Produk**, sekunder **Tanya AI**. Sertakan fakta tentang pencocokan varian, waktu pemeriksaan, dan pembelian di marketplace.

Produk yang ditampilkan berasal dari data terpublikasi. Bagian “pilih sesuai kebutuhan” boleh menjelaskan kategori kebutuhan tanpa mengklaim urutan terbaik. Tidak ada popularitas, testimonial, atau jumlah pengguna karangan.

**Diterima bila:** kedua CTA bekerja; identitas dan manfaat terbaca di mobile; panel harga menunjukkan varian dan freshness; fixture diberi label demo bila digunakan.

### FR-02 — Katalog

Cari nama/merek dan saring berdasarkan merek, rentang harga, RAM, serta penyimpanan. Tambahkan filter lain hanya jika data dan maknanya tersedia. Pilihan filter tercermin pada URL agar dapat dibagikan dan dipulihkan saat reload.

Urutan minimum: relevansi pencarian, harga naik/turun, dan terakhir diperiksa. Relevansi pencarian bukan skor kualitas produk. Gunakan contract existing untuk nama parameter/wire value; jangan membuat alias baru tanpa kebutuhan.

Kartu memuat gambar, nama, varian yang menjadi basis harga, spesifikasi ringkas, harga mulai, freshness, serta aksi detail/bandingkan. Tidak perlu menampilkan semua spesifikasi di kartu.

**Diterima bila:** pencarian dan reset bekerja; state URL konsisten; harga kosong bukan nol dan tidak lolos filter budget; hasil kosong mempunyai saran konkret seperti menghapus filter; perubahan hasil diumumkan secara aksesibel. Pagination diterapkan bila ukuran dataset memerlukannya, bukan simulasi cursor palsu.

### FR-03 — Detail produk

Tampilkan visual produk, pilihan varian yang benar-benar tercatat, harga dan waktu pemeriksaan, spesifikasi terstruktur, kelebihan/keterbatasan berbasis bukti, serta penawaran. Bedakan spesifikasi faktual dari pengalaman reviewer.

**Diterima bila:** perubahan varian memperbarui harga dan penawaran terkait; data yang tidak diketahui ditandai; produk tanpa review atau penawaran tetap dapat dibaca; slug tidak ditemukan mempunyai state 404 yang benar.

### FR-04 — Perbandingan

Pengguna memilih 2–3 kandidat beserta variannya. Tampilkan atribut sepadan, perbedaan utama, harga sebanding, selisih, freshness, dan konteks pengalaman. Jangan memaksa pemenang tunggal atau membuat skor universal.

**Diterima bila:** tambah/hapus pembanding bekerja; nama/varian selalu jelas; data kosong tidak dianggap lebih buruk atau bernilai nol; selisih hanya dihitung ketika kedua harga layak; perbedaan RAM/penyimpanan/garansi terlihat dan tidak disebut setara secara menyesatkan.

### FR-05 — Penawaran

Setiap penawaran menunjukkan marketplace, seller, varian, kondisi baru, garansi jika diketahui, harga tercatat, waktu pemeriksaan, serta tautan ke listing yang tepat. Badge resmi/terverifikasi hanya ditampilkan dengan bukti verifikasi.

**Diterima bila:** aturan harga di §7 diterapkan; listing salah varian tidak menjadi basis harga; harga kedaluwarsa dibedakan; tombol marketplace menuju URL yang valid; tidak ada klaim CekHarga memproses transaksi.

### FR-06 — Asisten AI

AI menanyakan informasi yang benar-benar kurang: budget, kegiatan utama, kebutuhan khusus, dan prioritas. Jangan mengulang informasi yang sudah diberikan atau memberikan kuesioner panjang sekaligus.

- **Syarat wajib:** tidak boleh dilanggar, misalnya budget maksimal yang dinyatakan tegas atau fitur yang wajib ada.
- **Preferensi:** dapat dikompromikan, misalnya lebih suka bodi ringan. Jika tidak jelas apakah wajib, tanyakan.
- Tampilkan beberapa kandidat yang tersedia, masing-masing dengan alasan cocok, kompromi, varian, harga/freshness jika layak, dan sumber pendukung.
- Jika tidak ada kandidat cocok, jelaskan kendalanya. Alternatif di luar budget harus diberi label dan tidak boleh diam-diam dianggap memenuhi syarat.
- Jangan memaksa jumlah rekomendasi jika datanya sedikit. Jangan menyimpulkan pengalaman gaming/baterai hanya dari angka spesifikasi.

**Diterima bila:** syarat wajib disaring melalui logika terstruktur, bukan janji prompt saja; rekomendasi merujuk produk terpublikasi; tidak ada harga/review karangan; informasi yang tidak diketahui dinyatakan; kegagalan AI menyediakan coba lagi dan katalog tetap berfungsi. Loading/streaming harus mewakili proses nyata.

### FR-07 — Admin data

Admin dapat membuat, menyunting, meninjau, dan mempublikasikan produk/varian; mengimpor dataset; mengelola penawaran; serta melihat hasil pemeriksaan harga. Data impor tidak langsung dipublikasikan tanpa validasi.

Untuk review, admin memilih produk/varian dan mencatat channel, URL video, tanggal publikasi, timestamp relevan, aspek, ringkasan, kelebihan/kekurangan, konteks pengujian, serta status draft/published. Channel reviewer berasal dari kurasi pemilik produk.

**Diterima bila:** pengguna biasa tidak dapat membaca/mengubah data admin melalui API; draft tidak tampil ke publik/AI; review lintas sumber dapat disimpan tanpa menghapus perbedaan pendapat; perubahan penting dapat ditelusuri ke admin dan waktunya. Tidak perlu membangun CMS generik.

### FR-08 — Transparansi

Jelaskan sumber spesifikasi, proses kurasi review, cakupan marketplace, arti “mulai dari”, dan keterbatasan AI. Tampilkan atribusi review dekat informasi terkait. Bila kelak memakai tautan afiliasi, ungkapkan dengan jelas; jangan menyatakan kemitraan yang belum ada.

**Diterima bila:** pengguna dapat membedakan data aktual, demo, informasi lama, pendapat reviewer, dan inferensi AI tanpa perlu membaca kode.

## 6. Sumber data dan model minimum

**Disepakati:** GSMArena menjadi sumber spesifikasi yang direncanakan; pipeline Python disiapkan setelah format data dan aksesnya diverifikasi. Dataset belum dianggap tersedia hanya karena halaman sumber dapat dibuka.

- Periksa ketentuan akses/penggunaan sebelum otomatisasi. Jangan melewati CAPTCHA, autentikasi, atau pembatasan layanan.
- Izin memakai spesifikasi tidak otomatis berarti izin menyalin foto. Gunakan aset yang hak penggunaannya jelas.
- Awali validasi dengan sampel kecil lintas merek/budget. Simpan sumber, waktu pengambilan, dan kesalahan normalisasi.
- Pertahankan hubungan model–varian–region. Jangan membuat kombinasi RAM/penyimpanan yang tidak tercantum.
- Spesifikasi GSMArena bukan sumber harga lokal marketplace.
- Review dikurasi manual dari channel pilihan pengguna; ringkas dengan atribusi, bukan menyalin transkrip penuh.

| Entitas konseptual | Informasi minimum |
| --- | --- |
| Product | Identitas, slug, merek, model, spesifikasi, sumber, status publikasi |
| Variant | Product, RAM, penyimpanan, region/atribut pembeda yang tersedia |
| ProductAsset | Produk/varian, aset, teks alternatif, sumber/hak penggunaan |
| ReviewSummary | Produk/varian, sumber video/channel, timestamp, temuan, konteks, publikasi |
| Offer | Varian, marketplace, seller, URL, kondisi, garansi, status listing |
| PriceObservation | Offer, harga IDR, waktu pengamatan berhasil, asal manual/otomatis |
| PriceCheck | Offer, waktu percobaan, hasil/gagal, ringkasan error yang aman |
| AdminAudit | Pelaku, operasi, objek, waktu |

Ini model domain, bukan perintah mengganti semua tabel/contract existing. Gunakan identifier dan schema konsisten; null berarti tidak diketahui/tidak tersedia, bukan nol. Harga berupa integer Rupiah non-negatif.

## 7. Aturan harga, freshness, dan promo

1. “Mulai dari” adalah harga terendah dari penawaran tercatat yang memenuhi syarat dalam cakupan CekHarga, **bukan jaminan termurah di seluruh internet**.
2. Penawaran layak harus cocok dengan varian, kondisi baru, aktif, memiliki harga valid, dan cukup baru menurut kebijakan freshness. Listing ambigu atau diketahui habis tidak menjadi basis harga aktif.
3. Kartu yang memakai harga terendah lintas varian wajib menyebut varian acuannya. Detail dan perbandingan memakai varian yang dipilih; jangan mencampur basis harga diam-diam.
4. Gunakan harga jual yang terlihat tanpa syarat personal. Potongan harga langsung yang sudah tercermin boleh tercatat, tetapi jangan menghitung voucher, cashback, atau kupon akun.
5. Jika tidak ada penawaran layak, tampilkan “Harga belum tersedia”. Harga lama boleh tampil terpisah sebagai “Harga terakhir tercatat”, bukan bukti bahwa produk masih sesuai budget.
6. Tampilkan waktu pemeriksaan berhasil terakhir. Percobaan gagal tidak boleh memperbarui waktu keberhasilan. Penyuntingan metadata juga tidak membuat harga terlihat baru.
7. Pembelian dan harga akhir mengikuti marketplace; perubahan harga tidak otomatis membuktikan adanya promo.

**Usulan teknis yang dapat diubah:** mulai dengan jadwal pemeriksaan harian dan batas freshness 24 jam, hanya jika sumber mendukung. **Keputusan 8 Oktober 2026:** batas freshness menjadi **30 jam** (pemeriksaan otomatis harian 06.00 WIB; selisih 6 jam menampung keterlambatan jadwal). Simpan sebagai konfigurasi, bukan angka tersebar di UI. Nilai operasional harus dikonfirmasi sebelum publikasi; hasil manual mengikuti aturan yang sama. Uji waktu dengan clock yang dapat dikendalikan agar test deterministik.

Target otomatisasi tidak boleh menghambat seluruh produk: jika akses tidak layak, gunakan pembaruan manual dan tampilkan waktunya secara jujur. Tidak ada janji mendeteksi diskon otomatis dalam versi awal.

## 8. UI/UX — Tema utama yang disepakati

Referensi visual adalah tampilan katalog jam tangan yang diberikan pengguna: **premium, minimal, product-first**, latar abu sangat muda, kartu putih membulat, headline besar, dan foto produk dominan. Ambil bahasa visualnya, bukan fungsi toko atau identitas mereknya.

### Palet dan tipografi

| Peran | Arah visual |
| --- | --- |
| Canvas | Abu/off-white lembut; acuan sekitar `#F5F5F5` |
| Surface | Putih `#FFFFFF` |
| Headline/CTA utama | Charcoal; acuan sekitar `#303030` |
| Teks sekunder | Blue-gray; acuan sekitar `#667085` |
| Border | Abu lembut; acuan sekitar `#E5E7EB` |
| Brand | Teal sebagai aksen terbatas, bukan warna dominan seluruh halaman |
| Status | Hijau/amber/merah disertai kata atau ikon |

Hex di atas adalah acuan desain, bukan hasil sampling screenshot atau kontrak warna baru. Implementasikan melalui semantic token; ukur contrast pada kombinasi yang dipakai. Gunakan Plus Jakarta Sans, headline tebal, harga mudah dipindai, dan body dengan panjang baris nyaman.

### Komposisi

- Container desktop sekitar 1200–1280 px; padding mobile sekitar 16 px. Ritme spacing konsisten.
- Header: logo/wordmark, navigasi kapsul, tombol ikon bulat untuk fungsi yang tersedia. Tidak ada cart atau favorit palsu.
- Hero: dua kolom desktop, satu kolom mobile; copy dan dua CTA di kiri, perangkat besar di kanan dengan bidang lingkaran abu lembut dan panel harga/freshness kecil.
- Katalog: kartu putih ber-radius sekitar 24–32 px, area visual dominan, metadata ringkas. Grid desktop lebar (≥1280 px) **5 kolom** (keputusan 7 Oktober 2026, menggantikan 3 kolom), lalu 4/3/2 di layar lebih kecil; filter mobile berupa disclosure.
- Detail: visual kiri, ringkasan keputusan kanan; mobile berurutan visual → identitas/varian → harga/freshness → aksi → penawaran dan bukti.
- Perbandingan: perbedaan terlihat jelas, label/nama tetap dekat nilainya pada mobile. Jangan memaksa tabel lebar yang tak terbaca.
- AI: percakapan lapang dengan kartu rekomendasi senada; tidak harus menyerupai dashboard kerja.
- Footer: panel putih luas, navigasi nyata dan transparansi; ditempatkan di luar main sebagai footer situs. Tanpa newsletter atau tautan legal palsu.

Foto harus sesuai produk/varian dan boleh digunakan. Selama belum ada, gunakan SVG perangkat generik lokal dengan keterangan yang tepat; dekorasi `aria-hidden`. Jangan gunakan inisial besar sebagai gambar produk atau membuat render generik tampak sebagai foto model asli.

### Motion dan aksesibilitas

### Keputusan visual (7 Oktober 2026)

- **CTA utama charcoal** (`--primary`), sesuai tabel palet di atas; teal kembali menjadi aksen terbatas (`--brand`: status harga, tautan aksen, logo) dan warna ring fokus. Di tema gelap publik, CTA dibalik menjadi terang dengan teks gelap.
- **Tanpa gaya kaca:** tombol dan navigasi padat bertoken, tanpa backdrop blur, gradien, bayangan `rgba` mentah, efek terangkat, atau glow pada menu aktif. Menu aktif ditandai latar `muted` dan `aria-current`.
- **Grid katalog desktop 5 kolom** (lihat Komposisi). Catatan: ponsel saat ini 2 kolom, berbeda dari acuan awal 1 kolom; belum diputuskan terpisah.

Motion adalah tambahan implementasi, bukan perilaku yang dapat dibuktikan dari screenshot referensi. Gunakan micro-interaction sekitar 120–180 ms dan entrance 280–420 ms dengan opacity/transform. Hero/SVG boleh bergerak halus sekali; hindari loop, parallax, glow, dan scroll hijacking.

Reduced motion menghentikan gerak non-esensial; konten tetap terlihat tanpa animasi. Hover affordance hanya untuk elemen interaktif. Skeleton hanya saat benar-benar memuat data.

Target interaktif minimal 44 px; input minimal 16 px; keyboard, label, focus terlihat, heading dan landmark semantik. Contrast teks normal minimal 4.5:1, teks besar 3:1, elemen UI/focus penting 3:1. Jangan mengklaim lolos aksesibilitas hanya dari source detector.

## 9. Arsitektur implementasi — Usulan teknis

Utamakan penggunaan ulang stack repository. Jangan mengganti framework atau memasang versi “terbaru” tanpa kebutuhan.

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, primitive project/shadcn yang sudah disesuaikan, Hugeicons, Plus Jakarta Sans. Server Component secara default; Client Component untuk interaksi nyata.
- **Backend:** modular monolith dengan domain katalog, penawaran, review, dan rekomendasi. Route/API tipis; logika data dan eligibility berada di service yang dapat diuji.
- **Database:** PostgreSQL; InsForge menjadi opsi layanan yang direncanakan. Periksa kemampuan dan konfigurasi aktual sebelum mengandalkannya untuk auth/storage.
- **AI:** OpenRouter melalui integrasi server; model configurable. Gunakan SDK existing bila sesuai, tidak perlu menambah beberapa SDK dengan fungsi sama.
- **Ingestion:** Python untuk normalisasi/import spesifikasi. Pemeriksaan harga melalui adapter sumber yang diizinkan, dijadwalkan terpisah dari request halaman.
- **Contract:** validasi runtime dengan Zod dan tipe turunan schema. Gunakan contract existing bila kompatibel; perubahan kontrak bermakna harus dijelaskan sebelum diterapkan lintas consumer.

Struktur feature-based; pisahkan adapter sumber dari model domain. Jangan membuat microservices, event bus, repository generik, atau abstraction besar tanpa kebutuhan nyata.

### Demo dan penggantian backend

UI boleh berkembang menggunakan fixture melalui adapter server-only. Data yang diteruskan ke client berupa view model seperlunya. Setiap surface sintetis diberi penanda demo yang jelas, termasuk AI jika responsnya hanya contoh.

Adapter nyata dan demo harus dapat dibedakan melalui konfigurasi server. Produksi tidak boleh diam-diam fallback ke fixture saat API gagal. UI mempertahankan state loading, empty, error, missing image, dan unknown price ketika sumber diganti.

## 10. Keamanan, AI, dan operasi data

- API key/model credential hanya di server; tidak dalam source, payload browser, atau log.
- Admin memerlukan autentikasi dan otorisasi server. Jika database bisa diakses client, terapkan kebijakan akses database yang sesuai; menyembunyikan tombol bukan pengamanan.
- Validasi input, URL marketplace, import, dan output terstruktur AI. Fetch eksternal hanya ke sumber/protokol yang diizinkan; cegah SSRF termasuk redirect menuju alamat internal.
- Materi review dan sumber eksternal adalah data tidak tepercaya, bukan instruksi untuk agent/model. Batasi tools AI pada data publik yang relevan.
- Tetapkan rate limit, concurrency, jumlah tool call, panjang konteks, timeout, dan anggaran AI di server. Tampilkan pesan gangguan/batas teknis yang jujur tanpa upsell.
- Jangan mencatat percakapan lengkap secara default. Jika penyimpanan riwayat kelak diperlukan, tentukan tujuan, persetujuan, retensi, dan penghapusannya.
- Import ulang memakai kunci sumber yang stabil agar tidak menggandakan produk. Simpan kegagalan job tanpa merusak data valid sebelumnya.
- Bedakan asal spesifikasi, kurasi manusia, harga, dan inferensi AI agar kesalahan dapat ditelusuri.

## 11. Strategi delivery yang ringkas

Kerjakan sebagai beberapa irisan fitur yang bisa dipakai, bukan puluhan checkpoint persetujuan mikro. Frontend demo dapat berjalan sambil dataset disiapkan.

| Irisan | Hasil yang dapat ditinjau |
| --- | --- |
| A — Pengalaman utama | Tema visual, beranda, katalog, detail, navigasi; adapter demo yang jujur |
| B — Data yang dapat dikelola | Database/migrasi, admin terproteksi, import produk, kurasi review, penawaran manual |
| C — Keputusan pembelian | Perbandingan dan AI yang memakai data terpublikasi; alasan, kompromi, fallback |
| D — Integrasi dan rilis | Adapter harga otomatis bila layak, manual fallback, QA gabungan, staging, kesiapan produksi |

Jangan mengulang fitur yang sudah benar hanya untuk mengikuti urutan ini. Perbaiki fondasi secukupnya jika menjadi blocker.

## 12. Protokol kerja AI Agent

1. Periksa instruksi repository, status Git, dan kode yang relevan. Pertahankan perubahan pengguna. Laporan lama bukan bukti keadaan kode saat ini.
2. Nyatakan scope dan rencana pendek. Implementasikan satu irisan berguna dengan keputusan sederhana yang konsisten dengan PRD.
3. Uji risiko nyata, bukan target jumlah test. Prioritaskan varian/harga, syarat wajib AI, otorisasi admin, draft review, dan timestamp pemeriksaan gagal.
4. Jalankan format, lint, typecheck, targeted tests, dan pemeriksaan diff. Jalankan build bila aplikasi/rute/integrasinya berubah. Untuk UI, periksa browser mobile/desktop dan satu state berisiko.
5. Jalankan test sekali; ulangi jika gagal atau ada indikasi flake. Jangan menjalankan agregat `check` bersama subperintah identik, full coverage berulang, atau audit dependency saat dependency tidak berubah.
6. Pakai tooling yang sudah tersedia. Skill UI seperti Impeccable boleh membantu file yang berubah bila tersedia; hasil scan tidak menggantikan peninjauan visual.
7. Ambil screenshot seperlunya, bukan semua kombinasi viewport. Jangan memasukkan screenshot/log/coverage ke Git. Dokumen QA baru hanya bila ada keputusan atau cacat penting.
8. Laporkan maksimal delapan poin: hasil, visual/interaksi, mode data, pengujian, file utama, status Git/commit, keterbatasan, langkah berikutnya.

Full regression, audit dependency, pemeriksaan aksesibilitas yang lebih lengkap, dan QA lintas halaman dilakukan saat konsolidasi atau menjelang rilis. Perubahan shared primitive/contract harus menguji consumer terdampak meskipun scope fiturnya kecil.

Commit hanya jika diminta pengguna; satu perubahan fitur yang utuh menjadi satu commit bila sesuai. Jangan amend, rebase, squash, push, membuat remote, mengubah Git config, menghapus data material, atau deploy tanpa izin yang relevan.

Jangan berhenti untuk detail kecil seperti jarak atau nama helper. Berhenti dan minta keputusan bila menyangkut klaim produk, perubahan contract bermakna, hak akses sumber, biaya eksternal, keamanan, atau perluasan scope. Jangan mengaku telah menguji hal yang belum dijalankan.

## 13. Deployment dan definisi selesai

**Usulan deployment:** lingkungan lokal → staging → produksi; hosting yang mendukung runtime Next.js/server, PostgreSQL terkelola, serta scheduler untuk job yang memang tersedia. Pemilihan provider mengikuti akses dan budget pengguna, bukan asumsi paket gratis atau integrasi otomatis.

Sediakan konfigurasi environment yang terdokumentasi tanpa nilai rahasia, migrasi database, backup/restore, health check aman, log error, status job terakhir, dan cara rollback. Pisahkan demo/staging dari produksi. Tidak ada secret atau service produksi dibuat hanya karena disebut di PRD.

### Frontend siap ditinjau

Seluruh halaman utama konsisten dengan tema referensi, alur dan kontrol berfungsi dalam mode data yang dinyatakan, responsive, keyboard dapat dipakai, serta loading/empty/error/unknown states tersedia. Backend belum lengkap harus terlihat sebagai keterbatasan integrasi, bukan fitur yang seolah selesai.

### MVP siap dipublikasikan

- Perjalanan katalog → detail → perbandingan → penawaran bekerja dengan data nyata terkurasi; harga manual boleh selama jujur dan memenuhi freshness.
- AI memakai data terpublikasi, menaati syarat wajib, mempunyai sumber dan fallback; tidak sekadar preview.
- Admin dan API terproteksi, tidak ada kebocoran credential, batas biaya/abuse aktif.
- Sumber data dan penggunaan aset telah diverifikasi; data demo tidak tampil sebagai data pasar.
- Uji inti dan build lulus; tidak ada broken core journey, hydration error aplikasi, atau temuan security kritis/high yang belum ditangani atau dinilai secara eksplisit.
- QA visual mobile/desktop, reduced motion, keyboard, contrast baru, serta pemeriksaan screen reader manual dilakukan sebelum acceptance produksi. Keterbatasan dicatat, bukan diganti klaim compliance otomatis.
- Staging diperiksa dan pengguna memberikan izin deployment produksi. Workflow CI dianggap terbukti hanya setelah benar-benar dijalankan.

Keberhasilan awal dinilai melalui evaluasi pengguna: mereka memahami alasan rekomendasi, kompromi, varian, freshness, dan tujuan pembelian. Ukur alur pencarian/rekomendasi sampai membuka penawaran dengan pengumpulan data minimal. Target angka bisnis ditetapkan setelah ada baseline, bukan dikarang sekarang.

## 14. Ketergantungan yang belum terverifikasi

| Kebutuhan | Status / tindakan saat relevan |
| --- | --- |
| Dataset smartphone | Pemilik produk menyiapkan; lanjutkan UI dengan demo berlabel, validasi sampel sebelum impor besar |
| Channel reviewer | Daftar akan diberikan pemilik; siapkan kurasi admin, jangan isi review faktual karangan |
| Akses GSMArena dan hak aset | Verifikasi sebelum pengambilan otomatis/publikasi |
| Marketplace pilot dan sumber harga | Pilih yang aksesnya layak; jangan mengasumsikan API seller menyediakan seluruh katalog marketplace |
| AI/provider/auth/database credentials | Konfigurasi server saat integrasi; jangan meminta secret ditulis dalam PRD |
| Freshness dan jadwal operasional | Default usulan §7; konfirmasi sebelum publikasi berdasarkan sumber yang dipakai |
| Hosting dan domain | Dipilih menjelang staging/deployment, tidak menghalangi implementasi lokal |

**Instruksi mulai untuk AI Agent:** audit singkat kode existing terhadap scope task dan PRD ini. Sampaikan yang bisa digunakan kembali serta gap penting, kemudian implementasikan fitur yang diminta. Jika diminta implementasi penuh, gunakan irisan §11 dan lanjutkan selama masih dalam izin pengguna; jangan menunggu dataset untuk mengerjakan visual, dan jangan menyamarkan demo sebagai integrasi nyata.
