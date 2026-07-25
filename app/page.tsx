import Footer from "@/components/Footer";
import HeroTablet from "@/components/HeroTablet";
import ProSyncVisual from "@/components/ProSyncVisual";
import StoreBadges from "@/components/StoreBadges";

const pillars = [
  {
    num: "01",
    title: "Menú con una foto",
    text: "La IA arma productos, precios y categorías. Tú revisas y listo.",
  },
  {
    num: "02",
    title: "Vende y cobra al momento",
    text: "Orden, comanda, cuenta y propina. Pensado para el mostrador.",
  },
  {
    num: "03",
    title: "Sin internet, sigues vendiendo",
    text: "Tu negocio no se para. Los datos viven en tu dispositivo.",
  },
];

const proFeatures = [
  {
    num: "01",
    title: "Meseros en su celular",
    text: "Piden desde el salón. Tú cobras en la caja. El menú se actualiza solo.",
  },
  {
    num: "02",
    title: "Comandas al instante",
    text: "Todo se sincroniza por la red del local. Sin hub ni tablet extra.",
  },
  {
    num: "03",
    title: "Impresión por la red",
    text: "Cocina y barra reciben el ticket directo, sin Bluetooth.",
  },
];

const steps = [
  {
    n: "01",
    title: "Descárgala",
    text: "En tu celular o tablet, en un minuto.",
  },
  {
    n: "02",
    title: "Arma tu menú",
    text: "Con una foto y la IA, o a mano.",
  },
  {
    n: "03",
    title: "Empieza a cobrar",
    text: "El mismo día. Sin enredos.",
  },
];

export default function Home() {
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-atmosphere" aria-hidden="true">
            <span className="hero-orb hero-orb-a" />
            <span className="hero-orb hero-orb-b" />
            <span className="hero-orb hero-orb-c" />
            <span className="hero-grain" />
          </div>

          <div className="hero-content">
            <p className="hero-name">
              Órale<span> AI</span>
            </p>
            <h1>
              La <em>IA</em> arma tu menú.
              <br />
              Tú solo cobras.
            </h1>
            <p className="hero-lead">
              Punto de venta para taquerías, fondas y food trucks. Fotografía tu
              menú y la IA lo configura.
            </p>

            <HeroTablet />

            <StoreBadges />
          </div>
        </section>

        <section id="features" className="pillars">
          <div className="container">
            <h2 className="section-title">Hecho para el mostrador</h2>
            <p className="section-sub">
              Lo esencial para vender. Sin complicaciones.
            </p>
            <ol className="pillars-list">
              {pillars.map((p) => (
                <li key={p.num} className="pillar">
                  <span className="pillar-num">{p.num}</span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="pillars-also">
              También: pedidos para llevar, reportes con IA, caja, inventario,
              PIN por empleado e impresión térmica.
            </p>
          </div>
        </section>

        <section id="pro" className="pro-band">
          <div className="container">
            <div className="pro-header">
              <div>
                <p className="pro-eyebrow">Órale AI Pro</p>
                <h2 className="pro-title">
                  Cuando ya no basta con un solo dispositivo
                </h2>
                <p className="pro-sub">
                  Cada mesero pide en su celular y la comanda llega a cocina. Tú
                  cobras en la caja. Pro necesita WiFi del local e impresora de
                  red; el plan normal no.
                </p>
              </div>
              <a className="btn btn-pro" href="#precios">
                Ver precios Pro
              </a>
            </div>
            <ProSyncVisual />
            <ol className="pro-points">
              {proFeatures.map((f) => (
                <li key={f.num} className="pro-point">
                  <span className="pro-point-num">{f.num}</span>
                  <div>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="pro-note">
              <strong>Importante:</strong> Pro se activa en la app (Ajustes →
              Equipo y accesos → Varios meseros). Solo México. Si no tienes WiFi
              estable, quédate en el plan normal.
            </p>
          </div>
        </section>

        <section id="precios" className="container">
          <h2 className="section-title">Precios claros</h2>
          <p className="section-sub">
            Empieza gratis 14 días. Si tu equipo crece, sube a Pro.
          </p>
          <div className="pricing">
            <div className="plan-card recommended">
              <span className="plan-ribbon">Recomendado</span>
              <h3 className="plan-name">Plan normal</h3>
              <p className="plan-tagline">
                Un dispositivo · funciona sin internet
              </p>
              <div className="plan-price">
                <span className="amount">$99</span>
                <span className="period">MXN / mes</span>
              </div>
              <p className="plan-yearly">o $799 MXN / año</p>
              <ul className="plan-list">
                <li>Punto de venta completo</li>
                <li>Menú y reportes con IA</li>
                <li>Impresión térmica</li>
                <li>Funciona sin internet</li>
                <li>14 días de prueba gratis</li>
              </ul>
              <a className="btn btn-primary plan-cta" href="#cta">
                Empezar gratis
              </a>
              <p className="plan-foot">Ideal si vendes desde un solo equipo</p>
            </div>

            <div className="plan-card featured">
              <h3 className="plan-name">Órale AI Pro</h3>
              <p className="plan-tagline">
                Varios meseros · requiere WiFi del local
              </p>
              <div className="plan-price">
                <span className="amount">$199</span>
                <span className="period">MXN / mes</span>
              </div>
              <p className="plan-yearly">o $1,599 MXN / año</p>
              <ul className="plan-list">
                <li>Incluye todo el plan normal</li>
                <li>Cada mesero pide desde su celular</li>
                <li>Las comandas se sincronizan solas</li>
                <li>Imprimen directo a cocina por la red</li>
              </ul>
              <a className="btn btn-pro plan-cta" href="#cta">
                Quiero Pro
              </a>
              <p className="plan-foot">
                Requiere WiFi e impresora de red · solo México
              </p>
            </div>
          </div>
        </section>

        <section id="como" className="como">
          <div className="container">
            <h2 className="section-title">Listo en 3 pasos</h2>
            <p className="section-sub">De cero a cobrando en una tarde.</p>
            <ol className="steps">
              {steps.map((s) => (
                <li className="step" key={s.n}>
                  <span className="step-num">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="cta" className="cta-wrap">
          <div className="container">
            <div className="cta">
              <p className="cta-eyebrow">Empieza gratis</p>
              <h2>Órale, ya vendiste</h2>
              <p className="cta-lead">
                Descarga la app, arma tu menú con IA y cobra hoy. Si tu equipo
                crece,{" "}
                <a className="cta-inline" href="#pro">
                  sube a Pro
                </a>
                .
              </p>
              <StoreBadges />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
