"use client";

import dynamic from "next/dynamic";

const ChapterReader = dynamic(() => import("@/components/chapter-reader"), {
  ssr: false,
});

export default function ChapterPage() {
  return <ChapterReader />;
}
