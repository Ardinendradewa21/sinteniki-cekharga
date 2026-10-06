import { permanentRedirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/dal";

/**
 * Tarik otomatis kini menjadi tab di Pusat Impor (rencana kerja impor, Fase
 * 3.3). Alamat lama tetap berfungsi dan diarahkan permanen ke tab itu.
 */
export default async function ScrapePage() {
  await requireStaff([]);
  permanentRedirect("/admin/import?tab=tarik");
}
