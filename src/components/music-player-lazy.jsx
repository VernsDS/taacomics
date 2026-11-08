"use client";

import dynamic from "next/dynamic";

const MusicPlayer = dynamic(() => import("@/components/music-player"), {
  ssr: false,
});

export default function MusicPlayerLazy() {
  return <MusicPlayer />;
}
