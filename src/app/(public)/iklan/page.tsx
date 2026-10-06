import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { Checkbox, Field, TextArea } from "@/components/admin/ads/fields";
import { AdLabel } from "@/components/ads/ad-label";
import { Container } from "@/components/layout/container";
import { PRICING_LABEL } from "@/lib/ads/billing";
import { submitLeadAction } from "@/lib/ads/lead-actions";
import { getMediaKit } from "@/lib/ads/media-kit";
import { getAdSettings } from "@/lib/ads/settings";
import { formatIdr } from "@/lib/catalog/pricing";

export const metadata: Metadata = {
  title: "Beriklan di CekHarga",
  description:
    "Media kit CekHarga: slot iklan, ukuran materi, cara kami mengukur tayangan dan klik, standar iklan, dan cara mengajukan kerja sama.",
  alternates: { canonical: "/iklan" },
};

/**
 * Media kit publik (docs/ads/ADS-CONTEXT.md §5 langkah 1).
 *
 * Sesuai PRD: tidak ada angka trafik, testimoni, logo klien, atau klaim
 * "terbaik" yang belum bisa dibuktikan. Angka audiens dikirim terpisah oleh
 * tim sales dari data analitik yang terverifikasi. Rate card hanya tampil
 * untuk tarif yang sudah diisi tim sales.
 */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="scroll-mt-8 border-t border-border pt-10">
      <h2 id={`${id}-judul`} className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

const STEPS = [
  { title: "Brief", detail: "Ceritakan produk, periode, dan target kampanye lewat form di bawah." },
  { title: "Proposal", detail: "Kami kirim usulan slot, jadwal, dan biaya sesuai rate card." },
  { title: "PKS & IO", detail: "Perjanjian Kerja Sama sebagai payung, Insertion Order untuk tiap kampanye." },
  { title: "Pembayaran", detail: "Invoice uang muka; kampanye disiapkan setelah pembayaran diterima." },
  { title: "Materi & review", detail: "Materi diperiksa dengan checklist standar iklan sebelum tayang." },
  { title: "Tayang & laporan", detail: "Laporan tayangan dan klik harian dalam format CSV." },
] as const;

const PROHIBITED = [
  "Judi dan taruhan",
  "Pinjaman online ilegal atau tanpa izin OJK",
  "Obat terlarang dan produk kesehatan tanpa izin edar",
  "Konten dewasa",
  "Klaim menyesatkan, termasuk klaim harga yang tidak bisa dibuktikan",
] as const;

function size(value: string | null): string {
  return value ? value.replace("x", " × ") : "–";
}

export default async function AdvertisePage() {
  const [kit, settings] = await Promise.all([getMediaKit(), getAdSettings()]);
  const whatsapp = settings.salesWhatsapp?.replace(/[^\d]/g, "") || null;

  return (
    <Container className="py-10 md:py-14">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">CekHarga / Beriklan</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
          Jangkau orang yang sedang membandingkan smartphone
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Pengunjung CekHarga datang untuk membandingkan harga, varian, dan spesifikasi sebelum membeli. Iklan Anda tampil di
          halaman beranda, katalog, detail produk, dan perbandingan, dengan label yang jelas dan pengukuran yang transparan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#ajukan"
            className="inline-flex min-h-11 items-center rounded-pill bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Ajukan kerja sama
          </a>
          <a
            href="#slot"
            className="inline-flex min-h-11 items-center rounded-pill border border-border px-6 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Lihat slot & ukuran
          </a>
        </div>
      </header>

      <div className="mt-12 max-w-4xl space-y-12">
        <Section id="slot" title="Slot iklan">
          <p>Ukuran mengikuti standar IAB. Materi untuk layar ponsel bisa dikirim terpisah.</p>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide">
                <tr>
                  <th scope="col" className="px-3 py-2">Slot</th>
                  <th scope="col" className="px-3 py-2">Halaman</th>
                  <th scope="col" className="px-3 py-2">Desktop</th>
                  <th scope="col" className="px-3 py-2">Ponsel</th>
                  <th scope="col" className="px-3 py-2">Tarif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {(kit ?? []).map((slot) => (
                  <tr key={slot.code}>
                    <td className="px-3 py-3 font-semibold">
                      {slot.label}
                      {slot.allowsNative ? <span className="block text-xs font-normal text-muted-foreground">juga format native</span> : null}
                    </td>
                    <td className="px-3 py-3">{slot.page}</td>
                    <td className="px-3 py-3 tabular-nums">{size(slot.desktopSize)}</td>
                    <td className="px-3 py-3 tabular-nums">{slot.mobileSize ? size(slot.mobileSize) : "Tidak tampil"}</td>
                    <td className="px-3 py-3">
                      {slot.rates.length === 0
                        ? "Hubungi kami"
                        : slot.rates.map((rate) => (
                            <span key={rate.model} className="block tabular-nums">
                              {formatIdr(rate.rate)} <span className="text-muted-foreground">{PRICING_LABEL[rate.model]}</span>
                              {rate.minOrder ? <span className="text-muted-foreground"> · min. {rate.minOrder}</span> : null}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!kit || kit.length === 0 ? (
              <p className="px-3 py-6 text-sm">Daftar slot sedang disiapkan. Hubungi kami untuk informasi terbaru.</p>
            ) : null}
          </div>
          <p className="text-sm">Ketentuan pajak dan diskon paket dijelaskan di proposal.</p>
        </Section>

        <Section id="pengukuran" title="Cara kami mengukur">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Tayangan</strong> dihitung saat minimal 50% iklan terlihat di layar selama 1
              detik (standar viewable impression IAB/MRC), bukan sekadar dimuat.
            </li>
            <li>
              <strong className="text-foreground">Klik</strong> dihitung oleh server kami saat pengunjung diarahkan ke situs Anda.
              Tambahkan UTM di URL tujuan agar Anda juga bisa mengukurnya di analitik sendiri.
            </li>
            <li>Lalu lintas bot dan klik berulang dalam waktu singkat ditandai dan tidak ditagihkan.</li>
            <li>Untuk CPM dan CPC, tagihan tidak pernah melebihi target yang disepakati di IO.</li>
            <li>Kami tidak memakai cookie pelacak untuk iklan langsung dan tidak menyimpan identitas pengunjung.</li>
          </ul>
        </Section>

        <Section id="standar" title="Standar iklan">
          <p className="flex flex-wrap items-center gap-2">
            Setiap iklan selalu diberi label <AdLabel /> dan terpisah jelas dari hasil katalog.
          </p>
          <p>
            Iklan tidak memengaruhi urutan produk, harga, spesifikasi, atau ringkasan review di CekHarga. Kami juga tidak
            menerima materi yang menyebut produk sebagai &quot;terbaik&quot; atas nama CekHarga.
          </p>
          <p>Kategori yang tidak kami terima:</p>
          <ul className="list-disc space-y-1 pl-5">
            {PROHIBITED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Materi: PNG, JPG, WebP, atau GIF, maksimal 500 KB, sesuai ukuran slot (boleh 2× untuk layar retina), dengan tautan
            tujuan https.
          </p>
        </Section>

        <Section id="alur" title="Alur kerja sama">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-border bg-card p-4">
                <span className="text-xs font-bold text-brand">Langkah {index + 1}</span>
                <p className="mt-1 font-bold text-foreground">{step.title}</p>
                <p className="mt-1 text-sm">{step.detail}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="ajukan" title="Ajukan kerja sama">
          {settings.salesEmail || whatsapp ? (
            <p>
              Atau hubungi langsung:{" "}
              {settings.salesEmail ? (
                <a href={`mailto:${settings.salesEmail}`} className="font-semibold text-brand underline underline-offset-2">
                  {settings.salesEmail}
                </a>
              ) : null}
              {settings.salesEmail && whatsapp ? " · " : null}
              {whatsapp ? (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand underline underline-offset-2"
                >
                  WhatsApp
                </a>
              ) : null}
            </p>
          ) : null}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <ActionForm action={submitLeadAction} submitLabel="Kirim pengajuan" pendingLabel="Mengirim…" resetOnSuccess>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field scope="lead" name="company_name" label="Nama perusahaan / merek" required maxLength={200} autoComplete="organization" />
                <Field scope="lead" name="contact_name" label="Nama Anda" required maxLength={120} autoComplete="name" />
                <Field scope="lead" name="contact_email" label="Email kerja" type="email" required maxLength={200} autoComplete="email" />
                <Field scope="lead" name="contact_phone" label="Telepon/WhatsApp (opsional)" type="tel" maxLength={20} autoComplete="tel" />
              </div>
              <TextArea
                scope="lead"
                name="message"
                label="Ceritakan kebutuhan Anda (opsional)"
                maxLength={1500}
                rows={4}
                hint="Mis. produk yang dipromosikan, periode, dan slot yang diminati."
              />
              {/* Honeypot: tidak terlihat dan tidak bisa difokus pengguna. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Situs web
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <Checkbox
                name="consent"
                label="Saya setuju CekHarga menyimpan data kontak di atas untuk menindaklanjuti pengajuan ini."
                hint="Data hanya dipakai tim kami untuk menghubungi Anda dan tidak dibagikan ke pihak lain."
              />
            </ActionForm>
          </div>
        </Section>
      </div>
    </Container>
  );
}
