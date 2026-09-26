import { cookies } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  ADMIN_THEME_COOKIE,
  type AdminTheme,
} from "@/lib/admin/preferences-config";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const storedTheme = (await cookies()).get(ADMIN_THEME_COOKIE)?.value;
  const initialTheme: AdminTheme = storedTheme === "dark" ? "dark" : "light";

  return (
    <AdminShell email={admin.email} initialTheme={initialTheme}>
      {children}
    </AdminShell>
  );
}
