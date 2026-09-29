import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";

// Protege /admin con Basic Auth (un solo dueño). Credenciales por env.
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/contadores")) {
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
  const auth = req.headers.get("authorization");
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "";

  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (pass !== "" && u === user && p === pass) {
        return NextResponse.next();
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

export const config = { matcher: ["/admin/:path*", "/contadores/:path*"] };
