import { cache } from "react";
import type { Metadata } from "next";
import { loadMenu } from "@/lib/online/server";
import Storefront from "@/components/online/Storefront";
import styles from "@/components/online/storefront.module.css";
export const dynamic = "force-dynamic";
const getMenu = cache(loadMenu);
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  let name = "Menú no disponible";
  let address = "";
  let logo: string | undefined;
  try {
    const { catalog } = await getMenu(params.slug);
    name = catalog.name;
    address = catalog.address.trim();
    logo = catalog.logoImage;
  } catch {}
  // Lo que ve el cliente cuando el dueño comparte el link (WhatsApp,
  // Facebook): el nombre, la dirección y el logo del restaurante.
  const title = `${name} · Menú y pedidos por WhatsApp`;
  const description = address
    ? `${address} · Elige del menú y manda tu pedido por WhatsApp.`
    : `Elige del menú de ${name} y manda tu pedido por WhatsApp.`;
  const images = logo ? [{ url: logo, alt: name }] : [];
  return {
    title,
    description,
    alternates: { canonical: `/pedir/${params.slug}` },
    robots: { index: false, follow: false },
    // Con logo, la pestaña del navegador muestra el del restaurante en lugar
    // del de Órale AI.
    ...(logo ? { icons: { icon: logo, apple: logo } } : {}),
    openGraph: {
      title,
      description,
      url: `/pedir/${params.slug}`,
      siteName: name,
      images,
    },
    twitter: { card: "summary", title, description, images },
  };
}
export default async function MenuPage({
  params,
}: {
  params: { slug: string };
}) {
  try {
    return (
      <Storefront initialMenu={await getMenu(params.slug)} slug={params.slug} />
    );
  } catch {
    return (
      <main className={styles.unavailable}>
        <h1>Menú no disponible</h1>
        <p>
          El negocio puede haber pausado su menú o hay un problema de conexión.
          Intenta de nuevo más tarde.
        </p>
        <a href={`/pedir/${encodeURIComponent(params.slug)}`}>
          Volver a intentar
        </a>
      </main>
    );
  }
}
