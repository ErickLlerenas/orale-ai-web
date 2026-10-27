import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Aviso de privacidad · Órale AI",
};

export default function Privacy() {
  return (
    <>
      <Nav>
        <a href="/">Inicio</a>
      </Nav>

      <main className="prose">
        <h1>Aviso de privacidad</h1>
        <p className="muted">Última actualización: octubre 2026</p>

        <p>
          Órale AI es un punto de venta para iPhone/iPad, Android, Windows y Mac.
          En el <strong>plan Órale AI</strong>, la información de tu negocio (menú,
          ventas, equipo, clientes) se guarda{" "}
          <strong>localmente en tu dispositivo</strong>. No la vendemos a
          nadie.
        </p>
        <p>
          Si activas varios meseros con <strong>Órale AI Pro</strong>,
          sincronizamos en nuestros servidores{" "}
          <strong>solo lo necesario</strong> para que varios dispositivos
          operen el mismo negocio: menú, personal (nombre, rol y PIN de acceso)
          y órdenes abiertas. El historial de ventas, caja y clientes sigue
          principalmente en tu dispositivo. Al dejar de usar Pro, ese acceso
          compartido deja de estar activo.
        </p>
        <p>
          En <strong>Windows</strong>, para gestionar la suscripción creas una
          cuenta iniciando sesión con Google. En ese caso guardamos{" "}
          <strong>únicamente</strong> los datos de tu cuenta (correo) y el
          estado de tu pago; <strong>nunca</strong> usamos el contenido de tu
          negocio para publicidad.
        </p>

        <h2>1. Qué datos tratamos</h2>
        <p>
          <strong>Contenido de tu negocio (en tu dispositivo):</strong> tu menú,
          tus ventas y tu equipo viven en la tablet o celular. Solo tú tienes
          acceso en el plan Órale AI. Si creas un respaldo, el archivo queda bajo
          tu control en el lugar que tú elijas.
        </p>
        <p>
          <strong>Órale AI Pro (sincronización):</strong> para unir varios
          dispositivos usamos un código de negocio y tokens de dispositivo. En
          nuestros servidores (Supabase) guardamos el menú compartido, el
          personal asociado al negocio y las órdenes abiertas mientras el plan
          Pro esté activo. No usamos esos datos para publicidad ni los vendemos.
        </p>
        <p>
          <strong>Órale AI Pro (tienda en línea):</strong> al activar Negocio en línea,
          publicas el nombre, teléfono, dirección y catálogo que configures, con precios
          y fotos. Cualquier persona con el enlace puede consultar el menú mientras
          esté disponible. Conservamos una copia en Supabase para servirlo con la app
          cerrada. El nombre, teléfono, domicilio y notas que el comprador ingresa
          se usan para preparar su mensaje de WhatsApp; no los guardamos como pedidos
          en nuestra base de datos. El comprador decide enviarlo al negocio.
          Puedes pausar la tienda desde Ajustes; las imágenes ya públicas pueden
          seguir disponibles mediante sus enlaces.
        </p>
        <p>
          <strong>Analítica de uso y soporte:</strong> para mejorar la app y
          poder ayudarte cuando nos escribes, recopilamos una vez al día: un
          identificador aleatorio de instalación, el{" "}
          <strong>nombre de tu negocio</strong> (el que pones en Ajustes para
          el ticket), el identificador de tu compra en la tienda, número de
          ventas y rango del monto del día, número de productos, versión de la
          app, plataforma y si estás en prueba o suscrito. No recopilamos tu
          correo, tu teléfono ni tu ubicación con este fin.{" "}
          <strong>Nunca</strong> recopilamos los detalles de tus ventas ni datos
          de tus clientes finales con fines de analítica, y no usamos estos
          datos para publicidad ni los vendemos.
        </p>
        <p>
          <strong>Funciones con IA:</strong> cuando usas el armado de menú con
          IA, la foto de tu menú se procesa a través de nuestro servidor con un
          proveedor de IA (Google Gemini) solo para generar tus productos.
          Cuando pides un reporte con IA, enviamos estadísticas{" "}
          <strong>agregadas</strong> de ventas (totales, productos más
          vendidos), nunca datos personales de clientes.
        </p>
        <p>
          <strong>Pagos y cuenta:</strong> en iPhone, iPad y Android la
          suscripción (plan Órale AI o Pro) se procesa por App Store (Apple) o
          Google Play, y no vemos ni guardamos los datos de tu tarjeta. En{" "}
          <strong>Windows</strong>, inicias sesión con tu cuenta de Google para
          gestionar la suscripción: guardamos tu <strong>correo</strong>, un
          identificador de cuenta y el{" "}
          <strong>estado de tu suscripción</strong> (plan y vigencia) en
          nuestro proveedor de servidores (Supabase). El pago lo procesa{" "}
          <strong>Stripe</strong>; los datos de tu tarjeta los maneja Stripe,
          nosotros no los vemos ni guardamos.
        </p>

        <h2>2. Resumen estilo “App Privacy”</h2>
        <table>
          <thead>
            <tr>
              <th>Dato</th>
              <th>Para qué</th>
              <th>¿Vinculado a tu identidad?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ID de instalación (aleatorio)</td>
              <td>Analítica de uso, medir adopción</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>Nombre del negocio</td>
              <td>Analítica y soporte</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>ID de compra en la tienda</td>
              <td>Analítica de suscripciones y soporte</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>Datos de uso (ventas del día, productos)</td>
              <td>Mejorar el producto</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>Diagnóstico (versión, plataforma)</td>
              <td>Estabilidad y compatibilidad</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>Contenido del negocio (plan Órale AI)</td>
              <td>Funcionamiento del POS (solo en tu dispositivo)</td>
              <td>No se recopila</td>
            </tr>
            <tr>
              <td>Menú, personal y órdenes abiertas (solo Pro)</td>
              <td>Sincronizar varios dispositivos del mismo negocio</td>
              <td>Asociado al negocio / dispositivo</td>
            </tr>
            <tr>
              <td>Correo y cuenta de Google (solo Windows)</td>
              <td>Crear tu cuenta y gestionar la suscripción</td>
              <td>Sí</td>
            </tr>
            <tr>
              <td>Estado de suscripción (solo Windows)</td>
              <td>Dar acceso a la app</td>
              <td>Sí</td>
            </tr>
          </tbody>
        </table>

        <h2>3. Qué NO hacemos</h2>
        <ul>
          <li>
            No vendemos ni compartimos tus datos con terceros para publicidad.
          </li>
          <li>
            No recopilamos datos de tus clientes finales para publicidad o
            analítica de marketing.
          </li>
          <li>No rastreamos tu ubicación.</li>
        </ul>

        <h2>4. Tus opciones</h2>
        <p>
          En el plan Órale AI, como la información vive en tu dispositivo, puedes
          eliminarla desinstalando la app. La analítica incluye el nombre de tu
          negocio para darte soporte; puedes pedirnos que borremos esos datos
          escribiéndonos por WhatsApp.
        </p>
        <p>
          Si usas <strong>Órale AI Pro</strong>, puedes dejar de sincronizar
          cancelando Pro o dejando de usar el código de negocio; puedes
          solicitarnos la eliminación de los datos de sincronización del
          negocio escribiéndonos por WhatsApp.
        </p>
        <p>
          Si usas Órale AI en <strong>Windows</strong> con una cuenta, puedes
          cancelar tu suscripción desde el portal de Stripe y solicitar la
          eliminación de los datos de tu cuenta (correo y estado de
          suscripción) escribiéndonos por WhatsApp.
        </p>

        <h2>5. Contacto</h2>
        <p>
          ¿Dudas sobre privacidad? Escríbenos por WhatsApp al{" "}
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
