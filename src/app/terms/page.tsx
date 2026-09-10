import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { PRICING_POLICY } from "@/lib/config";
import { COMPANY, LEGAL_LAST_UPDATED } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Ketentuan Layanan",
  description:
    "Ruang lingkup layanan CekHarga, batasan informasi harga dan ulasan, serta tanggung jawab pengguna dan penerbit.",
};

/**
 * Ketentuan Layanan.
 *
 * Ini DRAF yang disusun dari perilaku sistem yang benar-benar berjalan hari
 * ini, bukan template hukum generik: setiap batasan di bawah bisa ditelusuri ke
 * aturan yang sudah diimplementasikan (PRD §7 soal harga, FR-06 soal asisten,
 * FR-08 soal transparansi). Statusnya dinyatakan terbuka di awal halaman karena
 * badan hukum penerbitnya belum meninjau teks ini.
 *
 * Yang sengaja TIDAK ditulis: klaim kemitraan marketplace, program afiliasi,
 * jaminan harga, kebijakan pengembalian dana, dan yurisdiksi penyelesaian
 * sengketa. Semua itu keputusan perusahaan, bukan sesuatu yang boleh dikarang
 * di sini. Kalau kelak dipakai tautan afiliasi, pengungkapannya masuk ke sini
 * dan ke /how-it-works.
 */

function Article({
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
      <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Ketentuan Layanan
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Dokumen ini menjelaskan apa yang CekHarga lakukan, apa yang tidak, dan
          batas tanggung jawab atas informasi yang ditampilkan.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Terakhir diperbarui {LEGAL_LAST_UPDATED}.
        </p>
      </header>

      <div className="mt-8 rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">
          Draf, belum ditinjau secara hukum
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          Teks ini disusun dari cara sistem bekerja saat ini dan belum ditinjau
          penasihat hukum {COMPANY.legalName}. Selama layanan masih versi awal
          dan berjalan dengan data demo, dokumen ini berfungsi sebagai
          pernyataan ruang lingkup, bukan perjanjian final.
        </p>
      </div>

      <div className="mt-12 max-w-3xl space-y-10">
        <Article id="layanan" title="1. Layanan yang diberikan">
          <p>
            CekHarga adalah alat bantu keputusan untuk memilih smartphone,
            diterbitkan oleh {COMPANY.legalName}. Layanan ini mengumpulkan
            spesifikasi, ringkasan ulasan reviewer, dan penawaran yang tercatat,
            lalu menyajikannya agar bisa dibandingkan.
          </p>
          <p>
            CekHarga bukan marketplace, bukan toko, dan bukan perantara
            transaksi. Kami tidak menjual perangkat, tidak memproses pembayaran,
            tidak mengirim barang, dan tidak menerbitkan garansi produk.
            Pembelian sepenuhnya terjadi di marketplace tujuan dengan syarat dan
            ketentuan mereka sendiri.
          </p>
        </Article>

        <Article id="harga" title="2. Informasi harga">
          <p>
            Harga yang ditampilkan berasal dari penawaran yang tercatat dalam
            cakupan CekHarga dan diperiksa secara berkala, bukan real-time.
            Setiap harga disertai varian acuan dan waktu pemeriksaan terakhir
            yang berhasil. Harga yang lebih lama dari{" "}
            {PRICING_POLICY.freshnessWindowHours} jam tidak ditampilkan sebagai
            harga aktif.
          </p>
          <p>
            Frasa “mulai dari” berarti harga terendah di antara penawaran
            tercatat yang memenuhi syarat kami, bukan jaminan harga termurah di
            seluruh internet. Voucher, cashback, kupon, ongkos kirim, dan harga
            yang hanya terlihat setelah masuk akun tidak ikut dihitung.
          </p>
          <p>
            Harga di marketplace dapat berubah kapan saja tanpa pemberitahuan.
            Selisih antara angka di CekHarga dan angka di marketplace saat kamu
            membuka tautannya adalah hal yang wajar dan bukan penawaran yang
            mengikat.
          </p>
        </Article>

        <Article id="ulasan" title="3. Spesifikasi dan ulasan">
          <p>
            Spesifikasi disusun dari sumber yang dapat ditelusuri dan bisa
            mengandung kekeliruan atau ketertinggalan. Nilai yang belum
            diketahui ditulis sebagai belum diketahui, tidak diisi angka
            perkiraan.
          </p>
          <p>
            Ringkasan ulasan adalah pendapat reviewer yang bersangkutan, bukan
            pendapat CekHarga, dan selalu disertai atribusi channel serta
            konteks pengujiannya. Hak cipta atas materi ulasan tetap milik
            pembuatnya. Ringkasan kami tidak menggantikan menonton atau membaca
            sumber aslinya.
          </p>
        </Article>

        <Article id="asisten" title="4. Asisten dan rekomendasi">
          <p>
            Fitur asisten membantu mempersempit pilihan berdasarkan kebutuhan
            yang kamu sebutkan. Syarat yang kamu tetapkan sebagai wajib disaring
            lewat perhitungan di server, sementara lapisan bahasa alaminya belum
            aktif pada versi ini.
          </p>
          <p>
            Rekomendasi bersifat membantu, bukan menentukan. Keputusan membeli,
            beserta risikonya, tetap berada di tanganmu. Kami tidak menjamin
            bahwa kandidat yang muncul adalah pilihan terbaik untuk situasimu.
          </p>
        </Article>

        <Article id="data-demo" title="5. Status data saat ini">
          <p>
            Selama layanan berjalan dalam mode demo, seluruh produk, harga,
            penawaran, dan ulasan berasal dari data contoh dengan merek fiktif,
            dan ditandai jelas di antarmuka. Data demo tidak boleh dijadikan
            acuan membeli. Penjelasan lengkapnya ada di{" "}
            <Link
              href="/how-it-works"
              className="font-medium text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
            >
              halaman Cara Kerja
            </Link>
            .
          </p>
        </Article>

        <Article id="penggunaan" title="6. Penggunaan yang wajar">
          <p>
            Kamu boleh memakai CekHarga untuk keperluan pribadi dalam memilih
            perangkat. Yang tidak diperbolehkan: mengambil isi situs secara
            massal dengan alat otomatis, membebani layanan secara sengaja,
            menyalin isi situs untuk diterbitkan ulang seolah milik sendiri,
            atau memakai layanan ini untuk tujuan yang melanggar hukum.
          </p>
        </Article>

        <Article id="akun" title="7. Akun dan data pribadi">
          <p>
            Versi ini tidak memiliki pendaftaran akun dan tidak meminta data
            pribadi. Pilihan filter dan konsultasi disimpan di alamat URL
            halaman, bukan di profil pengguna, sehingga bisa dibagikan atau
            dimuat ulang tanpa menyimpan identitas siapa pun.
          </p>
          <p>
            Jika kelak akun, langganan, atau pengumpulan data diperkenalkan,
            ketentuan dan kebijakan privasinya akan ditulis lebih dulu, bukan
            diberlakukan diam-diam.
          </p>
        </Article>

        <Article id="tanggung-jawab" title="8. Batas tanggung jawab">
          <p>
            Informasi disediakan apa adanya. {COMPANY.legalName} berusaha
            menjaga ketepatan data, tetapi tidak menjamin bahwa spesifikasi,
            harga, ketersediaan, atau ringkasan ulasan selalu benar dan mutakhir
            pada setiap saat.
          </p>
          <p>
            Kami tidak bertanggung jawab atas kerugian yang timbul dari
            transaksi di marketplace pihak ketiga, termasuk perbedaan harga,
            pembatalan pesanan, keterlambatan, atau perselisihan garansi. Hal
            tersebut tunduk pada ketentuan marketplace dan penjual bersangkutan.
          </p>
        </Article>

        <Article id="perubahan" title="9. Perubahan ketentuan">
          <p>
            Ketentuan ini dapat diperbarui seiring bertambahnya fitur, misalnya
            saat data nyata, akun, atau tautan afiliasi mulai digunakan. Tanggal
            pembaruan terakhir selalu dicantumkan di awal halaman, dan perubahan
            yang memengaruhi cara data dipakai akan dinyatakan, bukan diselipkan
            tanpa keterangan.
          </p>
        </Article>

        <Article id="kontak" title="10. Menghubungi kami">
          {COMPANY.email ? (
            <p>
              Pertanyaan tentang ketentuan ini, atau koreksi atas data yang
              keliru, bisa dikirim ke{" "}
              <a
                href={`mailto:${COMPANY.email}`}
                className="font-medium text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
              >
                {COMPANY.email}
              </a>
              .
            </p>
          ) : (
            <p>
              Kanal kontak resmi belum dibuka pada versi ini. Begitu tersedia,
              alamatnya dicantumkan di sini dan di footer, dan pesan yang masuk
              benar-benar dibaca, bukan sekadar formalitas.
            </p>
          )}
        </Article>
      </div>
    </Container>
  );
}
