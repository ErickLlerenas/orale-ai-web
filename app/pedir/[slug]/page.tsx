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
  try {
    name = (await getMenu(params.slug)).catalog.name;
  } catch {}
  const title = `${name} · Pide por WhatsApp`;
  const description = `Consulta el menú de ${name} y prepara tu pedido por WhatsApp.`;
  return {
    title,
    description,
    alternates: { canonical: `/pedir/${params.slug}` },
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `/pedir/${params.slug}`, images: [] },
    twitter: { card: "summary", title, description, images: [] },
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
