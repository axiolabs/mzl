# Auditoría de seguridad (revisión interna, no certificación)

| Riesgo | Control implementado | Evidencia |
|---|---|---|
| Contraseñas | Argon2id (m=19 MiB, t=2, p=1); hash ficticio para igualar tiempos | `src/server/core.ts` |
| Sesiones | Token aleatorio 256 bits, sólo SHA-256 en BD, HttpOnly, SameSite=Lax, Secure con https, 30 días, borrado en logout, revocación en reset/cambio de contraseña/suspensión | tests 1, 2, 3, suspensión |
| CSRF | SameSite + verificación de `Origin`/`Sec-Fetch-Site` en toda petición mutante | test CSRF |
| Escalada de privilegios | Esquemas Zod `.strict()`; rol y verificación sólo modificables por admin; admin no actúa sobre sí mismo | tests inyección de rol, 13-14 |
| IDOR | Comprobación de propiedad en cada endpoint (planes, participaciones, fotos) | test 9, 10-11 |
| Concurrencia de cupos | Transacción + `FOR UPDATE` + `CHECK` en BD | test 10-11 (3 aceptaciones concurrentes → 2 OK + 1 409) |
| SQL injection | Consultas parametrizadas (Drizzle / `sql` template); `ILIKE` con escape de comodines | revisión de código |
| XSS | React escapa salida; URLs de portada limitadas a https; CSP restrictiva; sin `dangerouslySetInnerHTML` | test validación |
| Subida de archivos | Firma real, ≤3 MB, dimensiones, re-codificación WebP (elimina EXIF/GPS), `nosniff` + CSP en media | test 7 |
| Fuerza bruta / abuso | Rate limit en BD: login (IP y correo), registro, recuperación, subidas, solicitudes, reportes, bloqueos, creación de planes | test login 429 |
| Enumeración de cuentas | Respuestas neutras en registro y recuperación; mismo error de login | tests 1, 3 |
| Demo | Dataset estático; no crea sesión; escrituras exigen sesión real | tests 4-6 |
| Datos privados | Serializador público sin correo/fecha/barrio; ubicación aproximada para no aceptados | tests 10-11, 24 |
| Admin/auditoría | `requireAdmin` en servidor; acciones con justificación y `audit_logs` | test 13-14 |
| SSRF | El servidor no descarga URLs aportadas por usuarios (evidencia de verificación se muestra como texto) | revisión |
| CORS | Sin cabeceras CORS: sólo same-origin | revisión |
| Cabeceras | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (prod), sin X-Powered-By | test errores/cabeceras |
| Dependencias | `npm audit --omit=dev`: 0 críticas/altas tras actualizar Next a 16.4.0; 1 moderada en `baseline-browser-mapping` (sólo build) | |

## Riesgos residuales / pendientes
- La IP para rate limiting se toma de `X-Forwarded-For`: desplegar detrás de un proxy que la sobrescriba.
- Sin CAPTCHA en registro (añadir Turnstile/hCaptcha si hay abuso automatizado).
- Revisión jurídica de términos y privacidad (Ley 1581 de 2012) pendiente.
- La lista de barrios no es oficial y debe validarse.
