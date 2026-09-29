import { NextRequest, NextResponse } from "next/server";
import { accountingRole, createSession, sessionCookie } from "@/lib/accounting/access";
export const dynamic = "force-dynamic";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: NextRequest) {
  const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const origin = new URL(req.headers.get("origin") || "");
    if (origin.host !== req.headers.get("host") || (process.env.NODE_ENV === "production" && origin.protocol !== "https:")) return json({ error: "Solicitud no permitida." }, 403);
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "Solicitud inválida." }, 400);
    const body = JSON.parse(raw);
    if (body.action === "logout") {
      const response = json({ ok: true });
      response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/contadores", maxAge: 0 });
      return response;
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
    const attempt = attempts.get(ip) || { count: 0, until: Date.now() + 600000 };
    if (attempt.count >= 10 || attempts.size > 10000) return json({ error: "Demasiados intentos. Espera diez minutos." }, 429);
    if (typeof body.password !== "string") return json({ error: "Escribe la contraseña." }, 400);
    attempt.count++; attempts.set(ip, attempt);
    const role = accountingRole("Basic " + Buffer.from(`:${body.password}`).toString("base64"));
    if (!role) return json({ error: "Contraseña incorrecta." }, 401);
    const response = json({ ok: true });
    response.cookies.set(sessionCookie, await createSession(role), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/contadores", maxAge: 8 * 60 * 60 });
    attempts.delete(ip);
    return response;
  } catch { return json({ error: "No se pudo iniciar sesión." }, 400); }
}
