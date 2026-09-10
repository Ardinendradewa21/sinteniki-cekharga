import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Konfigurasi ESLint (flat config).
 *
 * `eslint-config-next` versi 16 mengekspor flat config langsung, jadi tidak
 * perlu FlatCompat maupun paket @eslint/eslintrc.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
