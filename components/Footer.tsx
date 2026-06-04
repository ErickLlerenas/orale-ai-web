export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="copy">
          © {year} Órale AI · Hecho en México 🇲🇽
        </div>
        <nav>
          <a href="/">Inicio</a>
          <a href="/privacidad">Aviso de privacidad</a>
          <a href="mailto:hola@oraleai.com">Contacto</a>
        </nav>
      </div>
    </footer>
  );
}
