"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OnlineStoreVisual.module.css";

const durations = [1000, 750, 1500, 900, 1300, 2300];
const captions = [
  "Tu cliente elige lo que se le antoja.",
  "Su pedido, con cantidades y total claros.",
  "Lo envía por WhatsApp. Tú lo confirmas.",
];

/** Illustrative only: no checkout, messages or real orders are triggered. */
export default function OnlineStoreVisual() {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReducedMotion(motion.matches);
      if (motion.matches) setPhase(5);
    };
    const updateVisibility = () => setForeground(!document.hidden);
    updateMotion();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || !visible || !foreground || reducedMotion) return;
    const timer = window.setTimeout(
      () => setPhase((value) => (value + 1) % durations.length),
      durations[phase],
    );
    return () => window.clearTimeout(timer);
  }, [phase, paused, visible, foreground, reducedMotion]);

  const quantity = phase === 0 ? 0 : phase === 1 ? 1 : 2;
  const step = phase < 2 ? 0 : phase < 3 ? 1 : 2;
  const chatOpen = phase >= 3;
  const transferred = phase >= 4;
  const sent = phase === 5;
  const selectStep = (index: number) => {
    setPhase([1, 2, 5][index]);
    setPaused(true);
  };

  return (
    <div className={styles.root} ref={root} data-phase={phase}>
      <div className={styles.controls}>
        <div className={styles.steps} role="group" aria-label="Pasos del menú en línea">
          {["Menú", "Pedido", "WhatsApp"].map((label, index) => (
            <button key={label} type="button" aria-pressed={step === index}
              onClick={() => selectStep(index)}>
              <span aria-hidden="true">0{index + 1}</span> {label}
            </button>
          ))}
        </div>
        {!reducedMotion && (
          <button type="button" className={styles.pause}
            aria-label={paused ? "Reproducir animación del menú" : "Pausar animación del menú"}
            onClick={() => setPaused((value) => !value)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {paused ? <path d="M4 2.5 13 8l-9 5.5Z" fill="currentColor" />
                : <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="2" />}
            </svg>
          </button>
        )}
      </div>

      <svg className={styles.scene} viewBox="0 0 350 274" role="img"
        aria-label="Ejemplo: el cliente agrega dos tacos de 35 pesos al menú, revisa el total de 70 pesos y envía el pedido por WhatsApp. El negocio confirma disponibilidad, entrega y pago.">
        <g aria-hidden="true">
          <g className={styles.menu} style={{ transform: `translateX(${chatOpen ? 14 : 77}px)` }}>
            <rect x="0" y="12" width="196" height="244" rx="18" fill="white" stroke="#e5e8ec" />
            {[16, 24, 32].map((x) => <circle key={x} cx={x} cy="27" r="2" fill="#d2d6dc" />)}
            <text x="16" y="59" className={styles.title}>Tu menú</text>
            <text x="16" y="77" className={styles.muted}>Hecho para antojar</text>
            <rect x="14" y="92" width="168" height="64" rx="12" fill="#f3f5f7" />
            <g transform="translate(23 106)">
              <ellipse cx="24" cy="22" rx="24" ry="14" fill="#e8ad42" />
              <path d="M2 21Q5-2 25 2Q43 3 47 23Z" fill="#f7cd70" />
              <path d="m8 17 5-6 6 2 6-5 7 5 7-1 4 9Z" fill="#955131" />
              <path d="m13 14 3-4m8 6 3-4m9 5 3-3" stroke="#45945d" strokeWidth="4" strokeLinecap="round" />
              <path d="M3 22Q24 12 46 24Q38 37 22 36Q7 35 3 22" fill="#f8ca64" />
            </g>
            <text x="80" y="116" className={styles.product}>Tacos</text>
            <text x="80" y="138" className={styles.price}>$35</text>
            <g key={quantity} className={quantity ? styles.quantity : undefined}>
              <rect x="145" y="123" width="26" height="26" rx="8" fill="#e5481d" />
              <text x="158" y="141" textAnchor="middle" className={styles.quantityText}>{quantity || "+"}</text>
            </g>
            <rect x="14" y="220" width="168" height="26" rx="8" fill="#e5481d" />
            <text x="98" y="237" textAnchor="middle" className={styles.ctaText}>
              {quantity ? "Pedir por WhatsApp" : "Elegir mi pedido"}
            </text>
          </g>

          <g className={styles.chat} data-visible={chatOpen}>
            <rect x="183" y="87" width="156" height="170" rx="17" fill="white" stroke="#e5e8ec" />
            <path d="M200 87h122q17 0 17 17v20H183v-20q0-17 17-17Z" fill="#157b52" />
            <path d="M198 98h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-7l-5 4 1-5a3 3 0 0 1-2-3v-4a3 3 0 0 1 3-3Z" fill="none" stroke="white" strokeWidth="1.5" />
            <text x="219" y="110" className={styles.chatTitle}>WhatsApp</text>
            <g className={styles.send} data-visible={transferred && !sent}>
              <text x="252" y="240" textAnchor="middle" className={styles.sendText}>Enviar</text>
              <path d="m283 229 13 6-13 6 3-6Z" fill="#157b52" />
            </g>
            <g className={styles.confirmation} data-visible={sent}>
              <path d="m211 236 3 3 6-7" fill="none" stroke="#157b52" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <text x="225" y="239" className={styles.sentText}>Pedido enviado</text>
            </g>
          </g>

          <g className={styles.packet} data-visible={phase >= 2} data-transferred={transferred}
            style={{ transform: `translate(${transferred ? 194 : chatOpen ? 28 : 91}px, ${transferred ? 139 : 165}px)` }}>
            <rect className={styles.packetPaper} width={transferred ? 134 : 168} height={transferred ? 67 : 46} rx="9" />
            <text x="12" y="19" className={styles.packetTitle}>2 × Tacos</text>
            <text x="12" y="36" className={styles.packetTotal}>Total: $70</text>
            <text x="12" y="54" className={styles.packetNote} opacity={transferred ? 1 : 0}>Para recoger</text>
          </g>
        </g>
      </svg>
      <p className={styles.caption}>{captions[step]}</p>
    </div>
  );
}
