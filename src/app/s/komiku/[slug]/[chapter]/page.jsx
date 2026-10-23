import { notFound } from "next/navigation";
import { getKomikuChapter } from "@/lib/komiku";
import KomikuReader from "@/components/komiku-reader";

export async function generateMetadata({ params }) {
  const { chapter } = await params;
  const pretty = String(chapter).replace(/[^a-z0-9-]/gi, "").replace(/-/g, " ");
  return { title: `${pretty.charAt(0).toUpperCase() + pretty.slice(1)} - TaaComics` };
}

function sitePathToRoute(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return pathname;
  } catch {
    return null;
  }
}

export default async function KomikuChapterPage({ params }) {
  const { slug, chapter } = await params;

  let data;
  try {
    data = await getKomikuChapter(chapter);
  } catch {
    notFound();
  }

  const prevPath = data.prev ? sitePathToRoute(data.prev) : null;
  const nextPath = data.next ? sitePathToRoute(data.next) : null;
  const prevHref = prevPath ? `/s/komiku/${slug}/${prevPath}` : null;
  const nextHref = nextPath ? `/s/komiku/${slug}/${nextPath}` : null;

  return (
    <KomikuReader
      title={data.title}
      images={data.images}
      prevHref={prevHref}
      nextHref={nextHref}
      backHref={`/s/komiku/${slug}`}
    />
  );
}
