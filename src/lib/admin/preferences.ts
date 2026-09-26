"use server";

import { cookies } from "next/headers";

import {
  ADMIN_THEME_COOKIE,
  type AdminTheme,
} from "@/lib/admin/preferences-config";
import { requireAdmin } from "@/lib/auth/dal";

/** Menyimpan preferensi tema hanya untuk area /admin. */
export async function setAdminThemeAction(theme: AdminTheme): Promise<void> {
  await requireAdmin();
  const safeTheme: AdminTheme = theme === "dark" ? "dark" : "light";
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_THEME_COOKIE, safeTheme, {
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
