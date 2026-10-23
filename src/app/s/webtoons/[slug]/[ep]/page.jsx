import { notFound } from "next/navigation";
import { getWebtoonsEpisode } from "@/lib/webtoons";
import KomikuReader from "@/components/komiku-reader";

export async function generateMetadata({ params }) {
  const { ep } = await params;
  return { title: `Webtoon ${ep} - TaaComics` };
}

export default async function WebtoonsEpisodePage({ params }) {
  const { slug, ep } = await params;

  let data;
  try {
    data = await getWebtoonsEpisode(slug, ep);
  } catch {
    notFound();
  }

  const prevHref = data.prev ? `/s/webtoons/${slug}/chapter-${data.prev.epNo}-${data.prev.seg}` : null;
  const nextHref = data.next ? `/s/webtoons/${slug}/chapter-${data.next.epNo}-${data.next.seg}` : null;

  return (
    <KomikuReader
      title={data.title}
      images={data.images}
      prevHref={prevHref}
      nextHref={nextHref}
      backHref={`/s/webtoons/${slug}`}
      direct={false}
    />
  );
}
