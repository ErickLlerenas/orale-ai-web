"use client";

import { useEffect } from "react";
import StoreBadges from "@/components/StoreBadges";
import { stores } from "@/lib/seo";

export default function MobileDownload() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const destination = /Android/i.test(ua) ? stores.google : isIOS ? stores.apple : null;
    if (destination) window.location.replace(destination);
  }, []);

  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "32px 20px", background: "#fff8f3" }}>
      <section style={{ maxWidth: 560, textAlign: "center" }}>
        <a href="/" style={{ color: "#ff642d", fontSize: 40, fontWeight: 800, textDecoration: "none" }}>Órale AI</a>
        <h1>Tu punto de venta, en tu dispositivo.</h1>
        <p>En iPhone, iPad o Android abrimos tu tienda automáticamente. Si no se abre, elige aquí:</p>
        <StoreBadges />
        <noscript><p>Elige tu tienda para descargar la app.</p></noscript>
      </section>
    </main>
  );
}
