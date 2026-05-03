// FIFO-capped Map. Map preserves insertion order, so the first key is oldest.
// Approximate LRU; close enough for our serverless instance lifetime.
export function setWithCap<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  max = 200
): void {
  if (!map.has(key) && map.size >= max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}
