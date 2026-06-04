import Footer from "@/components/Footer";

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
  { n: "1", title: "Descarga la app", text: "En tu tablet, desde la App Store o Google Play." },
  { n: "2", title: "Arma tu menú", text: "Con una foto y la IA, en minutos." },
  { n: "3", title: "Empieza a vender", text: "El mismo día, sin instalaciones ni servidores." },
];

export default function Home() {
  return (
    <>
      <header>
        <nav className="nav">
          <a className="brand" href="/">
            Órale<span> AI</span>
          </a>
          <div className="nav-links">
            <a href="#features">Funciones</a>
            <a href="#como">Cómo funciona</a>
            <a href="/privacidad">Privacidad</a>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>
            El punto de venta con <em>IA</em> para tu negocio
          </h1>
          <p>
            Para taquerías, fondas, cafeterías y food trucks. Descárgalo en una
            tablet y empieza a vender el mismo día. Sin computadora, sin
            servidor, sin complicaciones.
          </p>
          <div className="badges">
            <span className="badge">
              <span></span>
              <span>
                <small>Próximamente en</small>App Store
              </span>
            </span>
            <span className="badge">
              <span></span>
              <span>
                <small>Próximamente en</small>Google Play
              </span>
            </span>
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
            <p>Sin tarjeta. Luego desde $199 MXN al mes.</p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
