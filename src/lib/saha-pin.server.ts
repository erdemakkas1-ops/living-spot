/**
 * PIN kodlarının salt içeren, yavaş bir hash algoritması (bcrypt) ile
 * saklanması ve doğrulanması. Bu dosya yalnızca sunucuda çalışır.
 */
import bcrypt from "bcryptjs";

const MALIYET = 10;

export function pinHashle(pin: string): string {
  return bcrypt.hashSync(pin.trim(), MALIYET);
}

export function pinDogrula(pin: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(pin.trim(), hash);
  } catch {
    return false;
  }
}
