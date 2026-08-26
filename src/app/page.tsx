"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-[#f3f3f3] text-sm text-[#6b6b6b]">
      Loading…
    </div>
  ),
});

export default function HomePage() {
  return <App />;
}
