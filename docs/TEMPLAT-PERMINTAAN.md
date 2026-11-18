# Templat permintaan untuk Claude Code

Salin bagian di bawah, isi yang perlu saja, lalu kirim. Bagian yang kosong boleh dihapus; Claude akan menanyakannya bila penting.

```
Tujuan:
  (apa yang ingin dicapai dan untuk siapa, mis. "pembeli awam paham beda spesifikasi saat membandingkan")

Halaman / fitur:
  (mis. /compare, Tanya AI, admin > produk > penawaran)

Yang terlihat sekarang:
  (jelaskan atau lampirkan screenshot; sebutkan perangkat: HP/laptop, tema terang/gelap)

Yang saya inginkan:
  (sespesifik mungkin: ukuran, isi, perilaku, contoh dari situs lain bila ada)

Jangan diubah / batasan:
  (mis. "jangan sentuh harga", "tetap tanpa skor")

Selesai bila:
  (cara memeriksa hasilnya, mis. "di HP teks spesifikasi minimal 16px dan ada penjelasan per atribut")

Prioritas:     tinggi / sedang / rendah
Deploy ke produksi setelah selesai?   ya / tidak / tanya saya dulu
```

## Yang Claude lakukan dengan permintaan ini

1. Merangkum pemahaman dan menandai bagian yang ambigu.
2. Memeriksa kode, produksi, dan data (hanya membaca) untuk bukti.
3. Mengajukan rencana dan pilihan keputusan, dengan rekomendasi.
4. Mengerjakan setelah Anda mengonfirmasi, lalu menguji.
5. Melaporkan: apa yang berubah, angka uji, sisa pekerjaan, dan keputusan yang menunggu Anda.

Aturan lengkapnya ada di `CLAUDE.md` bagian "Cara kerja dengan PO".
