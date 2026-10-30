// Quién puede usar /admin: el dueño con Basic Auth, o el panel local de
// dev:admin. Lo usan el middleware (las páginas) y las acciones del panel,
// que escriben en la base y no dependen solo del middleware.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/// dev:admin habilita esta marca y liga el servidor a 127.0.0.1.
/// NODE_ENV y la marca son del proceso: un Host o una URL no bastan.
export function localAdmin(...hosts: (string | null | undefined)[]): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ORALE_LOCAL_ADMIN === "1" &&
    !process.env.VERCEL &&
    hosts.length > 0 &&
    hosts.every((h) => LOCAL_HOST.test(h ?? ""))
  );
}

/// Basic Auth (un solo dueño). Credenciales por env.
export function basicAdmin(authorization: string | null | undefined): boolean {
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "";
  if (pass === "" || !authorization?.startsWith("Basic ")) return false;
  try {
    const [u, p] = atob(authorization.slice(6)).split(":");
    return u === user && p === pass;
  } catch {
    return false;
  }
}
