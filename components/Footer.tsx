export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="copy">
          © {year} Órale AI (Orale AI) · Hecho en México 🇲🇽
        </div>
        <nav>
          <a href="/">Inicio</a>
          <a href="/terminos">Términos y condiciones</a>
          <a href="/privacidad">Aviso de privacidad</a>
          <a
            href="https://wa.me/523331041584"
            target="_blank"
            rel="noopener noreferrer"
          >
            Soporte
          </a>
        </nav>
      </div>
    </footer>
  );
}
