export type BankReceipt = { id:string; name:string; type:'pdf'|'xml'; category:string; rowId:string };
export const receiptCategories: Record<string,string>;
export function validateReceiptFile(file:unknown,hash:(bytes:Buffer)=>string):{id:string;name:string;type:'pdf'|'xml';data:string};
export function assignReceipt(receipts:BankReceipt[],rows:{id:string;category:string;amount:number;date:string}[],receipt:Omit<BankReceipt,'rowId'>):BankReceipt[];
