import { NextResponse } from "next/server";
import { loadMenuTranslations } from "@/lib/online/server";
export const dynamic = "force-dynamic";
// La primera traducción de un menú la hace la IA y puede tardar unos segundos.
export const maxDuration = 20;
/** Los textos del menú en inglés, para quien eligió EN en /pedir/[slug]. */
export async function GET(
  _: Request,
  { params }: { params: { slug: string } },
) {
  return NextResponse.json(await loadMenuTranslations(params.slug), {
    headers: { "Cache-Control": "no-store" },
  });
}
