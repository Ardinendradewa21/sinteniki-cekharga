import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Pembungkus tipis Hugeicons dengan bentuk API komponen-ikon.
 *
 * Alasannya: PRD §9 memilih Hugeicons, sementara komponen shadcn bawaan
 * meng-import ikon sebagai komponen JSX dari lucide. Dengan pembungkus ini
 * komponen `ui/*` tetap dekat dengan bentuk upstream (mudah di-update lewat
 * `shadcn add`) tanpa perlu memasang dua pustaka ikon dengan fungsi sama.
 *
 * Ukuran dikendalikan lewat class (mis. `size-4`) seperti pada shadcn, bukan
 * lewat prop `size`.
 */
type IconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, "icon">;

export function ChevronDownIcon(props: IconProps) {
  return <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={1.8} {...props} />;
}

export function ChevronUpIcon(props: IconProps) {
  return <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={1.8} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} {...props} />;
}
