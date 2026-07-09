import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

const features = [
  {
    icon: "🧾",
    title: "Vende y cobra rápido",
    text: "Mesas o para llevar, toma la orden, imprime la comanda y cobra con propina. Sin curva de aprendizaje.",
  },
  {
    icon: "✨",
    title: "Arma tu menú con IA",
    text: "Toma una foto de tu menú impreso y la IA crea productos, precios y categorías por ti.",
    accent: true,
  },
  {
    icon: "📊",
    title: "Reportes con IA",
    text: "Descubre tu producto estrella, tu día más flojo y qué surtir. Consejos claros, en español.",
    accent: true,
  },
  {
    icon: "📵",
    title: "Funciona sin internet",
    text: "Todo se guarda en tu tablet. El punto de venta siempre funciona, aunque se caiga la red.",
  },
  {
    icon: "🖨️",
    title: "Impresión Bluetooth",
    text: "Comandas y cuentas en tu impresora térmica con batería. Sin cables ni módem.",
  },
  {
    icon: "🛡️",
    title: "Respaldo cuando quieras",
    text: "Exporta toda tu información a un archivo y guárdalo donde quieras. Tus datos son tuyos.",
  },
];

const steps = [
  {
    n: "1",
    title: "Descarga la app",
    text: "En tablet o PC, desde la App Store, Google Play o Microsoft Store.",
  },
  { n: "2", title: "Arma tu menú", text: "Con una foto y la IA, en minutos." },
  { n: "3", title: "Empieza a vender", text: "El mismo día, sin instalaciones ni servidores." },
];

export default function Home() {
  return (
    <>
      <Nav>
        <a href="#features">Funciones</a>
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
            Para taquerías, fondas, cafeterías y food trucks. Disponible para
            tablet (iPad o Android) y Windows (beta). Empieza a vender el mismo
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

        <section id="como" className="container">
          <h2 className="section-title">Listo en 3 pasos</h2>
          <p className="section-sub">De cero a vendiendo en una tarde.</p>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <div className="num">{s.n}</div>
                <h3>{s.title}</h3>
                <p style={{ color: "var(--ink-soft)" }}>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container">
          <div className="cta">
            <h2>Prueba Órale AI gratis 14 días</h2>
            <p>Sin tarjeta. Luego $99 MXN al mes o $799 MXN al año.</p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
