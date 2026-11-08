import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/navbar";
import BottomNav from "@/components/bottom-nav";
import MusicPlayerLazy from "@/components/music-player-lazy";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  metadataBase: new URL("https://taamanga.my.id"),
  title: "TaaComics - Baca Manga, Manhua & Manhwa",
  description:
    "Platform baca manga, manhua, dan manhwa gratis dengan koleksi terlengkap. Update setiap hari.",
  manifest: "/manifest.json",
  openGraph: {
    title: "TaaComics - Baca Manga, Manhua & Manhwa Gratis",
    description:
      "Baca manga, manhua, dan manhwa terbaru gratis. Koleksi lengkap, cepat & ringan.",
    images: [{ url: "/banner.png", width: 1500, height: 500, alt: "TaaComics Banner" }],
    type: "website",
    siteName: "TaaComics",
  },
  twitter: {
    card: "summary_large_image",
    title: "TaaComics - Baca Manga Gratis",
    description: "Platform baca manga, manhua, dan manhwa gratis terlengkap.",
    images: ["/banner.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.className} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f59e0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TaaComics" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
      </head>
      <body className="pb-24">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <BottomNav />
        <MusicPlayerLazy />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#141720",
              color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
