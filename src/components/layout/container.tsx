import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Lebar konten situs (PRD §8): container desktop 1200–1280px, padding mobile 16px.
 * Ini satu-satunya tempat angka lebar/padding halaman ditetapkan.
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

export { Container };
