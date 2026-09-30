import { NextRequest, NextResponse } from "next/server";
import { sessionRole, sessionCookie } from "@/lib/accounting/access";
import { latest, storeVersion, emptyWorkspace } from "@/lib/accounting/store";
import { importBankDocument } from "@/lib/accounting/bank-import.mjs";
import { mergeBankDocuments, type BankDocument } from "@/lib/accounting/bank-ledger.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, {status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
const validMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
async function current(month:string) {
  const record=await latest(`bank-banamex/${month}`) as unknown as {key:string;bankDocuments?:BankDocument[]}|null;
  return {documents:record?.bankDocuments??[],version:record?.key??""};
}
export async function GET(req:NextRequest) {
  if(!await sessionRole(req.cookies.get(sessionCookie)?.value,req.headers.get("host")))return json({error:"Acceso restringido."},401);
  const month=req.nextUrl.searchParams.get("month")||"";
  if(!validMonth(month))return json({error:"Mes inválido."},400);
  try{return json(await current(month));}catch{return json({error:"No se pudieron abrir los archivos bancarios."},503);}
}
export async function POST(req:NextRequest) {
  if(await sessionRole(req.cookies.get(sessionCookie)?.value,req.headers.get("host"))!=="owner")return json({error:"Solo el administrador puede subir archivos."},403);
  try{
    const origin=new URL(req.headers.get("origin")||"");
    if(origin.host!==req.headers.get("host")||(process.env.NODE_ENV==="production"&&origin.protocol!=="https:")||!req.headers.get("content-type")?.startsWith("application/json"))return json({error:"Solicitud no permitida."},403);
  }catch{return json({error:"Solicitud no permitida."},403);}
  try{
    const raw=await req.text();if(raw.length>9_000_000)return json({error:"Los archivos superan el tamaño permitido."},413);
    const body=JSON.parse(raw);
    if(!validMonth(body.month||"")||!Array.isArray(body.files)||!body.files.length||body.files.length>3)return json({error:"Elige el mes y hasta tres archivos de Banamex."},400);
    const saved=await current(body.month);
    if(body.version!==saved.version)return json({error:"Hay información más reciente. Recarga antes de guardar."},409);
    const documents=[...saved.documents];
    for(const file of body.files){const doc=await importBankDocument(file,body.month);if(!documents.some(d=>d.id===doc.id))documents.push(doc);}
    if(documents.length>24)throw new Error("Demasiadas versiones para este mes.");
    const cards=new Set(documents.filter(d=>d.cardLast4).map(d=>d.cardLast4));
    if(cards.size>1)throw new Error("Los PDF corresponden a tarjetas distintas. Revisa los archivos.");
    const view=mergeBankDocuments(documents,body.month);
    if(view.gap)throw new Error("Los archivos dejan diferencias en la secuencia de saldos. No se guardaron; revisa que sean de la misma cuenta y que no falten movimientos.");
    if(Buffer.byteLength(JSON.stringify(documents))>8_000_000)throw new Error("El conjunto de archivos es demasiado grande.");
    const version=await storeVersion(`bank-banamex/${body.month}`,{state:emptyWorkspace(),bankDocuments:documents});
    return json({documents,version});
  }catch(error){return json({error:error instanceof Error?error.message:"No se pudieron cargar los archivos."},400);}
}
