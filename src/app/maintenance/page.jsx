import Image from "next/image";
import { readMaintenance, DEFAULT_MESSAGE } from "@/lib/siteStatus";

export const revalidate = 60;

export const metadata = {
  title: "Maintenance - TaaComics",
};

export default async function MaintenancePage() {
  let message = DEFAULT_MESSAGE;
  try {
    const { message: m } = await readMaintenance();
    if (m) message = m;
  } catch {}

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#080a0f" }}
    >
      <div
        className="w-20 h-20 rounded-3xl overflow-hidden mb-6"
        style={{
          border: "3px solid rgba(245,158,11,0.3)",
          boxShadow: "0 8px 32px rgba(245,158,11,0.2)",
        }}
      >
        <Image src="/favicon.png" alt="TaaComics" width={80} height={80} className="w-full h-full object-cover" />
      </div>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-3"
        style={{
          background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Sedang Pemeliharaan
      </h1>
      <p className="text-sm sm:text-base text-gray-300 max-w-md leading-relaxed mb-2">{message}</p>
      <p className="text-xs text-gray-500 mb-8">
        Kami akan kembali secepatnya. Terima kasih atas kesabaran kamu.
      </p>
      <a
        href="/?refresh=1"
        className="text-sm font-bold px-6 py-3 rounded-xl transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1f1400" }}
      >
        Muat Ulang Halaman
      </a>
    </div>
  );
}
