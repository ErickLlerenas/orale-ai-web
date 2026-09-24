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
export type Catalog = {
  acceptsDelivery?: boolean;
  version: number;
  utcOffsetMinutes: number;
  name: string;
  phone: string;
  address: string;
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
