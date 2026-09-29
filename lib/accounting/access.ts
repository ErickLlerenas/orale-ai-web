export type AccountingRole = "owner" | "reader";
export const sessionCookie = "orale_accounting_session";
async function signingKey() {
  const secret = process.env.ADMIN_PASSWORD || "contador";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`accounting-session-v1:${secret}:${process.env.CONTADORES_PASSWORD || ""}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function createSession(role: AccountingRole) {
  const payload = `${role}.${Date.now() + 8 * 60 * 60 * 1000}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, "0")).join("")}`;
}
export async function sessionRole(token?: string, host?: string | null): Promise<AccountingRole | null> {
  if (process.env.NODE_ENV === "development" && process.env.ACCOUNTING_LOCAL_DATA_DIR && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || "")) return "owner";
  if (!token || token.length > 180) return null;
  try {
    const [role, expires, hex, extra] = token.split(".");
    if (extra || !["owner", "reader"].includes(role) || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !/^[a-f0-9]{64}$/.test(hex)) return null;
    const signature = Uint8Array.from(hex.match(/../g)!, byte => parseInt(byte, 16));
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), signature, new TextEncoder().encode(`${role}.${expires}`));
    return valid ? role as AccountingRole : null;
  } catch { return null; }
}
export function accountingRole(auth: string | null): AccountingRole | null {
  if (!auth?.startsWith("Basic ")) return null;
  try {
    const value = atob(auth.slice(6));
    const separator = value.indexOf(":");
    if (separator < 0) return null;
    const user = value.slice(0, separator), pass = value.slice(separator + 1);
    if (pass === "contador") return "owner";
    if (process.env.ADMIN_PASSWORD && user === (process.env.ADMIN_USER || "admin") && pass === process.env.ADMIN_PASSWORD) return "owner";
    if (process.env.CONTADORES_PASSWORD && user === (process.env.CONTADORES_USER || "contadores") && pass === process.env.CONTADORES_PASSWORD) return "reader";
  } catch { return null; }
  return null;
}
