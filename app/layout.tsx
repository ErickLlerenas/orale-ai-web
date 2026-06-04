import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Órale AI · Punto de venta con IA para tu negocio",
  description:
    "El punto de venta con IA para taquerías, fondas y negocios pequeños en México. Offline, simple y listo en minutos.",
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
