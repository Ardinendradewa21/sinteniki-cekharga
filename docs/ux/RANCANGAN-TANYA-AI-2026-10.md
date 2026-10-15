# Rancangan Ulang Tanya AI — Oktober 2026

Disusun 15 Oktober 2026, setelah deploy pertama ke `sinteniki-cekharga.vercel.app`. Dasarnya adalah kode Tanya AI saat ini (`src/lib/assistant/**`), uji mesin rekomendasi terhadap katalog live, PRD FR-06/FR-08, dan dokumentasi OpenRouter (tool calling, structured outputs, fallback model) lewat Context7.

## 1. Cara kerja sekarang (singkat)

1. Pengguna mengetik. `runChatTurn` (`ai/chat.ts`) memanggil `google/gemini-2.5-flash-lite` dengan satu prompt sistem. Pengaturannya `temperature: 0.3` dan JSON schema ketat, dengan keluaran `kebutuhan`, `balasan` (maksimal 2 kalimat), `pilihan`, dan `cukup`.
2. Saat model menyatakan `cukup = true`, kode menjalankan `recommend()` (`recommend.ts`) yang menyaring dan mengurutkan katalog.
3. Model **tidak pernah melihat hasilnya** dan dilarang menyebut produk. Setelah kartu hasil tampil, percakapan praktis berhenti.

Prinsip pemisahan "model mengobrol, kode menyaring" sudah benar dan wajib dipertahankan (PRD FR-06: syarat wajib lewat logika terstruktur). Masalahnya ada di empat titik berikut.

## 2. Diagnosis: kenapa hasilnya terasa ngawur dan pertanyaannya aneh

### 2.1 Mesin pengurutan (penyebab utama rekomendasi ngawur)

Uji 15 Oktober terhadap katalog live (67 produk):

| Permintaan | Hasil teratas |
| --- | --- |
| Budget **sekitar** 3 juta, main game, prioritas performa | OPPO A6s Rp4,5 jt, **Galaxy Z Flip8 Rp20 jt**, Xiaomi 15T Rp8 jt, **Galaxy Z Fold8 Ultra Rp32,5 jt** |
| Budget **maksimal** 3 juta, foto, prioritas kamera | **0 kandidat** (7 harga lama, 47 di atas budget) |
| Budget sekitar 5 juta, media sosial, baterai | Redmi Note 17 Pro Max Rp7,3 jt di urutan pertama |

Penyebab di kode:

1. **Budget "sekitar" tidak membatasi apa pun.** Kalau `budgetIsHard = false`, kelebihan harga hanya dicatat sebagai kompromi, dan **tidak menurunkan skor**. HP Rp32 juta ikut bersaing dengan HP Rp3 juta.
2. **Kegiatan tidak memengaruhi skor sama sekali.** Skor hanya membaca `priority`.
3. **Skor performa datar.** Setiap HP yang chipset-nya tercatat mendapat +2, sehingga urutannya kembali ke urutan katalog.
4. **Skor kamera memakai megapiksel**, padahal teks alasannya sendiri mengakui megapiksel tidak menentukan kualitas.
5. **Harga basi membuat budget wajib menghasilkan 0 kandidat.** Saat semua harga melewati 30 jam (keadaan sekarang, sebelum cron harian berjalan), pengguna tidak mendapat apa pun.
6. **Tidak ada keragaman.** Tiga HP dari seri yang sama bisa memenuhi tiga posisi teratas.

### 2.2 Alur pertanyaan (penyebab pertanyaan terasa aneh)

1. **Urutan slot kaku:** budget → "budget ini batas keras atau tidak?" → kegiatan → prioritas → "ada syarat wajib?".
   - Pertanyaan "batas keras" dan "syarat wajib" adalah istilah sistem, bukan cara orang berbicara.
   - PRD hanya meminta bertanya *bila tidak jelas*, bukan selalu.
2. **Hasil baru keluar setelah 4–5 giliran.** Orang ingin melihat sesuatu dulu, lalu menyempurnakan.
3. **Kosakata dikunci enum.** Ada 5 kegiatan dan 6 prioritas (satu saja).
   - Permintaan seperti "buat ojol", "anak SD", "buat live TikTok", "yang enak dipegang satu tangan", atau "Genshin rata kanan" dipaksa masuk kotak yang tidak pas, atau diabaikan.
4. **Prioritas hanya satu.** "Kamera bagus tapi baterai juga awet" kehilangan separuh maknanya.

### 2.3 Gaya bahasa (penyebab terasa template)

1. Prompt mewajibkan "maksimal 2 kalimat, akui dulu lalu tanya satu hal". Setiap balasan jadi berpola sama.
2. `temperature: 0.3` dan satu panggilan yang sekaligus mengekstrak data dan menulis balasan membuat teksnya kaku. Ekstraksi butuh suhu rendah, sedangkan gaya butuh variasi.
3. Tidak ada contoh percakapan (few-shot) yang beragam gaya: santai, formal, campur Inggris, salah ketik, singkat.
4. Model kecil (`flash-lite`) cukup untuk ekstraksi, tetapi lemah untuk nuansa bahasa Indonesia sehari-hari.

### 2.4 Setelah hasil keluar

Model tidak menerima daftar kandidat, sehingga tidak bisa:
- menjelaskan "kenapa yang ini?",
- menerima "yang lebih murah dong", "selain Samsung", atau "bandingkan nomor 1 dan 2",
- mengakui "yang cocok persis tidak ada; ini yang paling dekat, dan yang dilanggar adalah …".

## 3. Rancangan target

### 3.1 Arsitektur: percakapan yang berpijak pada alat (tool-grounded)

```
Pengguna ─▶ [Ekstraktor kebutuhan]  model kecil, suhu 0, JSON schema ketat
                │  kebutuhan terstruktur (diperluas, §3.3)
                ▼
          [Kebijakan dialog]  KODE: tanya lagi, tampilkan hasil, atau perbaiki hasil
                │
                ├─▶ [Mesin rekomendasi v2]  KODE: saring syarat wajib, skor, keragaman
                │        │  kandidat + fakta + alasan + pelanggaran
                ▼        ▼
          [Penulis balasan]  model lebih fasih, suhu 0.6–0.7, hanya boleh memakai
                │             fakta dari hasil alat (nama, harga, varian, tanggal)
                ▼
          [Validator]  KODE: nama/harga di balasan harus ada di hasil alat;
                        bila tidak, kalimat dibuang dan diganti teks templat aman
```

- **Ekstraksi dipisah dari penulisan balasan.** Ekstraksi butuh ketepatan, balasan butuh luwes. Dua panggilan kecil lebih stabil daripada satu panggilan yang mengerjakan keduanya.
- **Keputusan "tanya atau tampilkan" dipindah ke kode.** Sekarang keputusan itu ada di tangan model lewat `cukup`. Di kode, aturannya bisa diuji dan konsisten.
- **Model boleh menyebut produk, tetapi hanya yang ada di hasil alat.** Ini tetap memenuhi PRD FR-06 ("rekomendasi merujuk produk terpublikasi, tidak ada harga karangan"), karena validator memeriksa setiap nama dan angka. **Perlu persetujuan PO** karena mengubah aturan prompt saat ini.
- **Pola OpenRouter yang dipakai:**
  - tool calling dengan putaran terbatas (maksimal 3 langkah per giliran, `parallel_tool_calls: false`);
  - `response_format` `json_schema` strict untuk ekstraksi;
  - daftar `models` sebagai cadangan otomatis bila model utama gagal (aturan system design 7);
  - bila semua gagal, formulir "Jawab pertanyaan saja" tetap jalan.

### 3.2 Kebijakan bertanya

1. **Tampilkan dulu, sempurnakan kemudian.** Begitu budget **atau** kegunaan utama diketahui, tampilkan 3 kandidat terbaik beserta label "berdasarkan info sejauh ini". Paling banyak 2 pertanyaan sebelum hasil pertama.
2. **Tanya hanya yang paling mengubah hasil.** Kode menghitung slot mana yang, bila dijawab, paling banyak mengubah daftar teratas, lalu menanyakan itu. Contoh: kalau semua kandidat sudah 5G, jangan tanya 5G.
3. **Budget dianggap "sekitar" (±15%) secara bawaan.**
   - Tanyakan ketegasan budget hanya bila ada kandidat bagus sedikit di atasnya: "Ada yang lebih bagus di Rp3,3 juta, masih masuk?"
   - Jangan pernah bertanya "apakah budget ini batas keras?".
4. **Syarat wajib digali lewat chip setelah hasil pertama**, bukan pertanyaan "ada syarat wajib?". Chip hanya berisi fitur yang **membedakan** kandidat yang tampil, mis. "Harus ada NFC", "Wajib garansi resmi".
5. **Jangan bertanya ulang** apa yang sudah tersirat. "Buat Genshin" sudah berarti game berat dan prioritas performa.
6. **Selalu ada jalan keluar:** chip "Udah, tampilkan aja" dan "Mulai ulang".

### 3.3 Kebutuhan terstruktur yang diperluas

| Field | Sekarang | Usulan |
| --- | --- | --- |
| Budget | `budgetIdr` + `budgetIsHard` | `budgetMin`, `budgetMax`, `budgetFlex` (`ketat`/`sekitar`/`belum`) |
| Kegunaan | 5 enum | enum diperluas (game ringan/berat, foto, video/konten, kerja, sosial, ojol/navigasi, orang tua, anak) + `catatanBebas` (teks pendek, tidak dipakai menyaring) |
| Prioritas | 1 enum | daftar berperingkat sampai 3 |
| Syarat wajib | 9 enum | tetap, ditambah ukuran layar maksimal/minimal dan berat maksimal |
| Merek | ada | tetap |
| Hindari | merek | merek + fitur ("jangan lipat", "tanpa iPhone") |

Sinonim dipetakan di **kode**, bukan diserahkan ke model. Contoh: "ML/Mobile Legends" = game ringan–sedang, "Genshin/HSR/Wuthering" = game berat, "konten/TikTok/vlog" = video. Daftarnya bisa diperluas tanpa mengubah prompt.

### 3.4 Mesin rekomendasi v2 (perbaikan paling berdampak)

1. **Pita budget.**
   - Kandidat di dalam ±15% budget "sekitar" mendapat skor penuh.
   - Di atas +15% skornya turun tajam. Di atas +30% kandidat hanya muncul di bagian "Kalau mau naik sedikit" yang berlabel.
   - Budget "ketat" tetap penyaring keras seperti sekarang.
2. **Skor per kegunaan dan prioritas berbobot.** Prioritas pertama 3×, kedua 2×, ketiga 1×. Kegunaan ikut menyumbang skor.
3. **Tabel kelas chipset** (`chipset_tiers`, diisi admin dengan sumber): kelas 1–5 per chipset. Dipakai **hanya untuk mengurutkan**. Di layar ditulis sebagai fakta berlabel, mis. "Chipset Snapdragon 7s Gen 4 (kelas menengah atas menurut tabel CekHarga)", bukan klaim "lancar main game" (PRD FR-06, FR-08).
4. **Kamera:** skornya memakai telefoto, OIS (bila tercatat), dan ringkasan reviewer beraspek kamera. Megapiksel tidak dipakai.
5. **Keragaman:** maksimal 1 kandidat per seri dan 2 per merek di 3 teratas, kecuali pengguna meminta merek tertentu.
6. **Harga basi tidak membuat hasil kosong.**
   - Kalau tidak ada harga segar, tampilkan kandidat dengan harga terakhir berlabel tanggal dan penjelasan.
   - Kalau ada pelanggaran, sebutkan: "Tidak ada yang lolos semua syarat. Ini yang paling dekat; yang belum terpenuhi: …".
7. **Alasan disusun dari kontribusi skor terbesar,** supaya penjelasan sama dengan alasan urutan sebenarnya.

### 3.5 Gaya bahasa

1. **Persona:** teman yang paham HP, jujur soal kekurangan, tidak jualan.
2. **Ikuti register pengguna:** "aku/kamu", "gue/lo", atau formal. Bahasa campur Inggris dijawab santai. Salah ketik tidak dikoreksi.
3. **Panjang mengikuti konteks:** sapaan pendek, penjelasan hasil boleh 3–5 kalimat. Tidak ada aturan "maksimal 2 kalimat".
4. **8–12 contoh percakapan few-shot** dengan gaya berbeda: singkat, curhat panjang, orang tua yang membelikan anak, gamer, campur Inggris, typo.
5. **Larangan tetap:**
   - tanpa "terbaik", "termurah", atau skor (AGENTS.md, PRD §3);
   - tanpa harga di luar hasil alat;
   - tanpa klaim pengalaman pemakaian yang tidak bersumber reviewer.
6. **Suhu 0.6–0.7** untuk penulis balasan. Model penulis diuji dari kandidat seperti `google/gemini-2.5-flash` dengan cadangan model lain. Pilihannya ditentukan lewat evaluasi §3.7, bukan selera.

### 3.6 Setelah hasil: percakapan perbaikan

Perintah yang dikenali ekstraktor:
- "lebih murah", "naikin dikit budgetnya"
- "selain Samsung"
- "yang kameranya lebih oke"
- "kenapa nomor 2?"
- "bandingkan 1 dan 3"

Untuk "bandingkan", sistem membuka halaman `/compare` yang sudah ada.

Setiap perbaikan menjalankan ulang mesin. Balasan menyebut **apa yang berubah**, mis. "Aku keluarkan Samsung; sekarang muncul Redmi Note 17 Pro dan iQOO Z11."

### 3.7 Evaluasi (wajib sebelum ganti prompt atau model)

1. **Set emas 40 percakapan** di `scripts/tests/fixtures/assistant-eval/`, berisi gaya bahasa beragam dan jawaban yang diharapkan:
   - slot hasil ekstraksi;
   - batas harga kandidat;
   - produk yang **tidak boleh** muncul.
2. **Ukuran keberhasilan:**

| Ukuran | Target |
| --- | --- |
| Akurasi ekstraksi slot | ≥90% |
| Giliran sampai hasil pertama | ≤3 |
| Kandidat teratas di dalam pita budget | ≥95% |
| Nama atau harga di balasan yang tidak ada di hasil alat | **0** |
| Penilaian manusia "terasa natural" pada 20 sampel | ≥4/5 |

3. **Skrip** `pnpm test:assistant-eval` dijalankan setiap kali prompt, model, atau mesin skor berubah. Mesin rekomendasi diuji tanpa model, karena logikanya murni.
4. **Telemetri tanpa isi percakapan** (PRD §10): jumlah giliran, apakah hasil keluar, jumlah kandidat, dan tombol 👍/👎 per hasil.

### 3.8 Batasan yang tetap berlaku

- Rate limit per IP dan kuota harian (aturan system design 1) tetap. Dua panggilan per giliran berarti kuota dihitung per giliran, bukan per panggilan model.
- Timeout 10 detik, retry 1 kali dengan backoff, cadangan model, lalu cadangan formulir (aturan 7).
- Riwayat tidak disimpan di server (PRD §10).
- Status loading mencerminkan proses nyata (PRD FR-06): "Memahami kebutuhan…", lalu "Mencari di 67 produk…", lalu "Menyusun penjelasan…".

## 4. Tahapan

| Tahap | Isi | SP | Dampak |
| --- | --- | --- | --- |
| A | Mesin rekomendasi v2: pita budget, skor kegunaan dan prioritas berbobot, keragaman, harga basi tidak mengosongkan hasil, tabel kelas chipset (struktur + isian awal) | 5 | Menghilangkan rekomendasi ngawur, termasuk di jalur formulir |
| B | Kebijakan bertanya di kode + skema kebutuhan diperluas + kamus sinonim + set emas evaluasi | 5 | Pertanyaan lebih sedikit dan wajar, hasil dalam ≤3 giliran |
| C | Penulis balasan terpisah + validator + few-shot gaya + percakapan perbaikan setelah hasil | 5 | Bahasa natural, bisa "lebih murah" dan "kenapa ini" |

Tahap A tidak bergantung pada model bahasa dan memperbaiki jalur formulir sekaligus, jadi dikerjakan lebih dulu.

**Status 15 Oktober 2026:**

- Tahap A dan B selesai (PB-37, PB-38).
- Tabel kelas chipset sementara ditulis di kode (`src/lib/assistant/chipset-tiers.ts`), belum tabel database yang diisi admin. Pemindahan ke admin dikerjakan bila aturannya sering berubah.
- Pembuka templat "Oke/Siap" dibuang di kode (`tidyReply`), karena model `flash-lite` mengabaikan larangan di prompt (63% balasan). Tahap C mengganti model penulis balasan.
- Evaluasi: `pnpm test:assistant-eval`. Hasil 15 Oktober: ekstraksi 66/66 (100%) dan pembuka templat 0%. Run terakhir lulus tanpa pelanggaran gaya. Satu run sebelumnya mencatat satu balasan memakai "gue" padahal pengguna tidak; model bersifat acak, jadi jalankan evaluasi lebih dari sekali sebelum menyimpulkan.
- Tahap C (PB-39) di Sprint 3.

## 5. Keputusan yang dibutuhkan dari PO

1. Model boleh menyebut produk dan harga **hanya dari hasil alat**, dengan validator (§3.1).
2. Budget dianggap "sekitar ±15%" secara bawaan, dan pertanyaan "batas keras" dihapus (§3.2).
3. Tabel kelas chipset diisi dan dirawat admin, dengan sumber dicatat (§3.4).
4. Anggaran biaya model: dua panggilan per giliran dan model penulis yang lebih fasih.
