import Footer from "@/components/Footer";
import HeroTablet from "@/components/HeroTablet";
import ProSyncVisual from "@/components/ProSyncVisual";
import StoreBadges from "@/components/StoreBadges";
import { discountPct, mxn, pricingNow, type PlanAmounts } from "@/lib/pricing";
import { softwareJsonLd } from "@/lib/seo";

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
    title: "Agrega lo que vendes",
    text: "Toma una foto de tu menú y la IA te ayuda a agregar tus productos y precios. También puedes escribirlos tú.",
  },
  {
    num: "02",
    title: "Toma pedidos y lleva la cuenta",
    text: "Anota qué pidió cada mesa o cliente, imprime el pedido para la cocina y calcula cuánto cobrar.",
  },
  {
    num: "03",
    title: "Sigue vendiendo sin internet",
    text: "Si se va el internet, puedes seguir registrando pedidos y cobros en tu celular o tablet. La IA sí necesita conexión.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }}
      />
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
                Tu menú listo
                <br />
                <em>con una foto.</em>
              </h1>
              <p className="hero-lead">
                La inteligencia artificial carga tus productos y precios desde
                una foto. Tú revisas y empiezas a vender.
              </p>
            </div>

            <div className="hero-visual">
              <HeroTablet />
            </div>

            <div className="hero-cta">
              <div className="hero-rating">
                <span className="hero-rating-stars" aria-hidden="true">★★★★★</span>
                <span>
                  <strong>4.9 estrellas</strong> en{" "}
                  <a href="https://apps.apple.com/mx/app/id6776390828" target="_blank" rel="noopener noreferrer">App Store</a>
                  {" y "}
                  <a href="https://play.google.com/store/apps/details?id=com.oraleai.orale_ai" target="_blank" rel="noopener noreferrer">Play Store</a>
                </span>
              </div>
              <StoreBadges />
            </div>
          </div>
        </section>

        <section id="features" className="pillars">
          <div className="container">
            <h2 className="section-title">Controla los pedidos y las ventas de tu negocio</h2>
            <p className="section-sub">
              Convierte tu celular o tablet en un punto de venta para tu restaurante, cafetería o puesto de comida.
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
              También puedes consultar cuánto vendiste, revisar el dinero de
              caja, controlar tu inventario y dar a cada empleado su propio
              código de acceso.
            </p>
          </div>
        </section>

        <section id="pro" className="pro-band">
          <div className="container">
            <div className="pro-header">
              <div>
                <p className="pro-eyebrow">Órale AI Pro</p>
                <h2 className="pro-title">
                  Tus meseros toman pedidos desde su celular
                </h2>
                <p className="pro-sub">
                  Los pedidos llegan a la caja y se imprimen en cocina. Tú llevas
                  las cuentas y cobras desde un solo lugar.
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
              impresora de red. Si no los tienes, quédate en el plan Órale AI.
            </p>
          </div>
        </section>

        <section id="precios" className="container">
          <h2 className="section-title">Precios claros</h2>
          <p className="section-sub">
            Si tu equipo crece, sube a Pro.
          </p>
          {promoEndsLabel && next && increaseOnLabel && (
            <p className="promo-note">
              <strong>Precio de lanzamiento hasta el {promoEndsLabel}.</strong>{" "}
              El {increaseOnLabel} el plan Órale AI pasa a{" "}
              {mxn(next.base.monthly)} y Pro a {mxn(next.pro.monthly)} al mes.
              Si te suscribes hoy, te quedas en este precio mientras no
              canceles.
              </p>
          )}
          <div className="pricing">
            <div className="plan-card recommended">
              <span className="plan-ribbon">Recomendado</span>
              <h3 className="plan-name">Órale AI</h3>
              <p className="plan-tagline">Una caja, vende sin internet.</p>
              <PlanPrice now={prices.base} next={next?.base} />
              <ul className="plan-list">
                <li>Órdenes sin límite</li>
                <li>Menú y reportes con IA</li>
                <li>Historial y corte de caja</li>
                <li>Cobra sin internet</li>
              </ul>
              <a className="btn btn-primary plan-cta" href="#cta">
                Empezar
              </a>
              <p className="plan-foot">Ideal si vendes desde un solo equipo</p>
            </div>

            <div className="plan-card featured">
              <h3 className="plan-name">Órale AI Pro</h3>
              <p className="plan-tagline">Una caja, varios meseros.</p>
              <PlanPrice now={prices.pro} next={next?.pro} />
              <ul className="plan-list">
                <li>Incluye todo Órale AI</li>
                <li>Cada mesero pide desde su celular</li>
                <li>Las comandas se sincronizan solas</li>
                <li>Imprimen directo a cocina por la red</li>
              </ul>
              <a className="btn btn-pro plan-cta" href="#cta">
                Quiero Pro
              </a>
              <p className="plan-foot">Ideal si ya pides desde las mesas</p>
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
              <div className="cta-main">
                <div className="cta-copy">
                  <p className="cta-eyebrow">Tu siguiente venta empieza aquí</p>
                  <h2>Tu negocio.<br /><em>Todo en una app.</em></h2>
                  <p className="cta-lead">
                    Carga tu menú, toma pedidos y lleva tus cuentas desde tu
                    celular o tablet.
                  </p>
                  <div className="cta-benefits"><span>Menú con IA</span><span>Mesas y pedidos</span><span>Control de ventas</span></div>
                </div>
                <div className="cta-download">
                  <img src="/logo.png" alt="" width="56" height="56" />
                  <h3>Descarga Órale AI</h3>
                  <p>Empieza con tu propio menú.</p>
                  <StoreBadges />
                </div>
              </div>
              <div id="negocio" className="cta-owner">
                <div><strong>¿Ya usas Órale AI?</strong><span>Consulta tu negocio si activaste el acceso desde la caja.</span></div>
                <a href="/negocio">Entrar a mi negocio <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
