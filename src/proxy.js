import { NextResponse } from "next/server";
import { readMaintenance } from "@/lib/siteStatus";

export default async function proxy(request) {
  try {
    const { enabled } = await readMaintenance();
    if (!enabled) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.png|robots.txt|sitemap.xml|logo.jpg|icon.png|banner.png|manifest.json|maintenance|admn67888820909).*)",
  ],
};
