/** JAN/EAN バーコード正規化（数字のみ・前後空白除去） */
export function normalizeBarcode(raw: string): string {
  return String(raw || '').trim().replace(/\D/g, '');
}

/** 先頭0の有無など複数キーでルックアップ */
export function resolveProductByBarcode(
  barcode: string,
  map: Record<string, string>
): string | null {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  if (map[code]) return map[code];
  // EAN-13 ↔ EAN-8 等のゆるい一致
  const trimmed = code.replace(/^0+/, '');
  if (map[trimmed]) return map[trimmed];
  for (const [key, name] of Object.entries(map)) {
    if (key.endsWith(trimmed) || trimmed.endsWith(key.replace(/^0+/, ''))) return name;
  }
  return null;
}

export function buildBarcodeLookup(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [code, name] of Object.entries(map)) {
    const n = normalizeBarcode(code);
    if (n) out[n] = name;
  }
  return out;
}
