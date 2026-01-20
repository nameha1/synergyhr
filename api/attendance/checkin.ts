import * as crypto from "crypto";

type OfficeSettings = {
  allowedASNs: Set<number>;
  allowedCIDRs: string[];
};

const SETTINGS_CACHE_TTL_MS = 30_000;
let settingsCache: { value: OfficeSettings; expiresAt: number } | null = null;

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function cidrContainsIPv4(cidr: string, ip: string): boolean {
  const [netStr, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const net = ipv4ToInt(netStr);
  const addr = ipv4ToInt(ip);
  if (net === null || addr === null) return false;

  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1) >>> 0) >>> 0;
  return (net & mask) === (addr & mask);
}

function ipAllowedByCidrs(cidrs: string[], ip: string): boolean {
  if (cidrs.length === 0) return true;
  return cidrs.some((cidr) => cidrContainsIPv4(cidr.trim(), ip));
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name.toLowerCase()];
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getClientIpFromRequest(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const cf = getHeaderValue(req.headers, "cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = getHeaderValue(req.headers, "x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;

  const xri = getHeaderValue(req.headers, "x-real-ip");
  if (xri) return xri.trim();

  return null;
}

async function fetchOfficeSettings(): Promise<OfficeSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) {
    return settingsCache.value;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url) {
    throw new Error("Server missing SUPABASE_URL");
  }
  if (!key) {
    throw new Error("Server missing SUPABASE_ANON_KEY");
  }

  const response = await fetch(
    `${url}/rest/v1/office_settings?select=setting_key,setting_value`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Supabase settings fetch failed");
  }

  const data = (await response.json()) as Array<{
    setting_key: string;
    setting_value: unknown;
  }>;

  const asnSetting = data.find((item) => item.setting_key === "allowed_asns");
  const cidrSetting = data.find((item) => item.setting_key === "allowed_cidrs");

  const allowedASNs = new Set(
    normalizeStringList(asnSetting?.setting_value)
      .map((item) => item.replace(/[^0-9]/g, ""))
      .map((digits) => Number(digits))
      .filter((value) => Number.isFinite(value))
  );

  const allowedCIDRs = normalizeStringList(cidrSetting?.setting_value);

  const value = { allowedASNs, allowedCIDRs };
  settingsCache = { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
  return value;
}

type IpinfoLiteResp = {
  ip?: string;
  asn?: string;
  as_name?: string;
  country?: string;
  country_code?: string;
};

async function requireOfficeNetwork(req: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ ok: true; ip: string; asn: number } | { ok: false; reason: string }> {
  const token = process.env.IPINFO_TOKEN ?? process.env.VITE_IPINFO_TOKEN;
  if (!token) return { ok: false, reason: "Server missing IPINFO_TOKEN" };

  const ip = getClientIpFromRequest(req);
  if (!ip) return { ok: false, reason: "Cannot determine client IP" };

  let officeSettings: OfficeSettings;
  try {
    officeSettings = await fetchOfficeSettings();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase settings fetch failed";
    return { ok: false, reason: message };
  }

  const { allowedASNs, allowedCIDRs } = officeSettings;

  if (!ipAllowedByCidrs(allowedCIDRs, ip)) {
    return { ok: false, reason: "IP not in office CIDR" };
  }

  if (allowedASNs.size === 0) {
    return { ok: true, ip, asn: 0 };
  }

  const url = `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return { ok: false, reason: "IPinfo lookup failed" };

  const data = (await response.json()) as IpinfoLiteResp;
  const asnStr = (data.asn ?? "").replace(/^AS/i, "");
  const asn = Number(asnStr);
  if (!Number.isFinite(asn)) return { ok: false, reason: "ASN missing" };

  if (allowedASNs.size > 0 && !allowedASNs.has(asn)) {
    return { ok: false, reason: "ASN not allowed" };
  }

  return { ok: true, ip, asn };
}

function verifyOfficePass(token: string): boolean {
  const secret = process.env.OFFICE_PASS_SECRET ?? "";
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  let body = "";
  try {
    body = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (expected !== sig) return false;
  let parsed: { exp?: number } = {};
  try {
    parsed = JSON.parse(body) as { exp?: number };
  } catch {
    return false;
  }
  if (!parsed.exp || Math.floor(Date.now() / 1000) > parsed.exp) return false;
  return true;
}

export default async function handler(
  req: { method?: string; headers: Record<string, string | string[] | undefined> },
  res: { status: (code: number) => { json: (body: unknown) => void } }
) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, reason: "Method not allowed" });
    return;
  }

  const pass = getHeaderValue(req.headers, "x-office-pass") ?? "";
  if (!verifyOfficePass(pass)) {
    res.status(403).json({ ok: false, reason: "Invalid office pass" });
    return;
  }

  try {
    const result = await requireOfficeNetwork(req);
    if (!result.ok) {
      res.status(403).json({ ok: false, reason: result.reason });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ ok: false, reason: message });
  }
}
