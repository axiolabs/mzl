# Seguimiento de tareas — MZL Parchado
Estados: [x] verificado (con evidencia) · [~] parcial · [ ] pendiente · [!] requiere credenciales/servicio externo

Evidencia: U = `tests/unit/logic.test.ts` (18/18 ✔) · I = `tests/integration/api.test.ts` (21/21 ✔, servidor `next start` + PostgreSQL)
· S = prueba de humo manual con curl · B = `next typegen` + `tsc --noEmit` + `next build` ✔ · L = `eslint src tests` sin errores.

## Fase 1-2 · Diseño e infraestructura
- [x] Esquema relacional con FKs, únicos, índices, CHECK de cupos (`drizzle-kit push`, `drizzle/0000_init.sql`)
- [x] Variables de entorno documentadas (`.env.example`), validación de `DATABASE_URL` al arrancar
- [x] Seed de referencia idempotente y no destructivo (se ejecuta en `instrumentation.ts`) — S
- [x] Seed de desarrollo determinista, bloqueado en producción, sin credenciales utilizables — S
- [x] docker-compose para PostgreSQL local; `.gitignore` excluye `.env`

## Fase 3 · Autenticación y seguridad
- [x] Registro con ciudad fija, barrio, +18, términos; rechazo de `role`/`verified` — U, I
- [x] Login con error genérico, rate limit (429) — I
- [x] Logout invalida la sesión en servidor — I (test 2)
- [x] Recuperación de contraseña: neutra, token de un solo uso, revoca sesiones — I (test 3)
- [x] Verificación de correo (token de un solo uso) — I
- [x] Cookies HttpOnly/SameSite=Lax/Path=/ y Secure con https — I
- [x] CSRF por Origin — I
- [x] Suspensión revoca sesiones, bloquea login, apelación — I
- [x] Cambio de contraseña, lista/revocación de sesiones, eliminación de cuenta — I (eliminación), UI

## Fase 4 · Funcionalidades principales
- [x] Perfiles, intereses, privacidad — UI + API
- [x] Fotografía: subida, validación de firma/tamaño/dimensiones, re-codificación, miniaturas, eliminación — I (test 7)
- [!] Cloudinary: integración implementada (firma en servidor) pero **no probada** por falta de credenciales
- [x] CRUD de parches + cancelación + eliminación condicionada — I (test 8, cancelar)
- [x] Protección contra edición ajena (IDOR) — I (test 9)
- [x] Solicitudes, aceptación/rechazo/retiro, cupos con concurrencia — I (test 10-11)
- [x] Comunitarios vs verificados; eventos verificados pasan por revisión — I (test 8, 13-14)
- [x] Favoritos (optimista con reversión), notificaciones internas — UI + I

## Fase 5 · Descubrimiento
- [x] Mapa Leaflet/OSM: bbox acotado, debounce, cancelación, agrupación, filtros, búsqueda de lugares, mapa/lista — I (test 19) + U (cluster) + S
- [x] Restricción geográfica configurable en backend — U, I (test 15)
- [x] Recomendaciones explicables (intereses, favoritos, participaciones, zona opcional, fecha) — U
- [x] Explorar con filtros y paginación del lado del servidor — S

## Fase 6 · Demo
- [x] `/demo` sin credenciales, dataset estático ficticio con fechas relativas, banner de solo lectura — I (test 4-6), U
- [x] Escrituras sin sesión → 401; sin cookie de sesión en la demo; sin datos reales en HTML — I

## Fase 7 · Administración
- [x] Verificación exclusiva de admins con auditoría (antes/después/actor/nota) — I (test 13-14)
- [x] Revocación con efecto en permisos y eventos futuros — I
- [x] Moderación de planes, reportes, usuarios, catálogos, apelaciones, auditoría — I (parcial: reportes, verificaciones, planes, usuarios) + UI

## Fase 8 · Experiencia visual
- [x] Responsive (menú móvil, grids), skeletons (`loading.tsx`, mapa), estados vacíos, alertas, foco visible, skip-link, `prefers-reduced-motion`
- [~] Accesibilidad: etiquetas, roles y aria aplicados; **sin auditoría automatizada** (axe/Lighthouse no ejecutados)

## Fase 9 · Validación
- [x] Persistencia tras reiniciar el servidor (sesión y plan siguen existiendo) — S (script de reinicio)
- [x] Cabeceras de seguridad, errores consistentes, límite de tamaño (413) — I
- [x] `npm audit --omit=dev`: 0 críticas/altas (Next actualizado a 16.4.0)
- [ ] Pruebas E2E con Playwright (no ejecutadas: requieren navegadores no disponibles en el sandbox) — pendiente
- [ ] Pruebas visuales responsive automatizadas — pendiente (verificación manual del layout con clases responsive)

## Limitaciones / configuraciones pendientes
- [!] Correo real: configurar `RESEND_API_KEY` y `EMAIL_FROM` (hoy: tabla `email_outbox`).
- [!] Cloudinary: configurar `CLOUDINARY_*` (hoy: fotos en PostgreSQL).
- [ ] Lista oficial de barrios/comunas pendiente de validar con la Alcaldía.
- [ ] Revisión jurídica de términos/privacidad (Ley 1581 de 2012).
- [ ] Chat privado: fuera de alcance (fase posterior); no se simula.
- [ ] Recorte manual de imagen: se aplica recorte cuadrado centrado automático (sin editor interactivo).
- [ ] Swagger/OpenAPI no generado (contratos en `src/lib/validation.ts`).
