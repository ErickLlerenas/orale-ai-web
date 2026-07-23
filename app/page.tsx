import Footer from "@/components/Footer";
import HeroPhone from "@/components/HeroPhone";
import StoreBadges from "@/components/StoreBadges";

const features = [
  {
    icon: "🧾",
    title: "Vende y cobra al momento",
    text: "Toma la orden, imprime la comanda o la cuenta y cobra con propina. Listo desde el primer día.",
  },
  {
    icon: "🥡",
    title: "Pedidos para llevar",
    text: "Nombre del cliente y cobra en segundos. Ideal para mostrador y comida rápida.",
  },
  {
    icon: "✨",
    title: "Menú con una foto",
    text: "Fotografía tu menú impreso y la IA arma productos, precios y categorías por ti.",
    accent: true,
  },
  {
    icon: "📊",
    title: "Reportes claros con IA",
    text: "Qué se vende más, qué día está flojo y qué conviene surtir. En español, sin tecnicismos.",
    accent: true,
  },
  {
    icon: "💰",
    title: "Caja e inventario",
    text: "Corte del día, gastos y existencias en la misma app. Adiós a las hojas de cálculo.",
  },
  {
    icon: "👥",
    title: "PIN para cada quien",
    text: "El dueño administra; meseros y cajeros solo ven lo que necesitan para vender.",
  },
  {
    icon: "📵",
    title: "Sin internet, sigues vendiendo",
    text: "En el plan normal tus datos viven en el dispositivo. Si se cae la red, el punto de venta sigue.",
  },
  {
    icon: "🖨️",
    title: "Impresión térmica",
    text: "Bluetooth o red: tickets a cocina, barra o caja, por separado.",
  },
  {
    icon: "🛡️",
    title: "Tus datos son tuyos",
    text: "Exporta un respaldo cuando quieras. Sin amarres raros.",
  },
];

const proFeatures = [
  {
    icon: "📱",
    title: "Cada mesero en su celular",
    text: "Toman pedidos desde su teléfono. Tú cobras en la caja. El menú se actualiza solo.",
  },
  {
    icon: "☁️",
    title: "Comandas al instante",
    text: "Las órdenes se sincronizan en el negocio. Sin tablet encendida como hub.",
  },
  {
    icon: "📶",
    title: "Impresión por la red",
    text: "Cada celular manda la comanda a la impresora del local.",
  },
];

const steps = [
  {
    n: "1",
    title: "Descárgala",
    text: "En el botón de arriba, según tu dispositivo.",
  },
  {
    n: "2",
    title: "Arma tu menú",
    text: "Con una foto y la IA, o a mano si prefieres.",
  },
  {
    n: "3",
    title: "Cobra hoy",
    text: "Sin servidores, sin técnico, sin enredo.",
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

            <HeroPhone />

            <StoreBadges />
          </div>
        </section>

        <section id="features" className="container">
          <h2 className="section-title">Todo lo que necesitas en el mostrador</h2>
          <p className="section-sub">
            Simple de usar, pensado para México. La IA solo cuando te conviene.
          </p>
          <div className="grid">
            {features.map((f) => (
              <div
                key={f.title}
                className={f.accent ? "feature accent" : "feature"}
              >
                <div className="ico">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
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
              <a className="btn btn-gold" href="#precios">
                Ver precios Pro
              </a>
            </div>
            <div className="grid-pro">
              {proFeatures.map((f) => (
                <div key={f.title} className="feature-pro">
                  <div className="ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
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
              <p className="plan-yearly">
                o $1,599 MXN / año · ahorra ~4 meses
              </p>
              <ul className="plan-list">
                <li>Incluye todo el plan normal</li>
                <li>Cada mesero pide desde su celular</li>
                <li>Las comandas se sincronizan solas</li>
                <li>Imprimen directo a cocina por la red</li>
              </ul>
              <a className="btn btn-gold plan-cta" href="#cta">
                Quiero Pro
              </a>
              <p className="plan-foot">
                Requiere WiFi e impresora de red · solo México
              </p>
            </div>
          </div>
        </section>

        <section id="como" className="container">
          <h2 className="section-title">Listo en 3 pasos</h2>
          <p className="section-sub">De cero a cobrando en una tarde.</p>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <div className="num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="cta" className="container">
          <div className="cta">
            <h2>Órale, ya vendiste</h2>
            <p>
              Descarga, arma tu menú con IA y cobra hoy. Cuando necesites varios
              meseros,{" "}
              <a className="cta-inline" href="#pro">
                sube a Pro
              </a>
              .
            </p>
            <StoreBadges />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
