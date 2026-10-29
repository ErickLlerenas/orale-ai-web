import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { siteUrl } from "@/lib/seo";

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
  const adminResponse = () => {
    // /admin/new ya es /admin: los enlaces guardados siguen llegando.
    if (["/admin2", "/admin2/", "/admin/new", "/admin/new/"].includes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  };
  // dev:admin habilita esta marca y liga el servidor a 127.0.0.1.
  // NODE_ENV y la marca son del proceso: un Host o una URL no bastan.
  // La excepción es solo para las páginas; no abre posibles APIs admin.
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
  const localPage = ["/admin", "/admin/", "/admin2", "/admin2/", "/admin/new", "/admin/new/"].includes(pathname);
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ORALE_LOCAL_ADMIN === "1" &&
    !process.env.VERCEL &&
    localPage &&
    localHost.test(req.headers.get("host") ?? "") &&
    localHost.test(req.nextUrl.host)
  ) {
    return adminResponse();
  }
  // Protege /admin con Basic Auth (un solo dueño). Credenciales por env.
  const auth = req.headers.get("authorization");
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "";

  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (pass !== "" && u === user && p === pass) {
        // Los enlaces guardados al panel anterior llevan al único panel.
        return adminResponse();
      }
    } catch {
      // cae al 401
    }
  }

  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Orale AI Admin"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
