export type Pending = { text:string };
export function monthPending(input:{bankMissing?:string[];hasNu?:boolean;appleFiles?:{name:string;periods:string[]}[];deposits?:string[];pesos?:string[];receipts?:string[];accountant?:boolean;unidentified?:number}):Pending[];
export function groupAppleFiles(items:{file:string;period:string}[]):{name:string;periods:string[]}[];
