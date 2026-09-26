import { cookies } from "next/headers";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  PUBLIC_THEME_COOKIE,
  type PublicTheme,
} from "@/lib/public/preferences-config";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storedTheme = (await cookies()).get(PUBLIC_THEME_COOKIE)?.value;
  const initialTheme: PublicTheme = storedTheme === "dark" ? "dark" : "light";

  return (
    <div
      data-public-theme=""
      data-theme={initialTheme}
      className="public-theme flex min-h-svh flex-1 flex-col bg-background text-foreground transition-colors duration-300"
    >
      <SiteHeader initialTheme={initialTheme} />
      <main id="konten-utama" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}