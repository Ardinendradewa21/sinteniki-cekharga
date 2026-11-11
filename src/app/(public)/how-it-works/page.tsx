import Link from "next/link";
import type { Metadata } from "next";

import { DemoBadge } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { PRICING_POLICY } from "@/lib/config";
import { loadOrNull } from "@/lib/catalog/load";
import { formatCheckedAt } from "@/lib/catalog/pricing";
import { isDemoData, loadPublishedCatalog } from "@/lib/catalog/queries";
import { catalogStats, type CatalogStats } from "@/lib/catalog/stats";

export const metadata: Metadata = {
  title: "Cara Kerja",
  description:
    "Sumber data, arti harga dan waktu pemeriksaan, metode kurasi review, serta keterbatasan CekHarga.",
};

/**
 * Transparansi (PRD FR-08).
 *
 * Syarat penerimaannya spesifik: "pengguna dapat membedakan data aktual, demo,
 * informasi lama, pendapat reviewer, dan inferensi AI tanpa perlu membaca
 * kode". Karena itu halaman ini bukan sekadar prosa, melainkan memuat legenda
 * penanda yang BENAR-BENAR dipakai di antarmuka, sehingga pembaca bisa
 * mencocokkan apa yang dilihatnya di halaman lain.
 *
 * Angka kebijakan diambil dari konfigurasi, bukan ditulis ulang di sini, supaya
 * halaman ini tidak pernah berbeda dari perilaku sistem yang sebenarnya
 * (PRD §7).
 *
 * Tidak ada klaim kemitraan, afiliasi, atau cakupan yang belum ada. Kalau kelak
 * dipakai tautan afiliasi, pengungkapannya ditambahkan di sini.
 */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border pt-8">
      <h2 className="heading-section text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

const MARKERS = [
  {
    sample: "demo" as const,
    meaning: "Data contoh, bukan data pasar",
    detail:
      "Angka dan produknya berasal dari fixture untuk pengembangan. Merek dan modelnya fiktif. Jangan dipakai sebagai acuan membeli.",
  },
  {
    sample: "Rp1.899.000" as const,
    meaning: "Harga aktif",
    detail:
      "Berasal dari penawaran yang cocok variannya, kondisinya baru, listingnya aktif, dan pemeriksaannya masih cukup baru.",
  },
  {
    sample: "Harga belum tersedia" as const,
    meaning: "Tidak ada penawaran yang memenuhi syarat",
    detail:
      "Ini bukan berarti gratis, murah, atau mahal. Artinya kami tidak punya angka yang bisa dipertanggungjawabkan saat ini.",
  },
  {
    sample: "Harga terakhir tercatat" as const,
    meaning: "Informasi lama, bukan harga berlaku",
    detail:
      "Pernah teramati, tapi sudah melewati batas kebaruan. Angkanya tetap tampil dengan label dan waktu pencatatannya, tidak ikut filter budget, dan diurutkan setelah harga aktif.",
  },
  {
    sample: "Belum diketahui" as const,
    meaning: "Data belum diverifikasi",
    detail:
      "Atributnya sengaja dikosongkan, bukan ditebak. Pada perbandingan, atribut seperti ini ditandai belum lengkap dan tidak dihitung sebagai kelebihan atau kekurangan.",
  },
  {
    sample: "Gawai Harian" as const,
    meaning: "Pendapat reviewer, bukan pengukuran kami",
    detail:
      "Setiap klaim pengalaman membawa nama channel yang mengatakannya, beserta konteks pengujiannya bila dicatat.",
  },
];

/**
 * Angka katalog saat ini (PB-30), dihitung dari data yang sama dengan
 * halaman lain. Tanpa jumlah pengguna atau kunjungan (PRD FR-01, FR-05).
 */
function LiveStats({ stats, now, isDemo }: { stats: CatalogStats; now: Date; isDemo: boolean }) {
  const freshShare = stats.products > 0 ? Math.round((stats.freshProducts / stats.products) * 100) : 0;
  const items = [
    { label: "Produk terbit", value: stats.products.toLocaleString("id-ID"), note: `${stats.brands} merek` },
    { label: "Penawaran aktif", value: stats.activeOffers.toLocaleString("id-ID"), note: `dari ${stats.stores} toko` },
    {
      label: "Harga masih segar",
      value: `${freshShare}%`,
      note: `${stats.freshProducts} dari ${stats.products} produk diperiksa dalam ${PRICING_POLICY.freshnessWindowHours} jam terakhir`,
    },
    {
      label: "Pemeriksaan terakhir",
      value: stats.latestCheckAt ? formatCheckedAt(stats.latestCheckAt, now) : "Belum ada",
      note: "pemeriksaan harga berhasil yang paling baru",
    },
  ];
  return (
    <div>
      {isDemo ? <DemoBadge /> : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="tabular mt-1 text-2xl font-extrabold tracking-tight text-foreground">{item.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{item.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function HowItWorksPage() {
  const usingDemoData = isDemoData();
  const now = new Date();
  const catalog = await loadOrNull(() => loadPublishedCatalog(now));
  const stats = catalog ? catalogStats(catalog, now) : null;

  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="heading-page text-foreground">
          Cara kerja CekHarga
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Halaman ini menjelaskan dari mana angkanya berasal, apa artinya, dan
          apa yang belum bisa kami lakukan. Kalau ada yang terbaca ambigu di
          halaman lain, jawabannya seharusnya ada di sini.
        </p>
      </header>

      {usingDemoData ? (
        <div className="mt-8 rounded-xl border border-border bg-warning-muted p-5">
          <p className="text-sm font-semibold text-warning">
            Saat ini berjalan dengan data demo
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            Seluruh produk, harga, penawaran, dan review yang kamu lihat berasal
            dari fixture pengembangan. Merek dan modelnya fiktif supaya tidak
            tertukar dengan data pasar sungguhan. Dataset asli belum tersedia.
          </p>
        </div>
      ) : null}

      <div className="mt-12 space-y-10">
        {stats ? (
          <Section id="angka" title="Angka katalog saat ini">
            <p>
              Dihitung langsung dari data yang sama dengan yang kamu lihat di katalog. Angka &quot;harga masih
              segar&quot; sengaja ditampilkan apa adanya, termasuk saat sedang rendah, karena harga yang belum
              diperiksa ulang selalu kami beri label.
            </p>
            <LiveStats stats={stats} now={now} isDemo={usingDemoData} />
          </Section>
        ) : null}

        <Section id="sikap" title="Sikap kami">
          <ul className="list-disc space-y-2 pl-5">
            <li>Urutan produk tidak dijual. Iklan dan produk sponsor selalu berlabel &quot;Iklan&quot; atau &quot;Sponsor&quot; dan tidak mengubah harga, urutan, maupun hasil perbandingan.</li>
            <li>Kami tidak memberi skor atau gelar &quot;terbaik&quot;. Yang kami tampilkan adalah fakta tercatat, kompromi, dan sumbernya.</li>
            <li>Saat ini belum ada tautan afiliasi. Bila kelak dipakai, tautannya akan diberi tanda dan dijelaskan di halaman ini.</li>
            <li>Tidak ada angka pengguna, testimoni, atau label &quot;terverifikasi&quot; yang tidak bisa kami buktikan.</li>
          </ul>
        </Section>

        <Section id="penanda" title="Cara membaca penandanya">
          <p>
            Kamu tidak perlu menebak jenis informasi yang sedang dilihat. Setiap
            jenis punya penanda tetap di seluruh situs.
          </p>
          <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
            {MARKERS.map((marker) => (
              <div key={marker.meaning} className="p-5">
                <dt className="flex flex-wrap items-center gap-3">
                  {marker.sample === "demo" ? (
                    <DemoBadge />
                  ) : (
                    <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold text-foreground">
                      {marker.sample}
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">
                    {marker.meaning}
                  </span>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {marker.detail}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="spesifikasi" title="Sumber spesifikasi">
          <p>
            Spesifikasi perangkat berasal dari sumber data terpisah dari harga,
            dan setiap halaman detail menyebut sumbernya di bawah tabel
            spesifikasi. Atribut yang belum kami verifikasi dibiarkan kosong dan
            ditandai, bukan diisi perkiraan.
          </p>
          <p>
            Spesifikasi bukan sumber harga. Angka spesifikasi juga tidak kami
            pakai untuk menyimpulkan rasa pemakaian; untuk itu kami mengandalkan
            reviewer.
          </p>
        </Section>

        <Section id="harga" title="Arti “mulai dari” dan penawaran yang dihitung">
          <p>
            “Mulai dari” adalah harga terendah dari penawaran tercatat yang
            memenuhi syarat <strong className="text-foreground">dalam cakupan CekHarga</strong>. Ini
            bukan jaminan harga termurah di seluruh internet.
          </p>
          <p>Sebuah penawaran baru dihitung kalau memenuhi semuanya:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>variannya cocok dengan yang sedang kamu lihat;</li>
            <li>kondisinya baru, karena versi awal ini belum mencakup bekas;</li>
            <li>listingnya aktif, bukan habis stok atau ambigu;</li>
            <li>
              harganya masih cukup baru menurut batas kebaruan{" "}
              {PRICING_POLICY.freshnessWindowHours} jam.
            </li>
          </ul>
          <p>
            Kartu yang menampilkan harga terendah lintas varian selalu menyebut
            varian acuannya, supaya harga dan spesifikasi tidak berasal dari
            varian yang berbeda.
          </p>
          <p>
            Yang kami catat adalah harga jual yang terlihat tanpa syarat pribadi.
            Voucher, cashback, dan kupon akun{" "}
            <strong className="text-foreground">tidak</strong> ikut dihitung,
            karena ketersediaannya berbeda untuk tiap orang.
          </p>
        </Section>

        <Section id="pemeriksaan" title="Arti waktu pemeriksaan">
          <p>
            Harga diperiksa berkala, bukan real-time. Yang kami tampilkan adalah
            waktu pemeriksaan yang{" "}
            <strong className="text-foreground">berhasil</strong> terakhir.
          </p>
          <p>
            Percobaan yang gagal tidak pernah memajukan waktu itu, dan
            penyuntingan data lain juga tidak membuat harga terlihat baru. Jadi
            kalau tertulis diperiksa empat jam lalu, artinya empat jam lalu kami
            benar-benar berhasil membaca harganya.
          </p>
        </Section>

        <Section id="marketplace" title="Cakupan marketplace">
          <p>
            Versi awal ini dimulai dari satu marketplace pilot. Cakupannya belum
            luas, jadi wajar kalau sebuah produk punya penawaran di tempat lain
            yang belum kami catat.
          </p>
          <p>
            CekHarga bukan marketplace. Kami tidak memproses transaksi, tidak
            menahan stok, dan tidak menentukan harga akhir. Pembelian sepenuhnya
            terjadi di marketplace tujuan dengan syarat mereka.
          </p>
          <p>
            Kami belum memakai tautan afiliasi dan belum punya kemitraan dengan
            marketplace mana pun. Kalau nanti ada, pengungkapannya akan muncul di
            halaman ini lebih dulu.
          </p>
        </Section>

        <Section id="review" title="Cara review dikurasi">
          <p>
            Ringkasan pengalaman berasal dari video reviewer yang dikurasi
            manual, bukan diambil otomatis dan bukan hasil pengujian kami.
          </p>
          <p>
            Setiap ringkasan membawa nama channel, tanggal publikasi, aspek yang
            dibahas, dan konteks pengujiannya bila reviewer mencatatnya. Kalau
            konteksnya tidak ada, kami tulis tidak dicatat, karena klaim tanpa
            konteks sulit kamu nilai sendiri.
          </p>
          <p>
            Dua reviewer boleh berbeda pendapat tentang produk yang sama, dan
            keduanya tetap kami tampilkan. Kami tidak melebur perbedaan itu
            menjadi satu kesimpulan.
          </p>
        </Section>

        <Section id="ai" title="Keterbatasan asisten">
          <p>
            Syarat wajib yang kamu tetapkan, seperti budget maksimal atau
            keharusan garansi resmi, disaring lewat perhitungan di server, bukan
            diserahkan ke model bahasa. Kandidat yang tidak memenuhinya tidak
            akan muncul sebagai kandidat yang sesuai.
          </p>
          <p>
            Kandidat yang harganya belum bisa dipastikan tidak dianggap masuk
            budget. Kandidat yang melewati budget keras dipisahkan dan diberi
            label, bukan dicampur begitu saja.
          </p>
          <p>
            Asisten tidak menilai rasa pemakaian dari angka spesifikasi. Kalau ia
            menyebut sesuatu soal pengalaman, itu berasal dari reviewer dan
            nama channel-nya disebutkan.
          </p>
          <p>
            Kamu bisa bercerita dengan kalimat bebas. Kalau model bahasa sedang
            tidak tersedia, asisten memakai pertanyaan bertahap, dan kandidatnya
            tetap disaring dengan aturan yang sama.
          </p>
        </Section>

        <Section id="batasan" title="Yang belum tercakup">
          <p>
            Versi awal ini terbatas pada smartphone kondisi baru, bahasa
            Indonesia, dan Rupiah. Belum ada laptop atau kategori lain, belum ada
            barang bekas, dan belum ada pelacakan promo atau voucher.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Katalog belum mencakup semua model. Banyak model Infinix, Tecno,
              itel, dan realme belum masuk.
            </li>
            <li>
              Harga marketplace dimasukkan berkala, belum diambil otomatis dari
              semua toko. Harga situs resmi diperiksa harian untuk merek yang
              situsnya mencantumkan harga.
            </li>
            <li>
              Ringkasan reviewer masih sedikit, dan banyak produk belum punya.
              Kami tidak menguji perangkat sendiri, jadi kualitas kamera dan
              baterai nyata kami rujuk ke reviewer.
            </li>
            <li>Belum bisa memberi tahu saat harga turun.</li>
            <li>Tidak menilai reputasi penjual.</li>
          </ul>
          <p>
            Kami juga tidak memberi skor atau peringkat kualitas. Perbandingan
            menunjukkan perbedaan dan komprominya, lalu keputusannya tetap milik
            kamu.
          </p>
        </Section>
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ada yang masih terbaca ambigu atau terasa menyesatkan? Itu masalah yang
          ingin kami tahu.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/products">Buka katalog</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/assistant">Coba asisten</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
