/**
 * PIN oturumları için imzalı (HMAC-SHA256) token üretimi ve doğrulaması.
 * Anahtar yalnızca sunucu tarafında bulunur; tarayıcıya asla gönderilmez.
 */
export type SahaClaims = { id: string; rol: "ik" | "personel"; oturumSurumu: number; exp: number };
export type MfaAdayClaims = { id: string; tur: "mfa-aday"; jti: string; exp: number };

const GECERLILIK_MS = 12 * 60 * 60 * 1000;

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string) {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function anahtar() {
  const secret = process.env["SAHA_SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("SAHA_SESSION_SECRET en az 32 karakter olacak şekilde yapılandırılmamış.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function imzala(payload: string) {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await anahtar(),
    new TextEncoder().encode(payload),
  );
  return b64url(new Uint8Array(sig));
}

export async function tokenUret(id: string, rol: "ik" | "personel", oturumSurumu: number) {
  const claims: SahaClaims = { id, rol, oturumSurumu, exp: Date.now() + GECERLILIK_MS };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  return `${payload}.${await imzala(payload)}`;
}

export async function mfaAdayTokenUret(id: string, jti: string) {
  const claims: MfaAdayClaims = { id, tur: "mfa-aday", jti, exp: Date.now() + 5 * 60 * 1000 };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  return `${payload}.${await imzala(payload)}`;
}

function esitMi(a: string, b: string) {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

function yetkisiz(): never {
  throw new Error("Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.");
}

/** Token'ı doğrular ve claim'leri döner; geçersizse hata atar. */
export async function tokenDogrula(token: unknown): Promise<SahaClaims> {
  if (typeof token !== "string" || !token.includes(".")) yetkisiz();
  const [payload, sig] = token.split(".");
  if (!payload || !sig) yetkisiz();
  if (!esitMi(sig, await imzala(payload))) yetkisiz();
  let claims: SahaClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as SahaClaims;
  } catch {
    yetkisiz();
  }
  if (!claims.id || (claims.rol !== "ik" && claims.rol !== "personel")) yetkisiz();
  if (!Number.isInteger(claims.oturumSurumu) || claims.oturumSurumu < 1) yetkisiz();
  if (!claims.exp || claims.exp < Date.now()) yetkisiz();
  return claims;
}

/** Yalnızca İK / yönetim rolüne izin verir. */
export async function ikDogrula(token: unknown): Promise<SahaClaims> {
  const claims = await tokenDogrula(token);
  if (claims.rol !== "ik") throw new Error("Bu işlem için yönetim yetkisi gerekiyor.");
  return claims;
}

export async function mfaAdayTokenDogrula(token: unknown): Promise<MfaAdayClaims> {
  if (typeof token !== "string" || !token.includes(".")) yetkisiz();
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !esitMi(sig, await imzala(payload))) yetkisiz();
  let claims: MfaAdayClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as MfaAdayClaims;
  } catch {
    yetkisiz();
  }
  if (!claims.id || claims.tur !== "mfa-aday" || !claims.jti || claims.exp < Date.now()) yetkisiz();
  return claims;
}
