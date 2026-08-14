// Precios publicados. Una sola fuente para la página de precios y los términos:
// antes vivían escritos a mano en los dos lados y era fácil mover uno y olvidar
// el otro.
//
// Estos montos tienen que coincidir con App Store, Google Play y Stripe. El día
// del aumento se cambian aquí, se despliega, y se pone `promoEndsAt` en null.

/// Hasta cuándo duran los precios de abajo, para anunciarlos como promoción.
/// `null` = no hay aumento anunciado y no se muestra el aviso.
export const promoEndsAt = "31 de agosto de 2026";

/// Lo que costarán al terminar la promoción. Solo se usa en el aviso, para que
/// nadie se entere del precio nuevo hasta el día que ya lo tiene que pagar.
export const nextPrices = {
  base: { monthly: 149, yearly: 1199 },
  pro: { monthly: 299, yearly: 2399 },
};

export const prices = {
  base: { monthly: 99, yearly: 799 },
  pro: { monthly: 199, yearly: 1599 },
};

/// "$1,599", como se leen los precios en la app y en las tiendas.
export function mxn(amount: number): string {
  return `$${new Intl.NumberFormat("es-MX").format(amount)}`;
}
