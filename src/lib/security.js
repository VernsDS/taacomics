/**
 * Security utilities for TaaComics:
 * - Edge & Browser compatible (zero top-level Node-only imports; dns is dynamically imported only inside validateSafeAudioUrl)
 * - Strict CORS validation restricted to taamanga.my.id and admin.taamanga.my.id
 * - SSRF host allowlist & private/reserved IPv4/IPv6 blocker
 * - Image URL domain allowlist for custom chapters
 */

export const PRIMARY_DOMAIN = "taamanga.my.id";
export const ADMIN_DOMAIN = "admin.taamanga.my.id";
export const CANONICAL_BASE_URL = "https://taamanga.my.id";
export const USER_AGENT = "TaaComics/2.0 (+https://taamanga.my.id)";

const ALLOWED_ORIGINS = new Set([
  "https://taamanga.my.id",
  "https://www.taamanga.my.id",
  "https://admin.taamanga.my.id",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://admin.localhost:3000"]
    : []),
]);

const ALLOWED_AUDIO_HOSTS = [
  "api-faa.my.id",
  "googlevideo.com",
  "ytimg.com",
  "youtube.com",
  "scdn.co",
  "sndcdn.com",
  "akamaized.net",
  "catbox.moe",
  "clyp.it",
  "aceimg.com", // Faa audio CDN (e.g. cdn.aceimg.com)
];

export const ALLOWED_IMAGE_DOMAINS = [
  "uploads.mangadex.org",
  "mangadex.network",
  "cmdxd98sb0x3yprd.mangadex.network",
  "komiku.org",
  "komiku.to",
  "komikid.org",
  "pstatic.net",
  "files.catbox.moe",
  "i.ibb.co",
  "i.imgur.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "res.cloudinary.com",
  "lh3.googleusercontent.com",
];

export function getCorsHeaders(request, methods = "GET, OPTIONS") {
  const origin = request?.headers?.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : CANONICAL_BASE_URL;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Range, X-CSRF-Token",
    Vary: "Origin",
  };
}

/**
 * Pure JS IPv4 / IPv6 detector (works in Edge, Node, and Browser without node:net).
 */
export function detectIpVersion(ip) {
  const clean = String(ip || "").trim().replace(/^\[|\]$/g, "");
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) {
    const parts = clean.split(".").map(Number);
    if (parts.every((n) => n >= 0 && n <= 255)) return 4;
  }
  if (clean.includes(":") && /^[0-9a-fA-F:.]+$/.test(clean)) {
    return 6;
  }
  return 0;
}

/**
 * Check if an IPv4 or IPv6 literal falls in private, loopback, link-local,
 * metadata, or reserved ranges (RFC 1918, RFC 4193, RFC 6598, cloud metadata).
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  const clean = String(ip).trim().toLowerCase().replace(/^\[|\]$/g, "");

  if (clean.startsWith("::ffff:")) {
    const v4 = clean.slice(7);
    if (detectIpVersion(v4) === 4) return isPrivateOrReservedIp(v4);
  }

  const version = detectIpVersion(clean);

  if (version === 4) {
    const [a, b, c] = clean.split(".").map(Number);
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    return false;
  }

  if (version === 6) {
    if (clean === "::" || clean === "::1") return true;
    if (clean.startsWith("fc") || clean.startsWith("fd")) return true;
    if (
      clean.startsWith("fe8") ||
      clean.startsWith("fe9") ||
      clean.startsWith("fea") ||
      clean.startsWith("feb")
    ) {
      return true;
    }
    if (clean.startsWith("ff")) return true;
    if (clean.startsWith("2001:db8:")) return true;
    return false;
  }

  return true;
}

export function isHostInAllowlist(hostname, allowlist) {
  const host = String(hostname || "").toLowerCase().trim();
  if (!host) return false;
  return allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Validate an upstream audio URL against SSRF (Node.js runtime only).
 */
export async function validateSafeAudioUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTPS audio streams are permitted" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credentials in URL are forbidden" };
  }
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, error: "Non-standard ports are forbidden" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    detectIpVersion(hostname) !== 0
  ) {
    return { ok: false, error: "Direct IP or local hostnames are forbidden" };
  }

  const extraHosts = (process.env.AUDIO_STREAM_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowlist = [...ALLOWED_AUDIO_HOSTS, ...extraHosts];

  if (!isHostInAllowlist(hostname, allowlist)) {
    return { ok: false, error: `Host '${hostname}' is not in the audio allowlist` };
  }

  try {
    const dns = await import("node:dns/promises");
    const records = await dns.default.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, error: "Unable to resolve upstream host" };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, error: "Upstream host resolved to a restricted private IP address" };
      }
    }
  } catch {
    return { ok: false, error: "DNS resolution failed for upstream host" };
  }

  return { ok: true, url: parsed.toString() };
}

export function isAllowedCustomImageUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (detectIpVersion(hostname) !== 0 && isPrivateOrReservedIp(hostname)) return false;

    const extraDomains = (process.env.CUSTOM_IMAGE_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const allowlist = [...ALLOWED_IMAGE_DOMAINS, ...extraDomains];

    return isHostInAllowlist(hostname, allowlist);
  } catch {
    return false;
  }
}

export function getClientIp(request) {
  const xff = request?.headers?.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = request?.headers?.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}
