import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encryption of amounts, names and notes at rest, so the database alone never shows anyone's finances. The server
 * holds the key (`DATA_ENCRYPTION_KEY`, 32 random bytes in base64), so it encrypts on write and decrypts on read;
 * everything above the database works with plain values.
 *
 * Each value is AES-256-GCM with its own random nonce, stored as "v1.<nonce + ciphertext + tag in base64url>", and
 * bound to its table and column, so a value copied into another column fails to decrypt instead of reading as
 * something else. The keys for encrypting, for name lookups and for checking the key are derived from the one
 * secret, each for its own purpose.
 */

const VERSION = "v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

type Keys = { encryption: Buffer; index: Buffer; check: string };
let cached: { raw: string; keys: Keys } | null = null;

/** Whether a key is configured, for scripts that only encrypt when one is. */
export function hasEncryptionKey() {
  return Boolean(process.env.DATA_ENCRYPTION_KEY);
}

function keys(): Keys {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY is not configured");
  if (cached?.raw === raw) return cached.keys;
  const secret = Buffer.from(raw, "base64");
  if (secret.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes in base64 (generate with `openssl rand -base64 32`)");
  const derive = (purpose: string) => Buffer.from(hkdfSync("sha256", secret, "yield-personal", purpose, 32));
  const checkKey = derive("key check v1");
  const derived = {
    encryption: derive("field encryption v1"),
    index: derive("name index v1"),
    check: createHmac("sha256", checkKey).update("yield-personal").digest("base64url"),
  };
  cached = { raw, keys: derived };
  return derived;
}

/** A value the key produces and only it does: recorded in the database to catch an environment with another key. */
export function keyCheckValue() {
  return keys().check;
}

/** Encrypts text for a column, `context` naming it ("purchases.note"). */
export function encryptText(plain: string, context: string) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keys().encryption, nonce);
  cipher.setAAD(Buffer.from(context));
  const sealed = Buffer.concat([nonce, cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${sealed.toString("base64url")}`;
}

/** Decrypts what `encryptText` stored for the same column; throws on anything else, never returning a wrong value. */
export function decryptText(stored: string, context: string) {
  const [version, body] = stored.split(".");
  if (version !== VERSION || !body) throw new Error(`Unreadable encrypted value in ${context}`);
  const sealed = Buffer.from(body, "base64url");
  if (sealed.length < NONCE_BYTES + TAG_BYTES) throw new Error(`Unreadable encrypted value in ${context}`);
  const decipher = createDecipheriv("aes-256-gcm", keys().encryption, sealed.subarray(0, NONCE_BYTES));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(NONCE_BYTES, sealed.length - TAG_BYTES)), decipher.final()]).toString("utf8");
}

/** Encrypts a whole number of centavos (or months). */
export function encryptInt(value: number, context: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`Only whole numbers are encrypted in ${context}`);
  return encryptText(String(value), context);
}

export function decryptInt(stored: string, context: string) {
  const text = decryptText(stored, context);
  const value = Number(text);
  if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(value)) throw new Error(`Unreadable encrypted number in ${context}`);
  return value;
}

/**
 * A keyed hash of an item's normalized name and its user: the same name always gives the same index, so items are
 * still found and kept unique by name, but the index can't be turned back into the name or matched across users.
 */
export function nameIndex(userId: string, normalizedName: string) {
  return createHmac("sha256", keys().index).update(`${userId}\u0000${normalizedName}`).digest("base64url");
}
