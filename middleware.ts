import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { siteUrl } from "@/lib/seo";
import { basicAdmin, localAdmin } from "@/lib/admin-auth";

// Dominio original. Sus links (menús, pedidos por WhatsApp, QR impresos) deben
// seguir funcionando para siempre: se redirigen con la misma ruta al dominio
// de NEXT_PUBLIC_SITE_URL. Mientras esa variable siga apuntando aquí, no hace nada.
const legacyHost = "oraleai.vercel.app";
const canonical = new URL(siteUrl);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // /api se queda en el host que la llamó: un menú viejo abierto en el
  // navegador puede enviar su pedido sin perderlo en una redirección.
  if (req.headers.get("host") === legacyHost && canonical.host !== legacyHost && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL(pathname + search, canonical), 308);
  }
  if (pathname.startsWith("/contadores")) {
    const publicRoute = ["/contadores/login", "/contadores/session"].includes(req.nextUrl.pathname);
    if (!publicRoute && !await sessionRole(req.cookies.get(sessionCookie)?.value, req.headers.get("host"))) {
      if (req.nextUrl.pathname.startsWith("/contadores/api")) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401, headers: { "Cache-Control": "no-store" } });
      const url = req.nextUrl.clone();
      url.pathname = "/contadores/login";
      url.search = "";
      url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  }
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  // La excepción local es solo para las páginas; no abre posibles APIs admin
  // (ver lib/admin-auth.ts).
  const localPage = pathname === "/admin" || pathname === "/admin/";
  if (localPage && localAdmin(req.headers.get("host"), req.nextUrl.host)) {
    return NextResponse.next();
  }
  if (basicAdmin(req.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Orale AI Admin"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
