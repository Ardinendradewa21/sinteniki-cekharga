"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

/**
 * Tombol aplikasi. Untuk tautan yang tampil seperti tombol, pakai
 * `<Button asChild><a|Link …/></Button>`: Slot Radix tidak menambah
 * role="button", jadi semantik tautannya tetap terjaga.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

// buttonVariants sengaja tidak diekspor dari sini (modul "use client"): impor
// dari "@/components/ui/button-variants" agar aman dipakai Server Component.
export { Button }
export type { ButtonProps }
