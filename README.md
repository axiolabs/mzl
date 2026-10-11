# MZL Parchado — «Menos pantalla, más parche»

Plataforma social full-stack para descubrir planes y conectar personas en **Manizales, Caldas, Colombia**.

## 1. Arquitectura
- **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4**: páginas renderizadas en servidor (Server Components) y componentes cliente para formularios/mapa.
- **API REST versionada** `/api/v1/*` (router propio en `src/app/api/v1/[...path]/route.ts`) con módulos separados: `auth`, `plans`, `social`, `admin` (`src/server/modules`). Validación Zod estricta (equivalente a DTOs), guards (`requireUser`, `requireAdmin`), CSRF por `Origin`, rate limiting en BD, errores uniformes `{ error: { code, message, fields } }`.
- **PostgreSQL + Drizzle ORM** (`src/db/schema.ts`), migraciones SQL versionadas en `drizzle/`.
- **Sesiones opacas** en BD (cookie HttpOnly), **Argon2id** para contraseñas.
- **Mapa**: Leaflet + OpenStreetMap (sin clave). **Fotos**: `sharp` + PostgreSQL o Cloudinary (firmado en servidor). **Correo**: Resend o outbox en BD.
- Por qué no NestJS/Prisma: ver `docs/DECISIONES.md` (ADR-01). El entorno ejecuta un único proceso Next.js.

## 2. Estructura
```
src/
  app/                    Rutas (públicas, /app autenticada, /demo, /api)
    api/v1/[...path]/     Router REST versionado
    app/                  Área autenticada (layout protegido): inicio, crear, mis-parches, solicitudes,
                          favoritos, notificaciones, perfil, configuracion, organizador, admin
    demo/                 Demo pública de solo lectura (dataset estático)
    info/[slug]/          Acerca, cómo funciona, seguridad, FAQ, términos, privacidad, cookies
  components/             UI (ui.tsx), mapa, formularios, paneles
  db/                     Conexión y esquema Drizzle
  lib/                    Lógica pura compartida: validación, permisos, geo, imágenes, recomendaciones, demo
  server/                 Núcleo servidor (sesiones, CSRF, rate limit, auditoría, correo), consultas, seed
scripts/                  seed.ts, seed-dev.ts, promote-admin.ts
tests/unit, tests/integration
drizzle/                  Migraciones SQL generadas
docs/DECISIONES.md, docs/SEGURIDAD.md, TASKS.md
```

## 3. Funcionalidades
Registro (ciudad fija, barrio administrable, +18, términos), login/logout, verificación de correo, recuperación de
contraseña (token 30 min, un solo uso, revoca sesiones), cambio de contraseña, gestión/revocación de sesiones,
eliminación de cuenta; perfiles con foto subida desde el dispositivo (sin catálogo de avatares), intereses y privacidad;
parches comunitarios (CRUD, borrador, cancelación con aviso, eliminación sólo sin solicitudes activas); eventos verificados
(revisión previa obligatoria); solicitudes con transacción + `SELECT … FOR UPDATE` + `CHECK` de cupos; favoritos con
actualización optimista y reversión; notificaciones internas; reportes; bloqueos; recomendaciones explicables; mapa con bbox,
agrupación, filtros, búsqueda de lugares y vista lista; panel de organizador con estadísticas; panel admin (resumen,
usuarios, verificaciones, moderación, reportes, categorías/barrios/lugares, apelaciones, auditoría); demo pública.

## 4. Esquema de base de datos
`barrios`, `categories`, `places`, `users` (rol `user|admin`, `is_verified_organizer`, estado), `user_preferences`,
`user_interests`, `sessions` (hash del token), `auth_tokens` (hash, expiración, uso único), `rate_limits`, `media`,
`plans` (tipo, estado, visibilidad, `CHECK accepted_count <= capacity`), `plan_participations` (único por plan+usuario),
`favorites`, `notifications`, `reports`, `blocks`, `organizer_verifications` (índice único parcial: una pendiente por usuario),
`appeals`, `audit_logs` (actor, antes, después, justificación), `email_outbox`. Ver `src/db/schema.ts` y `drizzle/0000_init.sql`.

## 5. Variables de entorno
Ver `.env.example`. Obligatoria: `DATABASE_URL`. Opcionales: `APP_URL`, `COOKIE_SECURE`, `GEO_BOUNDS`,
`RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Ninguna variable secreta lleva prefijo `NEXT_PUBLIC_`.

## 6. Instalación y ejecución
```bash
docker compose up -d            # PostgreSQL local (o usa tu propia instancia)
cp .env.example .env            # y completa DATABASE_URL
npm install
npx drizzle-kit push            # o: npx drizzle-kit migrate (usa drizzle/)
npx tsx scripts/seed.ts         # datos de referencia (idempotente; también corre al arrancar)
npx tsx scripts/seed-dev.ts     # OPCIONAL, sólo desarrollo: usuarios/planes ficticios sin credenciales
npm run dev                     # http://localhost:3000
npm run build && npm start      # producción
```
**Primer administrador**: registra una cuenta y ejecuta `npx tsx scripts/promote-admin.ts tu@correo` (requiere acceso a BD).
No existe ninguna cuenta admin ni credencial compartida por defecto.

## 7. Migraciones y seed
- Cambios de esquema: editar `src/db/schema.ts` → `npx drizzle-kit generate --name <cambio>` → `npx drizzle-kit migrate`.
- El seed de referencia es **no destructivo** (`onConflictDoNothing`). El seed de desarrollo se niega a correr con
  `NODE_ENV=production` o `APP_ENV=production`. Ningún seed borra datos.
- Probar correo sin proveedor: `psql "$DATABASE_URL" -c "select to_address, subject, body from email_outbox order by id desc limit 5"`.

## 8. Servicios externos
- **Correo (Resend)**: crear cuenta en resend.com, verificar dominio, crear API key → `RESEND_API_KEY`, `EMAIL_FROM="MZL Parchado <no-reply@tu-dominio>"`.
- **Cloudinary**: Dashboard → *API Keys* → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
  La subida se firma en el servidor tras sanear la imagen; el secreto nunca llega al navegador.
- **Mapas**: OpenStreetMap no requiere clave. Para tráfico alto, usar un proveedor de teselas con clave (Mapbox/MapTiler)
  cambiando la URL en `src/components/map-inner.tsx` y añadiendo el dominio a la CSP (`next.config.ts`).
Estado actual de integraciones: visible en Administración → Resumen.

## 9. Pruebas
```bash
npx vitest run tests/unit                                    # 18 pruebas de lógica
npx next start -p 3100 &                                     # servidor real
TEST_BASE_URL=http://localhost:3100 npx vitest run tests/integration   # 21 pruebas HTTP + BD
```
Resultados documentados en `TASKS.md`.

## 10. Seguridad
Ver `docs/SEGURIDAD.md`.

## 11. Despliegue
1. PostgreSQL gestionado con backups automáticos. 2. Configurar variables (sin `NEXT_PUBLIC_` para secretos).
3. `npm ci && npx drizzle-kit migrate && npm run build && npm start` detrás de un proxy HTTPS (HSTS activado en producción).
4. `APP_URL=https://tu-dominio` (CSRF/enlaces). La API es same-origin: no se habilita CORS para otros dominios.
5. Healthcheck: `GET /api/health`. 6. Crear el primer admin con `scripts/promote-admin.ts`.
**Backups**: `pg_dump -Fc "$DATABASE_URL" > backups/mzl-$(date +%F).dump` (programado diario).
**Restauración**: `pg_restore --clean --no-owner -d "$DATABASE_URL" backups/mzl-AAAA-MM-DD.dump`.
Logs: sólo mensajes de error sin cuerpos de petición, tokens ni contraseñas.
