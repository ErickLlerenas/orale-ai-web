import type { Report } from './ledger.mjs';
export type NuRow={id:string;date:string;time:string;description:string;amount:number;status:'posted'|'pending'|'cancelled';postedDate?:string;operationDate?:string;sourceIds:string[]};
export type NuSource={id:string;name:string;type:'png'|'pdf'};
export type NuReview={rows:NuRow[];sources:NuSource[];version:string};
export function validateNuReview(body:unknown):NuRow[];
export function nuCategory(row:NuRow):string;
export const nuLabels:Record<string,string>;
export function nuView(rows:NuRow[],month:string,reports?:Report[]):{rows:(NuRow&{category:string;matched:boolean})[];payments:number;charges:number;pending:number};
