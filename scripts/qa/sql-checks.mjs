// Validasi integritas data CekHarga langsung di database (docs/qa/TEST-PLAN.md §5.4).
//
// Setiap pemeriksaan adalah query yang mengembalikan baris PELANGGARAN.
// 0 baris = lulus. Tingkat:
//   gagal      -> melanggar aturan PRD / keamanan; exit code 1
//   peringatan -> celah data yang perlu ditindaklanjuti, tidak menggagalkan
//
// Jalankan: pnpm qa:sql   (butuh proyek InsForge yang ter-link, .insforge/)
// Hanya SELECT; skrip ini tidak pernah menulis ke database.
import { execSync } from "node:child_process";

const checks = [
  {
    id: "SQL-01",
    level: "gagal",
    title: "Produk terbit tanpa varian (halaman detail tidak bisa menyebut varian acuan)",
    sql: `select p.slug from products p where p.status = 'published'
          and not exists (select 1 from variants v where v.product_id = p.id)`,
  },
  {
    id: "SQL-02",
    level: "gagal",
    title: "Harga tercatat nol atau negatif (PRD §7: harga kosong bukan nol)",
    sql: `select id, offer_id, price_idr from price_observations where price_idr <= 0`,
  },
  {
    id: "SQL-03",
    level: "gagal",
    title: "Pengamatan harga bertanggal masa depan (membuat harga tampak segar palsu)",
    sql: `select id, offer_id, observed_at from price_observations where observed_at > now() + interval '5 minutes'`,
  },
  {
    id: "SQL-04",
    level: "gagal",
    title: "Tautan penawaran bukan https (tombol marketplace harus menuju URL valid)",
    sql: `select id, url from offers where url !~ '^https://'`,
  },
  {
    id: "SQL-05",
    level: "gagal",
    title: "View harga terbaru tidak sama dengan riwayat (offer_latest_price harus 1 baris per penawaran)",
    sql: `select a.offer_id from (select offer_id, max(observed_at) m from price_observations group by 1) a
          left join offer_latest_price v on v.offer_id = a.offer_id
          where v.offer_id is null or v.observed_at <> a.m`,
  },
  {
    id: "SQL-06",
    level: "gagal",
    title: "View sensitif tanpa security_invoker yang bisa dibaca anon (melewati RLS)",
    sql: `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'v'
            and has_table_privilege('anon', c.oid, 'SELECT')
            and coalesce(array_to_string(c.reloptions, ','), '') !~ 'security_invoker=true'`,
  },
  {
    id: "SQL-07",
    level: "gagal",
    title: "Peran staf tidak dikenal di admin_users",
    sql: `select user_id, role from admin_users where role not in ('admin','sales','adops','finance','legal')`,
  },
  {
    id: "SQL-08",
    level: "gagal",
    title: "Pemeriksaan harga harian ganda untuk merek dan tanggal yang sama",
    sql: `select options->>'refreshKey' k, count(*) from import_batches
          where options ? 'refreshKey' group by 1 having count(*) > 1`,
  },
  {
    id: "SQL-09",
    level: "peringatan",
    title: "Batch impor macet: status applying dengan lease habis lebih dari 15 menit",
    sql: `select id, source_label, lease_until from import_batches
          where status = 'applying' and lease_until < now() - interval '15 minutes'`,
  },
  {
    id: "SQL-10",
    level: "peringatan",
    title: "Antrean foto macet: running dengan lease habis lebih dari 1 jam",
    sql: `select id, product_id, lease_until from photo_jobs
          where status = 'running' and lease_until < now() - interval '1 hour'`,
  },
  {
    id: "SQL-11",
    level: "peringatan",
    title: "Produk terbit tanpa penawaran sama sekali (halaman hanya berisi spesifikasi)",
    sql: `select p.slug from products p where p.status = 'published' and not exists (
            select 1 from variants v join offers o on o.variant_id = v.id where v.product_id = p.id)`,
  },
  {
    id: "SQL-12",
    level: "peringatan",
    title: "Penawaran aktif yang harganya belum diperiksa ulang lebih dari 7 hari",
    sql: `select o.id, o.url, l.observed_at from offers o join offer_latest_price l on l.offer_id = o.id
          where o.listing_status = 'active' and l.observed_at < now() - interval '7 days'`,
  },
  {
    id: "SQL-13",
    level: "peringatan",
    title: "Draft kedaluwarsa (>14 hari) yang belum dibatalkan job harian",
    sql: `select id, source_label, created_at from import_batches
          where status = 'draft' and created_at < now() - interval '14 days'`,
  },
];

function query(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  if (oneLine.includes('"')) throw new Error("SQL pemeriksaan tidak boleh memuat tanda kutip ganda");
  // Satu string perintah dengan SQL berkutip ganda: aman untuk > < | di cmd.exe
  // maupun sh, dan tidak dipecah menjadi banyak argumen.
  const out = execSync(`npx -y @insforge/cli db query "${oneLine}" --json`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
}

let failed = 0;
const summary = [];
for (const check of checks) {
  let rows;
  try {
    rows = query(check.sql);
  } catch (error) {
    console.error(`${check.id} TIDAK BISA DIJALANKAN: ${String(error.stderr ?? error).slice(0, 200)}`);
    failed += 1;
    continue;
  }
  const ok = rows.length === 0;
  if (!ok && check.level === "gagal") failed += 1;
  const mark = ok ? "LULUS " : check.level === "gagal" ? "GAGAL " : "CATAT ";
  console.log(`${mark} ${check.id} ${check.title}${ok ? "" : ` (${rows.length} baris)`}`);
  if (!ok) for (const row of rows.slice(0, 5)) console.log(`         ${JSON.stringify(row)}`);
  summary.push({ id: check.id, level: check.level, violations: rows.length });
}
console.log(`\n${summary.filter((s) => s.violations === 0).length}/${checks.length} lulus, ${failed} gagal (tingkat "gagal"), ` +
  `${summary.filter((s) => s.violations > 0 && s.level === "peringatan").length} peringatan.`);
process.exit(failed > 0 ? 1 : 0);
