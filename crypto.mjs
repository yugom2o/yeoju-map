const encoder = new TextEncoder();
export const ITERATIONS = 600000;
export const b64 = bytes => {
  let result = '';
  for (const byte of new Uint8Array(bytes)) result += String.fromCharCode(byte);
  return btoa(result);
};
export const unb64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export async function deriveSession(password, salt, mapSalt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const params = value => ({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(value), iterations: ITERATIONS });
  const key = await crypto.subtle.deriveKey(params(salt), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bits = await crypto.subtle.deriveBits(params(mapSalt), material, 256);
  const mapId = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return { key, mapId };
}
export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return { iv: b64(iv), data: b64(data) };
}
export async function decryptText(key, payload) {
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.data));
  return new TextDecoder().decode(bytes);
}
