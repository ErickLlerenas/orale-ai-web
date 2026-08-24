/// Marca y URLs para metadatos. Una sola fuente: título, sitemap y JSON-LD.
///
/// La gente busca "orale ai" sin acento. El título visible de la marca sigue
/// siendo Órale; el nombre sin acento va en title/alternateName para que
/// Google no te mezcle solo con Oracle AI.

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://oraleai.vercel.app";

export const brandName = "Órale AI";
export const brandNamePlain = "Orale AI";

export const siteTitle = "Orale AI · Punto de venta para taquerías en México";
export const siteDescription =
  "Orale AI (Órale AI) es el punto de venta con IA para taquerías, fondas y food trucks en México. Arma el menú con una foto. App Store, Google Play y Windows.";

export const stores = {
  apple: "https://apps.apple.com/app/id6776390828",
  appleId: "6776390828",
  google: "https://play.google.com/store/apps/details?id=com.oraleai.orale_ai",
  microsoft:
    "https://apps.microsoft.com/detail/9mwh3bdnf0xt?hl=es-MX&gl=MX",
} as const;

export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: brandName,
        alternateName: [brandNamePlain, "OraleAI", "orale ai"],
        url: siteUrl,
        logo: `${siteUrl}/og-icon.png`,
        areaServed: "MX",
      },
      {
        "@type": "SoftwareApplication",
        name: brandName,
        alternateName: [brandNamePlain, "OraleAI"],
        applicationCategory: "BusinessApplication",
        operatingSystem: "iOS, Android, Windows, macOS",
        url: siteUrl,
        description: siteDescription,
        offers: {
          "@type": "Offer",
          priceCurrency: "MXN",
          availability: "https://schema.org/InStock",
        },
        downloadUrl: [stores.apple, stores.google, stores.microsoft],
      },
    ],
  };
}
