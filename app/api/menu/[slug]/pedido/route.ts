import { NextResponse } from "next/server";
import { loadMenu, MenuError } from "@/lib/online/server";
import { storeOrder } from "@/lib/online/orders";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  try {
    // The buyer still sends WhatsApp; only caja can retrieve this private draft.
    const reader = req.body?.getReader();
    if (!reader)
      return NextResponse.json({ error: "Pedido vacío." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 64000) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Pedido demasiado largo." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
    const menu = await loadMenu(params.slug);
    if (body?.revision !== menu.revision)
      return NextResponse.json(
        {
          error: "El menú cambió. Revisa los precios antes de continuar.",
          menu,
        },
        { status: 409 },
      );
    return NextResponse.json(
      await storeOrder(params.slug, menu, body.lines, body.checkout, body.requestKey,
        req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ?? "local"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof MenuError ? e.message : "No pudimos preparar el pedido. Revisa tus datos e intenta de nuevo.",
      },
      { status: e instanceof MenuError ? e.status : 400 },
    );
  }
}
