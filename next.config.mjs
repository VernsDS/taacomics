/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

const CSP_HEADER = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://translate.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_HEADER },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "uploads.mangadex.org" },
      { protocol: "https", hostname: "**.mangadex.network" },
      { protocol: "https", hostname: "files.catbox.moe" },
      { protocol: "https", hostname: "**.komiku.org" },
      { protocol: "https", hostname: "komiku.org" },
      { protocol: "https", hostname: "**.komiku.to" },
      { protocol: "https", hostname: "**.komikid.org" },
      { protocol: "https", hostname: "**.pstatic.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "i.imgur.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "admin.taamanga.my.id" }],
          destination: "/admin",
        },
        {
          source:
            "/:path((?!api|_next|admin|favicon\\.png|icon\\.png|logo\\.jpg|banner\\.png|manifest\\.json|robots\\.txt|sitemap\\.xml).*)",
          has: [{ type: "host", value: "admin.taamanga.my.id" }],
          destination: "/admin/:path",
        },
      ],
    };
  },
};

export default nextConfig;
