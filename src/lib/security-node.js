/**
 * Node.js-only security helpers.
 * Keep this file imported only by route handlers that declare runtime="nodejs".
 */
import {
  detectIpVersion,
  isPrivateOrReservedIp,
  isHostInAllowlist,
} from "@/lib/security";

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
];

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
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!isHostInAllowlist(hostname, [...ALLOWED_AUDIO_HOSTS, ...extraHosts])) {
    return { ok: false, error: `Host '${hostname}' is not in the audio allowlist` };
  }

  try {
    const dns = await import("node:dns/promises");
    const records = await dns.lookup(hostname, { all: true });

    if (!records?.length) {
      return { ok: false, error: "Unable to resolve upstream host" };
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          ok: false,
          error: "Upstream host resolved to a restricted private IP address",
        };
      }
    }
  } catch {
    return { ok: false, error: "DNS resolution failed for upstream host" };
  }

  return { ok: true, url: parsed.toString() };
}
