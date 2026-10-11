# Plan de Implementación: MZL Parchado (Plataforma Social Full-Stack para Manizales)

## Resumen Ejecutivo

**MZL Parchado** («*Menos pantalla, más parche*») es una aplicación web full-stack de alto impacto diseñada para conectar personas mediante planes, salidas y actividades presenciales en Manizales, Caldas, Colombia. 

El sistema implementará una arquitectura desacoplada y robusta:
- **Frontend**: Next.js (App Router, React 19 / TypeScript, Tailwind CSS, componentes tipo shadcn/ui con Radix UI, TanStack Query, React Hook Form, Zod, Lucide Icons, Leaflet/Mapbox para mapas interactivos).
- **Backend**: NestJS (TypeScript, API REST versionada `/api/v1`, DTOs con class-validator, arquitectura modular por dominios, Guards de roles y estado, Swagger OpenAPI, Throttler contra fuerza bruta, cookies HttpOnly seguras).
- **Base de Datos**: PostgreSQL gestionado con Prisma ORM (migraciones versionadas, transacciones atómicas con control de concurrencia para cupos, restricciones de integridad referencial e índices geoespaciales y temporales).
- **Almacenamiento de Imágenes**: Validación estricta en servidor (tipo MIME real, magic bytes, cuota de peso < 5MB), procesamiento y almacenamiento con neutral avatar fallback (sin catálogo de avatares predeterminados).
- **Demo Pública**: Modo de demostración aislado, de solo lectura, accesible sin credenciales desde la pantalla de bienvenida y login, precargado con datos ficticios contextualizados en Manizales y bloqueo de mutaciones en backend.

---

## User Review Required

> [!IMPORTANT]
> **Base de Datos PostgreSQL**: Hemos detectado el servicio `postgresql-x64-16` corriendo nativamente en el puerto `5432` en Windows, y Docker Desktop instalado en el sistema. Propondremos:
> 1. Un archivo `docker-compose.yml` que levanta PostgreSQL 16 aislado en el puerto `5433` (para evitar conflictos con el servicio existente de Windows), con persistencia de volumen.
> 2. Alternativamente, la configuración de un archivo `.env` para apuntar a la instancia local de Windows o a una base de datos PostgreSQL remota (Neon / Supabase / local).
> 
> Confirmaremos si prefieres usar el contenedor Docker en puerto 5433 o tu PostgreSQL local en 5432 si dispones de la contraseña de usuario.

> [!IMPORTANT]
> **Estructura del Proyecto**:
> Organizaremos el repositorio como un monorepo limpio con npm workspaces:
> - `apps/backend/`: API NestJS + Prisma ORM + Seeds + Pruebas.
> - `apps/frontend/`: Next.js App Router + Tailwind CSS + Mapas + UI Components.
> - Scripts en la raíz para orquestar `npm run dev`, `npm run build`, `npm run test` y `npm run seed`.

---

## Open Questions

> [!NOTE]
> 1. **Contraseña de PostgreSQL local**: Si deseas conectar directamente al PostgreSQL 16 que ya está corriendo en tu máquina (puerto 5432), indícanos la contraseña del usuario `postgres`. De lo contrario, configuraremos Docker Compose en el puerto 5433 listo para ejecutar con un solo comando.
> 2. **Mapas**: Utilizaremos OpenStreetMap + Leaflet interactivo como proveedor principal (sin necesidad de API keys de pago o límites de facturación, totalmente funcional y centrado en Manizales con coordenadas reales), con soporte preparado para Mapbox mediante variable de entorno opcional.

---

## Proposed Changes

### Arquitectura de Carpetas y Configuración General

```
mzl/
├── package.json               # Configuración de workspaces (apps/backend, apps/frontend)
├── docker-compose.yml         # Servicio PostgreSQL 16 para desarrollo
├── .gitignore
├── README.md
├── apps/
│   ├── backend/               # NestJS API REST
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Esquema relacional completo
│   │   │   └── seed.ts        # Seed determinista de Manizales y Demo
│   │   ├── src/
│   │   │   ├── auth/          # Registro, Login, Cookies, Guards
│   │   │   ├── users/         # Perfiles, Fotos de perfil, Bloqueos
│   │   │   ├── plans/         # CRUD Parches comunitarios y verificados
│   │   │   ├── participations/# Solicitudes, Cupos atómicos, Concurrencia
│   │   │   ├── verifications/ # Organizadores verificados (solo admin)
│   │   │   ├── recommendations/# Motor de recomendaciones explicable
│   │   │   ├── barrios/       # Barrios y comunas reales de Manizales
│   │   │   ├── categories/    # Categorías temáticas de planes
│   │   │   ├── reports/       # Reportes y moderación
│   │   │   ├── demo/          # Dataset y endpoints de demo aislada
│   │   │   ├── audit/         # Registro de auditoría administrativa
│   │   │   └── common/        # Filtros globales, decoradores, interceptores
│   │   ├── test/              # Pruebas e2e e integración
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── frontend/              # Next.js 14+ App Router
│       ├── src/
│       │   ├── app/           # Rutas públicas, autenticadas y de admin
│       │   │   ├── (public)/  # Landing, Explorar, Mapa, Login, Registro, Demo
│       │   │   ├── (auth)/    # Dashboard, Mis Parches, Solicitudes, Perfil
│       │   │   ├── (organizer)/# Panel de actividades y cupos
│       │   │   └── (admin)/   # Verificaciones, Reportes, Auditoría
│       │   ├── components/    # Componentes UI accesibles, Tarjetas, Modales
│       │   ├── hooks/         # Hooks para datos, autenticación y mapa
│       │   ├── lib/           # Cliente API, validadores Zod, utilidades
│       │   └── types/         # Tipos compartidos
│       ├── public/            # Assets estáticos y logos
│       ├── tailwind.config.ts
│       └── package.json
```

---

### Componente 1: Base de Datos y Persistencia (Prisma & PostgreSQL)

#### [NEW] [schema.prisma](file:///c:/Users/Stiven/Documents/mzl/apps/backend/prisma/schema.prisma)
Modelos relacionales normalizados:
- `User`: credenciales seguras (hash bcrypt/argon2), username único, email verificado, rol (`USER`, `ORGANIZER`, `ADMIN`), estado de cuenta (`ACTIVE`, `SUSPENDED`), ciudad fija `'Manizales, Caldas, Colombia'`, barrio referenciado.
- `Profile`: biografía, avatarUrl, almacenamiento de metadata, preferencias de privacidad (teléfono oculto por defecto, solo visible a parches aceptados si el usuario lo autoriza).
- `Barrio`: catálogo completo de comunas y barrios reconocidos de Manizales (Chipre, El Cable, Milán, Palogrande, La Enea, Campohermoso, Palermo, Los Rosales, San Jorge, La Sultana, etc.) con coordenadas centroides.
- `Category`: categorías dinámicas (Deportes, Café & Gastronomía, Senderismo & Miradores, Videojuegos & Geek, Arte & Cultura, Música & Baile, Estudio & Coworking).
- `Plan`: parches comunitarios y verificados, coordenadas exactas en Manizales, cupo máximo, contador transaccional de aceptados, fechas de inicio/fin, estados (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `FULL`, `CANCELLED`, `COMPLETED`), visibilidad y autor.
- `PlanParticipation`: máquina de estados (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`), mensaje de postulación, fecha de respuesta.
- `OrganizerVerification`: solicitud de verificación con documentación, organización representada, aprobación/rechazo/revocación por admin con notas de auditoría.
- `Favorite`: planes guardados por usuarios.
- `Notification`: notificaciones internas (nueva solicitud, aprobación, cancelación, recordatorio).
- `Report`: reportes de planes o usuarios con motivos tipificados y resolución administrativa.
- `BlockedUser`: bloqueo bilateral que oculta planes y solicitudes entre usuarios.
- `AuditLog`: trazabilidad inmutable de acciones administrativas sensibles (verificaciones, moderación, suspensiones).

#### [NEW] [seed.ts](file:///c:/Users/Stiven/Documents/mzl/apps/backend/prisma/seed.ts)
- Semilla determinista con datos contextualizados en Manizales.
- Barrios y comunas reales.
- Categorías con iconos y colores representativos.
- Usuarios ficticios con diferentes intereses y perfiles.
- Parches comunitarios activos (ej. Baloncesto en Canchas de Palogrande, Tarde de Café en Milán, Atardecer fotográfico en Chipre, Caminata a Cerro de Oro).
- Eventos de organizadores verificados de muestra etiquetados explícitamente como demostración.
- Cuenta de administrador preconfigurada para pruebas locales.

---

### Componente 2: Backend (NestJS REST API `/api/v1`)

#### [NEW] [AuthModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/auth/auth.module.ts)
- `POST /api/v1/auth/register`: validación estricta de edad (>= 18 años), ciudad fija Manizales, barrio válido, hash seguro.
- `POST /api/v1/auth/login`: autenticación con rate limiting (prevención de fuerza bruta), generación de cookie HttpOnly con token de sesión/JWT seguro.
- `POST /api/v1/auth/logout`: invalidación de cookie y revocación de sesión en servidor.
- `GET /api/v1/auth/me`: estado del usuario actual autenticado.
- `POST /api/v1/auth/forgot-password` y `POST /api/v1/auth/reset-password`: tokens temporales de un solo uso con respuesta genérica para evitar enumeración de correos.
- Guards: `JwtAuthGuard`, `RolesGuard`, `AccountActiveGuard`, `DemoWriteGuard`.

#### [NEW] [PlansModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/plans/plans.module.ts)
- `GET /api/v1/plans`: listado público con filtros por categoría, fecha, tipo (comunitario vs verificado), disponibilidad de cupos, sector/barrio, y búsqueda textual.
- `GET /api/v1/plans/map`: consulta geográfica optimizada con coordenadas para el mapa interactivo de Manizales.
- `GET /api/v1/plans/:id`: detalle completo del parche con organizador y requisitos.
- `POST /api/v1/plans`: creación de parche comunitario (por cualquier usuario) o verificado (solo organizador aprobado).
- `PATCH /api/v1/plans/:id`: edición restringida al propietario o moderador.
- `DELETE /api/v1/plans/:id/cancel`: cancelación controlada que notifica a los participantes.

#### [NEW] [ParticipationsModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/participations/participations.module.ts)
- `POST /api/v1/plans/:id/apply`: solicitud de participación.
- `DELETE /api/v1/plans/:id/withdraw`: retiro voluntario del participante.
- `PATCH /api/v1/plans/:id/participations/:userId`: aceptar o rechazar solicitud ejecutado en una **transacción Prisma `$transaction`** con bloqueo de concurrencia para garantizar que nunca se exceda el cupo máximo `maxParticipants`.

#### [NEW] [VerificationsModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/verifications/verifications.module.ts)
- `POST /api/v1/verifications/request`: usuarios solicitan ser organizadores verificados aportando datos y justificación.
- `GET /api/v1/admin/verifications`: cola de solicitudes para administradores.
- `PATCH /api/v1/admin/verifications/:id/approve`: aprobación que cambia el rol y estatus del usuario, generando registro en `AuditLog`.
- `PATCH /api/v1/admin/verifications/:id/reject` y `revoke`: rechazo o revocación con justificación obligatoria.

#### [NEW] [RecommendationsModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/recommendations/recommendations.module.ts)
- Algoritmo transparente y explicable: calcula afinidad según intereses registrados del perfil, barrio de residencia o proximidad en Manizales, categorías guardadas en favoritos y fechas próximas, devolviendo la razón textual ("*Porque te interesa el café de especialidad*", "*Cerca de tu sector en Chipre*").

#### [NEW] [DemoModule & Read-Only Guard](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/demo/demo.module.ts)
- `GET /api/v1/demo/overview`: entrega de datos de demostración preconstruidos y enriquecidos sin tocar registros reales de usuarios.
- `DemoWriteGuard`: interceptor/guard que intercepta cualquier petición con encabezado o contexto de demo que intente mutar datos (`POST`, `PUT`, `PATCH`, `DELETE`) devolviendo un código `403 Forbidden` con mensaje descriptivo de solo lectura.

#### [NEW] [UploadsModule](file:///c:/Users/Stiven/Documents/mzl/apps/backend/src/uploads/uploads.module.ts)
- Subida de fotografías de perfil y portadas con validación rigurosa de tipo MIME (JPEG, PNG, WEBP), tamaño máximo de 5MB, almacenamiento seguro y eliminación de recursos huérfanos.

---

### Componente 3: Frontend (Next.js App Router & Tailwind CSS)

#### [NEW] [Estilos & Design System](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/app/globals.css)
- Identidad visual **MZL Parchado**:
  - Color primario: Verde Montaña / Bosque Andino (`#059669` / `#047857`).
  - Color de acento: Atardecer Cafetero / Terracota Cálido (`#F97316` / `#EA580C`).
  - Fondo y superficies: Dark Slate contemporáneo con acentos translúcidos y modo claro balanceado.
  - Tipografía moderna e iconografía de Lucide.
  - Skeletons animados, estados vacíos estilizados, banners informativos y micro-animaciones.

#### [NEW] [Páginas Públicas](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/app/(public))
- `page.tsx`: Landing page de alto impacto con llamada a la acción, buscador rápido, parches destacados de Manizales, estadísticas de la comunidad y acceso destacado al botón **«Explorar demo»**.
- `explorar/page.tsx`: Catálogo completo de planes con filtros reactivos (categoría, fecha, barrio, cupos disponibles, comunitario vs verificado).
- `mapa/page.tsx`: Mapa interactivo de Manizales con marcadores diferenciados, tarjetas flotantes y filtros geográficos.
- `parches/[id]/page.tsx`: Vista detallada del plan, anfitrión, requisitos, mapa de ubicación, cupos restantes y botón de postulación.
- `como-funciona/page.tsx`, `seguridad-y-convivencia/page.tsx`, `faq/page.tsx`: Páginas informativas sobre convivencia y recomendaciones de encuentros seguros en lugares públicos.
- `registro/page.tsx`: Formulario validado con Zod: nombre, usuario, correo, contraseña, fecha de nacimiento (>=18), ciudad fija Manizales, selector de barrios reales, subida de foto de perfil y aceptación de términos.
- `login/page.tsx`: Inicio de sesión seguro con botón visible **«Explorar demo»** para acceso sin credenciales.

#### [NEW] [Experiencia de Demostración Aislada](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/components/demo/DemoBanner.tsx)
- Barra de estado superior de demostración que informa al usuario: "*Estás en la Demo Pública de MZL Parchado (Modo lectura con datos ficticios)*".
- Permite probar la navegación, filtros, mapa interactivo, vista de detalles y recomendaciones.
- Si el usuario intenta acciones de escritura (crear plan, postularse, editar perfil), la interfaz despliega un modal elegante explicativo sin ejecutar llamadas de mutación.

#### [NEW] [Plataforma Autenticada](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/app/(auth))
- `app/page.tsx`: Feed personalizado con recomendaciones ("Para ti"), parches de esta semana y accesos directos.
- `app/parches/crear/page.tsx`: Asistente de creación de parches con selección de categoría, fecha/hora, selector de barrio y punto de encuentro en Manizales, cupos y requisitos.
- `app/mis-parches/page.tsx`: Gestión de parches creados por el usuario, con panel lateral para revisar y aceptar/rechazar postulantes en tiempo real.
- `app/mis-solicitudes/page.tsx`: Estado de las postulaciones del usuario (Pendiente, Aceptada, Rechazada).
- `app/perfil/page.tsx`: Perfil del usuario con foto personal subida desde dispositivo, bio, intereses, historial de parches y controles de privacidad.

#### [NEW] [Herramientas de Organizador Verificado](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/app/(organizer))
- `organizador/page.tsx`: Panel con métricas de asistencia, estado de eventos verificados, gestión de cupos y estado de acreditación.
- Formulario de solicitud de verificación para usuarios que deseen acreditarse.

#### [NEW] [Panel Administrativo](file:///c:/Users/Stiven/Documents/mzl/apps/frontend/src/app/(admin))
- `admin/page.tsx`: Métricas globales de la plataforma (usuarios, parches activos, solicitudes, reportes).
- `admin/verificaciones/page.tsx`: Bandeja de revisión de solicitudes de organizador con acciones de aprobación, rechazo y revocación con justificación.
- `admin/moderacion/page.tsx`: Moderación de planes y resolución de reportes de convivencia.
- `admin/usuarios/page.tsx`: Gestión y suspensión de cuentas.
- `admin/auditoria/page.tsx`: Bitácora inmutable de eventos administrativos.

---

## Verification Plan

### Automated Tests
1. **Pruebas de Backend (Jest / Supertest)**:
   - `npm test -- apps/backend`:
     - Test de registro: valida que la ciudad sea Manizales, valida mayoría de edad, rechaza duplicados.
     - Test de autenticación: verifica cookie HttpOnly, login inválido, logout.
     - Test de concurrencia y cupos: simula peticiones concurrentes a `POST /apply` y `PATCH /accept` para confirmar que `currentParticipantsCount` nunca supere `maxParticipants`.
     - Test de autorización: verifica que usuarios normales no puedan acceder a `/admin/*` ni aprobar organizadores (código 403).
     - Test de protección de datos: verifica que usuarios no puedan editar parches ajenos (IDOR test).
     - Test de demo pública: verifica que endpoints de escritura en modo demo devuelvan 403 Forbidden.
2. **Pruebas de Frontend & Tipado**:
   - `npm run lint` y `npm run build` en ambas aplicaciones para asegurar cero errores de TypeScript y compilación exitosa.

### Manual Verification
1. **Flujo de la Demo Pública**:
   - Abrir `http://localhost:3000`, hacer clic en «Explorar demo».
   - Navegar por el feed, mapa interactivo con puntos de Manizales (Chipre, El Cable, Milán, etc.), filtros por categoría y fecha.
   - Intentar crear un plan o postularse y constatar que la demo bloquea la escritura de forma amigable.
2. **Flujo Real de Usuario**:
   - Registrar una cuenta nueva seleccionando un barrio de Manizales (ej. El Cable) y subiendo una foto personal.
   - Crear un parche comunitario (ej. "Tarde de café y charla en Milán").
   - Verificar que aparece en el mapa interactivo y en la lista pública con persistencia en PostgreSQL.
   - Abrir sesión en una ventana de incógnito con otro usuario y solicitar unirse.
   - Desde el usuario creador, aceptar la solicitud y constatar el decremento en tiempo real del cupo disponible.
3. **Flujo de Organizador y Administrador**:
   - Iniciar sesión con la cuenta de administrador.
   - Aprobar la solicitud de organizador verificado para un usuario.
   - Conectar con ese usuario y verificar que ahora tiene la insignia de organizador y puede publicar parches verificados.
   - Probar la revocación de la verificación y constatar que sus permisos se actualizan de inmediato.
4. **Resiliencia y Persistencia**:
   - Reiniciar el backend de NestJS y recargar la página para constatar que todas las sesiones y datos persisten en PostgreSQL.
