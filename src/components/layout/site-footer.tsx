import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Facebook01Icon,
  InstagramIcon,
  TiktokIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";

import { Container } from "@/components/layout/container";
import { MAIN_NAV } from "@/lib/navigation";
import { COMPANY, SOCIAL_LINKS, SUPPORT_NAV } from "@/lib/site-config";

/**
 * Footer situs (PRD §8): panel putih luas, navigasi nyata dan transparansi.
 *
 * Aturan lama yang tetap berlaku setelah footer diperluas: tanpa newsletter dan
 * tanpa tautan legal palsu. Ketentuan Layanan dan Pertanyaan Umum boleh muncul
 * di sini KARENA halamannya benar-benar dibuat, bukan sekadar mengisi kolom.
 *
 * Tautan sosial dan data perusahaan dibaca dari src/lib/site-config.ts. Entri
 * yang masih `null` dirender sebagai teks berlabel "segera" dan tidak bisa
 * diklik, supaya pengunjung tidak mengira ada akun atau kanal kontak yang
 * sebenarnya belum ada.
 */

const SOCIAL_ICONS: Record<string, typeof InstagramIcon> = {
  Instagram: InstagramIcon,
  Facebook: Facebook01Icon,
  TikTok: TiktokIcon,
  WhatsApp: WhatsappIcon,
};

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground">{children}</h2>
  );
}

/** Baris data perusahaan yang belum diisi: jujur kosong, bukan dikarang. */
function PendingValue({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      {label}
      <span className="ml-2 rounded-pill bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
        segera
      </span>
    </span>
  );
}

function SocialRow() {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {SOCIAL_LINKS.map((social) => {
        const icon = SOCIAL_ICONS[social.label];
        const inner = (
          <>
            <HugeiconsIcon
              icon={icon}
              size={18}
              strokeWidth={1.8}
              aria-hidden
            />
            <span className="sr-only">{social.label}</span>
          </>
        );

        return (
          <li key={social.label}>
            {social.href ? (
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                title={social.handle ?? social.label}
                className="flex size-11 items-center justify-center rounded-pill border border-border bg-card text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
              >
                {inner}
              </a>
            ) : (
              /*
                Belum ada akunnya. Dirender sebagai elemen mati yang terlihat
                nonaktif, bukan tautan, supaya tidak ada yang mengkliknya dan
                mengira kanalnya sudah jalan.
              */
              <span
                title={`${social.label} belum tersedia`}
                className="flex size-11 items-center justify-center rounded-pill border border-dashed border-border bg-card text-muted-foreground/60"
              >
                <HugeiconsIcon
                  icon={icon}
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="sr-only">{social.label}, belum tersedia</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <Container className="py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-foreground">
              {COMPANY.product}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Alat bantu keputusan untuk memilih smartphone: memahami pilihan,
              komprominya, dan di mana penawarannya bisa dilihat.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Diterbitkan oleh{" "}
              {COMPANY.website ? (
                <a
                  href={COMPANY.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4 transition-colors duration-150 hover:text-brand"
                >
                  {COMPANY.legalName}
                </a>
              ) : (
                <span className="font-medium text-foreground">{COMPANY.legalName}</span>
              )}
            </p>
            <SocialRow />
          </div>

          <nav aria-label="Navigasi footer">
            <FooterHeading>Halaman</FooterHeading>
            <ul className="mt-2 flex flex-col">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Bantuan dan ketentuan">
            <FooterHeading>Bantuan</FooterHeading>
            <ul className="mt-2 flex flex-col">
              {SUPPORT_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <FooterHeading>Transparansi</FooterHeading>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>
                CekHarga bukan marketplace. Pembelian dan harga akhir mengikuti
                marketplace tujuan.
              </li>
              <li>
                Harga diperiksa berkala, bukan real-time. Setiap harga disertai
                waktu pemeriksaan terakhir yang berhasil.
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Sumber data, metode kurasi, dan keterbatasannya
                </Link>
              </li>
            </ul>

            {/* Jarak atas eksplisit: terlihat di QA, judul ini menempel ke
                tautan transparansi di atasnya karena tautan itu memakai
                min-h-11 yang tidak menyisakan ruang bawah. */}
            <div className="mt-6">
              <FooterHeading>Kontak</FooterHeading>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                {COMPANY.email ? (
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="inline-flex min-h-11 items-center transition-colors duration-150 hover:text-foreground"
                  >
                    {COMPANY.email}
                  </a>
                ) : (
                  <PendingValue label="Email" />
                )}
              </li>
              <li>
                {COMPANY.whatsapp ? (
                  <a
                    href={`https://wa.me/${COMPANY.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center transition-colors duration-150 hover:text-foreground"
                  >
                    WhatsApp +62 858-1058-2323
                  </a>
                ) : (
                  <PendingValue label="WhatsApp" />
                )}
              </li>
              <li>
                {COMPANY.address ? (
                  <span>{COMPANY.address}</span>
                ) : (
                  <PendingValue label="Alamat kantor" />
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {COMPANY.legalName}. Versi awal. Cakupan masih terbatas
            pada smartphone baru, bahasa Indonesia, dan Rupiah.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/iklan"
              className="underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
            >
              Beriklan
            </Link>
            <Link
              href="/terms"
              className="underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
            >
              Ketentuan Layanan
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
