import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  brandName,
  brandNamePlain,
  siteDescription,
  siteTitle,
  siteUrl,
  stores,
} from "@/lib/seo";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: brandNamePlain,
  keywords: [
    "Orale AI",
    "Órale AI",
    "OraleAI",
    "punto de venta",
    "punto de venta taquerías",
    "POS México",
    "fondas",
    "food trucks",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: brandName,
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "/og-icon.png",
        width: 200,
        height: 200,
        alt: `${brandName} · ${brandNamePlain}`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-icon.png"],
  },
  itunes: { appId: stores.appleId },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
