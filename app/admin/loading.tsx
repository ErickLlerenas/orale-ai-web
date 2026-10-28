import s from "./admin.module.css";

/// Mientras el servidor arma el panel (al cambiar de mes o de día).
export default function Loading() {
  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.top}>
          <div className={s.brand}>
            <img className={s.logo} src="/logo.png" alt="Órale AI" />
            <div>
              <h1 className={s.title}>Panel</h1>
              <p className={s.subtitle}>Cargando…</p>
            </div>
          </div>
        </header>
        <div className={s.skelRow}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={s.skel} style={{ height: 150 }} />
          ))}
        </div>
        <div className={s.skel} style={{ height: 320 }} />
      </div>
    </main>
  );
}
