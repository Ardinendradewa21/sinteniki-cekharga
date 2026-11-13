import { cookies } from "next/headers";

import { AdRails } from "@/components/ads/ad-slot";
import { ConsentBanner } from "@/components/ads/consent-banner";
import { CompareTray } from "@/components/compare/compare-tray";
import { SceneBackdrop } from "@/components/layout/scene-backdrop";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  PUBLIC_THEME_COOKIE,
  type PublicTheme,
} from "@/lib/public/preferences-config";
import { getAdSettings } from "@/lib/ads/settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storedTheme = (await cookies()).get(PUBLIC_THEME_COOKIE)?.value;
  const initialTheme: PublicTheme = storedTheme === "dark" ? "dark" : "light";
  // Banner persetujuan hanya perlu bila ada mitra iklan pihak ketiga aktif.
  const { adsenseClient } = await getAdSettings();

  return (
    <div
      data-public-theme=""
      data-theme={initialTheme}
      className="public-theme relative isolate flex min-h-svh flex-1 flex-col bg-background text-foreground transition-colors duration-300"
    >
      {/* Foto latar tipis di atas setiap halaman; hero beranda memasang varian penuh sendiri. */}
      <SceneBackdrop variant="fade" />
      <SiteHeader initialTheme={initialTheme} />
      <main id="konten-utama" className="flex-1">
        {children}
      </main>
      {/* Rail iklan kiri/kanan, hanya di layar sangat lebar (lihat AdRails). */}
      <AdRails />
      <SiteFooter />
      <CompareTray />
      {adsenseClient ? <ConsentBanner /> : null}
    </div>
  );
}