import { cookies } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  ADMIN_THEME_COOKIE,
  type AdminTheme,
} from "@/lib/admin/preferences-config";
import { getAdminNavCounts } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const storedTheme = (await cookies()).get(ADMIN_THEME_COOKIE)?.value;
  const initialTheme: AdminTheme = storedTheme === "dark" ? "dark" : "light";
  // Angka pekerjaan menunggu di menu (CD-03). Gagal dihitung = tanpa angka.
  const counts = await getAdminNavCounts().catch(() => ({}));

  return (
    <AdminShell email={admin.email} role={admin.role} initialTheme={initialTheme} counts={counts}>
      {children}
    </AdminShell>
  );
}
