import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import type { AdminSession } from "@/lib/auth/dal";

/**
 * Jejak audit admin (PRD §6 dan FR-07: "perubahan penting dapat ditelusuri ke
 * admin dan waktunya").
 *
 * Dua keputusan yang disengaja:
 *
 * 1. Email pelaku ikut disalin, bukan hanya `actor_id`. Kalau akunnya kelak
 *    dihapus, foreign key menjadi NULL tetapi jejaknya tetap terbaca. Audit
 *    yang kehilangan identitas pelakunya tidak lagi berguna sebagai audit.
 *
 * 2. Kegagalan menulis audit dicatat ke log server, TIDAK membatalkan operasi
 *    yang sudah berhasil. Membatalkan perubahan data yang sudah tersimpan hanya
 *    karena catatannya gagal akan membuat keadaan lebih kacau, bukan lebih
 *    aman. Yang penting kegagalannya tidak disembunyikan.
 */
export async function recordAudit(
  admin: AdminSession,
  operation: string,
  objectType: string,
  objectId: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  const { error } = await getInsforgeAdminClient()
    .database.from("admin_audit")
    .insert([
      {
        // Pekerjaan terjadwal tidak punya akun; emailnya menjadi label pelaku.
        actor_id: admin.userId || null,
        actor_email: admin.email,
        operation,
        object_type: objectType,
        object_id: objectId,
        detail: detail ?? null,
      },
    ]);

  if (error) {
    console.error("[audit] gagal mencatat", { operation, objectType, error });
  }
}
