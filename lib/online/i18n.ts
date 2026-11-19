import { CartError, type Lang } from "./cart";

export type { Lang };

/** Dónde recuerda el celular el idioma que eligió el comensal. */
export const langStorageKey = "orale.menu.lang";

/**
 * Los textos fijos del menú en línea en inglés, por su texto en español.
 *
 * La página se escribe en español y aquí va su par: lo que falte sale en
 * español, nunca en blanco. Los textos del dueño (platillos, categorías,
 * extras) no van aquí: esos los traduce el servidor.
 */
const en: Record<string, string> = {
  // Encabezado
  Idioma: "Language",
  "Traduciendo el menú…": "Translating the menu…",
  "Envío a domicilio": "Delivery available",
  "Solo para recoger": "Pickup only",
  "Abierto todo el día": "Open all day",
  "Abierto · Cierra a {time}": "Open · Closes at {time}",
  "Cerrado · {opens}": "Closed · {opens}",
  Categorías: "Categories",
  "El negocio está preparando su menú. Vuelve pronto.":
    "This restaurant is setting up its menu. Come back soon.",
  // Platillos
  "Elegir {name}": "Choose {name}",
  "Desde {price}": "From {price}",
  Agotado: "Sold out",
  "Precio individual": "Price each",
  "Consulta los días y horario": "Check days and hours",
  "Disponible ahora": "Available now",
  "Fuera de días u horario de promoción": "Outside promotion days or hours",
  // Detalle del platillo
  Cerrar: "Close",
  Disminuir: "Decrease",
  Aumentar: "Increase",
  Presentación: "Size",
  Obligatorio: "Required",
  Opcional: "Optional",
  "Puedes elegir varios": "You can choose several",
  "Sin {name}": "No {name}",
  "Sin costo": "Free",
  "Notas para este producto": "Notes for this item",
  "Por ejemplo, sin cebolla": "For example, no onion",
  "Cantidad de {name}": "Quantity of {name}",
  "Elige una opción de {name}": "Choose an option for {name}",
  "Agregar · {price}": "Add · {price}",
  // Carrito
  "{count} producto · Ver carrito": "{count} item · View cart",
  "{count} productos · Ver carrito": "{count} items · View cart",
  Revisar: "Review",
  "Tu pedido": "Your order",
  "Tu carrito está vacío.": "Your cart is empty.",
  "Producto no disponible": "Item unavailable",
  producto: "item",
  Quitar: "Remove",
  Productos: "Items",
  "Total de productos": "Items total",
  "El negocio te confirmará el costo de envío.":
    "The restaurant will confirm the delivery fee.",
  "Tu nombre": "Your name",
  "¿Cómo quieres tu pedido?": "How do you want your order?",
  "Pedido para recoger": "Pickup order",
  "Pasar a recoger": "Pickup",
  "A domicilio": "Delivery",
  "Dirección y referencias": "Address and directions",
  "Tu WhatsApp": "Your WhatsApp",
  "10 dígitos": "10 digits",
  "Va en tu pedido para que el negocio te contacte si hace falta.":
    "It goes with your order so the restaurant can reach you if needed.",
  "Tu pedido se envía cuando presionas “Enviar” en WhatsApp. Espera la confirmación del negocio.":
    "Your order is sent when you tap “Send” in WhatsApp. The message is in Spanish so the restaurant can read it. Wait for their confirmation.",
  "El negocio está cerrado. {opens}": "The restaurant is closed. {opens}",
  "El negocio está cerrado.": "The restaurant is closed.",
  "Abrir WhatsApp y enviar pedido": "Open WhatsApp and send order",
  "Revisando disponibilidad…": "Checking availability…",
  "Continuar a WhatsApp": "Continue to WhatsApp",
  // Pie
  "Menú creado con": "Menu made with",
  "El negocio confirma disponibilidad, pago y tiempo de entrega por WhatsApp.":
    "The restaurant confirms availability, payment and delivery time on WhatsApp.",
  // Avisos del carrito (lib/online/cart.ts)
  "Revisa tu carrito.": "Check your cart.",
  "Agrega al menos un producto (máximo 50 renglones).":
    "Add at least one item (50 lines at most).",
  "Revisa las cantidades y notas del pedido.":
    "Check the quantities and notes in your order.",
  "Un producto ya no está disponible. Revisa tu carrito.":
    "An item is no longer available. Check your cart.",
  "Solo quedan {n} de {product}.": "Only {n} left of {product}.",
  "Revisa la presentación de {product}.": "Check the size of {product}.",
  "Revisa los extras del pedido.": "Check the extras in your order.",
  "Un extra de {product} ya no está disponible.":
    "An extra for {product} is no longer available.",
  "Revisa {option} de {product}.": "Check {option} for {product}.",
  "Completa tu nombre y los datos de entrega.":
    "Fill in your name and delivery details.",
  "Este negocio solo acepta pedidos para recoger.":
    "This restaurant only takes pickup orders.",
  "Escribe tu WhatsApp a 10 dígitos.": "Enter your 10-digit WhatsApp number.",
  "Tu pedido es muy largo. Reduce las notas o divídelo en dos mensajes.":
    "Your order is too long. Shorten the notes or split it into two messages.",
  // Avisos del servidor al preparar el pedido
  "No pudimos preparar el pedido. Intenta de nuevo.":
    "We couldn't prepare your order. Try again.",
  "No pudimos preparar el pedido. Revisa tus datos e intenta de nuevo.":
    "We couldn't prepare your order. Check your details and try again.",
  "No pudimos preparar el pedido. Intenta más tarde.":
    "We couldn't prepare your order. Try again later.",
  "No pudimos preparar el pedido.": "We couldn't prepare your order.",
  "No pudimos guardar el pedido. Intenta de nuevo.":
    "We couldn't save your order. Try again.",
  "El negocio ahora solo acepta pedidos para recoger. Revisa tu pedido antes de continuar.":
    "The restaurant now only takes pickup orders. Review your order before continuing.",
  "El menú cambió. Revisa los precios antes de continuar.":
    "The menu changed. Check the prices before continuing.",
  "El menú cambió. Actualiza la página antes de continuar.":
    "The menu changed. Refresh the page before continuing.",
  "El menú ya no está disponible.": "This menu is no longer available.",
  "El pedido cambió. Actualiza la página antes de enviarlo.":
    "The order changed. Refresh the page before sending it.",
  "El pedido venció. Actualiza la página para preparar uno nuevo.":
    "The order expired. Refresh the page to prepare a new one.",
  "Actualiza la página y vuelve a enviar tu pedido.":
    "Refresh the page and send your order again.",
  "Demasiados intentos. Intenta más tarde.":
    "Too many attempts. Try again later.",
  "Pedido vacío.": "Empty order.",
  "Pedido demasiado largo.": "The order is too long.",
  "Pedido inválido.": "Invalid order.",
  "Menú no disponible.": "Menu unavailable.",
  "No pudimos cargar el menú. Intenta más tarde.":
    "We couldn't load the menu. Try again later.",
};

const own = (map: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(map, key);

const fill = (template: string, vars?: Record<string, string | number>) =>
  vars
    ? template.replace(/\{(\w+)\}/g, (m, k: string) =>
        own(vars, k) ? String(vars[k]) : m,
      )
    : template;

/** Un texto fijo de la página en el idioma del comensal. */
export function ui(
  lang: Lang,
  es: string,
  vars?: Record<string, string | number>,
): string {
  return fill(lang === "en" && own(en, es) ? en[es] : es, vars);
}

/** Si el texto fijo ya tiene par en inglés (para las pruebas). */
export const hasEnglish = (es: string) => own(en, es);

/**
 * El texto del dueño en el idioma del comensal: su traducción guardada o, si
 * todavía no hay, el original. Nunca regresa otra cosa que un texto.
 */
export function translated(
  lang: Lang,
  translations: Record<string, unknown>,
  text: string,
): string {
  if (lang !== "en") return text;
  const key = text.trim();
  const value = own(translations, key) ? translations[key] : undefined;
  return typeof value === "string" && value.trim() ? value : text;
}

/**
 * Un aviso (del carrito o del servidor) en el idioma del comensal. [tr]
 * traduce los nombres del dueño que el aviso menciona.
 */
export function errorText(
  lang: Lang,
  error: unknown,
  tr: (text: string) => string,
  fallback = "No pudimos preparar el pedido. Intenta de nuevo.",
): string {
  if (error instanceof CartError) {
    if (lang !== "en") return error.message;
    const vars = Object.fromEntries(
      Object.entries(error.vars).map(([k, v]) => [
        k,
        typeof v === "string" ? tr(v) : v,
      ]),
    );
    return ui(lang, error.template, vars);
  }
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : fallback;
  if (lang !== "en") return message;
  // «El negocio está cerrado. Abre hoy a las 9:00 a.m.»: la hora la arma el
  // servidor en español; en inglés se queda el aviso sin ella (el encabezado
  // ya dice a qué hora abre).
  if (message.startsWith("El negocio está cerrado.")) {
    return ui(lang, "El negocio está cerrado.");
  }
  return ui(lang, message);
}
