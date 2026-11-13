import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

/**
 * Remah roti bersama. Menggantikan eyebrow huruf kapital berjarak lebar
 * ("CekHarga / ...") yang tidak bisa diklik (antislop R-06, VD-05): remah
 * roti memberi tautan balik yang nyata. Item terakhir = halaman ini.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Remah roti" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={cn("flex items-center gap-x-1", last && "min-w-0")}>
              {index > 0 ? <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} aria-hidden="true" /> : null}
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="min-w-0 truncate text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center font-medium transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
