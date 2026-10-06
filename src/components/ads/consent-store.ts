/**
 * Persetujuan iklan pihak ketiga, disimpan di cookie `ck_ads_consent`
 * ("all" | "essential") selama 180 hari. Iklan langsung CekHarga tidak
 * memakai cookie dan tidak bergantung pada persetujuan ini.
 */

export type AdConsent = "all" | "essential";

const COOKIE = "ck_ads_consent";
const EVENT = "ck-ads-consent";

export function readAdConsent(): AdConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)ck_ads_consent=(all|essential)/);
  return (match?.[1] as AdConsent | undefined) ?? null;
}

export function writeAdConsent(value: AdConsent): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeAdConsent(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
