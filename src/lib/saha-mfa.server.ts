const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function b64Decode(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let buffer = 0;
  let result = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32[(buffer << (5 - bits)) & 31];
  return result;
}

function base32Decode(value: string) {
  let bits = 0;
  let buffer = 0;
  const result: number[] = [];
  for (const char of value.replace(/\s/g, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Geçersiz MFA anahtarı.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      result.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(result);
}

async function sifrelemeAnahtari() {
  const secret = process.env["SAHA_SESSION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("SAHA_SESSION_SECRET yapılandırılmamış.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mfa:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function mfaAnahtariUret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function mfaAnahtariSifrele(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await sifrelemeAnahtari(),
    new TextEncoder().encode(secret),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}

export async function mfaAnahtariCoz(value: string) {
  const [version, iv, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !encrypted) throw new Error("MFA anahtarı okunamadı.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64Decode(iv) },
    await sifrelemeAnahtari(),
    b64Decode(encrypted),
  );
  const decoded = new TextDecoder().decode(plain);
  try {
    const bundle = JSON.parse(decoded) as { secret?: unknown };
    return typeof bundle.secret === "string" ? bundle.secret : decoded;
  } catch {
    return decoded;
  }
}

export type MfaVerisi = { secret: string; kurtarmaHashleri: string[] };

export async function mfaVerisiCoz(value: string): Promise<MfaVerisi> {
  const [version, iv, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !encrypted) throw new Error("MFA anahtarı okunamadı.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64Decode(iv) },
    await sifrelemeAnahtari(),
    b64Decode(encrypted),
  );
  const decoded = new TextDecoder().decode(plain);
  try {
    const bundle = JSON.parse(decoded) as Partial<MfaVerisi>;
    if (typeof bundle.secret === "string") {
      return { secret: bundle.secret, kurtarmaHashleri: bundle.kurtarmaHashleri ?? [] };
    }
  } catch {
    // Eski kayıtlar yalnız TOTP anahtarını içerir.
  }
  return { secret: decoded, kurtarmaHashleri: [] };
}

export async function mfaVerisiSifrele(veri: MfaVerisi) {
  return mfaAnahtariSifrele(JSON.stringify(veri));
}

async function kurtarmaKoduHashle(kod: string) {
  const secret = process.env["SAHA_SESSION_SECRET"];
  if (!secret) throw new Error("SAHA_SESSION_SECRET yapılandırılmamış.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const normalized = kod.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hash = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`mfa-kurtarma:${normalized}`)),
  );
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function kurtarmaKodlariUret() {
  const alfabe = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const kodlar = Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const value = Array.from(bytes, (b) => alfabe[b % alfabe.length]).join("");
    return `${value.slice(0, 4)}-${value.slice(4)}`;
  });
  return { kodlar, hashler: await Promise.all(kodlar.map(kurtarmaKoduHashle)) };
}

export async function kurtarmaKoduBul(hashler: string[], kod: string) {
  const hash = await kurtarmaKoduHashle(kod);
  return hashler.indexOf(hash);
}

async function totp(secret: string, counter: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = n & 255;
    n = Math.floor(n / 256);
  }
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  if (hash.length < 20) throw new Error("TOTP hash hesaplanamadı.");
  const offset = (hash.at(-1) ?? 0) & 15;
  const binary =
    (((hash.at(offset) ?? 0) & 127) << 24) |
    ((hash.at(offset + 1) ?? 0) << 16) |
    ((hash.at(offset + 2) ?? 0) << 8) |
    (hash.at(offset + 3) ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
}

export async function mfaKoduDogrula(secret: string, code: string): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(Date.now() / 30_000);
  for (const delta of [-1, 0, 1]) if ((await totp(secret, counter + delta)) === code) return counter + delta;
  return null;
}

export function mfaKurulumUri(secret: string, ad: string) {
  const issuer = "Saha Is Takip";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${ad}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
