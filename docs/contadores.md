# Cierre mensual de Órale AI

El mes seleccionado es el mes del depósito o pago declarado por el preparador. El periodo original de ventas del archivo se conserva y no decide el mes del cierre. Subir un comprobante supone que se pagó en el mes elegido; no constituye una conciliación bancaria automática.

La vista conserva el diseño de estado de cuenta. Google Play, App Store y Stripe comparten seis renglones: ventas (total con IVA), IVA de ventas, comisión, IVA de comisión, IVA estimado y depósito. No se repite el ingreso después de comisión; los originales descargables conservan el detalle.

## Archivos y cálculo

- **Google Play:** subir únicamente `PlayApps_AAAAMM.csv` (Descargar informes → Financieros → Ingresos/Earnings; extraer el CSV del ZIP). La carga funciona sin reporte de actividades y se asigna al mes abierto, aunque el periodo del archivo sea anterior. Ventas, devoluciones, comisiones, IVA de comisión y neto provienen del detalle. El IVA de ventas mexicano se calcula con las operaciones individuales. El neto se muestra como «Neto del reporte» hasta que el pago tenga confirmación bancaria o del preparador; no se inventa fecha de depósito. Al sustituir un reporte antiguo de actividades, se exige coincidencia de importes y periodo, se conserva el pago y no se crea otro ingreso. Las versiones anteriores conservan el original antiguo.
- **App Store:** el CSV financiero conserva Earned, Input Tax, Adjustments, Withholding Tax y Proceeds. Se validan los totales en MXN. Adjustments no se reclasifica automáticamente como IVA a pagar. El detalle de ventas es opcional, se valida contra Earned y se conserva como documento complementario; solo se suman precios y monedas compatibles. Con el detalle mexicano se calcula un IVA estimado: IVA incluido en ventas menos 16% de la comisión derivada. El depósito conserva el importe recibido; el cálculo de IVA se identifica como estimado. No se altera el depósito para hacerlo coincidir con ese cálculo ni se asume que el ajuste del reporte es un impuesto. La factura de comisión descargada de Apple permite usar la comisión y su IVA reales; véase el apartado final. El impuesto de la comisión queda sujeto a su comprobante; retenciones y otros conceptos requieren su desglose.
- **Stripe:** CSV de movimientos en MXN. Admite cargos, devoluciones y Stripe Fee. Cada fila debe cumplir Amount - Fees = Net. Rechaza IDs duplicados y tipos desconocidos sin omitirlos. El IVA al 16% de ventas y comisiones es un desglose calculado para operaciones gravadas en México y debe contrastarse con sus comprobantes. No representa una declaración fiscal.
- **Mercado Libre Afiliados:** PDF del CFDI; conserva el subtotal, IVA trasladado, IVA retenido e ISR retenido. El UUID identifica el documento.
- **Cursor:** PDF de factura, importe original en USD; el modelo conserva aparte un cargo bancario en MXN cuando ya se haya registrado. Si falta, no se suma USD como si fueran pesos.
- **ChatGPT:** PDF de recibo; usa Amount paid, Date paid y número de factura. La tarjeta se obtiene del recibo cuando aparece.
- **Facebook Ads:** CSV Resumen_Facturación; conserva los cargos y el IVA reportados.
- **Google Ads:** XML del CFDI de prepago; conserva subtotal, IVA y total. UUID (o folio si no está presente) identifica la factura.
- **Supabase:** Receipt en PDF; conserva USD y tarjeta cuando esté documentada.
- **Google Cloud:** ZIP mensual de Facturas → Prepago: AI Studio, incluyendo Documentos relacionados. Se leen los CFDI XML en MXN de GOOGLE CLOUD MEXICO, se deduplican por UUID y se valida subtotal + IVA = total. Los PDF repetidos no se suman. Las notas relacionadas de tipo 02 y notas de crédito se conservan como ajustes fuera de los cargos; otras relaciones requieren revisión. La tarjeta se confirma aparte cuando no viene en el documento.

## Registro y conservación

La carga guarda archivo y asignación mensual en una sola operación. Los comprobantes se identifican por número o UUID, no únicamente por fecha, para admitir varias compras el mismo día. Reimportar un documento en otro mes se rechaza para evitar registrarlo dos veces. La vista compacta no incluye un formulario para cambiar asignaciones existentes. El reemplazo de contenido distinto requiere confirmación. Reimportar un archivo idéntico conserva fecha, tarjeta, cargo en pesos y detalles adjuntos. Al reemplazar un reporte cambiado, el detalle previo se invalida para evitar cifras obsoletas.

Los reportes agregados mensuales (Play, Apple, Facebook y Stripe) conservan una versión vigente por plataforma y periodo; para varios pagos de Stripe debe subirse el reporte consolidado de movimientos que respalda el mes. No subir exportaciones parciales esperando que se acumulen. Los recibos individuales se acumulan por identificador.

El modelo permite conservar mes, importe y fecha bancaria, además de los cuatro últimos dígitos de tarjeta. La API conserva estos datos si ya existen; la vista compacta no agrega formularios. Las etiquetas Personal y Negocio siguen la asignación indicada por el preparador. La sección Estado de cuenta sigue pendiente de un importador bancario.

Cursor muestra USD mientras no haya un cargo documentado en MXN; no se mezclan las monedas. El IVA desglosado en gastos es el reportado, sin asumir automáticamente su acreditamiento. No se presenta un total fiscal definitivo mientras falten clasificación de ajustes, acreditamientos o saldos a favor. Sí se muestra el cálculo estimado que permiten los archivos disponibles. RESICO no hace que toda retención, comisión o ajuste pueda tratarse igual.

Se conservan los originales y versiones privadas en Supabase Storage o en ACCOUNTING_LOCAL_DATA_DIR durante pruebas. Los datos existentes se normalizan en lectura sin sobrescribir el histórico. Las escrituras exigen sesión de propietario y control de versión. No se deben incluir documentos personales en Git.

## Fuentes consultadas (29 de septiembre de 2026)

- Google: precios con impuestos incluidos, responsabilidad del desarrollador mexicano e IVA de comisión: https://support.google.com/googleplay/android-developer/answer/138000?hl=en
- Apple: significado de impuestos, ajustes y Proceeds: https://developer.apple.com/help/app-store-connect/reference/reporting/payment-information/
- Apple: Exhibits to Schedule 2 and 3, 27 de agosto de 2026, Exhibit B (México) y Exhibit C, apartado 9: https://developer.apple.com/support/downloads/terms/exhibits/Exhibits-to-Schedule-2-and-3-English.pdf
- Stripe: IVA de comisiones en México y emisión de CFDI: https://support.stripe.com/questions/taxes-on-stripe-fees-for-mexico-based-businesses?locale=es-ES
- SAT, LIVA artículo 5, requisitos de acreditamiento: https://wwwmat.sat.gob.mx/articulo/46936/articulo-5

Apple distingue el IVA entregado al desarrollador del remitido a la autoridad y cobra IVA sobre comisiones a desarrolladores mexicanos. La etiqueta genérica Adjustments no permite inferir por sí sola ese desglose.

## Verificación

`node --test scripts/test-accounting.mjs scripts/test-apple.mjs scripts/test-stripe.mjs scripts/test-google.mjs scripts/test-facebook.mjs scripts/test-mercado.mjs scripts/test-cursor.mjs scripts/test-chatgpt.mjs scripts/test-earnings.mjs scripts/test-receipts.mjs scripts/test-monthly-accounting.mjs`

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

Las regresiones prueban varios recibos el mismo día, reimportación sin duplicados ni cambio accidental de mes, importes bancarios y monedas, pagos de Play con saldo final cero, IVA incluido con detalle coincidente, IVA estimado de Apple independiente de sus ajustes, devoluciones Stripe y carga atómica por API con almacenamiento aislado en memoria.

## Factura de comisión de Apple

Se acepta `MexicoCommissionInvoice-MM-AAAA-VENDOR.pdf` desde el mismo botón Subir archivo. Se adjunta al reporte financiero del mismo periodo que ya esté asignado al mes seleccionado; no crea otro ingreso ni altera el depósito. Valida mes e importe de Partner Revenue, conserva el PDF y toma Apple Commission y VAT Adjustment on Commission (MXN) como importes oficiales. Estas cifras tienen prioridad sobre la comisión derivada del detalle de ventas; reimportar el detalle no las reemplaza.

Con detalle de ventas mexicanas y una factura de comisión coincidente, la base se reconstruye como Partner Revenue + Apple Commission. Apple define Partner Share como precio al cliente menos impuestos y comisión: https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-fields/. El IVA de ventas se obtiene restando esa base al precio total cobrado. Así se conservan los importes de Apple sin imponer otro redondeo al 16%. Adjustments no interviene en el cálculo ni se reclasifica automáticamente para futuros meses.

Para el depósito del 3 de septiembre de 2026, los documentos fiscales de julio permiten reconstruir: base $2,999.72 + $529.42 = $3,529.14; IVA de ventas $4,093.77 - $3,529.14 = $564.63; menos IVA de comisión $84.71 = $479.92. El resultado coincide con el ajuste de Apple de forma independiente. El cálculo anterior daba $480.01 porque extraía $564.72 de IVA redondeando cada renglón; al calcular sobre el total da $564.66. Esto explica 6 de los 9 centavos. Los 3 restantes son la diferencia entre recalcular al 16% y reconstruir los importes de Apple; los reportes no documentan su algoritmo interno de redondeo.

La factura de agosto descargada el 29 de septiembre informa Partner Revenue $13,821.70, comisión $2,439.42 e IVA de comisión $390.31. El resumen de agosto tiene Earned $13,967.52 y ajustes $2,238.73, con pago estimado para el 1 de octubre. La diferencia de $145.82 coincide con Partner Share de una suscripción de $199, pero el PDF no identifica la operación ni su causa. La validación rechaza adjuntar esta factura a ese resumen: no se mezclan importes distintos ni se registra un depósito de octubre en septiembre.

El campo Total Amount de esta factura se conserva por separado ($3,528.72); no se trata como base de ventas ni se usa para forzar una igualdad con Partner Revenue y Apple Commission.

## Supabase

Usar el PDF **Receipt**: incluye fecha de pago, total pagado y el mismo detalle del Invoice. El Invoice solo indica un importe por pagar y se rechaza como comprobante de pago para esta vista. Se identifica cada gasto por su número de factura para evitar duplicados, conservando el PDF y asignándolo al mes abierto al subirlo.

El recibo AZSTCI-00012 confirma $27 USD pagados el 20 de septiembre de 2026 ($25 de Pro Plan y $2 de consumo adicional). No muestra tarjeta ni desglosa IVA; no se inventan esos datos. Supabase confirma que emite sus facturas en USD: https://supabase.com/docs/guides/platform/billing-faq. El importe permanece en USD, igual que los demás comprobantes en dólares, sin convertirlo ni sumarlo como pesos. Si un recibo futuro incluye tarjeta, se muestra la terminación o Personal/Negocio cuando coincide con 0698/6271.

Para este recibo, el usuario confirmó la tarjeta personal Nu terminación 0698. Se conserva en los datos del pago con origen user, sin atribuírsela al PDF ni guardar su vencimiento.

## ZIP mensual

Google Cloud acepta un ZIP sin descomprimir: toda la carga se valida antes de guardar, sin duplicar cobros al reimportar. Los importes permanecen en centavos enteros. El mes lo selecciona el usuario.

## Estado de cuenta Banamex

En Estado de cuenta → Negocio, Subir Banamex acepta el PDF Switch del corte y los dos Excel originales de movimientos. Los originales se conservan en almacenamiento privado, por mes, con el mismo control de acceso de contabilidad. El lector valida cada saldo del Excel y el detalle del PDF contra su resumen antes de guardar el lote. Las filas compartidas por los archivos no se duplican. El detalle del PDF queda disponible para identificar depósitos, conservando la descripción del Excel en pantalla.

La tabla muestra Fecha, Descripción, Depósitos, Retiros y Saldo, de más reciente a más antiguo, filtrados por la fecha bancaria del mes abierto. Un cargo sin saldo informado conserva la celda vacía; se incluye en el total de retiros de la tabla, pero no se inventa un saldo posterior. Personal/Nu permanece sin cargar hasta su revisión. La presentación replica la exportación sin diagnósticos ni explicaciones visibles.

Lectores: read-excel-file y PDF.js 5.6.205 (compatible con Node 20.19). El lector bancario PDF se mantiene separado del lector previo de comprobantes para conservar los formatos ya validados.
