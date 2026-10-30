"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase";
import { basicAdmin, localAdmin } from "@/lib/admin-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// «Revisado» en Soporte sin revisar: marca solo los casos que se veían en la
/// tarjeta, así uno que llegue mientras tanto sigue pendiente. Escribe en la
/// base, así que no depende solo del middleware: revisa el acceso otra vez.
export async function markSupportReviewed(form: FormData) {
  const h = headers();
  if (!basicAdmin(h.get("authorization")) && !localAdmin(h.get("host"))) {
    throw new Error("Acceso restringido");
  }
  const ids = [...new Set(form.getAll("id").map(String))]
    .filter((id) => UUID.test(id))
    .slice(0, 100);
  if (!ids.length) return;
  const { error } = await adminClient()
    .from("support_requests")
    .update({ reviewed: true })
    .eq("kind", "escalation")
    .in("id", ids);
  if (error) throw new Error("No se pudo marcar como revisado.");
  revalidatePath("/admin");
}
