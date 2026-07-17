import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Órale AI · Punto de venta con IA para tu negocio",
  description:
    "Punto de venta con IA para taquerías, fondas y food trucks en México. Menú con foto, reportes claros y funciona sin internet. Pro para varios meseros con WiFi.",
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
