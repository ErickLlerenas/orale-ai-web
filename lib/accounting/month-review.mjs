// What is still missing from a month, in plain words.
const list=items=>items.length<2?items.join(''):`${items.slice(0,-1).join(', ')} y ${items.at(-1)}`;
export function monthPending({bankMissing=[],hasNu=true,appleFiles=[],deposits=[],pesos=[],receipts=[],accountant=false,unidentified=0}){
  const pending=[];
  if(bankMissing.length)pending.push({text:`Banamex: ${list(bankMissing)}`});
  if(!hasNu)pending.push({text:'Movimientos de Nu'});
  if(deposits.length)pending.push({text:`Confirmar con el banco: ${list(deposits)}`});
  if(unidentified>0)pending.push({text:unidentified===1?'1 movimiento de Banamex sin identificar':`${unidentified} movimientos de Banamex sin identificar`});
  if(pesos.length)pending.push({text:`Cargo en pesos de ${list(pesos)}`});
  if(receipts.length)pending.push({text:`${receipts.length===1?'Comprobante':'Comprobantes'} de ${list(receipts)}`});
  if(accountant)pending.push({text:'Comprobante de honorarios'});
  for(const {name,periods} of appleFiles)pending.push({text:`${name.charAt(0).toUpperCase()}${name.slice(1)} de Apple (${list(periods)})`});
  return pending;
}
export function groupAppleFiles(items){
  const groups=new Map();
  for(const {file,period} of items){const name=file.split(' (')[0];groups.set(name,[...(groups.get(name)||[]),period]);}
  return [...groups].map(([name,periods])=>({name,periods:[...new Set(periods)]}));
}
