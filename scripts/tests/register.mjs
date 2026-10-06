// Loader uji untuk `node --test` tanpa bundler:
// - memetakan alias `@/` ke `src/` dan menambahkan ekstensi .ts/.tsx,
// - mengganti `server-only` dengan modul kosong (aman: uji berjalan di server),
// - mengganti `next/cache` dengan versi tiruan (tidak ada konteks request).
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const empty = "data:text/javascript,export {}";
const nextCacheStub =
  "data:text/javascript,export const revalidateTag=()=>{};export const revalidatePath=()=>{};export const unstable_cache=(f)=>f;";

function resolveTs(base) {
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: empty, shortCircuit: true };
    if (specifier === "next/cache") return { url: nextCacheStub, shortCircuit: true };
    if (/^next\/(navigation|headers)$/.test(specifier)) return next(`${specifier}.js`, context);
    if (specifier.startsWith("@/")) {
      const file = resolveTs(path.join(src, specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = resolveTs(path.join(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
