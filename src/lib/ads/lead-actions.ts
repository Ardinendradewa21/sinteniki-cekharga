"use server";

import { headers } from "next/headers";

import { leadInput, text, type AdActionState } from "@/lib/ads/admin-schema";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { getDataSourceMode } from "@/lib/config";

/**
 * Form "Ajukan kerja sama" di /iklan → advertiser baru berstatus Prospek
 * (source = form). Ini satu-satunya aksi publik modul iklan, jadi:
 *
 * - Data yang disimpan hanya yang diperlukan untuk dihubungi (UU PDP) dan
 *   hanya bila pengunjung mencentang persetujuan.
 * - Honeypot `website` menyaring bot sederhana tanpa CAPTCHA.
 * - Batas 3 kiriman per 10 menit per alamat (memori proses; cukup untuk
 *   meredam spam, bukan pengganti WAF).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const recent = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return false;
}

export async function submitLeadAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  // Bot mengisi semua field; manusia tidak melihat field ini.
  if (text(formData, "website")) return { error: null, message: "Terima kasih. Tim kami akan menghubungi Anda." };
  if (formData.get("consent") !== "on") {
    return { error: "Centang persetujuan agar kami boleh menyimpan data kontak Anda untuk menindaklanjuti." };
  }
  const parsed = leadInput.safeParse({
    company_name: text(formData, "company_name") ?? "",
    contact_name: text(formData, "contact_name") ?? "",
    contact_email: text(formData, "contact_email") ?? "",
    contact_phone: text(formData, "contact_phone"),
    message: text(formData, "message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data belum lengkap." };
  if (getDataSourceMode() !== "live") {
    return { error: "Form belum aktif di mode demo. Silakan hubungi kami lewat email." };
  }

  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() || head.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return { error: "Terlalu banyak kiriman. Coba lagi beberapa menit lagi." };

  const lead = parsed.data;
  const { error } = await getInsforgeAdminClient()
    .database.from("advertisers")
    .insert([
      {
        company_name: lead.company_name,
        display_name: lead.company_name,
        contact_name: lead.contact_name,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone,
        prospect_status: "lead",
        source: "form",
        notes: [`Persetujuan data: ${new Date().toISOString()}`, lead.message].filter(Boolean).join("\n\n"),
      },
    ]);
  if (error) {
    console.error("[iklan] prospek gagal disimpan:", error);
    return { error: "Pengajuan gagal terkirim. Coba lagi atau hubungi kami lewat email." };
  }
  return { error: null, message: "Terima kasih. Pengajuan Anda sudah kami terima dan tim kami akan menghubungi Anda." };
}
