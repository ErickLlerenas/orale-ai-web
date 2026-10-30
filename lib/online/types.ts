export type Choice = { id: string; name: string; price: number };
export type Product = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  available: boolean;
  stock?: number;
  image?: string;
  variants: Choice[];
  options: {
    id: string;
    name: string;
    required: boolean;
    multiple: boolean;
    choices: Choice[];
  }[];
};
/** Un día del horario: minutos en la hora del negocio. [to] < [from] cierra
 * al día siguiente; iguales, abierto todo el día. */
export type HoursDay = { open: false } | { open: true; from: number; to: number };
export type Catalog = {
  acceptsDelivery?: boolean;
  /** Lunes a domingo. Sin horario, siempre abierto (como antes). */
  hours?: HoursDay[];
  version: number;
  utcOffsetMinutes: number;
  name: string;
  phone: string;
  address: string;
  /** Logo del negocio (online-menu-photos), si la caja lo mandó. */
  logoImage?: string;
  categories: { id: string; name: string }[];
  products: Product[];
  promotions: {
    id: string;
    name: string;
    daysMask: number;
    buy: number;
    pay: number;
    productIds: string[];
    choiceIds: string[];
    fixedPriceCents?: number;
    requireEachProduct?: boolean;
    startsAtMinute?: number;
    endsAtMinute?: number;
  }[];
};
export type Menu = { catalog: Catalog; revision: string; updatedAt: string };
export type CartLine = {
  productId: string;
  variantId: string;
  choiceIds: string[];
  quantity: number;
  notes: string;
};
export type Checkout = {
  name: string;
  fulfillment: "pickup" | "delivery";
  address: string;
};
