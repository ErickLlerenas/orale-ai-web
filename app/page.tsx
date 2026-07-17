import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

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
            <div className="badges">
              <a
                className="badge badge-apple"
                href="https://apps.apple.com/app/id6776390828"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="badge-logo"
                  viewBox="0 0 384 512"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
                  />
                </svg>
                <span className="badge-text">
                  <small>Descárgalo en la</small>App Store
                </span>
              </a>
              <a
                className="badge badge-google"
                href="https://play.google.com/store/apps/details?id=com.oraleai.orale_ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="badge-logo"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.6 3 21.09 3 20.5m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19 0 .5-.25.92-.57 1.18l-2.29 1.32-2.5-2.5 2.29-1.32 2.48 1.13M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z"
                  />
                </svg>
                <span className="badge-text">
                  <small>Disponible en</small>Google Play
                </span>
              </a>
            </div>
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
            <div className="plan-card">
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
              <span className="plan-ribbon">Recomendado</span>
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
              <a href="#pro">sube a Pro</a>.
            </p>
            <div className="cta-actions">
              <a
                className="btn btn-primary"
                href="https://apps.apple.com/app/id6776390828"
                target="_blank"
                rel="noopener noreferrer"
              >
                App Store
              </a>
              <a
                className="btn btn-primary"
                href="https://play.google.com/store/apps/details?id=com.oraleai.orale_ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Play
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
