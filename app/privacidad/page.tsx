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
        <p className="muted">Última actualización: junio 2026</p>

        <p>
          Órale AI es un punto de venta que funciona <strong>sin conexión</strong>.
          La información de tu negocio (menú, ventas, equipo, clientes) se guarda{" "}
          <strong>localmente en tu dispositivo</strong>. No la almacenamos en
          nuestros servidores ni la vendemos a nadie.
        </p>

        <h2>1. Qué datos tratamos</h2>
        <p>
          <strong>Contenido de tu negocio (en tu dispositivo):</strong> tu menú,
          tus ventas y tu equipo viven en la tablet. Solo tú tienes acceso. Si
          creas un respaldo, el archivo queda bajo tu control en el lugar que tú
          elijas.
        </p>
        <p>
          <strong>Analítica de uso (anónima):</strong> para mejorar la app
          recopilamos métricas <strong>agregadas y anónimas</strong>: un
          identificador aleatorio de instalación (sin tu nombre ni correo),
          número de ventas y monto del día, número de productos, versión de la
          app, plataforma y si estás en prueba o suscrito. <strong>Nunca</strong>{" "}
          recopilamos los detalles de tus ventas ni datos de tus clientes.
        </p>
        <p>
          <strong>Funciones con IA:</strong> cuando usas el armado de menú con
          IA, la foto de tu menú se procesa a través de nuestro servidor con un
          proveedor de IA (Google Gemini) solo para generar tus productos.
          Cuando pides un reporte con IA, enviamos estadísticas{" "}
          <strong>agregadas</strong> de ventas (totales, productos más vendidos),
          nunca datos personales de clientes.
        </p>
        <p>
          <strong>Pagos:</strong> la suscripción se procesa por App Store
          (Apple) o Google Play. Nosotros no vemos ni guardamos los datos de tu
          tarjeta.
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
              <td>Contenido del negocio</td>
              <td>Funcionamiento del POS (solo en tu dispositivo)</td>
              <td>No se recopila</td>
            </tr>
          </tbody>
        </table>

        <h2>3. Qué NO hacemos</h2>
        <ul>
          <li>No vendemos ni compartimos tus datos con terceros para publicidad.</li>
          <li>No recopilamos datos de tus clientes finales.</li>
          <li>No rastreamos tu ubicación.</li>
        </ul>

        <h2>4. Tus opciones</h2>
        <p>
          Como la información vive en tu dispositivo, puedes eliminarla
          desinstalando la app. La analítica es anónima y no permite
          identificarte personalmente.
        </p>

        <h2>5. Contacto</h2>
        <p>
          ¿Dudas sobre privacidad? Escríbenos a{" "}
          <a href="mailto:hola@oraleai.com">hola@oraleai.com</a>.
        </p>
      </main>

      <Footer />
    </>
  );
}
