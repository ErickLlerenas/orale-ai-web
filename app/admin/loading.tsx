import s from "./new.module.css";

/// Mientras el servidor arma el panel nuevo (sin esto sale el del panel oscuro).
export default function Loading() {
  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <img className={s.logo} src="/logo.png" alt="Órale AI" />
          <div>
            <h1 className={s.title}>Panel</h1>
            <p className={s.subtitle}>Cargando…</p>
          </div>
        </header>
        <section className={s.card} style={{ height: 136 }} />
      </div>
    </main>
  );
}
