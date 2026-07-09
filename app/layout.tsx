import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Órale AI · Punto de venta con IA para tu negocio",
  description:
    "Punto de venta con IA para taquerías, fondas y restaurantes en México. iOS, Android y Windows. Offline, mesas, impresión en red y menú con foto.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
