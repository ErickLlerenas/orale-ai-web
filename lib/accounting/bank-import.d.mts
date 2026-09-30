import type { BankDocument } from './bank-ledger.mjs';
export function bankPdfText(bytes:Buffer):Promise<string>;
export function importBankDocument(file:{name:string;data:string},month:string):Promise<BankDocument>;
