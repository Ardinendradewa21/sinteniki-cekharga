import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Badge: label status/kategori yang TIDAK interaktif (chip yang bisa diklik
 * atau dihapus tetap tautan/tombol, bukan Badge).
 *
 * Mengikuti badge shadcn/ui v4 (dasar `text-xs` = 12px, varian lewat cva,
 * hover hanya bila dirender sebagai tautan lewat `[a&]:`), ditambah varian
 * status bertoken CekHarga. Satu-satunya sumber gaya pil status, supaya tidak
 * ada lagi pil buatan tangan berukuran 10–11px (audit UX-05). Status selalu
 * berupa kata, tidak pernah warna saja (PRD §8).
 */
const badgeVariants = cva(
  "inline-flex min-h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-transparent px-2 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/88",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        outline: "border-border bg-card text-foreground [a&]:hover:bg-muted",
        ghost: "text-foreground [a&]:hover:bg-muted",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        // Varian status bertoken (kontras teks-latar diukur di globals.css).
        brand: "bg-brand-muted text-brand",
        success: "bg-success-muted text-success",
        warning: "bg-warning-muted text-warning",
        destructive: "bg-destructive-muted text-destructive",
        // text-foreground, bukan muted-foreground: muted-foreground di atas
        // muted hanya 4.4:1 (gagal 4.5:1 untuk teks 12px).
        muted: "bg-muted text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
