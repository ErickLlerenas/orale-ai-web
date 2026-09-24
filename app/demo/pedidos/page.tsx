import type { Metadata } from "next";
import Storefront from "@/components/online/Storefront";
import { demoMenu } from "@/lib/online/demo";

const title = "Prueba el menú en línea · Órale AI";
const description =
  "Explora un menú de ejemplo, personaliza tus productos y envía un pedido de prueba a tu propio WhatsApp.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: "/demo/pedidos" },
  openGraph: { title, description, url: "/demo/pedidos", images: [] },
  twitter: { card: "summary", title, description, images: [] },
};

export default function OrderDemoPage() {
  return <Storefront initialMenu={demoMenu} slug="demo" preview />;
}
