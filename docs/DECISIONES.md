# Decisiones de arquitectura (ADR resumidos) — MZL Parchado

## ADR-01 · Stack adaptado al entorno
El prompt recomienda NestJS + Prisma. El entorno de ejecución provisto es **Next.js 16 (App Router) + PostgreSQL + Drizzle ORM**
con un único proceso que se construye, arranca y valida con `/api/health`. Para no introducir un segundo servidor que la plataforma
no puede orquestar, se decidió:
- **Backend**: API REST versionada en `/api/v1/*` implementada con un router propio (`src/app/api/v1/[...path]/route.ts`)
  que despacha a módulos con responsabilidades separadas (`src/server/modules/*`): validación Zod (equivalente a DTOs),
  guards (`requireUser`, `requireAdmin`, `requireOrganizer`), servicios y control de errores uniforme.
- **ORM**: Drizzle (equivalente a Prisma). Esquema versionado en `src/db/schema.ts`; se aplica con `npx drizzle-kit push`
  o se generan migraciones SQL con `npx drizzle-kit generate`.
- **Contratos tipados**: los esquemas Zod de `src/lib/validation.ts` se comparten entre formularios y servidor.
- React Hook Form / TanStack Query / shadcn no se añadieron: los formularios usan Zod + estado React y los datos se cargan
  por Server Components; se evita peso de dependencias. Iconos: Lucide.

## ADR-02 · Autenticación
- Sesiones opacas en BD (tabla `sessions`); el navegador recibe un token aleatorio de 32 bytes en cookie `mzl_session`
  HttpOnly, SameSite=Lax, Secure en producción, Path=/, 30 días. En BD sólo se guarda el **SHA-256** del token.
- Contraseñas con **Argon2id** (`@node-rs/argon2`, m=19 MiB, t=2, p=1 — parámetros OWASP).
- CSRF: cookie SameSite=Lax + verificación obligatoria de cabecera `Origin`/`Sec-Fetch-Site` en toda petición mutante.
- Limitación de intentos en BD (`rate_limits`) por IP y por correo (login, registro, recuperación, subidas, reportes, solicitudes).
- Mensajes neutros: registro/recuperación no revelan si un correo existe.
- Tokens de verificación/restablecimiento: aleatorios, guardados como hash, de un solo uso, 24 h / 30 min.

## ADR-03 · Roles
`users.role` ∈ {user, admin}. "Organizador verificado" = `users.is_verified_organizer`, que sólo cambia un admin vía
`/api/v1/admin/verifications/:id` o revocación; cada cambio crea `audit_logs` con estado anterior/nuevo y justificación.
Ningún endpoint acepta `role` o `verified` del cliente (los esquemas Zod son estrictos: `.strict()`).
Primer administrador: `npx tsx scripts/promote-admin.ts correo@dominio` (requiere acceso a la BD; no hay cuenta admin por defecto).

## ADR-04 · Política de eventos verificados
Verificar a un organizador ≠ aprobar sus eventos. **Todo evento verificado entra como `pending_review`** y un administrador
lo publica. Los parches comunitarios se publican directamente y quedan sujetos a moderación posterior/reportes.
Al revocar una verificación, los eventos verificados futuros vuelven a `pending_review` (dejan de ser visibles) y se pierde el
permiso de crear nuevos.

## ADR-05 · Demo pública
La demo (`/demo`) usa un **dataset estático versionado** (`src/lib/demo-data.ts`) con fechas relativas. No consulta la BD,
no crea sesión ni cuenta, y sus acciones sólo muestran un mensaje. Los endpoints de escritura exigen sesión real, así que
una petición manipulada desde la demo recibe 401/403. Los eventos "institucionales" están etiquetados como ficticios.

## ADR-06 · Fotografías
Proveedor por defecto: almacenamiento en PostgreSQL (`media`, bytea) tras **re-codificar** con `sharp` a WebP 512×512
(elimina metadatos EXIF/GPS y cualquier payload). Se valida firma real (magic bytes), tamaño ≤ 3 MB, dimensiones
≥128 px y ≤ 6000 px. Si existen `CLOUDINARY_*`, se sube la imagen ya saneada a Cloudinary con firma generada en servidor
(subida server-side, así el secreto nunca llega al navegador) y se elimina el recurso anterior; si Cloudinary falla se
devuelve error y no se modifica el perfil (sin huérfanos en BD).

## ADR-07 · Mapas
OpenStreetMap + Leaflet (sin clave). Agrupación de marcadores por cuadrícula propia (sin plugin), consulta por bbox
acotada (`limit` 200) con debounce. Límite geográfico configurable con `GEO_BOUNDS` (por defecto el área de Manizales).

## ADR-08 · Correo
Si `RESEND_API_KEY` y `EMAIL_FROM` existen se envía con la API de Resend. Si no, el mensaje se guarda en la tabla
`email_outbox` (sólo accesible con acceso directo a la BD) — herramienta de desarrollo que no expone enlaces por HTTP.
La verificación de correo es requisito para solicitar verificación de organizador.

## ADR-09 · Barrios
Lista inicial de barrios/sectores conocidos de Manizales marcada como **no oficial y administrable** desde el panel admin.
Debe validarse contra la división político-administrativa publicada por la Alcaldía (comunas y corregimientos).

## ADR-10 · Coordenadas de lugares
Las coordenadas de lugares semilla son aproximadas (±150 m) y editables por administradores.
