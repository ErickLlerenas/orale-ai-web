import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { mxn, pricingNow } from "@/lib/pricing";

export const metadata = {
  title: "Términos y condiciones · Órale AI",
};

/// Los precios de aquí son los mismos de la portada y cambian el mismo día.
export const revalidate = 600;

export default function Terms() {
  const { prices, promoEndsLabel } = pricingNow();

  return (
    <>
      <Nav>
        <a href="/">Inicio</a>
      </Nav>

      <main className="prose">
        <h1>Términos y condiciones</h1>
        <p className="muted">Última actualización: julio 2026</p>

        <p>
          Estos términos regulan el uso de <strong>Órale AI</strong>, un punto
          de venta para negocios de comida en México. Al descargar o usar la
          app aceptas estos términos. Si no estás de acuerdo, no uses la app.
        </p>

        <h2>1. Qué es Órale AI</h2>
        <p>
          Órale AI es una aplicación para tomar pedidos u órdenes, manejar
          mesas, cobrar, hacer cortes de caja y administrar tu menú. Está
          disponible para <strong>iPhone y iPad</strong> (App Store),{" "}
          <strong>Android</strong> (Google Play), <strong>Windows</strong>{" "}
          (Microsoft Store) y <strong>Mac</strong> (app de iPad en Apple
          Silicon). Esas funciones están en todos los planes;{" "}
          <strong>Órale AI Pro</strong> agrega varios dispositivos sincronizados
          en el mismo negocio.
        </p>
        <p>
          En el <strong>plan normal</strong>, la información de tu negocio
          (menú, ventas, equipo) se guarda{" "}
          <strong>localmente en cada dispositivo</strong> y no se sincroniza
          entre equipos. Con <strong>Órale AI Pro</strong>, parte de esa
          información (menú y órdenes abiertas) se sincroniza en la nube para
          que varios celulares operen el mismo negocio. Tú eres responsable de
          tus datos y de hacer respaldos.
        </p>
        <p>
          En <strong>Windows</strong>, el pago de la suscripción se procesa con{" "}
          <strong>Stripe</strong> (no con la tienda de Microsoft) y la
          impresora se conecta por <strong>Ethernet o USB</strong>.
        </p>

        <h2>2. Uso permitido</h2>
        <ul>
          <li>Puedes usar la app para operar tu propio negocio.</li>
          <li>
            No debes intentar copiar, modificar, revender o hacer ingeniería
            inversa de la app.
          </li>
          <li>
            Eres responsable de la información que capturas y de cumplir con tus
            obligaciones fiscales y legales.
          </li>
        </ul>

        <h2>3. Suscripción y pagos</h2>
        <p>
          Órale AI ofrece una <strong>prueba gratis</strong> limitada y luego
          una suscripción para seguir usando la app. Los planes disponibles
          (precios en México) son:
        </p>
        <ul>
          <li>
            <strong>Plan normal mensual:</strong> {mxn(prices.base.monthly)} MXN
            al mes.
          </li>
          <li>
            <strong>Plan normal anual:</strong> {mxn(prices.base.yearly)} MXN al
            año.
          </li>
          <li>
            <strong>Órale AI Pro mensual:</strong> {mxn(prices.pro.monthly)} MXN
            al mes.
          </li>
          <li>
            <strong>Órale AI Pro anual:</strong> {mxn(prices.pro.yearly)} MXN al
            año.
          </li>
        </ul>
        <p>
          Podemos <strong>cambiar estos precios</strong> avisándote con
          anticipación razonable desde la app, esta página o la tienda donde te
          suscribiste. Si ya estás suscrito,{" "}
          <strong>
            un aumento no se te aplica automáticamente: conservas el precio con
            el que contrataste
          </strong>{" "}
          mientras tu suscripción siga activa y no la canceles ni cambies de
          plan. Si en algún momento tuviéramos que moverte a un precio nuevo, te
          avisaríamos antes y tendrías que aceptarlo o podrías cancelar sin
          costo.
          {promoEndsLabel && (
            <>
              {" "}
              Los precios de arriba son de lanzamiento y están vigentes hasta el{" "}
              <strong>{promoEndsLabel}</strong>.
            </>
          )}
        </p>
        <p>
          El plan normal en App Store / Google Play incluye{" "}
          <strong>14 días de prueba</strong> al suscribirte.{" "}
          <strong>Órale AI Pro no incluye prueba gratis</strong>. Pro está
          disponible solo en <strong>México</strong> y también puedes
          contratarlo o activarlo desde la app (Ajustes → Equipo y accesos →
          Varios meseros).
        </p>
        <p>
          <strong>Órale AI Pro</strong> está pensado para negocios con{" "}
          <strong>WiFi en el local</strong>. Permite varios celulares tomando
          comandas y sincroniza menú y órdenes abiertas. Si cancelas o dejas de
          pagar Pro, el acceso multi-dispositivo y la sincronización dejan de
          estar disponibles.
        </p>
        <p>
          <strong>En iPhone, iPad, Mac y Android:</strong> el cobro y la
          renovación los gestiona <strong>Apple</strong> (App Store) o{" "}
          <strong>Google</strong> (Google Play). La suscripción se renueva
          automáticamente al final de cada periodo, a menos que la canceles al
          menos 24 horas antes de la renovación desde los ajustes de tu cuenta
          de la tienda. Los reembolsos se rigen por las políticas de Apple o
          Google.
        </p>
        <p>
          <strong>En Windows:</strong> creas una cuenta iniciando sesión con{" "}
          <strong>Google</strong> y el pago lo procesa{" "}
          <strong>Stripe</strong>. La suscripción se renueva automáticamente;
          puedes cambiar tu tarjeta o cancelar cuando quieras desde el portal de
          Stripe (botón “Administrar suscripción” dentro de la app). Si un cobro
          falla, conservas el acceso durante un breve{" "}
          <strong>periodo de gracia</strong> mientras se reintenta el cargo; si
          no se completa, la suscripción se cancela. Los reembolsos se gestionan
          a través de Stripe.
        </p>
        <p>
          Órale AI y sus planes están disponibles solo en{" "}
          <strong>México</strong>, con precios en MXN.
        </p>

        <h2>4. Funciones con IA</h2>
        <p>
          Las funciones con inteligencia artificial (armado de menú desde una
          foto, reportes) son de apoyo y pueden contener errores. Revisa siempre
          los resultados antes de usarlos. No garantizamos exactitud total en el
          contenido generado por IA.
        </p>

        <h2>5. Disponibilidad del servicio</h2>
        <p>
          El punto de venta del plan normal funciona sin conexión; algunas
          funciones (como la IA) requieren internet. Órale AI Pro requiere
          internet y WiFi del local para sincronizar varios dispositivos.
          Podemos actualizar, cambiar o descontinuar funciones para mejorar el
          producto.
        </p>

        <h2>6. Limitación de responsabilidad</h2>
        <p>
          Órale AI se ofrece “tal cual”. En la medida que la ley lo permita, no
          somos responsables por pérdidas de datos, lucro cesante o daños
          derivados del uso de la app. Recomendamos mantener respaldos de tu
          información.
        </p>

        <h2>7. Cambios a estos términos</h2>
        <p>
          Podemos actualizar estos términos. La versión vigente siempre estará
          publicada en esta página con su fecha de actualización.
        </p>

        <h2>8. Contacto</h2>
        <p>
          ¿Dudas sobre estos términos? Escríbenos por WhatsApp al{" "}
          <a
            href="https://wa.me/523331041584"
            target="_blank"
            rel="noopener noreferrer"
          >
            +52 333 104 1584
          </a>
          .
        </p>
      </main>

      <Footer />
    </>
  );
}
