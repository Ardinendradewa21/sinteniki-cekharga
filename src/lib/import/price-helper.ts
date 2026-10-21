import { UNIFIED_COLUMNS } from "@/lib/import/unified";

/**
 * Alat bantu salin harga (Sprint 12, 21 Oktober 2026).
 *
 * Bookmarklet yang dijalankan admin di halaman produk marketplace yang ia
 * buka sendiri (Shopee, Tokopedia, dll., dengan akunnya sendiri). Tidak ada
 * yang mengambil data otomatis: satu klik admin = satu halaman yang sedang
 * dilihat. Alat ini membaca judul, harga yang tampil, URL, dan nama toko bila
 * tersedia, menampilkan panel untuk dikoreksi, lalu menyalin SATU baris
 * berformat kolom CSV gabungan (dipisah tab, siap ditempel ke Google Sheet).
 *
 * Sumbernya teks JavaScript biasa (bukan fungsi TypeScript) supaya tidak
 * diubah minifier; unit test mengevaluasi fungsi-fungsi murninya di Node, dan
 * E2E menjalankan bookmarklet utuh di halaman uji.
 */

const COLUMNS = JSON.stringify(UNIFIED_COLUMNS);

export const PRICE_HELPER_SOURCE = String.raw`
function chParsePrice(text) {
  var m = String(text || "").replace(/\s+/g, " ").match(/Rp\s?([\d.]{4,})/i);
  if (!m) return null;
  var n = Number(m[1].replace(/\./g, ""));
  return n >= 10000 && n <= 200000000 ? n : null;
}
function chAllPrices(text) {
  var out = [];
  var re = /Rp\s?([\d.]{4,})/gi, m;
  while ((m = re.exec(String(text || ""))) && out.length < 12) {
    var n = Number(m[1].replace(/\./g, ""));
    if (n >= 10000 && n <= 200000000 && out.indexOf(n) < 0) out.push(n);
  }
  return out;
}
function chParseMemory(text) {
  var t = String(text || "").replace(/\s+/g, " ");
  var m = t.match(/(\d{1,2})\s*(?:GB)?\s*[\/+]\s*(\d{1,4})\s*(GB|TB)?\b/i);
  if (m) {
    var s = Number(m[2]) * (/tb/i.test(m[3] || "") ? 1024 : 1);
    if (Number(m[1]) <= 24 && s >= 32) return { ram: Number(m[1]), storage: s };
  }
  var r = t.match(/RAM\s*(\d{1,2})\s*GB/i), st = t.match(/(?:ROM|Internal|Memori)\s*(\d{2,4})\s*(GB|TB)/i);
  if (r && st) return { ram: Number(r[1]), storage: Number(st[1]) * (/tb/i.test(st[2]) ? 1024 : 1) };
  return null;
}
function chMarketplace(host) {
  var h = String(host || "").toLowerCase();
  var map = [["shopee.co.id", "Shopee"], ["tokopedia.com", "Tokopedia"], ["blibli.com", "Blibli"], ["lazada.co.id", "Lazada"], ["tiktok.com", "TikTok Shop"], ["erafone.com", "Erafone"]];
  for (var i = 0; i < map.length; i++) if (h === map[i][0] || h.slice(-map[i][0].length - 1) === "." + map[i][0]) return map[i][1];
  return "";
}
function chCleanUrl(href) {
  try { var u = new URL(href); return u.origin + u.pathname; } catch (e) { return String(href || ""); }
}
function chObservedAt(date) {
  var parts = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  var get = function (type) { for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value; return ""; };
  return get("day") + "/" + get("month") + "/" + get("year") + " " + get("hour") + ":" + get("minute");
}
function chBuildRow(columns, values) {
  return columns.map(function (c) { return String(values[c] == null ? "" : values[c]).replace(/[\t\r\n]+/g, " ").trim(); }).join("\t");
}
function chReadPage(doc) {
  var title = "", price = null, seller = "";
  var ld = doc.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < ld.length; i++) {
    try {
      var data = JSON.parse(ld[i].textContent || "null");
      var list = Array.isArray(data) ? data : data && data["@graph"] ? data["@graph"] : [data];
      for (var j = 0; j < list.length; j++) {
        var p = list[j];
        if (!p || String(p["@type"]).indexOf("Product") < 0) continue;
        title = title || p.name || "";
        var offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        if (offer) {
          var amount = Number(offer.price || offer.lowPrice);
          if (!price && amount >= 10000) price = amount;
          if (!seller && offer.seller && offer.seller.name) seller = offer.seller.name;
        }
      }
    } catch (e) {}
  }
  var meta = function (name) { var el = doc.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]'); return el ? el.getAttribute("content") || "" : ""; };
  title = title || meta("og:title") || (doc.querySelector("h1") ? doc.querySelector("h1").textContent : "") || doc.title || "";
  if (!price) { var amt = Number(meta("product:price:amount")); if (amt >= 10000) price = amt; }
  var bodyText = doc.body ? doc.body.innerText || doc.body.textContent || "" : "";
  return { title: String(title).trim(), price: price, prices: chAllPrices(bodyText), seller: String(seller).trim() };
}
function cekhargaSalinHarga(config) {
  var doc = document, store = {};
  try { store = JSON.parse(localStorage.getItem("cekharga-salin") || "{}"); } catch (e) {}
  var page = chReadPage(doc);
  var selected = String(window.getSelection ? window.getSelection() : "").trim();
  var memory = chParseMemory(selected) || chParseMemory(page.title);
  var picked = chParsePrice(selected) || page.price || page.prices[0] || "";
  var old = doc.getElementById("cekharga-salin");
  if (old) old.remove();
  var box = doc.createElement("div");
  box.id = "cekharga-salin";
  box.setAttribute("style", "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-height:90vh;overflow:auto;background:#fff;color:#1f2937;border:2px solid #0f766e;border-radius:14px;padding:14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)");
  var fields = [
    ["brand", "Merek", store.brand || ""],
    ["model_name", "Model", store.model_name || ""],
    ["ram_gb", "RAM (GB)", memory ? memory.ram : ""],
    ["storage_gb", "Penyimpanan (GB)", memory ? memory.storage : ""],
    ["color", "Warna", ""],
    ["price_idr", "Harga (Rp)", picked],
    ["seller_name", "Toko", page.seller || store["seller:" + location.host] || ""],
    ["marketplace", "Marketplace", chMarketplace(location.host)]
  ];
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong style="color:#0f766e">Salin ke CekHarga</strong><button type="button" data-close style="border:0;background:none;font-size:20px;cursor:pointer;min-width:44px;min-height:44px">&times;</button></div>';
  html += '<p style="margin:0 0 8px;font-size:12px;color:#4b5563">' + (page.title ? page.title.replace(/</g, "&lt;").slice(0, 140) : "Judul tidak terbaca") + "</p>";
  for (var i = 0; i < fields.length; i++) {
    html += '<label style="display:block;margin:6px 0 2px;font-size:12px;font-weight:600">' + fields[i][1] + '</label><input data-f="' + fields[i][0] + '" style="width:100%;box-sizing:border-box;min-height:40px;padding:6px 8px;border:1px solid #9ca3af;border-radius:8px;font-size:14px">';
  }
  if (page.prices.length) {
    html += '<p style="margin:8px 0 4px;font-size:12px">Harga yang terlihat di halaman (klik untuk memakai):</p><div>';
    for (var k = 0; k < page.prices.length; k++) html += '<button type="button" data-price="' + page.prices[k] + '" style="margin:2px;padding:6px 8px;min-height:36px;border:1px solid #0f766e;border-radius:999px;background:#f0fdfa;cursor:pointer">Rp' + page.prices[k].toLocaleString("id-ID") + "</button>";
    html += "</div>";
  }
  html += '<button type="button" data-copy style="margin-top:12px;width:100%;min-height:44px;border:0;border-radius:999px;background:#303030;color:#fff;font-weight:700;cursor:pointer">Salin baris</button><p data-status style="margin:8px 0 0;font-size:12px;color:#0f766e"></p>';
  box.innerHTML = html;
  doc.body.appendChild(box);
  var input = function (name) { return box.querySelector('[data-f="' + name + '"]'); };
  for (var f = 0; f < fields.length; f++) input(fields[f][0]).value = fields[f][2];
  box.addEventListener("click", function (event) {
    var t = event.target;
    if (t.hasAttribute("data-close")) box.remove();
    if (t.hasAttribute("data-price")) input("price_idr").value = t.getAttribute("data-price");
    if (!t.hasAttribute("data-copy")) return;
    var values = {};
    for (var n = 0; n < fields.length; n++) values[fields[n][0]] = input(fields[n][0]).value;
    var status = box.querySelector("[data-status]");
    if (!values.brand || !values.model_name || !values.ram_gb || !values.storage_gb) { status.style.color = "#b91c1c"; status.textContent = "Isi merek, model, RAM, dan penyimpanan dulu."; return; }
    values.offer_url = chCleanUrl(location.href);
    values.observed_at = chObservedAt(new Date());
    values.listing_status = "active";
    values.seller_verified = "tidak";
    var row = chBuildRow(config.columns, values);
    store.brand = values.brand; store.model_name = values.model_name; store["seller:" + location.host] = values.seller_name;
    try { localStorage.setItem("cekharga-salin", JSON.stringify(store)); } catch (e) {}
    var done = function () { status.style.color = "#0f766e"; status.textContent = "Tersalin. Tempel di baris kosong sheet (Ctrl+V), lalu ganti varian di halaman dan klik bookmark lagi."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(row).then(done, function () { fallback(row); done(); });
    else { fallback(row); done(); }
  });
  function fallback(text) {
    var area = doc.createElement("textarea");
    area.value = text; doc.body.appendChild(area); area.select();
    try { doc.execCommand("copy"); } catch (e) {}
    area.remove();
  }
}
`;

/** URL bookmarklet siap seret ke bilah bookmark. */
export const PRICE_HELPER_BOOKMARKLET = `javascript:${encodeURIComponent(
  `(function(){${PRICE_HELPER_SOURCE};cekhargaSalinHarga({columns:${COLUMNS}});})();`
)}`;
