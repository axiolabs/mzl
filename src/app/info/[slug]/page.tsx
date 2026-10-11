import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Page = { title: string; intro: string; sections: { h: string; id?: string; body: ReactNode }[] };

const PAGES: Record<string, Page> = {
  acerca: {
    title: "Sobre MZL Parchado",
    intro: "Una plataforma independiente para que la gente de Manizales salga, se encuentre y haga planes presenciales.",
    sections: [
      { h: "Nuestra idea", body: "Menos pantalla, más parche: queremos que descubrir un plan sea tan fácil como deslizar el dedo, pero que lo importante pase afuera — en un mirador, una cancha o un café." },
      { h: "Ciudad", body: "Por ahora funcionamos sólo en Manizales, Caldas, Colombia. Las ubicaciones fuera del área de la ciudad no se aceptan." },
      { h: "Independencia", body: "MZL Parchado no está afiliado a la Alcaldía de Manizales ni a ninguna entidad pública. Ningún evento se presenta como institucional sin autorización comprobable." },
    ],
  },
  "como-funciona": {
    title: "Cómo funciona",
    intro: "Tres pasos: descubre, solicita y vive el plan.",
    sections: [
      { h: "1. Descubre", body: "Explora la lista o el mapa y filtra por categoría, fecha, tipo y cupos. Con cuenta recibes recomendaciones explicadas según tus intereses." },
      { h: "2. Solicita o crea", body: "Envía una solicitud a un parche. Quien organiza decide aceptar o no. También puedes crear tu propio parche comunitario: se publica de inmediato." },
      { h: "3. Encuéntrense", body: "Al ser aceptado ves el punto exacto y quiénes van. Los datos de contacto nunca se comparten automáticamente." },
      { h: "Parches comunitarios vs. eventos verificados", id: "organizadores", body: <>Los <b>parches comunitarios</b> los crea cualquier persona. Los <b>eventos verificados</b> sólo los publican organizadores cuya verificación aprobó un administrador; además, cada evento verificado pasa por revisión antes de publicarse. Para solicitar la verificación: verifica tu correo y ve a <Link className="text-accent-dark underline" href="/app/organizador">Panel de organizador</Link>.</> },
    ],
  },
  seguridad: {
    title: "Seguridad y convivencia",
    intro: "Los encuentros presenciales requieren cuidado. Estas reglas aplican a todas las personas.",
    sections: [
      { h: "Reglas de convivencia", body: <ul className="list-disc space-y-1 pl-5"><li>Respeto: cero acoso, discriminación o violencia.</li><li>Planes legales y honestos: nada de ventas engañosas, cobros ocultos ni spam.</li><li>Sin suplantación de personas o entidades.</li><li>Respeta los cupos y avisa si no puedes asistir (retira tu solicitud).</li></ul> },
      { h: "Encuentros seguros", body: <ul className="list-disc space-y-1 pl-5"><li>Prefiere lugares públicos y concurridos, sobre todo la primera vez.</li><li>Cuéntale a alguien de confianza a dónde vas.</li><li>No compartas tu dirección ni datos financieros.</li><li>Ten tu propio transporte de regreso.</li><li>En emergencias llama a la Línea 123.</li></ul> },
      { h: "Qué ven los demás", body: "Antes de que te acepten: tu nombre visible, usuario y foto. Después: los demás aceptados te ven en la lista del plan. Tu correo, fecha de nacimiento y barrio nunca se muestran (el barrio sólo si lo activas en privacidad)." },
      { h: "Reportes, bloqueos y moderación", body: "Puedes reportar planes y perfiles, y bloquear usuarios: no verás sus planes y no podrán unirse a los tuyos. El equipo de administración revisa los reportes y puede cancelar planes o suspender cuentas." },
      { h: "Suspensión y apelación", body: "Si tu cuenta es suspendida, al intentar iniciar sesión podrás enviar una apelación con tu correo y contraseña. Un administrador la revisará y cada decisión queda registrada." },
      { h: "Límites contra abuso", body: "Hay límites de creación de planes, solicitudes, reportes e intentos de inicio de sesión para evitar spam y ataques automatizados." },
    ],
  },
  faq: {
    title: "Preguntas frecuentes",
    intro: "Lo que más nos preguntan.",
    sections: [
      { h: "¿Cuesta algo?", body: "No. Crear una cuenta, crear parches y unirse es gratis." },
      { h: "¿Qué es la demo?", body: "Una versión de solo lectura con datos ficticios. No pide correo ni contraseña y nada de lo que hagas en ella se guarda." },
      { h: "¿Por qué piden fecha de nacimiento?", body: "Sólo para aplicar la regla de edad mínima (18 años), dado que la plataforma facilita encuentros presenciales. No se muestra a nadie." },
      { h: "¿Puedo usar la app fuera de Manizales?", body: "Todavía no. Las ubicaciones deben estar dentro de la ciudad." },
      { h: "¿Hay chat?", body: "No por ahora. Está previsto para una fase posterior con controles de abuso y bloqueo." },
      { h: "¿Cómo elimino mi cuenta?", body: "En Configuración → Eliminar cuenta. Se borran tu perfil, fotos, planes y solicitudes." },
    ],
  },
  terminos: {
    title: "Términos de uso",
    intro: "Versión preliminar. Debe revisarla un profesional jurídico antes del lanzamiento público.",
    sections: [
      { h: "Aceptación", body: "Al crear una cuenta aceptas estos términos y la política de privacidad." },
      { h: "Requisitos", body: "Debes tener al menos 18 años y proporcionar información veraz." },
      { h: "Responsabilidad", body: "Cada persona es responsable de su conducta en los planes. MZL Parchado facilita el contacto pero no organiza ni supervisa los encuentros comunitarios." },
      { h: "Contenido", body: "No publiques contenido ilegal, engañoso, violento o que vulnere derechos de terceros. Podemos moderar, cancelar planes y suspender cuentas que incumplan las reglas." },
      { h: "Cambios", body: "Avisaremos con antelación cambios relevantes de estos términos." },
    ],
  },
  privacidad: {
    title: "Política de privacidad y tratamiento de datos",
    intro: "Redactada considerando la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015). No constituye una certificación de cumplimiento; requiere revisión jurídica competente.",
    sections: [
      { h: "Datos que tratamos", body: "Nombre y apellido, nombre de usuario, correo, contraseña (sólo como hash Argon2id), fecha de nacimiento (verificación de edad), barrio o sector (opcional en el perfil público), fotografía opcional, intereses, planes, solicitudes, favoritos, reportes y registros técnicos mínimos de sesión." },
      { h: "Lo que NO recopilamos", body: "Ubicación precisa del dispositivo, contactos del teléfono, datos financieros ni datos sensibles. Las fotos se re-codifican y se eliminan sus metadatos (incluida la geolocalización EXIF)." },
      { h: "Finalidades", body: "Prestar el servicio (cuentas, planes, recomendaciones explicables), seguridad y moderación, y comunicaciones transaccionales (verificación de correo y recuperación de contraseña)." },
      { h: "Derechos del titular", body: "Conocer, actualizar, rectificar y suprimir tus datos, revocar la autorización y presentar quejas ante la Superintendencia de Industria y Comercio. Puedes editar tu información en Configuración y eliminar tu cuenta en cualquier momento." },
      { h: "Encargados", body: "Proveedor de base de datos/hosting y, si se activan, Cloudinary (imágenes) y Resend (correo). Los mapas usan teselas de OpenStreetMap." },
      { h: "Conservación", body: "Mientras la cuenta esté activa. Al eliminarla se borran los datos asociados; los registros de auditoría administrativa conservan sólo identificadores técnicos." },
    ],
  },
  cookies: {
    title: "Política de cookies",
    intro: "Sólo usamos cookies estrictamente necesarias.",
    sections: [
      { h: "mzl_session", body: "Cookie de sesión HttpOnly, SameSite=Lax y Secure en producción, con vigencia máxima de 30 días. Contiene un identificador aleatorio; se invalida al cerrar sesión." },
      { h: "Sin rastreo", body: "No usamos cookies de publicidad ni analítica de terceros. Las teselas del mapa se cargan desde OpenStreetMap, que puede registrar tu IP según su propia política." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: PAGES[slug]?.title ?? "Información" };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{page.title}</h1>
      <p className="mt-3 text-lg text-black/65">{page.intro}</p>
      <div className="mt-8 space-y-6">
        {page.sections.map((s) => (
          <section key={s.h} id={s.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-bold">{s.h}</h2>
            <div className="text-black/75">{s.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
