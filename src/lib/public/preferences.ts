"use server";

import { cookies } from "next/headers";

import {
  PUBLIC_THEME_COOKIE,
  type PublicTheme,
} from "@/lib/public/preferences-config";

/** Menyimpan tema situs publik tanpa mencampurnya dengan preferensi admin. */
export async function setPublicThemeAction(theme: PublicTheme): Promise<void> {
  const safeTheme: PublicTheme = theme === "dark" ? "dark" : "light";
  const cookieStore = await cookies();

  cookieStore.set(PUBLIC_THEME_COOKIE, safeTheme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}
