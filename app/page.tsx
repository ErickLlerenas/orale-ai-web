import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import StoreBadges from "@/components/StoreBadges";

const features = [
  {
    icon: "🧾",
    title: "Vende y cobra al momento",
    text: "Toma la orden, imprime la comanda o la cuenta y cobra con propina. Listo para usar desde el primer día.",
  },
  {
    icon: "🥡",
    title: "Pedidos para llevar",
    text: "Registra el nombre del cliente y cobra en segundos. Ideal para mostrador y comida rápida.",
  },
  {
    icon: "✨",
    title: "Menú con una foto",
    text: "Fotografía tu menú impreso y la IA crea productos, precios, categorías y modificadores por ti.",
    accent: true,
  },
  {
    icon: "📊",
    title: "Reportes claros con IA",
    text: "Te dice qué se vende más, qué día está flojo y qué conviene surtir. En español, sin tecnicismos.",
    accent: true,
  },
  {
    icon: "💰",
    title: "Caja e inventario",
    text: "Corte del día, gastos y existencias en la misma app. Olvídate de las hojas de cálculo.",
  },
  {
    icon: "👥",
    title: "PIN para cada quien",
    text: "El dueño administra el negocio; meseros y cajeros solo ven lo que necesitan para vender.",
  },
  {
    icon: "📵",
    title: "Sin internet, sigues vendiendo",
    text: "En el plan normal tus datos viven en el dispositivo. Si se cae la red, el punto de venta sigue.",
  },
  {
    icon: "🖨️",
    title: "Impresión térmica",
    text: "Conecta por Bluetooth o red y manda tickets a cocina, barra o caja, por separado.",
  },
  {
    icon: "🛡️",
    title: "Tus datos son tuyos",
    text: "Exporta un respaldo cuando quieras y guárdalo donde te acomode. Sin amarres raros.",
  },
];

const proFeatures = [
  {
    icon: "📱",
    title: "Cada mesero en su celular",
    text: "Toman pedidos desde su teléfono. Tú cobras en la caja. El menú se actualiza solo para todos.",
  },
  {
    icon: "☁️",
    title: "Comandas al instante",
    text: "Las órdenes se sincronizan en el negocio. No necesitas dejar una tablet encendida como hub.",
  },
  {
    icon: "📶",
    title: "Impresión por la red",
    text: "Cada celular manda la comanda a la impresora del local. Bluetooth no alcanza cuando hay varios.",
  },
];

const steps = [
  {
    n: "1",
    title: "Descarga la app",
    text: "En tu celular o tablet, desde App Store o Google Play.",
  },
  {
    n: "2",
    title: "Arma tu menú",
    text: "Con una foto y la IA, o agrégalo a mano si prefieres.",
  },
  {
    n: "3",
    title: "Empieza a vender",
    text: "El mismo día. Sin instalar servidores ni llamar a un técnico.",
  },
];

export default function Home() {
  return (
    <>
      <Nav>
        <a href="#features">Funciones</a>
        <a href="#pro">Pro</a>
        <a href="#precios">Precios</a>
        <a href="#como">Cómo funciona</a>
        <a className="nav-cta" href="#precios">
          Ver Pro
        </a>
      </Nav>

      <main>
        <section className="hero">
          <div className="hero-content">
            <div className="hero-brand">
              <img className="hero-logo" src="/logo.png" alt="" />
              <p className="hero-name">
                Órale<span> AI</span>
              </p>
            </div>
            <h1>
              El punto de venta con <em>IA</em> para tu negocio
            </h1>
            <p>
              Hecho para taquerías, fondas, cafeterías y food trucks. Descárgalo,
              arma tu menú y vende hoy mismo.
            </p>
            <StoreBadges />
            <a
              className="windows-link"
              href="https://apps.microsoft.com/detail/9mwh3bdnf0xt?hl=es-MX&gl=MX"
              target="_blank"
              rel="noopener noreferrer"
            >
              También disponible para Windows
            </a>
          </div>
        </section>

        <section id="features" className="container">
          <h2 className="section-title">Lo que necesitas para vender</h2>
          <p className="section-sub">
            Punto de venta completo, con IA que te ayuda a armar el menú y
            entender tus ventas.
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
                <h2 className="pro-title">Cuando tu equipo ya no cabe en un solo dispositivo</h2>
                <p className="pro-sub">
                  Cada mesero toma pedidos en su celular y las comandas llegan a
                  cocina. Tú cobras en la caja. Pro necesita WiFi del local e
                  impresora de red; el plan normal no.
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
          <h2 className="section-title">Elige tu plan</h2>
          <p className="section-sub">
            Empieza sin internet. Si tu equipo crece, sube a Pro con WiFi.
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
            <h2>Empieza gratis hoy</h2>
            <p>
              Descarga la app, arma tu menú con IA y vende el mismo día. Cuando
              necesites varios meseros con WiFi,{" "}
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
