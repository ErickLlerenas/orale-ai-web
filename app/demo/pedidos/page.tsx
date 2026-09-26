import { notFound } from "next/navigation";
import Storefront from "@/components/online/Storefront";
import type { Menu } from "@/lib/online/types";

const menu: Menu = {
  revision: "local",
  updatedAt: "2026-09-25T00:00:00.000Z",
  catalog: {
    acceptsDelivery: true,
    version: 1,
    utcOffsetMinutes: -360,
    name: "Tacos de prueba",
    phone: "526641234567",
    address: "Vista local",
    categories: [
      { id: "tacos", name: "Tacos" },
      { id: "bebidas", name: "Bebidas" },
    ],
    products: [
      {
        id: "pastor",
        name: "Taco al pastor",
        description: "Con piña y cilantro.",
        categoryId: "tacos",
        available: true,
        variants: [{ id: "orden", name: "Orden", price: 2500 }],
        options: [
          {
            id: "salsa",
            name: "Salsa",
            required: true,
            multiple: false,
            choices: [
              { id: "verde", name: "Verde", price: 0 },
              { id: "roja", name: "Roja", price: 0 },
            ],
          },
        ],
      },
      {
        id: "victoria",
        name: "Cerveza Victoria",
        description: "Fría, de botella.",
        categoryId: "bebidas",
        available: true,
        stock: 6,
        variants: [{ id: "botella", name: "Botella", price: 3500 }],
        options: [],
      },
    ],
    promotions: [],
  },
};

export const metadata = {
  title: "Vista local del menú",
  robots: { index: false, follow: false },
};

export default function LocalMenuPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Storefront initialMenu={menu} slug="vista" preview />;
}
