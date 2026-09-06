import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ver mi negocio · Órale AI",
  robots: { index: false, follow: false },
};

export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
