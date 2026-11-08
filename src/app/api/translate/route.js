import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders } from "@/lib/security";

export const runtime = "edge";

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request, "POST, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "text_translate",
      limit: 30,
      window: "1 m",
    });

    if (!rl.success) {
      return Response.json(
        { error: "Terlalu banyak permintaan terjemahan." },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { text, targetLang } = await request.json();
    if (!text?.trim()) {
      return Response.json({ translated: "" }, { headers: { ...corsHeaders, ...rl.headers } });
    }

    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", String(targetLang || "id").slice(0, 8));
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text.slice(0, 4000));

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
      },
    });

    if (!res.ok) {
      const mm = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          text.slice(0, 500)
        )}&langpair=auto|${encodeURIComponent(String(targetLang || "id").slice(0, 8))}`
      );
      const mmData = await mm.json();
      return Response.json(
        { translated: mmData.responseData?.translatedText || text },
        { headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const data = await res.json();
    const translated = (data[0] || []).map((x) => x?.[0] || "").join("");
    return Response.json(
      { translated, detectedLang: data[2] },
      { headers: { ...corsHeaders, ...rl.headers } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
