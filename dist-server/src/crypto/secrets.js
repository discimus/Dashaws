const SECRETS_STORAGE_KEY = 'script-dashboard-secrets-blob';
const PBKDF2_ITERATIONS = 200_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 32;
function encode(buf) {
    const arr = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return btoa(String.fromCharCode(...arr));
}
function decode(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}
function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
}
async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
    }, baseKey, { name: 'AES-GCM', length: KEY_LENGTH_BITS }, false, ['encrypt', 'decrypt']);
}
export async function encryptSecrets(secrets, password) {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt);
    const iv = randomBytes(12);
    const plaintext = JSON.stringify(secrets);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(plaintext));
    const hash = await hashPassword(password);
    return {
        iv: encode(iv),
        data: encode(encrypted),
        salt: encode(salt),
        hash,
    };
}
export async function decryptSecrets(blob, password) {
    const salt = decode(blob.salt);
    const key = await deriveKey(password, salt);
    const iv = decode(blob.iv);
    const data = decode(blob.data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
}
export async function hashPassword(password) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return encode(hash);
}
export function saveBlob(blob) {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(blob));
}
export function loadBlob() {
    try {
        const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (parsed.iv && parsed.data && parsed.salt && parsed.hash) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
export function clearBlob() {
    localStorage.removeItem(SECRETS_STORAGE_KEY);
}
//# sourceMappingURL=secrets.js.map