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
        <p className="muted">Última actualización: julio 2026</p>

        <p>
          Órale AI es un punto de venta para iPhone/iPad, Android y Windows. En
          el <strong>plan normal</strong>, la información de tu negocio (menú,
          ventas, equipo, clientes) se guarda{" "}
          <strong>localmente en tu dispositivo</strong>. No la vendemos a
          nadie.
        </p>
        <p>
          Si contratas <strong>Órale AI Pro</strong> (varios meseros),
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
          acceso en el plan normal. Si creas un respaldo, el archivo queda bajo
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
          <strong>Analítica de uso (anónima):</strong> para mejorar la app
          recopilamos métricas <strong>agregadas y anónimas</strong>: un
          identificador aleatorio de instalación (sin tu nombre ni correo),
          número de ventas y monto del día, número de productos, versión de la
          app, plataforma y si estás en prueba o suscrito. <strong>Nunca</strong>{" "}
          recopilamos los detalles de tus ventas ni datos de tus clientes
          finales con fines de analítica.
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
          suscripción (plan normal o Pro) se procesa por App Store (Apple) o
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
              <td>No</td>
            </tr>
            <tr>
              <td>Datos de uso agregados</td>
              <td>Mejorar el producto</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Diagnóstico (versión, plataforma)</td>
              <td>Estabilidad y compatibilidad</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Contenido del negocio (plan normal)</td>
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
          En el plan normal, como la información vive en tu dispositivo, puedes
          eliminarla desinstalando la app. La analítica es anónima y no permite
          identificarte personalmente.
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
