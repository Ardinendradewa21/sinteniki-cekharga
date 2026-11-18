import { adminFont } from "@/lib/fonts/admin";

/**
 * Pembungkus semua rute admin (login dan workspace): memasang variabel font
 * Urbanist (AV-01). `display: contents` supaya tata letak flex di <body> tetap
 * sama seperti tanpa pembungkus.
 */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className={`${adminFont.variable} contents`}>{children}</div>;
}
