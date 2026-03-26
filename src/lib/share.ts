export interface ShareData {
  positions: number[]; // 0-100 for cards 1-3, -1 if skipped
  texts: string[]; // written reactions for cards 1-4
  rating?: number; // 0.5-5
}

export function encodeShareData(data: ShareData): string {
  return btoa(JSON.stringify(data));
}

export function decodeShareData(hash: string): ShareData | null {
  try {
    return JSON.parse(atob(decodeURIComponent(hash)));
  } catch {
    return null;
  }
}
