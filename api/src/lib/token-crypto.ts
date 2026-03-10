function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes / 256 bits)");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts a raw token string. Returns a base64 string of IV (12 bytes) || ciphertext. */
export async function encryptToken(rawToken: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(rawToken);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...result));
}

/** Decrypts a base64-encoded IV || ciphertext back to the original token string. */
export async function decryptToken(encrypted: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const bytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
