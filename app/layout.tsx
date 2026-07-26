import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://oraleai.vercel.app"),
  title: "Órale AI · Punto de venta con IA para tu negocio",
  description:
    "Punto de venta con IA para taquerías, fondas y food trucks en México. Menú con foto, reportes claros y funciona sin internet. Pro para varios meseros con WiFi.",
  openGraph: {
    title: "Órale AI · Punto de venta con IA para tu negocio",
    description:
      "Punto de venta con IA para taquerías, fondas y food trucks. Menú con foto y funciona sin internet.",
    url: "/",
    siteName: "Órale AI",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "/og-icon.png",
        width: 200,
        height: 200,
        alt: "Órale AI",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Órale AI · Punto de venta con IA para tu negocio",
    description:
      "Punto de venta con IA para taquerías, fondas y food trucks. Menú con foto y funciona sin internet.",
    images: ["/og-icon.png"],
  },
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
