/**
 * Manga Translator API — wraps manga-translator.ai
 * Hardened with:
 * - Origin/Host verification (same-origin only)
 * - Upstash rate limiting (10 requests / minute per IP)
 * - Strict image URL domain allowlist (prevents SSRF / open proxy)
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { isAllowedCustomImageUrl, getCorsHeaders, USER_AGENT } from "@/lib/security";

export const runtime = "nodejs";

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://manga-translator.ai",
  Referer: "https://manga-translator.ai/",
  fp: "6e9a38cb67afccae784c68be21a8a387",
  "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
};

const UPLOAD_HEADERS = {
  ...COMMON_HEADERS,
  fp1: "bFyIcq46yCju92avXHeOyA/RcuZH+3xcCTVRwdr34+5Iv6Zrdumo5c0BU7HK2cvM",
};

const TRANSLATE_HEADERS = {
  ...COMMON_HEADERS,
  "Content-Type": "application/json",
  fp1: "Kt6LRBkBrtgZV5ReQJOyBs2DmPMmj1qaMSK0O46ru93rarSN/oa/bnE2OtTgaJcM",
  "x-guide":
    "sIABglDxcNCj5jW/k09n79D+Kv6UKB+Gz5km5Zg+OHmsxCV7WwYrsFDaPskrs4XTor6t64mr8IisbSvaikJoxroE3dtM6ZnukoiYMRq0raDX+J57I2/LVftlKvxpzoPPX6hcP5HlEQssGYXYtuhRCs8ayJnlv75Wkg9CRxb2SjM=",
};

function resolveAndValidateSourceImage(rawImageUrl, requestUrl) {
  try {
    // Allow relative /api/proxy/page?url=... or direct allowlisted HTTPS URL
    if (rawImageUrl.startsWith("/api/proxy/page")) {
      const parsedProxy = new URL(rawImageUrl, requestUrl);
      const inner = parsedProxy.searchParams.get("url") || "";
      if (!isAllowedCustomImageUrl(inner)) return null;
      return inner;
    }
    if (isAllowedCustomImageUrl(rawImageUrl)) {
      return rawImageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadImageFromUrl(validatedUrl) {
  const imgRes = await fetch(validatedUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://mangadex.org",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);

  const imageBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  const filename = `page.${ext}`;

  const preamble = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    "",
  ].join("\r\n");

  const middle = [
    "",
    `--${boundary}`,
    `Content-Disposition: form-data; name="fn_name"`,
    "",
    "demo-image-translator",
    `--${boundary}`,
    `Content-Disposition: form-data; name="request_from"`,
    "",
    "22",
    `--${boundary}`,
    `Content-Disposition: form-data; name="origin_from"`,
    "",
    "1a98cd9363f93dca",
    `--${boundary}--`,
  ].join("\r\n");

  const preambleBytes = new TextEncoder().encode(preamble);
  const middleBytes = new TextEncoder().encode(middle);
  const imageBytes = new Uint8Array(imageBuffer);

  const body = new Uint8Array(preambleBytes.length + imageBytes.length + middleBytes.length);
  body.set(preambleBytes, 0);
  body.set(imageBytes, preambleBytes.length);
  body.set(middleBytes, preambleBytes.length + imageBytes.length);

  const res = await fetch("https://api.manga-translator.ai/aitools/upload-img", {
    method: "POST",
    headers: {
      ...UPLOAD_HEADERS,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-code": Date.now().toString(),
    },
    body: body.buffer,
    signal: AbortSignal.timeout(20000),
  });

  const data = await res.json();
  if (!data?.data?.path) throw new Error("Upload failed: " + JSON.stringify(data));
  return data.data.path;
}

async function createTranslation(imagePath, targetLang = "id", index = 0) {
  const payload = {
    target_lang: String(targetLang || "id").slice(0, 8),
    request_from: 22,
    image: imagePath,
    index: Number(index) || 0,
    origin_from: "1a98cd9363f93dca",
  };

  const res = await fetch("https://api.manga-translator.ai/aitools/img-tr/create", {
    method: "POST",
    headers: { ...TRANSLATE_HEADERS, "X-code": Date.now().toString() },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  const data = await res.json();
  if (!data?.data?.result) throw new Error("Translation failed: " + JSON.stringify(data));
  return data.data.result;
}

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request, "POST, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "manga_translate",
      limit: 10,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Batas penggunaan terjemahan gambar tercapai. Coba lagi dalam 1 menit." },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { imageUrl, targetLang = "id", index = 0 } = await request.json();
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "imageUrl required" },
        { status: 400, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const validatedUrl = resolveAndValidateSourceImage(String(imageUrl), request.url);
    if (!validatedUrl) {
      return NextResponse.json(
        { success: false, error: "Domain gambar sumber tidak diizinkan." },
        { status: 403, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const uploadedPath = await uploadImageFromUrl(validatedUrl);
    const resultPath = await createTranslation(uploadedPath, targetLang, index);
    const translatedUrl = `https://temp.manga-translator.ai/${resultPath}`;

    return NextResponse.json(
      { success: true, translatedUrl },
      { headers: { ...corsHeaders, ...rl.headers } }
    );
  } catch (err) {
    console.error("[manga-translate]", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
