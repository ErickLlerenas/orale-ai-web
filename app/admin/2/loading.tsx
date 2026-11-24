import s from "./panel2.module.css";

/// Mientras el servidor arma el panel 2 (sin esto sale la de /admin).
export default function Loading() {
  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <img className={s.logo} src="/logo.png" alt="Órale AI" />
          <div className={s.topText}>
            <h1 className={s.title}>Panel 2</h1>
            <p className={s.subtitle}>Cargando…</p>
          </div>
        </header>
        <section className={s.card} style={{ height: 200 }} />
      </div>
    </main>
  );
}
