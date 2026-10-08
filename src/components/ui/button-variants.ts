import { cva } from "class-variance-authority"

/**
 * Kelas tombol untuk seluruh aplikasi.
 *
 * Dipisah dari komponen (yang bertanda "use client") supaya `buttonVariants()`
 * bisa dipanggil juga dari Server Component, mis. untuk tautan atau teks CTA
 * yang harus tampil persis seperti tombol.
 *
 * Gaya padat (solid) mengikuti PRD §8 "premium, minimal, product-first":
 * tanpa blur kaca, gradien, glow, atau efek terangkat. Semua warna lewat token
 * semantik, jadi tema publik/admin terang/gelap tidak butuh override per
 * tombol. Umpan balik interaksi cukup perubahan warna 150ms (micro-interaction
 * PRD §8: 120–180ms). Keputusan pemilik produk 2026-10-07: CTA utama charcoal
 * (`--primary`), teal hanya aksen (`--brand`).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-pill border text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/88",
        outline:
          "border-border-strong bg-card text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary/80",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "border-destructive/30 bg-destructive-muted text-destructive hover:bg-destructive/15 focus-visible:border-destructive/50 focus-visible:ring-destructive/25",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
      },
      // Semua ukuran setinggi minimal 44px (PRD §8). `sm` hanya lebih rapat
      // secara horizontal untuk tabel/toolbar admin; ukuran di bawah 44px
      // (xs, icon-xs, icon-sm) dihapus karena melanggar target sentuh.
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        sm: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export { buttonVariants }
