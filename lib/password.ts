import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt from Node's own crypto module — no bcrypt/argon2 native dependency
// to compile on deploy. Stored as "scrypt$<saltHex>$<hashHex>" so the salt
// and cost travel with the hash and there's nothing else to configure later.
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8;
}
