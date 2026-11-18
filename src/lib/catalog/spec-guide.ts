/**
 * Bank materi spesifikasi: penjelasan singkat setiap atribut HP dan
 * realitanya dalam pemakaian. Modul murni (tanpa I/O), dipakai halaman
 * perbandingan ("Apa artinya?") dan tabel spesifikasi di detail produk.
 *
 * Aturan menulis (keputusan PO 18 Nov 2026, PRD §3, FR-04, FR-06):
 *
 * - Ringkas dan to the point: satu kalimat "apa ini", lalu 2-4 butir realita.
 * - Menjelaskan arti angka, bukan memilih pemenang. Tidak ada "terbaik",
 *   skor, atau rekomendasi merek.
 * - Tidak menyimpulkan pengalaman (baterai, gaming, foto) dari angka saja;
 *   bila pengalaman nyata yang menentukan, arahkan ke ulasan.
 * - Klaim teknis hanya yang umum berlaku dan bisa ditelusuri ke standar atau
 *   dokumentasi pabrikan (kolom `reference`).
 *
 * Status: DRAF untuk ditinjau PO. Ubah teksnya di sini saja; tampilan
 * mengambil dari modul ini.
 */

export type SpecGuideEntry = {
  /** Sama dengan label baris spesifikasi (`ProductSpecRow.label`). */
  label: string;
  /** Satu kalimat: atribut ini mengukur apa. */
  what: string;
  /** Realita pemakaian, 2-4 butir pendek. */
  reality: readonly string[];
  /** Standar atau rujukan umum, bila ada. */
  reference?: string;
};

const ENTRIES: readonly SpecGuideEntry[] = [
  {
    label: "Layar",
    what: "Ukuran diagonal layar dalam inci dan jenis panelnya.",
    reality: [
      "Selisih 0,2 inci hampir tidak terasa; ukuran genggam lebih ditentukan bentuk bodi dan bingkai layar.",
      "AMOLED/OLED: hitam pekat dan kontras tinggi. LCD (IPS): umumnya lebih murah, warna hitam tampak keabu-abuan.",
      "Kecerahan di bawah matahari tidak terlihat dari ukuran atau jenis panel; cek ulasan.",
    ],
  },
  {
    label: "Refresh rate",
    what: "Berapa kali layar menggambar ulang tampilan setiap detik, dalam hertz (Hz).",
    reality: [
      "60 Hz adalah standar lama; 90 sampai 120 Hz membuat gulir dan animasi tampak lebih halus.",
      "Banyak game dan video tetap berjalan di 30 sampai 60 fps, jadi manfaatnya paling terasa saat menggulir.",
      "Refresh rate tinggi memakai daya lebih; banyak HP menurunkannya otomatis saat layar diam.",
    ],
  },
  {
    label: "Chipset",
    what: "Prosesor utama yang menentukan kecepatan aplikasi, kemampuan game, pengolahan foto, dan efisiensi daya.",
    reality: [
      "Kelas chipset di CekHarga (entry sampai flagship) adalah pengelompokan menurut seri dan generasi pabrikan, bukan hasil benchmark.",
      "Kelas lebih tinggi umumnya lebih kencang dan lebih lama terasa lancar, tetapi pendinginan dan perangkat lunak tiap HP ikut menentukan.",
      "Untuk game, cek ulasan yang menguji game yang Anda mainkan; lembar spesifikasi tidak menunjukkan kestabilan frame atau panas.",
    ],
  },
  {
    label: "Sistem operasi",
    what: "Versi Android atau iOS beserta antarmuka bawaan merek saat HP dicatat.",
    reality: [
      "Versi lebih baru berarti fitur dan tambalan keamanan lebih baru sejak awal.",
      "Yang lebih menentukan umur pakai: berapa tahun pabrikan menjanjikan pembaruan OS dan keamanan untuk seri itu.",
      "Antarmuka merek (One UI, HyperOS, ColorOS, dan lainnya) memengaruhi aplikasi bawaan dan iklan sistem.",
    ],
  },
  {
    label: "Kamera utama",
    what: "Resolusi sensor kamera belakang utama dalam megapiksel (MP).",
    reality: [
      "MP lebih tinggi memberi ruang memotong (crop) foto lebih besar, bukan jaminan foto lebih bagus.",
      "Kualitas foto lebih ditentukan ukuran sensor, lensa, stabilisasi (OIS), dan pengolahan gambar; HP 50 MP bisa kalah di foto malam dari HP 12 MP.",
      "Kamera 50 sampai 200 MP umumnya menggabungkan piksel dan menyimpan foto sekitar 12 MP secara bawaan.",
    ],
  },
  {
    label: "Susunan kamera",
    what: "Jumlah dan jenis kamera belakang: utama, ultrawide (sudut lebar), telefoto (zoom optik), makro, atau depth.",
    reality: [
      "Ultrawide berguna untuk foto ruangan, gedung, dan rombongan.",
      "Telefoto memberi zoom optik tanpa memotong gambar; hasilnya jauh lebih tajam daripada zoom digital pada jarak yang sama.",
      "Kamera makro atau depth 2 MP umumnya hanya menambah jumlah lensa; jumlah lensa bukan ukuran kualitas.",
    ],
  },
  {
    label: "Baterai",
    what: "Kapasitas baterai dalam miliampere-jam (mAh).",
    reality: [
      "Kapasitas lebih besar berarti cadangan energi lebih banyak, tetapi daya tahan nyata juga bergantung pada efisiensi chipset, layar, dan perangkat lunak.",
      "Selisih di bawah sekitar 10% jarang terasa dalam pemakaian harian.",
      "Baterai lebih besar sering membuat bodi lebih tebal atau berat; cek bobotnya juga.",
      "Untuk daya tahan nyata, rujuk ulasan yang menguji pemakaian.",
    ],
  },
  {
    label: "Pengisian",
    what: "Daya pengisian kabel maksimum yang didukung, dalam watt (W).",
    reality: [
      "Watt lebih tinggi umumnya lebih cepat terisi, terutama dari kosong ke sekitar 50%; mendekati penuh pengisian melambat.",
      "Kecepatan tertulis butuh charger dan kabel yang mendukung; sebagian HP tidak menyertakan charger di kotak.",
      "Kapasitas baterai ikut menentukan: watt lebih tinggi ke baterai lebih besar tidak selalu lebih cepat penuh.",
    ],
  },
  {
    label: "RAM",
    what: "Memori kerja untuk aplikasi yang sedang berjalan.",
    reality: [
      "RAM lebih besar membuat lebih banyak aplikasi tetap terbuka di latar tanpa dimuat ulang.",
      "Untuk pemakaian umum Android saat ini 8 GB umumnya cukup lega; 12 GB ke atas terasa untuk multitasking berat dan game besar.",
      "RAM virtual (diambil dari penyimpanan) tidak setara RAM fisik dan tidak dihitung di CekHarga.",
    ],
  },
  {
    label: "Penyimpanan",
    what: "Ruang untuk sistem, aplikasi, foto, dan video.",
    reality: [
      "Sistem dan aplikasi bawaan sudah memakai belasan GB, jadi ruang kosong lebih kecil dari angka di kotak.",
      "Video 4K dan game besar cepat menghabiskan ruang; 128 GB mulai sempit untuk pemakaian itu.",
      "Kapasitas penyimpanan tidak bisa ditambah setelah membeli, kecuali HP punya slot microSD (cek halaman resmi).",
    ],
  },
  {
    label: "Bobot",
    what: "Berat HP tanpa casing, dalam gram.",
    reality: [
      "Selisih di bawah sekitar 15 gram jarang terasa.",
      "HP di atas sekitar 200 gram mulai terasa saat dipakai satu tangan dalam waktu lama.",
      "Bobot biasanya naik seiring baterai dan kamera yang lebih besar.",
    ],
  },
  {
    label: "Ketahanan (IP rating)",
    what: "Kode IP: angka pertama perlindungan dari debu (0-6), angka kedua perlindungan dari air (0-9).",
    reality: [
      "IP68: rapat debu dan tahan terendam lebih dari 1 meter (kedalaman dan lamanya ditentukan pabrikan). IP67: terendam sampai 1 meter selama 30 menit. IP54: debu terbatas dan cipratan air.",
      "Uji dilakukan dengan air tawar di laboratorium; air laut, kolam berklorin, air sabun, dan air panas tidak termasuk.",
      "Kerusakan karena air sering tidak ditanggung garansi meski HP ber-IP68, dan segel bisa melemah seiring waktu atau setelah servis.",
    ],
    reference: "Standar IEC 60529 (kode IP)",
  },
  {
    label: "Jaringan",
    what: "Generasi jaringan seluler tertinggi yang didukung: 4G LTE atau 5G.",
    reality: [
      "Manfaat 5G hanya terasa di area yang sudah terjangkau 5G operator Anda; di luar itu HP memakai 4G.",
      "Dukungan 5G juga bergantung pada pita frekuensi; cek kecocokannya dengan operator yang dipakai.",
    ],
  },
  {
    label: "NFC",
    what: "Komunikasi jarak sangat dekat dengan menempelkan HP ke kartu atau perangkat lain.",
    reality: [
      "Di Indonesia NFC paling sering dipakai untuk cek dan isi saldo kartu uang elektronik (mis. e-money, Flazz, Brizzi, TapCash) lewat aplikasi bank.",
      "Pembayaran QRIS memakai kamera, bukan NFC.",
      "Sebagian model hanya punya NFC di wilayah tertentu; pastikan berlaku untuk varian Indonesia.",
    ],
  },
  {
    label: "Jack headphone 3.5mm",
    what: "Colokan standar untuk headphone atau earphone kabel.",
    reality: [
      "Tanpa jack, earphone kabel butuh adaptor USB-C, atau pakai earphone USB-C atau Bluetooth.",
      "Berguna bagi yang memakai earphone kabel, mikrofon klip, atau ingin audio tanpa jeda Bluetooth.",
    ],
  },
  {
    label: "Tahun rilis",
    what: "Tahun model ini pertama kali diumumkan.",
    reality: [
      "Model lebih baru umumnya masih punya sisa jatah pembaruan OS dan keamanan lebih panjang.",
      "Model lama bisa tetap masuk akal bila harganya sudah turun jauh dan kebutuhan Anda terpenuhi.",
      "Tahun rilis global dan waktu masuk Indonesia bisa berbeda beberapa bulan.",
    ],
  },
  {
    label: "Garansi",
    what: "Jenis garansi varian yang dicatat, mis. resmi Indonesia atau garansi distributor/toko.",
    reality: [
      "Garansi resmi dilayani pusat servis merek di Indonesia sesuai ketentuan pabrikan.",
      "HP yang IMEI-nya tidak terdaftar bisa tidak mendapat sinyal operator Indonesia; HP dari luar negeri perlu didaftarkan.",
      "Garansi distributor atau toko hanya dilayani penjualnya, dengan syarat yang berbeda-beda.",
    ],
    reference: "Aturan pendaftaran IMEI (berlaku sejak 2020)",
  },
];

const BY_LABEL = new Map(ENTRIES.map((entry) => [entry.label, entry]));

export const SPEC_GUIDE: readonly SpecGuideEntry[] = ENTRIES;

/** Penjelasan untuk satu label spesifikasi, atau `null` bila belum ada. */
export function specGuideFor(label: string): SpecGuideEntry | null {
  return BY_LABEL.get(label) ?? null;
}

/** Penjelasan untuk sekumpulan label, urutan mengikuti label, tanpa duplikat. */
export function specGuidesFor(labels: readonly string[]): SpecGuideEntry[] {
  const seen = new Set<string>();
  const result: SpecGuideEntry[] = [];
  for (const label of labels) {
    const entry = BY_LABEL.get(label);
    if (entry && !seen.has(label)) {
      seen.add(label);
      result.push(entry);
    }
  }
  return result;
}
