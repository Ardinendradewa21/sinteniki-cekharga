"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Megaphone01Icon,
  DashboardSquare01Icon,
  DatabaseImportIcon,
  Logout01Icon,
  Menu02Icon,
  Moon02Icon,
  Package01Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { setAdminThemeAction } from "@/lib/admin/preferences";
import type { AdminTheme } from "@/lib/admin/preferences-config";
import { signOutAction } from "@/lib/auth/actions";
import type { StaffRole } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";

/**
 * `roles` = peran staf selain `admin` yang boleh membuka menu ini. `admin`
 * selalu boleh. Menu hanya disembunyikan untuk kenyamanan; batas akses yang
 * sebenarnya ada di requireStaff() setiap halaman dan aksi.
 */
const ADMIN_NAV: readonly {
  href: string;
  label: string;
  description: string;
  icon: typeof DashboardSquare01Icon;
  roles: readonly StaffRole[];
}[] = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Ringkasan dan aktivitas",
    icon: DashboardSquare01Icon,
    roles: ["sales", "adops", "finance", "legal"],
  },
  {
    href: "/admin/products",
    label: "Kelola produk",
    description: "Cari, sunting, dan terbitkan",
    icon: Package01Icon,
    roles: [],
  },
  {
    href: "/admin/import",
    label: "Impor data",
    description: "CSV, tarik otomatis, foto",
    icon: DatabaseImportIcon,
    roles: [],
  },
  {
    href: "/admin/iklan",
    label: "Iklan",
    description: "Advertiser, IO, materi, laporan",
    icon: Megaphone01Icon,
    roles: ["sales", "adops", "finance", "legal"],
  },
];

function navFor(role: StaffRole) {
  return ADMIN_NAV.filter((item) => role === "admin" || item.roles.includes(role));
}

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: StaffRole;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navigasi admin" className="mt-8">
      <p className="px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Menu utama
      </p>
      <ul className="mt-3 space-y-1">
        {navFor(role).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-[background-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-brand-muted text-brand shadow-sm"
                    : "text-foreground hover:translate-x-0.5 hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={19}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarContent({
  pathname,
  email,
  role,
  onNavigate,
}: {
  pathname: string;
  email: string;
  role: StaffRole;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div>
        <Link
          href="/admin"
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-brand-foreground">
            CH
          </span>
          <span>
            <span className="block text-base font-extrabold leading-tight">CekHarga</span>
            <span className="block text-xs text-muted-foreground">Admin workspace</span>
          </span>
        </Link>
        <AdminNavigation pathname={pathname} role={role} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-border pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Akun aktif
        </p>
        <p className="mt-1 truncate text-sm font-semibold" title={email}>
          {email}
        </p>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Lihat situs publik
        </Link>
      </div>
    </>
  );
}

export function AdminShell({
  email,
  role,
  initialTheme,
  children,
}: {
  email: string;
  role: StaffRole;
  initialTheme: AdminTheme;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);
  const [themePending, startThemeTransition] = useTransition();
  const shouldReduceMotion = useReducedMotion();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const currentSection =
    ADMIN_NAV.find((item) => isActive(pathname, item.href))?.label ?? "Admin";

  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    const handleMenuKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleMenuKeys);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleMenuKeys);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  function toggleTheme() {
    const previousTheme = theme;
    const nextTheme: AdminTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    startThemeTransition(async () => {
      try {
        await setAdminThemeAction(nextTheme);
      } catch {
        setTheme(previousTheme);
      }
    });
  }

  return (
    <div
      data-admin-theme={theme}
      className={cn(
        "admin-theme flex min-h-svh min-w-0 flex-1 bg-background text-foreground transition-colors duration-300 lg:h-svh",
        theme === "dark" && "dark"
      )}
    >
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-card p-5 transition-colors duration-300 lg:flex">
        <SidebarContent pathname={pathname} email={email} role={role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              ref={menuButtonRef}
              type="button"
              variant="outline"
              size="icon"
              aria-label="Buka menu admin"
              aria-expanded={menuOpen}
              aria-controls="menu-admin-mobile"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
            >
              <HugeiconsIcon icon={Menu02Icon} size={21} strokeWidth={1.8} aria-hidden />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Admin / {currentSection}
              </p>
              <p className="truncate text-sm font-bold text-foreground sm:text-base">
                {currentSection}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              disabled={themePending}
              aria-label={theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"}
              aria-pressed={theme === "dark"}
            >
              <HugeiconsIcon
                icon={theme === "dark" ? Sun02Icon : Moon02Icon}
                size={20}
                strokeWidth={1.8}
                aria-hidden
              />
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <HugeiconsIcon
                  icon={Logout01Icon}
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </form>
          </div>
        </header>

        <main id="konten-utama" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen ? (
        <motion.div
          key="admin-mobile-menu"
          className="fixed inset-0 z-50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.18 }}
        >
          <motion.button
            type="button"
            aria-label="Tutup menu admin"
            onClick={closeMenu}
            tabIndex={-1}
            className="absolute inset-0 bg-foreground/35"
          />
          <motion.aside
            ref={menuPanelRef}
            id="menu-admin-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin mobile"
            initial={shouldReduceMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={{
              duration: shouldReduceMotion ? 0.01 : 0.24,
              ease: "easeOut",
            }}
            className="relative flex h-full w-[min(19rem,85vw)] flex-col justify-between overflow-y-auto border-r border-border bg-card p-5 shadow-xl"
          >
            <div className="absolute right-4 top-4">
              <Button
                ref={closeButtonRef}
                type="button"
                variant="outline"
                size="icon"
                aria-label="Tutup menu"
                onClick={closeMenu}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={20}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </Button>
            </div>
            <SidebarContent pathname={pathname} email={email} role={role} onNavigate={closeMenu} />
          </motion.aside>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
