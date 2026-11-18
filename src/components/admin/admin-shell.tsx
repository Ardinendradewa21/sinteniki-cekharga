"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  DashboardSquare01Icon,
  DatabaseImportIcon,
  Logout01Icon,
  Megaphone01Icon,
  Menu02Icon,
  Moon02Icon,
  Package01Icon,
  PlusSignIcon,
  Search01Icon,
  Sun02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { setAdminThemeAction } from "@/lib/admin/preferences";
import type { AdminTheme } from "@/lib/admin/preferences-config";
import { signOutAction } from "@/lib/auth/actions";
import type { StaffRole } from "@/lib/auth/dal";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Shell workspace admin, tema Veyla (AV-01, keputusan PO 18 Nov 2026).
 *
 * - Sidebar sewarna kanvas: logo, pencarian produk (Ctrl/⌘ K), menu
 *   berkelompok dengan penanda aktif yang bergeser (Motion `layoutId`), kartu
 *   tinta "situs publik", dan kartu akun dengan tombol keluar.
 * - Topbar: remah roti + tema + "Tambah produk".
 * - Di bawah `lg`: tab bar bawah untuk navigasi, laci untuk pencarian dan akun.
 *
 * `roles` = peran staf selain `admin` yang boleh membuka menu ini. `admin`
 * selalu boleh. Menu hanya disembunyikan untuk kenyamanan; batas akses yang
 * sebenarnya ada di requireStaff() setiap halaman dan aksi.
 */
type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: typeof DashboardSquare01Icon;
  roles: readonly StaffRole[];
};

const NAV_GROUPS: readonly { label: string; items: readonly NavItem[] }[] = [
  {
    label: "Katalog",
    items: [
      { href: "/admin", label: "Dashboard", short: "Dashboard", icon: DashboardSquare01Icon, roles: ["sales", "adops", "finance", "legal"] },
      { href: "/admin/products", label: "Kelola produk", short: "Produk", icon: Package01Icon, roles: [] },
      { href: "/admin/import", label: "Impor data", short: "Impor", icon: DatabaseImportIcon, roles: [] },
      { href: "/admin/ulasan", label: "Ulasan YouTube", short: "Ulasan", icon: Video01Icon, roles: [] },
    ],
  },
  {
    label: "Monetisasi",
    items: [{ href: "/admin/iklan", label: "Iklan", short: "Iklan", icon: Megaphone01Icon, roles: ["sales", "adops", "finance", "legal"] }],
  },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  sales: "Sales",
  adops: "Ad Ops",
  finance: "Finance",
  legal: "Legal",
};

function allowed(item: NavItem, role: StaffRole) {
  return role === "admin" || item.roles.includes(role);
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// Label pintasan mengikuti platform; server selalu "Ctrl K" (tidak berubah
// selama sesi, jadi tidak perlu berlangganan).
const noopSubscribe = () => () => {};
const platformShortcut = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");

function initials(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._+-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "CH";
}

function AdminNavigation({
  pathname,
  role,
  layoutId,
  onNavigate,
}: {
  pathname: string;
  role: StaffRole;
  layoutId: string;
  onNavigate?: () => void;
}) {
  const { transition } = useMotionPreset();
  return (
    <nav aria-label="Navigasi admin" className="mt-6 space-y-5">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => allowed(item, role));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
            <ul className="mt-1.5 space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "text-foreground" : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId={layoutId}
                          transition={transition("thumb")}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-brand-muted"
                        />
                      ) : null}
                      <HugeiconsIcon icon={item.icon} size={19} strokeWidth={1.8} aria-hidden className="relative shrink-0" />
                      <span className="relative min-w-0 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Pencarian produk; Ctrl/⌘ K memfokuskannya (hanya peran admin). */
function ProductSearch({ id, inputRef, shortcut }: { id: string; inputRef: React.RefObject<HTMLInputElement | null>; shortcut: string }) {
  return (
    <form action="/admin/products" role="search" className="relative mt-5">
      <label htmlFor={id} className="sr-only">
        Cari produk
      </label>
      <HugeiconsIcon
        icon={Search01Icon}
        size={17}
        strokeWidth={1.8}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        placeholder="Cari produk…"
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-border bg-card pr-14 pl-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
        {shortcut}
      </kbd>
    </form>
  );
}

function SidebarContent({
  pathname,
  email,
  role,
  layoutId,
  searchRef,
  shortcut,
  onNavigate,
}: {
  pathname: string;
  email: string;
  role: StaffRole;
  layoutId: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shortcut: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div>
        <Link
          href="/admin"
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-ink-foreground">CH</span>
          <span>
            <span className="block text-lg leading-tight font-semibold tracking-tight">CekHarga</span>
            <span className="block text-xs text-muted-foreground">Admin workspace</span>
          </span>
        </Link>
        {role === "admin" ? <ProductSearch id={`${layoutId}-cari`} inputRef={searchRef} shortcut={shortcut} /> : null}
        <AdminNavigation pathname={pathname} role={role} layoutId={layoutId} onNavigate={onNavigate} />
      </div>

      <div className="mt-8 space-y-2">
        <Link
          href="/"
          onClick={onNavigate}
          className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="block text-sm font-semibold">Situs publik</span>
            <span className="block text-xs text-ink-muted">Lihat hasil yang dilihat pengunjung</span>
          </span>
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            size={18}
            strokeWidth={1.8}
            aria-hidden
            className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-2.5 shadow-sm">
          <span
            aria-hidden="true"
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand-text"
          >
            {initials(email)}
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-success" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" title={email}>
              {email}
            </span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Keluar" title="Keluar">
              <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

/** Tab bar bawah untuk layar kecil (pola Veyla); penanda aktif bergeser. */
function MobileTabBar({ pathname, role }: { pathname: string; role: StaffRole }) {
  const { transition } = useMotionPreset();
  const items = NAV_GROUPS.flatMap((group) => group.items).filter((item) => allowed(item, role));
  if (items.length < 2) return null;
  return (
    <nav
      aria-label="Navigasi admin bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg justify-between gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.6875rem] font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {active ? (
                  <motion.span
                    layoutId="admin-tab-aktif"
                    transition={transition("thumb")}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-xl bg-brand-muted"
                  />
                ) : null}
                <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.8} aria-hidden className="relative" />
                <span className={cn("relative truncate", !active && "text-muted-foreground")}>{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
  const shortcut = useSyncExternalStore(noopSubscribe, platformShortcut, () => "Ctrl K");
  const { reduce, transition } = useMotionPreset();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerSearchRef = useRef<HTMLInputElement>(null);
  const current = NAV_GROUPS.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

  // Ctrl/⌘ K: fokus ke pencarian produk. Di layar kecil laci dibuka dulu.
  useEffect(() => {
    if (role !== "admin") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (window.innerWidth >= 1024) {
        searchRef.current?.focus();
        searchRef.current?.select();
      } else {
        setMenuOpen(true);
        requestAnimationFrame(() => drawerSearchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role]);

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
        menuPanelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input") ?? []
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

  // Di dalam <body> flex-col, `flex-1` membuat `h-svh` diabaikan dan shell
  // memanjang mengikuti isi. `max-h-svh` mengunci tinggi ke layar di desktop,
  // jadi hanya kolom konten yang menggulir dan sidebar tetap.
  return (
    <div
      data-admin-theme={theme}
      className={cn(
        "admin-theme flex min-h-svh min-w-0 flex-1 bg-background text-foreground transition-colors duration-300 lg:h-svh lg:max-h-svh",
        theme === "dark" && "dark"
      )}
    >
      <aside className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-background p-4 transition-colors duration-300 lg:flex">
        <SidebarContent
          pathname={pathname}
          email={email}
          role={role}
          layoutId="admin-nav-aktif"
          searchRef={searchRef}
          shortcut={shortcut}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Buka menu admin"
              aria-expanded={menuOpen}
              aria-controls="menu-admin-mobile"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
            >
              <HugeiconsIcon icon={Menu02Icon} size={21} strokeWidth={1.8} aria-hidden />
            </Button>
            <nav aria-label="Remah roti" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden text-muted-foreground sm:block">
                  <Link href="/admin" className="rounded-md hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                    Admin
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden text-muted-foreground sm:block">
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
                </li>
                <li aria-current="page" className="truncate font-semibold text-foreground">
                  {current?.label ?? "Admin"}
                </li>
              </ol>
            </nav>
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
              title={theme === "dark" ? "Tema terang" : "Tema gelap"}
              className="border-border bg-card shadow-sm"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={reduce ? false : { rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={reduce ? undefined : { rotate: 90, opacity: 0 }}
                  transition={transition("micro")}
                  className="flex"
                >
                  <HugeiconsIcon icon={theme === "dark" ? Sun02Icon : Moon02Icon} size={19} strokeWidth={1.8} aria-hidden />
                </motion.span>
              </AnimatePresence>
            </Button>
            {/* Dasbor dan Kelola produk sudah punya tombol ini di kepala halaman. */}
            {role === "admin" && pathname !== "/admin" && !pathname.startsWith("/admin/products") ? (
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/admin/products/baru">
                  <HugeiconsIcon icon={PlusSignIcon} size={17} strokeWidth={2} aria-hidden data-icon="inline-start" />
                  Tambah produk
                </Link>
              </Button>
            ) : null}
          </div>
        </header>

        <main id="konten-utama" className="min-w-0 flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileTabBar pathname={pathname} role={role} />

      <AnimatePresence initial={false}>
        {menuOpen ? (
          <motion.div
            key="admin-mobile-menu"
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition("micro")}
          >
            <button
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
              aria-label="Menu admin"
              initial={reduce ? { opacity: 0 } : { x: "-100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={transition("entrance")}
              className="relative flex h-full w-[min(19rem,85vw)] flex-col justify-between overflow-y-auto border-r border-border bg-background p-4 shadow-xl"
            >
              <div className="absolute top-4 right-4">
                <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" aria-label="Tutup menu" onClick={closeMenu}>
                  <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.8} aria-hidden />
                </Button>
              </div>
              <SidebarContent
                pathname={pathname}
                email={email}
                role={role}
                layoutId="admin-nav-aktif-laci"
                searchRef={drawerSearchRef}
                shortcut={shortcut}
                onNavigate={closeMenu}
              />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
