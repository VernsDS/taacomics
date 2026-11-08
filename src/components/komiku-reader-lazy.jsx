"use client";

import dynamic from "next/dynamic";

const KomikuReader = dynamic(() => import("@/components/komiku-reader"), {
  ssr: false,
});

export default function KomikuReaderLazy(props) {
  return <KomikuReader {...props} />;
}
