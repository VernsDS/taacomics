
import { NextResponse } from "next/server";
import { readMaintenance } from "@/lib/siteStatus";

const ADMIN_HOSTS = new Set([
  "admin.taamanga.my.id",
  "admin.localhost:3000",
  "admin.localhost",
]);

/**
 * Next.js 16 Proxy
 * 1. Rewrites admin subdomain to /admin.
 * 2. Blocks direct admin access from public domain.
 * 3. Reads maintenance status from Neon database.
 * 4. Keeps admin and maintenance status API accessible.
 */
export default async function proxy(request) {
  const host = (request.headers.get("host") || "").toLowerCase().trim();
  const { pathname } = request.nextUrl;

  const isAdminHost = ADMIN_HOSTS.has(host) || host.startsWith("admin.");

  // Admin subdomain must remain accessible.
  if (isAdminHost) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();

    if (!pathname.startsWith("/admin")) {
      url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // Block direct admin access from public domain.
  if (pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/not-found";
    return NextResponse.rewrite(url, { status: 404 });
  }

  // Allow maintenance page and its public status API.
  if (
    pathname === "/maintenance" ||
    pathname === "/api/site-status"
  ) {
    return NextResponse.next();
  }

  // Check maintenance status from Neon.
  try {
    const { enabled } = await readMaintenance();

    if (enabled) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      url.search = "";

      return NextResponse.redirect(url);
    }
  } catch (error) {
    // Fail open if the database is temporarily unavailable.
    console.error("[proxy] Maintenance check failed:", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|robots.txt|sitemap.xml|logo.jpg|icon.png|banner.png|manifest.json).*)",
  ],
};
