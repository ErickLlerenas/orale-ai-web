import type { Report } from './ledger.mjs';
export function expensePesos(reports:Report[], rows:{category:string;amount:number;date:string;postedDate?:string;status?:string}[],month:string):Record<string,number|null>;
