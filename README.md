# Órale AI — Web

Sitio de **Órale AI**: landing pública, aviso de privacidad y un **dashboard admin**
(solo para el dueño) que consume la analítica de uso anónima desde Supabase.

- **Framework:** Next.js (App Router) + TypeScript.
- **Hosting:** Vercel.
- **Datos:** tabla `usage_pings` en Supabase (la misma del proyecto de la app).

## Páginas

| Ruta | Qué es |
|---|---|
| `/` | Landing pública con footer y enlace a privacidad. |
| `/privacidad` | Aviso de privacidad (requerido por App Store / Play Store). |
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
ADMIN_PASSWORD=una_contraseña_fuerte
```

> El `service_role` se saca en Supabase → Project Settings → API. Trátalo como
> contraseña maestra; nunca lo subas al repo.

## Correr local

```bash
npm install
npm run dev
# http://localhost:3000  (landing)
# http://localhost:3000/admin  (pide usuario/contraseña)
```

## Desplegar en Vercel

1. Sube este folder a un repo de GitHub.
2. En Vercel: **New Project** → importa el repo.
3. Agrega las 4 variables de entorno (las mismas de arriba).
4. Deploy. El dashboard queda en `tu-dominio.vercel.app/admin`.

## Seguridad del dashboard

`/admin` está protegido con Basic Auth vía `middleware.ts` (usuario/contraseña
por env). Es suficiente para un solo dueño. Si más adelante quieres algo más
robusto, se puede cambiar a Supabase Auth.
