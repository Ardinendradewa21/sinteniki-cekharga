/**
 * Membuat aset foto latar (scene) tema Verdant dari foto sumber.
 *
 *   node scripts/build-scene.mjs
 *   node scripts/build-scene.mjs --src <folder> --out <folder>
 *
 * Masukan: design/scene-src/day.* dan design/scene-src/night.* (jpg, jpeg,
 * png, webp, avif, tif). Foto harus milik sendiri atau berlisensi bebas;
 * folder sumber di-ignore git.
 *
 * Keluaran di public/images/scene/ (DESIGN.md §6.4), dipotong ke 16:10
 * (`fit: cover`) karena scene selalu melebar; foto potret pun aman:
 *   <nama>.avif       2400x1500, master untuk next/image (srcset dibuat
 *                     Next), batas 200 KB
 *   <nama>-blur.avif  1200x750, Gaussian sigma 18 (setara blur 36px pada
 *                     2400px), hanya untuk Hero Price Panel, batas 40 KB
 *
 * Titik fokus potongan bisa diatur per foto: --position-day <nilai> dan
 * --position-night <nilai> (nilai sharp: centre, north, south, east, west,
 * attention, entropy, dst.). Bawaan: centre.
 *
 * Kualitas AVIF diturunkan bertahap sampai berkas muat batasnya. Bila sampai
 * kualitas terendah masih melebihi batas, skrip berhenti dengan kode 1 supaya
 * aset kebesaran tidak ikut ter-commit diam-diam. Metadata EXIF (termasuk
 * lokasi GPS) tidak ikut disalin karena sharp membuangnya secara default.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const SRC_DIR = path.resolve(argValue("--src", "design/scene-src"));
const OUT_DIR = path.resolve(argValue("--out", "public/images/scene"));
const NAMES = ["day", "night"];
const SOURCE_EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const KB = 1024;
const VARIANTS = [
  { suffix: "", width: 2400, height: 1500, sigma: 0, maxBytes: 200 * KB, qualities: [60, 55, 50, 45, 40, 35, 30] },
  { suffix: "-blur", width: 1200, height: 750, sigma: 18, maxBytes: 40 * KB, qualities: [50, 45, 40, 35, 30, 25] },
];

async function findSource(name) {
  const files = await readdir(SRC_DIR).catch(() => []);
  const match = files.find((file) => SOURCE_EXT.test(file) && path.parse(file).name.toLowerCase() === name);
  return match ? path.join(SRC_DIR, match) : null;
}

async function encode(source, variant, quality, position) {
  let pipeline = sharp(source).rotate().resize({
    width: variant.width,
    height: variant.height,
    fit: "cover",
    position,
    withoutEnlargement: true,
  });
  if (variant.sigma > 0) pipeline = pipeline.blur(variant.sigma);
  return pipeline.avif({ quality, effort: 6, chromaSubsampling: "4:2:0" }).toBuffer();
}

async function build(name, source) {
  const meta = await sharp(source).rotate().metadata();
  if ((meta.width ?? 0) < 2400) {
    console.warn(`! ${name}: lebar sumber ${meta.width}px, kurang dari 2400px; hasil tidak diperbesar.`);
  }
  const position = argValue(`--position-${name}`, "centre");

  let failed = false;
  for (const variant of VARIANTS) {
    const outFile = path.join(OUT_DIR, `${name}${variant.suffix}.avif`);
    let result = null;
    for (const quality of variant.qualities) {
      const buffer = await encode(source, variant, quality, position);
      result = { buffer, quality };
      if (buffer.byteLength <= variant.maxBytes) break;
    }

    const size = result.buffer.byteLength;
    const label = `${path.relative(process.cwd(), outFile)} (${Math.round(size / KB)} KB, q${result.quality})`;
    if (size > variant.maxBytes) {
      console.error(`x ${label} melebihi batas ${variant.maxBytes / KB} KB; tidak ditulis.`);
      failed = true;
      continue;
    }
    await writeFile(outFile, result.buffer);
    console.log(`ok ${label}`);
  }
  return !failed;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let ok = true;
  for (const name of NAMES) {
    const source = await findSource(name);
    if (!source) {
      console.error(`x Sumber "${name}.*" tidak ditemukan di ${path.relative(process.cwd(), SRC_DIR) || "."}.`);
      ok = false;
      continue;
    }
    ok = (await build(name, source)) && ok;
  }
  if (!ok) process.exit(1);
  console.log("Selesai. Catat sumber dan lisensi foto di public/images/scene/SOURCES.md.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
