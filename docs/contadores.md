# Cierre mensual de Google Play

## Acceso y puesta en marcha

- Ruta: `/contadores`. No enlazada desde la landing ni incluida en sitemap; robots y respuestas llevan noindex.
- Preparador: `ADMIN_USER` / `ADMIN_PASSWORD` existentes. Puede cargar, vincular, guardar notas y publicar.
- Contadores: nuevas variables **solo servidor** `CONTADORES_USER` (por defecto `contadores`) y `CONTADORES_PASSWORD`. Usar una contraseña larga distinta de admin y entregarla por separado del enlace.
- La contraseña del contador solo permite GET: las escrituras se verifican también dentro del handler, no solo en middleware. No compartir la clave admin.
- Basic Auth usa el diálogo nativo del navegador. Para probar otro rol, utilizar otro perfil o una ventana privada. Producción requiere HTTPS.
- El cliente Supabase requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La key nunca llega al cliente.
- El primer guardado crea el bucket **privado** `accounting-private` (sin políticas anónimas). Si ya existe como público, se rechaza el acceso. No configurar políticas públicas de Storage para ese bucket.
- Los originales se guardan dentro del JSON privado junto a los datos derivados. Nunca se guardan en Git ni en `/public`.
- No requiere migración SQL. Los borradores y publicaciones se guardan como nuevas versiones inmutables. El último nombre temporal de cada carpeta es la versión vigente.
- Alcance inicial: un preparador. Se detectan versiones obsoletas al guardar; no existe bloqueo transaccional entre dos escrituras exactamente simultáneas. No editar a la vez en varias pestañas. Las versiones previas permanecen recuperables en Storage.

## Flujo mensual

1. El titular abre `/contadores` con el acceso de admin.
2. Carga los CSV originales `account_activities_AAAAMM.csv`, en español y MXN. Límite 2 MB por archivo, 120 periodos y 3.5 MB por guardado.
3. Elige el **mes del pago registrado por Google**, no necesariamente el periodo de ventas ni la fecha bancaria.
4. Vincula explícitamente el reporte de operaciones con el pago. La app comprueba la aritmética y compara el saldo final con el pago; no inventa la relación.
5. Puede informar la fecha de recepción bancaria y añadir notas. Esa fecha es una declaración del preparador, no una verificación contra un estado de cuenta.
6. Publica el cierre. El contador ve una copia publicada, no el borrador en edición. No permite publicar reportes con descuadres aritméticos; los otros pendientes se muestran, no se ocultan.
7. Envía `https://oraleai.vercel.app/contadores?mes=2026-09&vista=publicado` y la contraseña de lector por separado. Las futuras publicaciones del mismo mes actualizan lo que ve ese enlace.
8. El contador puede descargar el CSV del resumen, los originales vinculados e imprimir. No puede cargar ni modificar archivos.

## Límites contables

RESICO es contexto declarado, no una clasificación tributaria implementada. No se calcula IVA, ISR, acreditamiento ni retenciones. Se conservan literalmente abonos, cargos e IVA reportado. No se asume que el cargo negativo sea una comisión, que el abono sea venta sin IVA, ni que el depósito sea base fiscal. Los informes de actividades no sustituyen informes detallados, comprobantes de comisiones o estados de cuenta.

Los saldos inicial/final son saldos, no ingresos. Los pagos son salidas del saldo de Google y se presentan positivos solo en el resumen de pagos. Los CSV sin operaciones no significan ventas cero. Si varios pagos se vinculan al mismo origen, sus totales de origen no son aditivos; el CSV lo advierte.

App Store, Stripe y Mercado Libre están pendientes, sin datos ni importadores ficticios. La carga de estados de cuenta no forma parte de esta entrega.

## Verificación local

`node --test scripts/test-accounting.mjs`

`yarn build`

Para una prueba aislada sin Supabase, iniciar Next en desarrollo con `ACCOUNTING_LOCAL_DATA_DIR` apuntando a una carpeta temporal fuera del repo, y credenciales temporales de admin/contador en variables del proceso. Este modo se ignora en producción y muestra una advertencia visible. Los datos locales no se migran automáticamente a producción.

Las contraseñas y el despliegue deben configurarse en Vercel. Este documento no implica que la ruta ya esté publicada.
