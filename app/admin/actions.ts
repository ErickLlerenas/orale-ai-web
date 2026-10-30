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

/// «Contestar» en Soporte sin revisar: la respuesta queda ligada al caso más
/// reciente y le llega a esa persona en el chat de la app (support-replies).
/// El aparato sale del caso en la base, nunca del formulario. Los casos que se
/// veían quedan revisados.
export async function replySupport(form: FormData) {
  const h = headers();
  if (!basicAdmin(h.get("authorization")) && !localAdmin(h.get("host"))) {
    throw new Error("Acceso restringido");
  }
  const body = String(form.get("reply") ?? "").trim();
  const requestId = String(form.get("requestId") ?? "");
  if (!body || body.length > 2000 || !UUID.test(requestId)) return;
  const db = adminClient();
  const { data: request, error: readError } = await db
    .from("support_requests")
    .select("id, install_id")
    .eq("id", requestId)
    .eq("kind", "escalation")
    .maybeSingle();
  if (readError || !request?.install_id) {
    throw new Error("No se encontró el caso.");
  }
  const { error } = await db.from("support_replies").insert({
    request_id: request.id,
    install_id: request.install_id,
    body,
  });
  if (error) throw new Error("No se pudo mandar la respuesta.");
  const ids = [...new Set(form.getAll("id").map(String))]
    .filter((id) => UUID.test(id))
    .slice(0, 100);
  if (ids.length) {
    await db
      .from("support_requests")
      .update({ reviewed: true })
      .eq("kind", "escalation")
      .eq("install_id", request.install_id)
      .in("id", ids);
  }
  revalidatePath("/admin");
}
