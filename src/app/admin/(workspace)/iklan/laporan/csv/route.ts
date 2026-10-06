import type { NextRequest } from "next/server";

import { loadReport, parseReportFilter, toCsv } from "@/lib/ads/report";
import { getStaffOrNull } from "@/lib/auth/dal";

/** Ekspor laporan harian iklan (CSV) dengan filter yang sama dengan halaman Laporan. */
export async function GET(request: NextRequest) {
  const staff = await getStaffOrNull(["adops", "sales", "finance"]);
  if (!staff) return new Response("Tidak berwenang.", { status: 403 });

  const filter = parseReportFilter(Object.fromEntries(request.nextUrl.searchParams));
  const { rows, io } = await loadReport(filter);
  const name = `laporan-iklan-${io ? io.io_number.replace(/[^A-Za-z0-9-]+/g, "-") + "-" : ""}${filter.from}_${filter.to}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
