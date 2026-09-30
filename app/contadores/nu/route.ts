import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { sessionRole, sessionCookie } from '@/lib/accounting/access';
import { latest, storeVersion, emptyWorkspace } from '@/lib/accounting/store';
import { validateNuReview, type NuReview } from '@/lib/accounting/nu-ledger.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const validMonth=(m:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
async function current(month:string){const record=await latest(`bank-nu/${month}`) as unknown as (NuReview&{key:string})|null;return {rows:record?.rows||[],sources:record?.sources||[],version:record?.key||''};}
export async function GET(req:NextRequest){
 if(!await sessionRole(req.cookies.get(sessionCookie)?.value,req.headers.get('host')))return json({error:'Acceso restringido.'},401);
 const month=req.nextUrl.searchParams.get('month')||'';if(!validMonth(month))return json({error:'Mes inválido.'},400);
 try{
  const saved=await current(month),source=req.nextUrl.searchParams.get('source');
  if(!source)return json(saved);
  const meta=saved.sources.find(s=>s.id===source);if(!meta)return json({error:'Archivo no encontrado.'},404);
  const record=await latest(`bank-nu-sources/${month}/${source}`) as unknown as {file:string}|null;
  if(!record)return json({error:'Archivo no encontrado.'},404);
  return new NextResponse(Buffer.from(record.file,'base64'),{headers:{...headers,'Content-Type':meta.type==='png'?'image/png':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`}});
 }catch{return json({error:'No se pudieron abrir los movimientos de Nu.'},503);}
}
export async function POST(req:NextRequest){
 if(await sessionRole(req.cookies.get(sessionCookie)?.value,req.headers.get('host'))!=='owner')return json({error:'Solo el administrador puede guardar.'},403);
 try{const origin=new URL(req.headers.get('origin')||'');if(origin.host!==req.headers.get('host')||(process.env.NODE_ENV==='production'&&origin.protocol!=='https:')||!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Solicitud no permitida.'},403);}catch{return json({error:'Solicitud no permitida.'},403);}
 try{
  const raw=await req.text();if(raw.length>15_000_000)return json({error:'Las capturas superan el tamaño permitido.'},413);
  const body=JSON.parse(raw),rows=validateNuReview(body),saved=await current(body.month);
  if(body.version!==saved.version)return json({error:'Hay información más reciente. Recarga antes de guardar.'},409);
  // Validate every source before writing the reviewed snapshot.
  const sources=body.sources.map((s:{id:string;name:string;type:string;file:string})=>{
   if(!/^[a-f0-9]{64}$/.test(s.id)||typeof s.name!=='string'||!s.name.length||s.name.length>180||!['png','pdf'].includes(s.type)||typeof s.file!=='string'||!/^[A-Za-z0-9+/=]+$/.test(s.file))throw Error('Archivo original inválido.');
   const bytes=Buffer.from(s.file,'base64');if(!bytes.length||bytes.length>2_000_000||createHash('sha256').update(bytes).digest('hex')!==s.id||(s.type==='png'?!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):bytes.subarray(0,5).toString()!=='%PDF-'))throw Error('Archivo original inválido.');
   return s;
  });
  for(const source of sources)if(!await latest(`bank-nu-sources/${body.month}/${source.id}`))await storeVersion(`bank-nu-sources/${body.month}/${source.id}`,{file:source.file});
  const metadata=sources.map((s:{id:string;name:string;type:'png'|'pdf'})=>({id:s.id,name:s.name,type:s.type}));
  const version=await storeVersion(`bank-nu/${body.month}`,{state:emptyWorkspace(),month:body.month,rows,sources:metadata});
  return json({rows,sources:metadata,version});
 }catch(e){return json({error:e instanceof Error?e.message:'No se pudo guardar Nu.'},400);}
}
