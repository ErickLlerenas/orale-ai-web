import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

const features = [
  {
    icon: "🧾",
    title: "Vende y cobra rápido",
    text: "Toma la orden, imprime comanda o cuenta y cobra con propina. En tablet es modo mostrador (órdenes con nombre); en Windows, mesas y para llevar.",
  },
  {
    icon: "✨",
    title: "Arma tu menú con IA",
    text: "Toma una foto de tu menú impreso y la IA crea productos, precios, categorías y modificadores por ti.",
    accent: true,
  },
  {
    icon: "📊",
    title: "Reportes con IA",
    text: "Descubre tu producto estrella, tu día más flojo y qué surtir. Consejos claros, en español.",
    accent: true,
  },
  {
    icon: "💰",
    title: "Caja e inventario",
    text: "Corte del día, gastos, ventas cerradas y control de existencias. Todo en la misma app, sin hojas de cálculo.",
  },
  {
    icon: "📵",
    title: "Funciona sin internet",
    text: "Tus datos viven en tu dispositivo. El punto de venta sigue operando aunque se caiga la red.",
  },
  {
    icon: "🖨️",
    title: "Impresión térmica",
    text: "En tablet: impresora Bluetooth (comandas y cuentas). En Windows: impresoras en red por área (cocina, barra, caja).",
  },
  {
    icon: "🛡️",
    title: "Respaldo cuando quieras",
    text: "Exporta toda tu información a un archivo y guárdalo donde quieras. Tus datos son tuyos.",
  },
];

const windowsFeatures = [
  {
    icon: "🍽️",
    title: "Mapa de mesas",
    text: "Un cuadro por mesa: libre u ocupada, con el total a la vista. Configura cuántas mesas tiene tu local.",
  },
  {
    icon: "🖨️",
    title: "Impresoras en red por área",
    text: "Cada categoría va a su impresora: cocina recibe tacos, barra recibe bebidas. Tickets separados, sin mezclar.",
  },
  {
    icon: "🥡",
    title: "Para llevar",
    text: "Cobra pedidos para llevar sin usar una mesa. Salón y takeout desde el mismo punto, en la misma app.",
  },
];

const steps = [
  {
    n: "1",
    title: "Descarga la app",
    text: "En celular, tablet o PC, desde la App Store, Google Play o Microsoft Store.",
  },
  { n: "2", title: "Arma tu menú", text: "Con una foto y la IA, en minutos." },
  { n: "3", title: "Empieza a vender", text: "El mismo día, sin instalaciones ni servidores." },
];

export default function Home() {
  return (
    <>
      <Nav>
        <a href="#features">Funciones</a>
        <a href="#windows">Windows</a>
        <a href="#como">Cómo funciona</a>
        <a href="/privacidad">Privacidad</a>
      </Nav>

      <main>
        <section className="hero">
          <img className="hero-logo" src="/logo.png" alt="Órale AI" />
          <h1>
            El punto de venta con <em>IA</em> para tu negocio
          </h1>
          <p>
            Para taquerías, fondas, cafeterías, restaurantes y food trucks.
            En tablet (iOS o Android) para el mostrador; en Windows para
            restaurantes con mesas e impresión en red. Empieza a vender el mismo
            día, sin servidor ni complicaciones.
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
            <a
              className="badge badge-windows badge-beta"
              href="https://apps.microsoft.com/detail/9mwh3bdnf0xt?hl=es-MX&gl=MX"
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
                  d="M3 12V3.045l8.955 1.26v7.695H3zm9.955 0V4.305L21 5.56V12h-8.045zM3 20.955l8.955-1.245V12H3v8.955zm9.955-1.965L21 17.44V12h-8.045v6.99z"
                />
              </svg>
              <span className="badge-text">
                <small>Disponible para</small>Windows
              </span>
              <span className="badge-tag">BETA</span>
            </a>
          </div>
        </section>

        <section id="features" className="container">
          <h2 className="section-title">Todo lo que tu negocio necesita</h2>
          <p className="section-sub">
            Lo esencial para vender, más IA que te ayuda a crecer.
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

        <section id="windows" className="container">
          <div className="windows-panel">
            <div className="windows-header">
              <div>
                <p className="section-eyebrow windows-eyebrow">Versión para PC</p>
                <h2 className="windows-title">En Windows, aún más potente</h2>
                <p className="windows-sub">
                  Pensada para el mostrador del restaurante: mapa de mesas,
                  comandas divididas por área (cocina, barra, caja) e impresión
                  en red desde tu PC táctil.
                </p>
              </div>
              <span className="windows-beta">BETA</span>
            </div>
            <div className="grid grid-windows">
              {windowsFeatures.map((f) => (
                <div key={f.title} className="feature feature-windows">
                  <div className="ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
            <a
              className="windows-cta"
              href="https://apps.microsoft.com/detail/9mwh3bdnf0xt?hl=es-MX&gl=MX"
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar para Windows
            </a>
          </div>
        </section>

        <section id="como" className="container">
          <h2 className="section-title">Listo en 3 pasos</h2>
          <p className="section-sub">De cero a vendiendo en una tarde.</p>
          <div className="steps">
            {steps.map((s) => (
              <div className="step-card" key={s.n}>
                <div className="num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="cta" className="container">
          <div className="cta">
            <h2>Empieza gratis</h2>
            <p>
              25 ventas y 1 menú con IA incluidos, sin suscripción. Luego desde
              $99 MXN al mes o $799 MXN al año. En App Store y Google Play:
              14 días de prueba al suscribirte.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
