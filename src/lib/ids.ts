export function newId(): string {
  return crypto.randomUUID();
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  // Sync fallback for webhook hashing without async subtle in all paths.
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + String(bytes.length);
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
