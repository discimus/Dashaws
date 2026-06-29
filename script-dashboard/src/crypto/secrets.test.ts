import { describe, it, expect } from 'vitest';
import { encryptSecrets, decryptSecrets, hashPassword, saveBlob, loadBlob, clearBlob, type EncryptedBlob } from './secrets';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('encryptSecrets / decryptSecrets', () => {
  const secrets: Record<string, string> = { API_KEY: 'abc123', DB_PASS: 'secret-db' };
  const password = 'strong-password-123';

  it('round-trips correctly', async () => {
    const blob = await encryptSecrets(secrets, password);
    expect(blob.iv).toBeTruthy();
    expect(blob.data).toBeTruthy();
    expect(blob.salt).toBeTruthy();
    expect(blob.hash).toBeTruthy();

    const decrypted = await decryptSecrets(blob, password);
    expect(decrypted).toEqual(secrets);
  });

  it('round-trips with empty secrets', async () => {
    const blob = await encryptSecrets({}, password);
    const decrypted = await decryptSecrets(blob, password);
    expect(decrypted).toEqual({});
  });

  it('round-trips with special characters', async () => {
    const special = { 'key!@#': 'val$%^', 'emoji': '\u{1F600}' };
    const blob = await encryptSecrets(special, password);
    const decrypted = await decryptSecrets(blob, password);
    expect(decrypted).toEqual(special);
  });

  it('fails to decrypt with wrong password', async () => {
    const blob = await encryptSecrets(secrets, password);
    await expect(decryptSecrets(blob, 'wrong-password')).rejects.toThrow();
  });

  it('produces different ciphertexts for the same plaintext', async () => {
    const blob1 = await encryptSecrets(secrets, password);
    const blob2 = await encryptSecrets(secrets, password);
    expect(blob1.data).not.toBe(blob2.data);
    expect(blob1.iv).not.toBe(blob2.iv);
    expect(blob1.salt).not.toBe(blob2.salt);
  });

  it('produces different salts for different encryptions', async () => {
    const blob1 = await encryptSecrets(secrets, password);
    const blob2 = await encryptSecrets(secrets, password);
    expect(blob1.salt).not.toBe(blob2.salt);
  });

  it('handles many secrets', async () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      many[`KEY_${i}`] = `value_${i}_${'x'.repeat(50)}`;
    }
    const blob = await encryptSecrets(many, password);
    const decrypted = await decryptSecrets(blob, password);
    expect(decrypted).toEqual(many);
  });

  it('accepts long password', async () => {
    const longPw = 'a'.repeat(128);
    const blob = await encryptSecrets(secrets, longPw);
    const decrypted = await decryptSecrets(blob, longPw);
    expect(decrypted).toEqual(secrets);
  });

  it('rejects tampered blob', async () => {
    const blob = await encryptSecrets(secrets, password);
    const tampered = { ...blob, data: 'aaa' + blob.data.slice(3) };
    await expect(decryptSecrets(tampered, password)).rejects.toThrow();
  });
});

describe('hashPassword', () => {
  it('returns a base64 string', async () => {
    const hash = await hashPassword('test');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces consistent results', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).toBe(h2);
  });

  it('produces different results for different passwords', async () => {
    const h1 = await hashPassword('one');
    const h2 = await hashPassword('two');
    expect(h1).not.toBe(h2);
  });
});

describe('localStorage persistence', () => {
  it('saveBlob and loadBlob round-trip', async () => {
    const blob = await encryptSecrets({ X: '1' }, 'pw');
    saveBlob(blob);
    const loaded = loadBlob();
    expect(loaded).toBeTruthy();
    expect(loaded!.iv).toBe(blob.iv);
    expect(loaded!.data).toBe(blob.data);
    expect(loaded!.salt).toBe(blob.salt);
    expect(loaded!.hash).toBe(blob.hash);
  });

  it('loadBlob returns null when nothing stored', () => {
    expect(loadBlob()).toBeNull();
  });

  it('clearBlob removes stored data', async () => {
    const blob = await encryptSecrets({ X: '1' }, 'pw');
    saveBlob(blob);
    expect(loadBlob()).not.toBeNull();
    clearBlob();
    expect(loadBlob()).toBeNull();
  });

  it('loadBlob returns null for malformed data', () => {
    localStorage.setItem('dashaws-secrets-blob', 'not-json');
    expect(loadBlob()).toBeNull();
  });

  it('loadBlob returns null for data with missing fields', () => {
    localStorage.setItem('dashaws-secrets-blob', JSON.stringify({ iv: 'a', data: 'b' }));
    expect(loadBlob()).toBeNull();
  });
});

describe('integration: encrypt → save → load → decrypt', () => {
  it('full lifecycle across functions', async () => {
    const original = { TOKEN: 'secret-token', HOST: 'db.example.com' };
    const pw = 'master-password';

    const blob = await encryptSecrets(original, pw);
    saveBlob(blob);

    const loaded = loadBlob();
    expect(loaded).not.toBeNull();

    const decrypted = await decryptSecrets(loaded!, pw);
    expect(decrypted).toEqual(original);

    // Verify hash matches
    const hash = await hashPassword(pw);
    expect(loaded!.hash).toBe(hash);

    clearBlob();
    expect(loadBlob()).toBeNull();
  });
});
