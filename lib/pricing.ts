// Precios publicados. Una sola fuente para la página de precios y los términos:
// antes vivían escritos a mano en los dos lados y era fácil mover uno y olvidar
// el otro.
//
// El cambio del día del aumento ocurre solo: las páginas preguntan por
// `pricingNow()` y ella decide según la fecha. Es a propósito, porque las dos
// formas de fallar no cuestan lo mismo. Si esto fuera manual y se nos pasara la
// fecha, el sitio anunciaría un precio más bajo del que cobran las tiendas
// —publicidad engañosa, y por tiempo indefinido—. Automático, lo peor que pasa
// es que unas horas del día del cambio anunciemos de más mientras Google
// termina de propagar, que no le hace daño a nadie.
//
// Las páginas necesitan `export const revalidate` para que Next regenere el
// HTML estático; sin eso se quedarían congeladas en lo que se generó al hacer
// deploy y nada de esto serviría.

/// Cuándo suben los precios. Es la misma fecha que el secret
/// `PRICE_INCREASE_AT` de la app (medianoche del centro de México), para que la
/// web y el aviso dentro de la app cuenten exactamente lo mismo.
///
/// `null` = no hay aumento anunciado: se muestran los precios de `raised` sin
/// tachados ni aviso.
export const priceIncreaseAt: Date | null = new Date("2026-09-01T06:00:00Z");

export type PlanAmounts = { monthly: number; yearly: number };
export type PlanSet = { base: PlanAmounts; pro: PlanAmounts };

/// Precios de lanzamiento, vigentes hasta `priceIncreaseAt`.
const launch: PlanSet = {
  base: { monthly: 99, yearly: 799 },
  pro: { monthly: 199, yearly: 1599 },
};

/// Los que entran ese día.
const raised: PlanSet = {
  base: { monthly: 149, yearly: 1199 },
  pro: { monthly: 249, yearly: 1999 },
};

export type Pricing = {
  /// Lo que se cobra hoy.
  prices: PlanSet;
  /// Lo que viene, para el tachado. `null` si el aumento ya ocurrió.
  next: PlanSet | null;
  /// Último día con precio de lanzamiento ("31 de agosto de 2026"), o `null`.
  promoEndsLabel: string | null;
  /// El día en que suben ("1 de septiembre de 2026"), o `null`.
  increaseOnLabel: string | null;
};

/// Qué enseñar en este momento. [now] se inyecta en las pruebas.
export function pricingNow(now: Date = new Date()): Pricing {
  const promoActive = priceIncreaseAt != null && now < priceIncreaseAt;
  if (!promoActive) {
    return {
      prices: raised,
      next: null,
      promoEndsLabel: null,
      increaseOnLabel: null,
    };
  }
  return {
    prices: launch,
    next: raised,
    promoEndsLabel: lastDayLabel(priceIncreaseAt!),
    increaseOnLabel: dayLabel(priceIncreaseAt!),
  };
}

function dayLabel(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(value);
}

/// El día antes del aumento, que es el último con precio de lanzamiento.
/// Se calcula para que la fecha del texto no pueda contradecir a la lógica.
function lastDayLabel(increaseAt: Date): string {
  return dayLabel(new Date(increaseAt.getTime() - 24 * 60 * 60 * 1000));
}

/// "$1,599", como se leen los precios en la app y en las tiendas.
export function mxn(amount: number): string {
  return `$${new Intl.NumberFormat("es-MX").format(amount)}`;
}

/// Cuánto se ahorra hoy contra el precio que viene, en porcentaje entero.
///
/// Se calcula, no se escribe a mano: un número inflado en el tachado es
/// publicidad engañosa, y si algún día se mueve un precio sin mover el otro,
/// esto se mantiene solo. Se trunca en vez de redondear porque anunciar menos
/// descuento del real no le hace daño a nadie; al revés sí.
export function discountPct(now: number, later: number): number {
  return Math.floor((1 - now / later) * 100);
}
