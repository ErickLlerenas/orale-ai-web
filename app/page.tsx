import Footer from "@/components/Footer";
import HeroTablet from "@/components/HeroTablet";
import ProSyncVisual from "@/components/ProSyncVisual";
import StoreBadges from "@/components/StoreBadges";
import { discountPct, mxn, pricingNow, type PlanAmounts } from "@/lib/pricing";

/// Cada cuánto se regenera el HTML estático. Es lo que hace que los precios
/// cambien solos el día del aumento sin necesidad de un deploy.
export const revalidate = 600;

/// Precio mensual y anual de un plan, con el precio que viene tachado al lado
/// mientras la promoción siga viva.
///
/// El tachado es el precio FUTURO, no uno que se haya cobrado antes. Por eso el
/// aviso de arriba lleva la fecha: sin ese contexto, el tachado se leería como
/// un precio viejo inventado, que es publicidad engañosa.
function PlanPrice({ now, next }: { now: PlanAmounts; next?: PlanAmounts }) {
  return (
    <>
      <div className="plan-price">
        <span className="amount">{mxn(now.monthly)}</span>
        <span className="period">MXN / mes</span>
        {next && (
          <>
            <s className="amount-next">{mxn(next.monthly)}</s>
            <span className="plan-discount">
              −{discountPct(now.monthly, next.monthly)}%
            </span>
          </>
        )}
      </div>
      <p className="plan-yearly">
        o{" "}
        {next && (
          <>
            <s>{mxn(next.yearly)}</s>{" "}
          </>
        )}
        {mxn(now.yearly)} MXN / año
      </p>
    </>
  );
}

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
    text: "Piden desde las mesas. Tú cobras en la caja. El menú se actualiza solo.",
  },
  {
    num: "02",
    title: "Comandas al instante",
    text: "Cada pedido llega a caja.",
  },
  {
    num: "03",
    title: "Impresión por la red",
    text: "Cocina y barra reciben el ticket al momento.",
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
  const { prices, next, promoEndsLabel, increaseOnLabel } = pricingNow();

  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-atmosphere" aria-hidden="true">
            <span className="hero-orb hero-orb-a" />
            <span className="hero-orb hero-orb-b" />
            <span className="hero-orb hero-orb-c" />
          </div>

          <div className="hero-content">
            <div className="hero-copy">
              <p className="hero-name">
                Órale<span> AI</span>
              </p>
              <p className="hero-eyebrow">
                Punto de venta para negocios de comida
              </p>
              <h1>
                Fotografía tu menú.
                <br />
                Empieza a <em>cobrar</em>
              </h1>
              <p className="hero-lead">
                La IA crea tus productos, precios y categorías. Tú revisas y
                listo: toma pedidos, imprime comandas y cobra desde la app.
              </p>
            </div>

            <div className="hero-visual">
              <HeroTablet />
            </div>

            <div className="hero-cta">
              <StoreBadges />
            </div>
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
              <strong>Importante:</strong> Pro necesita WiFi del local e
              impresora de red. Si no los tienes, quédate en el plan normal.
            </p>
          </div>
        </section>

        <section id="precios" className="container">
          <h2 className="section-title">Precios claros</h2>
          <p className="section-sub">
            Empieza gratis 14 días. Si tu equipo crece, sube a Pro.
          </p>
          {promoEndsLabel && next && increaseOnLabel && (
            <p className="promo-note">
              <strong>Precio de lanzamiento hasta el {promoEndsLabel}.</strong>{" "}
              El {increaseOnLabel} el plan normal pasa a{" "}
              {mxn(next.base.monthly)} y Pro a {mxn(next.pro.monthly)} al mes.
              Si te suscribes hoy, te quedas en este precio mientras no
              canceles.
              </p>
          )}
          <div className="pricing">
            <div className="plan-card recommended">
              <span className="plan-ribbon">Recomendado</span>
              <h3 className="plan-name">Plan normal</h3>
              <p className="plan-tagline">
                Un dispositivo · funciona sin internet
              </p>
              <PlanPrice now={prices.base} next={next?.base} />
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
              <PlanPrice now={prices.pro} next={next?.pro} />
              <ul className="plan-list">
                <li>Incluye todo el plan normal</li>
                <li>Cada mesero pide desde su celular</li>
                <li>Las comandas se sincronizan solas</li>
                <li>Imprimen directo a cocina por la red</li>
                <li>Ves en caja lo que piden en las mesas</li>
              </ul>
              <a className="btn btn-pro plan-cta" href="#cta">
                Quiero Pro
              </a>
              <p className="plan-foot">Requiere WiFi e impresora de red</p>
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
