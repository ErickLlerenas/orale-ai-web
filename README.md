# Órale AI — Web

Sitio de **Órale AI**: landing pública, aviso de privacidad, **Ver mi negocio**
(el dueño entra con Google y ve ventas en solo lectura) y un **dashboard admin**
que consume la analítica de uso anónima desde Supabase.

- **Framework:** Next.js (App Router) + TypeScript.
- **Hosting:** Vercel.
- **Datos:** tabla `usage_pings` en Supabase (la misma del proyecto de la app).

## Páginas

| Ruta | Qué es |
|---|---|
| `/` | Landing pública con footer y enlace a privacidad. |
| `/privacidad` | Aviso de privacidad (requerido por App Store / Play Store). |
| `/negocio` | Panel del dueño (Google). Misma lectura que en la app. |
| `/admin` | Dashboard de métricas. Protegido con Basic Auth. |

## Por qué Next.js (y no Vite)

El dashboard lee `usage_pings`, cuya tabla tiene **RLS cerrada**: solo el
`service_role` puede leerla. Ese key **no puede vivir en el navegador**, así que
la página `/admin` se renderiza en el servidor (Server Component) y el key vive
en una variable de entorno de Vercel. Next.js lo resuelve de forma nativa.

## Variables de entorno

Crea un `.env.local` (no se sube al repo) y llena:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # service role (secreto, solo servidor)
ADMIN_USER=admin
ADMIN_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # anon key pública (la misma de la app)
```

En Supabase → Authentication → URL Configuration:

- **Site URL:** el dominio de producción (`https://oraleai.vercel.app`). Si
  queda en `localhost`, el login de prod te manda a tu compu.
- **Redirect URLs:** `https://oraleai.vercel.app/negocio`,
  `http://localhost:3000/negocio` y `http://127.0.0.1:3000/negocio`.

> El `service_role` se saca en Supabase → Project Settings → API. Trátalo como
> contraseña maestra; nunca lo subas al repo.

## Correr local

```bash
npm install
npm run dev
# http://localhost:3000  (landing)
# http://localhost:3000/negocio  (Google)
# http://localhost:3000/admin    (pide usuario/contraseña)
```

## Desplegar en Vercel

1. Sube este folder a un repo de GitHub.
2. En Vercel: **New Project** → importa el repo.
3. Agrega las variables de entorno (las mismas de arriba).
4. Deploy. El panel del dueño queda en `tu-dominio.vercel.app/negocio`.
   El dashboard interno sigue en `/admin`.

## Seguridad del dashboard

`/admin` está protegido con Basic Auth vía `middleware.ts` (usuario/contraseña
por env). Es suficiente para un solo dueño. Si más adelante quieres algo más
robusto, se puede cambiar a Supabase Auth.


## Menú en línea y demo

- `/demo/pedidos`: demo pública con un restaurante ficticio. Funciona sin
  Supabase, sesión ni suscripción. Permite elegir presentaciones, salsa, extras,
  cantidades, notas y entrega; al finalizar muestra el mensaje de WhatsApp y permite abrirlo con el
  número de prueba introducido por el visitante. El visitante pulsa Enviar
  dentro de WhatsApp. No hay un número personal incluido en el código. Los datos introducidos permanecen en memoria y se
  descartan al recargar. No se enlaza desde la landing y lleva `noindex`.
- `/pedir/[slug]`: menú real publicado desde Órale. Requiere la función
  `online-store` del repositorio de la app y `SUPABASE_URL` (o
  `NEXT_PUBLIC_SUPABASE_URL`) en Vercel. Las credenciales de Apple/Google viven
  en Supabase, no en esta web. La demo no sustituye ni omite esa validación.
- `/api/menu/[slug]/pedido`: vuelve a consultar el menú vigente y valida
  precios, opciones, existencias y revisión antes de preparar el enlace.
  No registra una orden, cobra ni reserva inventario.

Para probar: `npm run dev`, abre `/demo/pedidos`, agrega tacos con salsa y
extras, abre el carrito, escribe tu número con código de país y un nombre de prueba, y pulsa
**Ver mensaje de WhatsApp**. Desde la vista del mensaje puedes abrir WhatsApp
para enviarte el pedido. Prueba también domicilio y quitar/cambiar cantidades.

Validación: `node scripts/test-online-store.mjs` y `npm run build`.

Fotos ilustrativas de la demo en Unsplash:
[Tai’s Captures](https://unsplash.com/photos/close-up-photography-of-food-JiRSy0GfqPA),
[Frankie Lopez](https://unsplash.com/photos/a-wooden-plate-topped-with-three-tacos-and-a-lime-_j4S4V2C8ew)
y [Spencer Davis](https://unsplash.com/es/fotos/tacos-en-bandeja-gris-bIZmLWPATeA).
