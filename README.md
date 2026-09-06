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

Copia `.env.example` a `.env.local` y llena:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # service role (secreto, solo servidor)
ADMIN_USER=admin
ADMIN_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # anon key pública (la misma de la app)
```

En Supabase → Authentication → URL Configuration, agrega a Redirect URLs:
`https://tu-dominio/negocio`, `http://localhost:3000/negocio` y
`http://127.0.0.1:3000/negocio`.

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
