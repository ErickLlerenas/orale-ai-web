"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  { title: "Toma el pedido", detail: "El mesero lo envía desde su celular." },
  { title: "Sale en cocina", detail: "La comanda se imprime para preparar." },
  { title: "Llega a caja", detail: "La cuenta de la mesa se actualiza." },
];

/** Una misma orden recorre mesero, impresión y caja, en ese orden. */
export default function ProSyncVisual() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      motion.removeEventListener("change", updateMotion);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || !visible || reducedMotion) return;
    const timer = window.setTimeout(() => setStep((current) => (current + 1) % steps.length), 3000);
    return () => window.clearTimeout(timer);
  }, [step, paused, visible, reducedMotion]);

  return (
    <div className="pro-demo" ref={root} data-step={step}>
      <div className="pro-demo-toolbar">
        <span className="pro-demo-kicker">Un pedido. Todo tu equipo conectado.</span>
        {!reducedMotion && (
          <button className="pro-demo-pause" type="button" onClick={() => setPaused(!paused)}
            aria-label={paused ? "Reproducir demostración" : "Pausar demostración"}>
            <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span> {paused ? "Reproducir" : "Pausar"}
          </button>
        )}
      </div>

      <div className="pro-demo-steps" role="group" aria-label="Pasos de un pedido con Pro">
        {steps.map((item, index) => (
          <button key={item.title} type="button" aria-pressed={step === index}
            onClick={() => { setStep(index); setPaused(true); }}>
            <span className="pro-demo-number">0{index + 1}</span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      <div className="pro-demo-scene" aria-hidden="true">
        <div className="pro-demo-station pro-demo-waiter" data-active={step === 0}>
          <div className="pro-demo-phone">
            <div className="pro-demo-notch" />
            <div className="pro-demo-phone-screen">
              <small>NUEVO PEDIDO</small>
              <strong className="pro-demo-table">Mesa 3</strong>
              <div className="pro-demo-line"><b>2</b><span>Tacos al pastor<small>Sin cebolla</small></span></div>
              <div className="pro-demo-line"><b>1</b><span>Horchata</span></div>
              <span className="pro-demo-send">{step === 0 ? "Enviar pedido ↑" : "Pedido enviado ✓"}</span>
            </div>
          </div>
          <span className="pro-demo-caption">Celular del mesero</span>
        </div>

        <div className="pro-demo-connection" data-reached={step >= 1}><svg viewBox="0 0 32 16" fill="none" aria-hidden="true"><path d="M2 8H29M23 2L29 8L23 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>

        <div className="pro-demo-station pro-demo-kitchen" data-active={step === 1}>
          <div className="pro-demo-printer">
            <div className="pro-demo-printer-shell"><span className="pro-demo-printer-led" /><span>COCINA</span></div>
            <div className="pro-demo-printer-slot" />
            <div className="pro-demo-paper-window">
              <div className="pro-demo-ticket" data-printed={step >= 1}>
                <strong>MESA 3</strong><span>Pedido para preparar</span>
                <div>2× Tacos al pastor<small>Sin cebolla</small></div>
                <div>1× Horchata</div>
                <span className="pro-demo-ticket-end">Órale, ¡a preparar!</span>
              </div>
            </div>
          </div>
          <span className="pro-demo-caption">Impresora de cocina</span>
        </div>

        <div className="pro-demo-connection" data-reached={step === 2}><svg viewBox="0 0 32 16" fill="none" aria-hidden="true"><path d="M2 8H29M23 2L29 8L23 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>

        <div className="pro-demo-station pro-demo-register" data-active={step === 2}>
          <div className="pro-demo-tablet">
            <div className="pro-demo-register-screen">
              <div className="pro-demo-register-head"><strong>Tu caja</strong><span><i /> Conectada</span></div>
              <div className="pro-demo-register-body">
                <div className="pro-demo-tables"><span className="chosen">Mesa 3</span><span>Mesa 4</span><span>Mesa 5</span></div>
                <div className="pro-demo-account">
                  <div className="pro-demo-account-head"><strong>Mesa 3</strong><small>Cuenta abierta</small></div>
                  <div className="pro-demo-received" data-received={step === 2}>
                    <div><span>2× Tacos al pastor</span><b>$70</b></div>
                    <div><span>1× Horchata</span><b>$35</b></div>
                    <div className="pro-demo-total"><span>Total</span><strong>$105</strong></div>
                  </div>
                  <div className="pro-demo-empty" data-show={step < 2}>Esperando el pedido…</div>
                </div>
              </div>
              <div className="pro-demo-notification" data-show={step === 2}>✓ Pedido recibido · Mesa 3</div>
            </div>
          </div>
          <span className="pro-demo-caption">Tu tablet en caja</span>
        </div>
      </div>
      <p className="pro-demo-summary">{steps[step].detail}</p>
    </div>
  );
}
