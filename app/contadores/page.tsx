import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import AccountingPortal from "@/components/accounting/AccountingPortal";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cierre mensual | Órale AI", robots: { index: false, follow: false }, alternates: { canonical: "/contadores" }, description: "Revisión privada de pagos y documentos contables." };
export default async function Page() {
  const role = await sessionRole(cookies().get(sessionCookie)?.value, headers().get("host"));
  if (!role) redirect("/contadores/login");
  return <AccountingPortal role={role} local={process.env.NODE_ENV === "development" && Boolean(process.env.ACCOUNTING_LOCAL_DATA_DIR)} />;
}
