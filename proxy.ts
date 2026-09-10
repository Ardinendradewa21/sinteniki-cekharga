import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

/**
 * Proxy (Next.js 16 mengganti nama Middleware menjadi Proxy).
 *
 * Perannya SATU saja: menyegarkan cookie sesi supaya Server Component melihat
 * token yang masih berlaku saat merender.
 *
 * Yang sengaja TIDAK dilakukan di sini adalah otorisasi. Dokumentasi Next.js 16
 * menyatakan Proxy bukan tempat untuk manajemen sesi maupun otorisasi penuh,
 * dan alasannya masuk akal: Proxy berjalan di setiap rute termasuk yang
 * di-prefetch, jadi pemeriksaan ke database di sini akan mahal sekaligus
 * memberi rasa aman palsu. Gerbang sesungguhnya ada di requireAdmin() pada
 * src/lib/auth/dal.ts, yang dipanggil setiap halaman dan aksi admin.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  return response;
}

export const config = {
  // Hanya jalur admin yang butuh penyegaran sesi. Halaman publik tidak punya
  // sesi sama sekali, jadi menjalankan proxy di sana hanya menambah beban.
  matcher: ["/admin/:path*", "/api/auth/:path*"],
};
