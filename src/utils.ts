export function cleanName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const raw = String(value).trim();
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}

export function isFinished(status: unknown, approved?: unknown, result?: unknown): boolean {
  const s = String(status ?? "").toLowerCase();
  const explicit = /finished|complete|completed|played|final|full.?time|result/.test(s);
  const pending = /scheduled|pending|postponed|cancelled|abandoned|live|in.?play/.test(s);
  if (pending) return false;
  if (explicit) return true;
  return approved === true && result === true;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function fetchJson(url: string, timeoutMs: number, headers: Record<string,string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json", ...headers },
      signal: controller.signal
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 240)}`);
    if (!body.trim()) throw new Error("Provider returned an empty response body");
    try { return JSON.parse(body); }
    catch { throw new Error("Provider returned invalid JSON"); }
  } finally {
    clearTimeout(timer);
  }
}
