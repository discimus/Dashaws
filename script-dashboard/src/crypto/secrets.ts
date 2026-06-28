import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

const SECRETS_STORAGE_KEY = 'dashaws-secrets-blob';
const PBKDF2_ITERATIONS = 200_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 32;

const useSubtle = (() => {
  try {
    return !!(globalThis.crypto && globalThis.crypto.subtle);
  } catch {
    return false;
  }
})();

function encode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function decode(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(length)) as Uint8Array<ArrayBuffer>;
}

// ── Web Crypto API (crypto.subtle) path ────────────────────────────────

async function deriveKeySubtle(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Pure-JS fallback (@noble/hashes + @noble/ciphers) ─────────────────

function deriveKeyJS(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_LENGTH_BITS / 8 });
}

function encryptSecretsJS(secrets: Record<string, string>, password: string): EncryptedBlob {
  const salt = randomBytes(SALT_BYTES);
  const key = deriveKeyJS(password, salt);
  const nonce = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(secrets));
  const cipher = gcm(key, nonce);
  const encrypted = cipher.encrypt(plaintext);
  const hash = hashPasswordJS(password);
  return { iv: encode(nonce), data: encode(encrypted), salt: encode(salt), hash };
}

function decryptSecretsJS(blob: EncryptedBlob, password: string): Record<string, string> {
  const salt = decode(blob.salt);
  const key = deriveKeyJS(password, salt);
  const nonce = decode(blob.iv);
  const ciphertext = decode(blob.data);
  const cipher = gcm(key, nonce);
  const decrypted = cipher.decrypt(ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function hashPasswordJS(password: string): string {
  const hash = sha256(new TextEncoder().encode(password));
  return encode(hash);
}

// ── Public API ─────────────────────────────────────────────────────────

export interface EncryptedBlob {
  iv: string;
  data: string;
  salt: string;
  hash: string;
}

export async function encryptSecrets(
  secrets: Record<string, string>,
  password: string
): Promise<EncryptedBlob> {
  if (useSubtle) {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKeySubtle(password, salt);
    const iv = randomBytes(12);
    const plaintext = JSON.stringify(secrets);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    const hash = await hashPassword(password);
    return {
      iv: encode(iv),
      data: encode(new Uint8Array(encrypted)),
      salt: encode(salt),
      hash,
    };
  }
  return encryptSecretsJS(secrets, password);
}

export async function decryptSecrets(
  blob: EncryptedBlob,
  password: string
): Promise<Record<string, string>> {
  if (useSubtle) {
    const salt = decode(blob.salt);
    const key = await deriveKeySubtle(password, salt);
    const iv = decode(blob.iv);
    const data = decode(blob.data);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
  return decryptSecretsJS(blob, password);
}

export async function hashPassword(password: string): Promise<string> {
  if (useSubtle) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return encode(new Uint8Array(hash));
  }
  return hashPasswordJS(password);
}

export function saveBlob(blob: EncryptedBlob): void {
  localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(blob));
}

export function loadBlob(): EncryptedBlob | null {
  try {
    const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.iv && parsed.data && parsed.salt && parsed.hash) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearBlob(): void {
  localStorage.removeItem(SECRETS_STORAGE_KEY);
}
