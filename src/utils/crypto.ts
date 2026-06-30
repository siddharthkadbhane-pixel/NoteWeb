// client-side end-to-end encryption/decryption using the browser's SubtleCrypto API

const SALT_CONSTANT = 'noteweb-salt-constant-v1';

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_CONSTANT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plain text using AES-GCM-256 derived from the passphrase.
 * Returns a serialized ciphertext prefixed block.
 */
export async function encryptMessage(text: string, passphrase: string): Promise<string> {
  if (!text) return '';
  try {
    const key = await deriveKey(passphrase);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      enc.encode(text)
    );

    // Convert IV and Ciphertext to hex strings for safe network transmission
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedBytes = new Uint8Array(encrypted);
    const encryptedHex = Array.from(encryptedBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return `[noteweb-aes-gcm]:${ivHex}:${encryptedHex}`;
  } catch (err) {
    console.error('[E2EE] Encryption failed:', err);
    throw err;
  }
}

/**
 * Decrypts a serialized ciphertext block using the passphrase.
 * If the input is not encrypted, returns it unchanged.
 */
export async function decryptMessage(encryptedText: string, passphrase: string): Promise<string> {
  if (!encryptedText || !encryptedText.startsWith('[noteweb-aes-gcm]:')) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const ivHex = parts[1];
    const encryptedHex = parts[2];

    // Convert hex strings back to bytes
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const key = await deriveKey(passphrase);
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[E2EE] Decryption failed:', err);
    throw err;
  }
}

/**
 * Helper to check if a message text is encrypted.
 */
export function isMessageEncrypted(text: string): boolean {
  return typeof text === 'string' && text.startsWith('[noteweb-aes-gcm]:');
}
