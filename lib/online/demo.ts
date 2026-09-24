import type { Menu, Product } from "./types";

// Public, fictional catalogue. This route never loads or publishes a real menu.
const salsa: Product["options"][number] = {
  id: "salsa",
  name: "Elige tu salsa",
  required: true,
  multiple: false,
  choices: [
    { id: "verde", name: "Verde", price: 0 },
    { id: "roja", name: "Roja", price: 0 },
    { id: "sin-salsa", name: "Sin salsa", price: 0 },
  ],
};
const extras: Product["options"][number] = {
  id: "extras",
  name: "Extras",
  required: false,
  multiple: true,
  choices: [
    { id: "queso", name: "Queso", price: 1200 },
    { id: "aguacate", name: "Aguacate", price: 1500 },
  ],
};
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=80`;

export const demoMenu: Menu = {
  revision: "demo-v1",
  updatedAt: "2026-09-24T12:00:00Z",
  catalog: {
    acceptsDelivery: true,
    version: 1,
    utcOffsetMinutes: -360,
    name: "Taquería La Esquina",
    phone: "",
    address: "Centro · Ciudad de México",
    categories: [
      { id: "tacos", name: "Tacos" },
      { id: "especialidades", name: "Especialidades" },
      { id: "bebidas", name: "Bebidas" },
      { id: "postres", name: "Postres" },
    ],
    products: [
      {
        id: "asada",
        name: "Tacos de asada",
        description:
          "Carne a la plancha, cebolla, cilantro y limón. Recién hechos en tortilla de maíz.",
        categoryId: "tacos",
        available: true,
        image: photo("photo-1552332386-f8dd00dc2f85"),
        variants: [
          { id: "asada-1", name: "1 taco", price: 3500 },
          { id: "asada-3", name: "Orden de 3", price: 9500 },
        ],
        options: [salsa, extras],
      },
      {
        id: "pastor",
        name: "Tacos al pastor",
        description:
          "Pastor marinado, cebolla y cilantro. El clásico de la casa.",
        categoryId: "tacos",
        available: true,
        image: photo("photo-1648437595587-e6a8b0cdf1f9"),
        variants: [
          { id: "pastor-1", name: "1 taco", price: 3000 },
          { id: "pastor-3", name: "Orden de 3", price: 8000 },
        ],
        options: [salsa, extras],
      },
      {
        id: "vegetariano",
        name: "Tacos vegetarianos",
        description:
          "Frijoles, col fresca, jitomate y cilantro. Orden de dos con limón.",
        categoryId: "tacos",
        available: true,
        image: photo("photo-1574781998292-d71edace54fa"),
        variants: [{ id: "vegetariano-2", name: "Orden de 2", price: 6500 }],
        options: [salsa, extras],
      },
      {
        id: "gringa",
        name: "Gringa al pastor",
        description:
          "Tortilla de harina doradita, pastor y queso fundido. Acompañada de salsa y limón.",
        categoryId: "especialidades",
        available: true,
        variants: [{ id: "gringa-1", name: "Individual", price: 7500 }],
        options: [salsa, extras],
      },
      {
        id: "agua",
        name: "Agua fresca",
        description:
          "Horchata o jamaica, preparada en casa. Elige tu sabor y tamaño.",
        categoryId: "bebidas",
        available: true,
        variants: [
          { id: "agua-mediana", name: "500 ml", price: 3000 },
          { id: "agua-grande", name: "1 litro", price: 4500 },
        ],
        options: [
          {
            id: "sabor",
            name: "Sabor",
            required: true,
            multiple: false,
            choices: [
              { id: "horchata", name: "Horchata", price: 0 },
              { id: "jamaica", name: "Jamaica", price: 0 },
            ],
          },
        ],
      },
      {
        id: "flan",
        name: "Flan de la casa",
        description: "Flan de vainilla con caramelo. Por hoy se nos terminó.",
        categoryId: "postres",
        available: false,
        stock: 0,
        variants: [{ id: "flan-1", name: "Rebanada", price: 4500 }],
        options: [],
      },
    ],
    promotions: [],
  },
};
