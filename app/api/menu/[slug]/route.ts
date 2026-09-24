import { NextResponse } from "next/server";
import { loadMenu, MenuError } from "@/lib/online/server";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: { slug: string } },
) {
  try {
    return NextResponse.json(await loadMenu(params.slug), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Menú no disponible." },
      { status: e instanceof MenuError ? e.status : 503 },
    );
  }
}
