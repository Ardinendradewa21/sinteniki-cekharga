import { MAX_PHOTOS_PER_COLOR } from "@/lib/import/photo-rules";
import { UNIFIED_COLUMNS } from "@/lib/import/unified";

/**
 * Alat bantu salin foto galeri resmi (Sprint 14, 11 November 2026).
 *
 * Bookmarklet yang dijalankan admin di halaman produk situs resmi yang sedang
 * ia buka (saat ini motorola.com/id). Halaman itu sudah memuat galeri per
 * warna sebagai data JavaScript (`window["moto-product-landing-flip-v2_..."]`,
 * objek `{ images: [{ t_id: { t_id: "//pN-ofp.static.pub//fes/..." } }],
 * gradientName: { t_id: "%3Cp%3EPANTONE%20Corsair%3C%2Fp%3E" } }`). Alat ini
 * membaca data itu, menampilkan panel berisi warna dan jumlah fotonya untuk
 * dikoreksi, lalu menyalin baris CSV gabungan (satu baris per foto, dipisah
 * tab, siap ditempel ke Google Sheet).
 *
 * Tidak ada pengambilan di server (aturan system design 3): satu klik admin =
 * satu halaman yang sedang dilihat. Dasar hak pakai foto tidak diisi di sini,
 * melainkan dipilih admin di form unggah (berlaku untuk baris tanpa dasar).
 *
 * Sumbernya teks JavaScript biasa supaya tidak diubah minifier; unit test
 * mengevaluasi fungsi murninya di Node, dan E2E menjalankan bookmarklet utuh
 * di halaman tiruan.
 */

const CONFIG = JSON.stringify({ columns: UNIFIED_COLUMNS, maxPerColor: MAX_PHOTOS_PER_COLOR });

export const PHOTO_HELPER_SOURCE = String.raw`
function chpText(raw) {
  var s = String(raw || "");
  try { s = decodeURIComponent(s); } catch (e) {}
  return s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function chpColorName(raw) {
  return chpText(raw).replace(/^pantone\s+/i, "").trim();
}
function chpImageUrl(raw) {
  var s = String(raw || "").trim();
  if (s.indexOf("//") === 0) s = "https:" + s;
  if (!/^https:\/\/[^\/]+\//i.test(s)) return "";
  return /\.(?:png|jpe?g|webp)(?:$|\?)/i.test(s) ? s : "";
}
function chpTitleWord(w) {
  if (/^\d+g$/i.test(w)) return w.toUpperCase();
  if (/^\d+mah$/i.test(w)) return w.replace(/mah$/i, "mAh");
  if (/^\d/.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
function chpModelFromPath(pathname) {
  var parts = String(pathname || "").split("/").filter(Boolean);
  var i = parts.indexOf("phones");
  if (i < 0 || !parts[i + 2]) return "";
  var series = parts[i + 1], slug = parts[i + 2];
  slug = slug.replace(/^motorola-/, "");
  var letter = { "moto-g": "g", "moto-e": "e" }[series];
  if (letter && /^\d/.test(slug)) slug = "moto-" + letter + slug;
  else if (letter && new RegExp("^" + letter + "\\d").test(slug)) slug = "moto-" + slug;
  else if (series === "motorola-edge" && slug.indexOf("edge") !== 0) slug = "edge-" + slug;
  else if (series === "razr" && slug.indexOf("razr") !== 0) slug = "razr-" + slug;
  return slug.split("-").filter(Boolean).map(chpTitleWord).join(" ");
}
function chpCollectGalleries(roots, maxPerColor) {
  var out = [], byColor = {}, seen = [];
  function add(node) {
    var color = chpColorName(node.gradientName && typeof node.gradientName === "object" ? node.gradientName.t_id : node.gradientName);
    if (!color) return;
    var urls = [];
    for (var i = 0; i < node.images.length; i++) {
      var img = node.images[i];
      var raw = img && typeof img === "object" ? (img.t_id && typeof img.t_id === "object" ? img.t_id.t_id : img.t_id || img.url || img.src) : img;
      var url = chpImageUrl(raw);
      if (url && urls.indexOf(url) < 0) urls.push(url);
    }
    if (!urls.length) return;
    var key = color.toLowerCase();
    var entry = byColor[key];
    if (!entry) { entry = { color: color, urls: [], total: 0 }; byColor[key] = entry; out.push(entry); }
    for (var j = 0; j < urls.length; j++) {
      if (entry.urls.indexOf(urls[j]) >= 0) continue;
      entry.total += 1;
      if (entry.urls.length < maxPerColor) entry.urls.push(urls[j]);
    }
  }
  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 12 || seen.indexOf(node) >= 0) return;
    seen.push(node);
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) walk(node[i], depth + 1); return; }
    if (Array.isArray(node.images) && node.images.length && node.gradientName) add(node);
    for (var k in node) if (Object.prototype.hasOwnProperty.call(node, k) && k !== "language") walk(node[k], depth + 1);
  }
  for (var r = 0; r < roots.length; r++) walk(roots[r], 0);
  return out;
}
function chpPageRoots(win) {
  var roots = [];
  var keys = Object.keys(win);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf("product-landing") >= 0) {
      try { roots.push(win[keys[i]]); } catch (e) {}
    }
  }
  return roots;
}
function chpCleanUrl(href) {
  try { var u = new URL(href); return u.origin + u.pathname; } catch (e) { return String(href || ""); }
}
function chpBuildRows(columns, product, galleries, sourceUrl) {
  var rows = [];
  for (var g = 0; g < galleries.length; g++) {
    for (var i = 0; i < galleries[g].urls.length; i++) {
      var values = { brand: product.brand, model_name: product.model, color: galleries[g].color, image_url: galleries[g].urls[i], urutan: i + 1, is_cover: i === 0 ? "ya" : "tidak", image_source_url: sourceUrl };
      rows.push(columns.map(function (c) { return String(values[c] == null ? "" : values[c]).replace(/[\t\r\n]+/g, " ").trim(); }).join("\t"));
    }
  }
  return rows.join("\n");
}
function cekhargaSalinFoto(config) {
  var doc = document, store = {};
  try { store = JSON.parse(localStorage.getItem("cekharga-salin-foto") || "{}"); } catch (e) {}
  var galleries = chpCollectGalleries(chpPageRoots(window), config.maxPerColor);
  var pageKey = chpCleanUrl(location.href);
  var old = doc.getElementById("cekharga-salin-foto");
  if (old) old.remove();
  var box = doc.createElement("div");
  box.id = "cekharga-salin-foto";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Salin foto ke CekHarga");
  box.setAttribute("style", "position:fixed;top:16px;right:16px;z-index:2147483647;width:360px;max-height:90vh;overflow:auto;background:#fff;color:#1f2937;border:2px solid #0f766e;border-radius:14px;padding:14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)");
  var el = function (tag, style, text) { var n = doc.createElement(tag); if (style) n.setAttribute("style", style); if (text != null) n.textContent = text; return n; };
  var head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px");
  head.appendChild(el("strong", "color:#0f766e", "Salin foto ke CekHarga"));
  var close = el("button", "border:0;background:none;font-size:20px;cursor:pointer;min-width:44px;min-height:44px;color:#1f2937", "×");
  close.type = "button"; close.setAttribute("aria-label", "Tutup");
  close.onclick = function () { box.remove(); };
  head.appendChild(close);
  box.appendChild(head);
  if (!galleries.length) {
    box.appendChild(el("p", "margin:0;font-size:13px;color:#b91c1c", "Galeri warna tidak ditemukan di halaman ini. Buka halaman produk HP di motorola.com/id, tunggu sampai gambar warna tampil, lalu klik bookmark lagi."));
    doc.body.appendChild(box);
    return;
  }
  var remembered = store[pageKey] || {};
  var field = function (label, value) {
    box.appendChild(el("label", "display:block;margin:6px 0 2px;font-size:12px;font-weight:600", label));
    var input = el("input", "width:100%;box-sizing:border-box;min-height:40px;padding:6px 8px;border:1px solid #9ca3af;border-radius:8px;font-size:14px;color:#1f2937;background:#fff");
    input.value = value;
    box.appendChild(input);
    return input;
  };
  var brand = field("Merek", remembered.brand || "Motorola");
  var model = field("Model (sama dengan nama di katalog)", remembered.model || chpModelFromPath(location.pathname));
  box.appendChild(el("p", "margin:10px 0 4px;font-size:12px;font-weight:600", "Warna dan foto (foto pertama jadi sampul)"));
  var rows = [];
  for (var g = 0; g < galleries.length; g++) {
    var gal = galleries[g];
    var row = el("div", "display:flex;align-items:center;gap:6px;margin:4px 0");
    var check = el("input", "width:20px;height:20px;flex:none");
    check.type = "checkbox"; check.checked = true; check.setAttribute("aria-label", "Sertakan warna " + gal.color);
    var name = el("input", "flex:1;min-width:0;min-height:40px;padding:6px 8px;border:1px solid #9ca3af;border-radius:8px;font-size:14px;color:#1f2937;background:#fff");
    name.value = (remembered.colors && remembered.colors[gal.color]) || gal.color;
    name.setAttribute("aria-label", "Nama warna");
    var thumb = el("img", "width:40px;height:40px;object-fit:contain;flex:none;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb");
    thumb.src = gal.urls[0]; thumb.alt = "";
    var count = gal.total > gal.urls.length ? gal.urls.length + " dari " + gal.total : String(gal.urls.length);
    row.appendChild(check); row.appendChild(thumb); row.appendChild(name); row.appendChild(el("span", "flex:none;font-size:12px;color:#4b5563", count + " foto"));
    box.appendChild(row);
    rows.push({ check: check, name: name, gallery: gal });
  }
  if (galleries.some(function (x) { return x.total > x.urls.length; })) {
    box.appendChild(el("p", "margin:6px 0 0;font-size:12px;color:#4b5563", "Paling banyak " + config.maxPerColor + " foto per warna disalin, sesuai batas galeri CekHarga."));
  }
  var copy = el("button", "margin-top:12px;width:100%;min-height:44px;border:0;border-radius:999px;background:#303030;color:#fff;font-weight:700;cursor:pointer", "Salin baris");
  copy.type = "button";
  box.appendChild(copy);
  var status = el("p", "margin:8px 0 0;font-size:12px;color:#0f766e");
  status.setAttribute("role", "status");
  box.appendChild(status);
  doc.body.appendChild(box);
  copy.onclick = function () {
    var product = { brand: brand.value.trim(), model: model.value.trim() };
    var picked = [], colors = {};
    for (var i = 0; i < rows.length; i++) {
      var color = rows[i].name.value.trim();
      colors[rows[i].gallery.color] = color;
      if (rows[i].check.checked && color) picked.push({ color: color, urls: rows[i].gallery.urls });
    }
    if (!product.brand || !product.model) { status.style.color = "#b91c1c"; status.textContent = "Isi merek dan model dulu."; return; }
    if (!picked.length) { status.style.color = "#b91c1c"; status.textContent = "Centang minimal satu warna yang bernama."; return; }
    var text = chpBuildRows(config.columns, product, picked, pageKey);
    var total = text.split("\n").length;
    store[pageKey] = { brand: product.brand, model: product.model, colors: colors };
    try { localStorage.setItem("cekharga-salin-foto", JSON.stringify(store)); } catch (e) {}
    var done = function () { status.style.color = "#0f766e"; status.textContent = "Tersalin " + total + " baris. Tempel di baris kosong sheet (Ctrl+V)."; };
    var fallback = function () {
      var area = doc.createElement("textarea");
      area.value = text; doc.body.appendChild(area); area.select();
      try { doc.execCommand("copy"); } catch (e) {}
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); done(); });
    else { fallback(); done(); }
  };
}
`;

/** URL bookmarklet siap seret ke bilah bookmark. */
export const PHOTO_HELPER_BOOKMARKLET = `javascript:${encodeURIComponent(
  `(function(){${PHOTO_HELPER_SOURCE};cekhargaSalinFoto(${CONFIG});})();`
)}`;
