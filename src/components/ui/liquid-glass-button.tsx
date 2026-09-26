"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Tombol liquid-glass untuk seluruh aplikasi.
 *
 * Efek kaca dibuat lewat gradient, backdrop blur, border transparan, dan
 * inset shadow. Tidak ada SVG filter per tombol: selain lebih ringan, bentuk
 * ini tetap aman saat `asChild` mengubah tombol menjadi tautan Next.js.
 */
const liquidButtonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-pill border bg-clip-padding text-sm font-medium whitespace-nowrap backdrop-blur-xl backdrop-saturate-150 transition-[transform,box-shadow,background-color,border-color,color,filter] duration-150 ease-out outline-none select-none shadow-[0_4px_14px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_8px_22px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.52),inset_0_-1px_0_rgba(15,23,42,0.12)] active:translate-y-px active:scale-[0.985] active:brightness-95 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none motion-reduce:transition-none disabled:pointer-events-none disabled:transform-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-white/25 bg-primary bg-linear-to-b from-white/16 via-transparent to-black/10 text-primary-foreground",
        cool:
          "border-white/30 bg-primary bg-linear-to-t from-primary via-primary/90 to-white/20 text-primary-foreground shadow-[0_6px_18px_color-mix(in_oklch,var(--primary)_24%,transparent),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(15,23,42,0.12)]",
        outline:
          "border-white/75 bg-card/65 bg-linear-to-b from-white/55 via-white/12 to-black/5 text-foreground hover:bg-card/85 aria-expanded:bg-card/90 aria-expanded:text-foreground dark:border-white/20 dark:bg-card/55 dark:from-white/12 dark:to-black/10",
        secondary:
          "border-white/55 bg-secondary/75 bg-linear-to-b from-white/38 via-transparent to-black/5 text-secondary-foreground hover:bg-secondary/90 aria-expanded:bg-secondary/90 aria-expanded:text-secondary-foreground dark:border-white/15 dark:from-white/10",
        ghost:
          "border-transparent bg-card/20 bg-linear-to-b from-white/20 to-transparent text-foreground shadow-none hover:border-white/60 hover:bg-card/60 aria-expanded:border-white/60 aria-expanded:bg-card/65 dark:hover:border-white/15 dark:hover:bg-card/45",
        destructive:
          "border-destructive/25 bg-destructive/12 bg-linear-to-b from-white/25 to-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:border-destructive/30 dark:bg-destructive/20 dark:from-white/8 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link:
          "border-transparent bg-transparent text-primary underline-offset-4 shadow-none backdrop-blur-none hover:translate-y-0 hover:bg-primary/6 hover:shadow-none hover:brightness-100 hover:underline active:scale-100",
      },
      // Ukuran lama dipertahankan agar semua pemakai Button tetap kompatibel.
      // Aksi utama tetap memiliki target sentuh minimal 44px.
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-6 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-4 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xl: "h-13 gap-2 px-8 text-base",
        xxl: "h-14 gap-2 px-10 text-base",
        icon: "size-11",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type LiquidButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof liquidButtonVariants> & {
    asChild?: boolean
  }

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot.Root : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(liquidButtonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)

LiquidButton.displayName = "LiquidButton"

// Nama Button dipertahankan supaya seluruh halaman memperoleh tampilan baru
// tanpa migrasi import satu per satu.
const Button = LiquidButton
const buttonVariants = liquidButtonVariants
const liquidbuttonVariants = liquidButtonVariants

export {
  Button,
  LiquidButton,
  buttonVariants,
  liquidButtonVariants,
  liquidbuttonVariants,
}
export type { LiquidButtonProps }
