import { SPEC_PASTE_HEADER, SPEC_PASTE_MAX_CHARS } from "@/lib/scrape/spec-paste";

/**
 * Bookmarklet "Salin spesifikasi" (14 November 2026).
 *
 * Cadangan tarik otomatis saat GSMArena membatasi akses server CekHarga.
 * Admin membuka halaman spesifikasi satu model di www.gsmarena.com dengan
 * browsernya sendiri, lalu menekan bookmark ini. Bookmarklet hanya membaca
 * halaman yang sedang tampil (bagian `#body`, berisi nama model, foto utama,
 * dan tabel `#specs-list`) dan menyalinnya sebagai teks berformat
 * `CEKHARGA-SPEK/1` (lihat spec-paste.ts). Tidak ada request tambahan, tidak
 * ada yang dikirim ke CekHarga dari halaman GSMArena: admin sendiri yang
 * menempel di tab Tarik otomatis.
 *
 * Sumbernya teks JavaScript biasa supaya tidak diubah minifier; unit test
 * mengevaluasi fungsi murninya di Node.
 */

const CONFIG = JSON.stringify({ header: SPEC_PASTE_HEADER, maxChars: SPEC_PASTE_MAX_CHARS });

export const SPEC_HELPER_SOURCE = String.raw`
function chsBuildPayload(config, hostname, pathname, bodyHtml, hasSpecs) {
  if (hostname !== "www.gsmarena.com") return { error: "Buka halaman spesifikasi model di www.gsmarena.com (versi desktop), lalu klik bookmark lagi." };
  var path = String(pathname || "").replace(/^\/+/, "");
  if (!/^[a-z0-9_()]+-\d+\.php$/.test(path) || !hasSpecs || !bodyHtml) return { error: "Halaman ini bukan halaman spesifikasi satu model. Buka halaman model (yang memuat tabel spesifikasi), lalu klik bookmark lagi." };
  var text = config.header + "\n" + path + "\n" + bodyHtml;
  if (text.length > config.maxChars) return { error: "Halaman terlalu besar untuk disalin. Muat ulang halaman model lalu coba lagi." };
  return { text: text };
}
function cekhargaSalinSpek(config) {
  var doc = document;
  var body = doc.getElementById("body");
  var result = chsBuildPayload(config, location.hostname, location.pathname, body ? body.outerHTML : "", !!doc.getElementById("specs-list"));
  var old = doc.getElementById("cekharga-salin-spek");
  if (old) old.remove();
  var box = doc.createElement("div");
  box.id = "cekharga-salin-spek";
  box.setAttribute("role", "status");
  box.setAttribute("style", "position:fixed;top:16px;right:16px;z-index:2147483647;width:320px;background:#fff;color:#1f2937;border:2px solid #0f766e;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)");
  var title = doc.createElement("strong");
  title.setAttribute("style", "display:block;color:#0f766e;margin-bottom:4px");
  title.textContent = "Salin spesifikasi ke CekHarga";
  var msg = doc.createElement("p");
  msg.setAttribute("style", "margin:0;font-size:13px");
  var close = doc.createElement("button");
  close.type = "button";
  close.textContent = "Tutup";
  close.setAttribute("style", "margin-top:8px;min-height:44px;min-width:44px;padding:0 14px;border:1px solid #9ca3af;border-radius:999px;background:#fff;color:#1f2937;cursor:pointer");
  close.onclick = function () { box.remove(); };
  box.appendChild(title); box.appendChild(msg); box.appendChild(close);
  doc.body.appendChild(box);
  if (result.error) { msg.style.color = "#b91c1c"; msg.textContent = result.error; return; }
  var done = function () { msg.style.color = "#1f2937"; msg.textContent = "Tersalin. Kembali ke CekHarga > Impor > Tarik otomatis, lalu tempel di kotak Salin spesifikasi."; };
  var fallback = function () {
    var area = doc.createElement("textarea");
    area.value = result.text; doc.body.appendChild(area); area.select();
    try { doc.execCommand("copy"); } catch (e) {}
    area.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(result.text).then(done, function () { fallback(); done(); });
  else { fallback(); done(); }
}
`;

/** URL bookmarklet siap seret ke bilah bookmark. */
export const SPEC_HELPER_BOOKMARKLET = `javascript:${encodeURIComponent(
  `(function(){${SPEC_HELPER_SOURCE};cekhargaSalinSpek(${CONFIG});})();`
)}`;
