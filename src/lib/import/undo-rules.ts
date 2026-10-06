/**
 * Aturan undo terbatas (rencana kerja impor, Fase 4.2). Murni, tanpa I/O.
 *
 * Undo hanya menghapus yang AMAN dihapus: data yang dibuat oleh batch ini
 * dan belum disentuh siapa pun sejak batch selesai diterapkan. Perubahan
 * batch pada data yang sudah ada sebelumnya TIDAK dikembalikan (tidak ada
 * snapshot nilai lama); jumlahnya ditampilkan supaya admin tahu.
 *
 * "Belum disentuh" = updated_at tidak lebih baru dari applied_at batch. Setiap
 * suntingan manual, penerbitan, atau impor lain menaikkan updated_at, sehingga
 * otomatis melindungi barisnya dari undo.
 */

export const UNDOABLE_STATUSES = ["applied", "partial"] as const;

export type ProductRow = {
  id: string;
  label: string;
  status: string;
  createdByBatchId: string | null;
  updatedAt: string;
};

export type ProductDecision =
  | { id: string; label: string; remove: true }
  | { id: string; label: string; remove: false; reason: string };

export function classifyProduct(row: ProductRow, batchId: string, appliedAt: string): ProductDecision {
  if (row.createdByBatchId !== batchId) {
    return { id: row.id, label: row.label, remove: false, reason: "Sudah ada sebelum batch ini; perubahannya tidak dikembalikan." };
  }
  if (row.status !== "draft") {
    return { id: row.id, label: row.label, remove: false, reason: "Sudah diterbitkan, jadi tidak dihapus." };
  }
  if (new Date(row.updatedAt).getTime() > new Date(appliedAt).getTime()) {
    return { id: row.id, label: row.label, remove: false, reason: "Sudah disunting atau diperbarui setelah batch ini." };
  }
  return { id: row.id, label: row.label, remove: true };
}

export type OfferRow = { id: string; createdByBatchId: string | null; updatedAt: string };

export function offerRemovable(row: OfferRow, batchId: string, appliedAt: string): boolean {
  return row.createdByBatchId === batchId && new Date(row.updatedAt).getTime() <= new Date(appliedAt).getTime();
}

export function canUndo(status: string, appliedAt: string | null): { ok: true } | { ok: false; reason: string } {
  if (status === "reverted") return { ok: false, reason: "Batch ini sudah dibatalkan." };
  if (!(UNDOABLE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, reason: "Hanya batch yang sudah selesai diterapkan yang bisa dibatalkan." };
  }
  if (!appliedAt) return { ok: false, reason: "Waktu penerapan batch tidak tercatat." };
  return { ok: true };
}
