import type { Metadata } from "next";
import MobileDownload from "./MobileDownload";

export const metadata: Metadata = {
  title: "Descarga Órale AI",
  alternates: { canonical: "/mobile" },
  robots: { index: false, follow: true },
};

export default function MobilePage() {
  return <MobileDownload />;
}
