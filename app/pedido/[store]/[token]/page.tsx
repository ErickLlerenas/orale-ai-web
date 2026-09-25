import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recibir pedido · Órale AI",
  description: "Abre este pedido desde la caja de tu negocio.",
  robots: {index: false, follow: false}, referrer: "no-referrer",
  alternates: {canonical: null},
  openGraph: {title: "Pedido para tu negocio", description: "Revisa y acepta el pedido en Órale AI."},
};
export default function OrderLink({params, searchParams}: {params: {store: string; token: string}; searchParams: {entorno?: string}}) {
  if (!/^[a-f0-9-]{36}$/.test(params.store) || !/^[a-f0-9]{64}$/.test(params.token)) notFound();
  const development = searchParams.entorno === "prueba";
  const link = `oraleai://pedido/${params.store}/${params.token}${development ? "?entorno=prueba" : ""}`;
  return <main className={styles.page}><section className={styles.card}>
    <span className={styles.icon} aria-hidden="true">↗</span>
    <p className={styles.eyebrow}>PARA LA CAJA{development ? " · PRUEBA" : ""}</p>
    <h1>Tu próximo pedido,<br/>listo para revisar.</h1>
    <p>Ábrelo en el equipo donde administras este negocio. Revisa los productos y acepta para crear la comanda.</p>
    <a className={styles.button} href={link}>Abrir en Órale AI</a>
    <p className={styles.hint}>Necesitas la versión más reciente de Órale AI. El pedido no se cobra ni se imprime al abrir el enlace.</p>
    <a className={styles.secondary} href="/">Conocer Órale AI</a>
  </section></main>;
}
