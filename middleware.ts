import { NextRequest, NextResponse } from "next/server";

// Protege /admin con Basic Auth (un solo dueño). Credenciales por env.
export function middleware(req: NextRequest) {
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

export const config = { matcher: ["/admin/:path*"] };
