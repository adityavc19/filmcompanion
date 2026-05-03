export interface ShareData {
  positions: number[]; // 0-100 for cards 1-3, -1 if skipped
  texts: string[]; // written reactions for cards 1-4
  rating?: number; // 0.5-5
  filmTitle?: string;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToUtf8(s: string): string {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function toBase64Url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  return t;
}

export function encodePayload<T>(data: T): string {
  return toBase64Url(utf8ToBase64(JSON.stringify(data)));
}

export function decodePayload<T>(s: string): T | null {
  try {
    return JSON.parse(base64ToUtf8(fromBase64Url(s))) as T;
  } catch {
    return null;
  }
}

export function encodeShareData(data: ShareData): string {
  return encodePayload(data);
}

export function decodeShareData(hash: string): ShareData | null {
  return decodePayload<ShareData>(hash);
}
