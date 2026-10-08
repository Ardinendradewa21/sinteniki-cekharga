import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { PRICING_POLICY } from "@/lib/config";
import { isDemoData } from "@/lib/catalog/queries";
import { COMPANY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pertanyaan Umum",
  description:
    "Jawaban singkat soal status harga, arti mulai dari, kurasi ulasan, kesiapan asisten, dan data demo di CekHarga.",
};

/**
 * Pertanyaan Umum.
 *
 * Setiap jawaban di sini harus cocok dengan perilaku sistem yang benar-benar
 * berjalan. Kalau suatu hari perilakunya berubah (misal jendela freshness atau
 * status asisten), halaman ini ikut berubah, bukan dibiarkan jadi arsip yang
 * menyesatkan. Angka kebijakan dibaca dari konfigurasi, bukan diketik ulang.
 *
 * Memakai <details>/<summary> bawaan browser: bisa dibuka dengan keyboard,
 * dibacakan pembaca layar, dan tetap berfungsi tanpa JavaScript. Tidak perlu
 * komponen accordion ber-JS untuk pekerjaan yang sudah dilakukan HTML.
 */

type Faq = {
  question: string;
  answer: React.ReactNode;
};

const GENERAL: Faq[] = [
  {
    question: "Apakah saya bisa membeli HP langsung di CekHarga?",
    answer: (
      <>
        Tidak. CekHarga alat bantu keputusan, bukan marketplace. Kami tidak
        memproses transaksi, pembayaran, maupun pengiriman. Setelah menemukan
        kandidat yang cocok, pembelian dilakukan di marketplace tujuan dengan
        ketentuan mereka.
      </>
    ),
  },
  {
    question: "Perlu membuat akun?",
    answer: (
      <>
        Tidak perlu, dan memang belum ada pendaftaran akun. Filter katalog dan
        jawaban konsultasi tersimpan di alamat URL halaman, jadi kamu bisa
        menyalin tautannya untuk membuka kembali hasil yang sama atau
        membagikannya ke orang lain.
      </>
    ),
  },
  {
    question: "Apakah CekHarga menerima bayaran dari merek atau penjual?",
    answer: (
      <>
        Tidak ada penempatan berbayar, konten bersponsor, maupun tautan afiliasi
        pada versi ini. Urutan produk mengikuti data apa adanya, bukan siapa
        yang membayar. Kalau kelak ada tautan afiliasi, pengungkapannya
        ditampilkan lebih dulu di halaman Cara Kerja dan Ketentuan Layanan.
      </>
    ),
  },
];

const PRICING: Faq[] = [
  {
    question: "Harganya real-time?",
    answer: (
      <>
        Bukan. Harga diperiksa berkala, lalu ditampilkan bersama waktu
        pemeriksaan terakhir yang berhasil. Pemeriksaan yang gagal tidak pernah
        memajukan waktu itu, jadi yang kamu lihat adalah kapan angka tersebut
        benar-benar terkonfirmasi, bukan kapan halaman dibuka.
      </>
    ),
  },
  {
    question: "Apa arti “mulai dari”?",
    answer: (
      <>
        Harga terendah di antara penawaran tercatat yang memenuhi syarat kami:
        kondisi baru, listing aktif, dan harga yang terlihat tanpa harus masuk
        akun. Voucher, cashback, kupon, dan ongkos kirim tidak ikut dihitung.
        Ini bukan klaim termurah se-internet.
      </>
    ),
  },
  {
    question: "Kenapa ada produk yang tertulis “Harga belum tersedia”?",
    answer: (
      <>
        Karena tidak ada penawaran yang memenuhi syarat saat ini, atau karena
        catatan harganya sudah lebih tua dari{" "}
        {PRICING_POLICY.freshnessWindowHours} jam. Harga kedaluwarsa tidak
        dipromosikan menjadi harga aktif. Kalau ada catatan terakhirnya, angka
        itu ditampilkan terpisah dan diberi keterangan bahwa sifatnya historis.
      </>
    ),
  },
  {
    question: "Harga di marketplace berbeda dari yang saya lihat di sini.",
    answer: (
      <>
        Itu bisa terjadi dan bukan kesalahan pembacaan. Penjual dapat mengubah
        harga kapan saja setelah pemeriksaan terakhir kami. Angka di CekHarga
        adalah catatan pada waktu tertentu, bukan penawaran yang mengikat. Harga
        akhir selalu yang tertera di marketplace saat kamu bertransaksi.
      </>
    ),
  },
  {
    question: "Kenapa harga terikat pada varian tertentu?",
    answer: (
      <>
        Karena RAM dan penyimpanan mengubah harga secara signifikan. Menyebut
        satu harga untuk sebuah model tanpa menyebut variannya akan menyesatkan,
        jadi setiap harga di sini selalu membawa varian acuannya.
      </>
    ),
  },
];

const CONTENT: Faq[] = [
  {
    question: "Bagaimana ulasan reviewer dikurasi?",
    answer: (
      <>
        Dipilih manual dari channel yang kami ikuti, lalu diringkas dengan
        atribusi nama channel dan konteks pengujiannya. Ringkasan itu pendapat
        reviewer, bukan pendapat CekHarga, dan bukan kesimpulan yang ditarik
        otomatis dari angka spesifikasi.
      </>
    ),
  },
  {
    question: "Kenapa ada kolom yang ditulis “belum diketahui”?",
    answer: (
      <>
        Karena datanya memang belum ada. Kolom kosong tidak diisi angka
        perkiraan dan tidak dianggap nol, sebab keduanya akan membuat
        perbandingan terlihat lebih pasti daripada kenyataannya.
      </>
    ),
  },
  {
    question: "Apakah asisten AI-nya sudah bisa dipakai?",
    answer: (
      <>
        Belum sepenuhnya. Penyaringan kandidat sudah berjalan sungguhan di
        server dan syarat yang kamu tandai wajib benar-benar disaring lewat
        perhitungan, bukan janji model. Yang belum ada adalah lapisan percakapan
        bahasa bebas, karena integrasi modelnya dikerjakan di sisi server.
        Katalog tetap bisa dipakai penuh tanpa asisten.
      </>
    ),
  },
  {
    question: "Kenapa perbandingan tidak menentukan pemenang?",
    answer: (
      <>
        Karena “terbaik” bergantung pada kebutuhanmu, dan sebagian data yang
        menentukan rasa pemakaian tidak bisa disimpulkan dari angka. Yang kami
        tampilkan adalah perbedaannya secara jelas, termasuk apa yang
        dikorbankan, supaya penilaian akhirnya tetap milikmu.
      </>
    ),
  },
];

function FaqGroup({ title, items }: { title: string; items: Faq[] }) {
  return (
    <section className="border-t border-border pt-8">
      <h2 className="heading-section text-foreground">
        {title}
      </h2>
      <StaggerList as="div" className="mt-4 space-y-3">
        {items.map((item) => (
          <StaggerItem as="div" key={item.question}>
            <details className="group rounded-xl border border-border bg-card transition-colors duration-150 hover:border-border-strong">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-5 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {item.question}
                {/* Penanda buka/tutup; berputar 150ms sesuai skala micro PRD §8. */}
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-pill border border-border text-muted-foreground transition-transform duration-150 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-base leading-relaxed text-muted-foreground">
                {item.answer}
              </div>
            </details>
          </StaggerItem>
        ))}
      </StaggerList>
    </section>
  );
}

export default function FaqPage() {
  const usingDemoData = isDemoData();

  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="heading-page text-foreground">
          Pertanyaan umum
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Jawaban singkat untuk hal yang paling sering membingungkan. Untuk
          penjelasan lebih dalam soal sumber data dan metode, lihat halaman Cara
          Kerja.
        </p>
      </header>

      {usingDemoData ? (
        <div className="mt-8 rounded-xl border border-border bg-warning-muted p-5">
          <p className="text-sm font-semibold text-warning">
            Saat ini berjalan dengan data demo
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            Produk, harga, dan ulasan yang tampil berasal dari data contoh
            dengan merek fiktif. Aturannya sudah berjalan sungguhan, tapi
            angkanya belum boleh dipakai sebagai acuan membeli.
          </p>
        </div>
      ) : null}

      <div className="mt-12 max-w-3xl space-y-10">
        <FaqGroup title="Tentang layanan" items={GENERAL} />
        <FaqGroup title="Harga dan varian" items={PRICING} />
        <FaqGroup title="Data, ulasan, dan asisten" items={CONTENT} />

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="heading-card text-foreground">
            Pertanyaanmu belum terjawab?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {COMPANY.email
              ? "Kirimkan ke alamat kontak kami. Koreksi atas data yang keliru juga sangat membantu."
              : "Kanal kontak resmi belum dibuka pada versi ini. Sementara itu, halaman Cara Kerja memuat penjelasan terlengkap soal sumber data dan keterbatasannya."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/how-it-works">Baca cara kerjanya</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/terms">Ketentuan Layanan</Link>
            </Button>
          </div>
        </section>
      </div>
    </Container>
  );
}
