/**
 * DATASET DE DEMOSTRACIÓN — 100 % FICTICIO.
 * No proviene de la base de datos, no contiene datos personales reales ni credenciales.
 * Los "eventos institucionales" son ejemplos y NO representan eventos reales de ninguna entidad.
 * Las fechas se calculan relativas al momento de la visita para que la demo siempre parezca activa.
 */
import { CATEGORY_SEED, PLACE_SEED } from "./reference-data";

export type DemoUser = { id: string; username: string; name: string; bio: string; interests: string[]; verified?: string };
export type DemoPlan = {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: "community" | "verified";
  place: string;
  lat: number;
  lng: number;
  startsAt: string;
  capacity: number;
  accepted: number;
  creator: string;
  cover: string;
  requirements?: string;
  status: "published" | "full" | "finished" | "cancelled";
};

export const DEMO_USERS: DemoUser[] = [
  { id: "d-u1", username: "vale_demo", name: "Valentina (demo)", bio: "Perfil ficticio. Amo los atardeceres en Chipre.", interests: ["fotografia", "cafe-comida"] },
  { id: "d-u2", username: "santi_demo", name: "Santiago (demo)", bio: "Perfil ficticio. Basket los fines de semana.", interests: ["deporte", "juegos"] },
  { id: "d-u3", username: "majo_demo", name: "María José (demo)", bio: "Perfil ficticio. Senderos y café de origen.", interests: ["naturaleza", "cafe-comida"] },
  { id: "d-u4", username: "colectivo_demo", name: "Colectivo Cultural Ficticio", bio: "Organizador de ejemplo para la demo.", interests: ["cultura", "musica"], verified: "Colectivo Cultural Ficticio (demo)" },
  { id: "d-u5", username: "ecoclub_demo", name: "Club Verde Ficticio", bio: "Organizador de ejemplo para la demo.", interests: ["ambiente"], verified: "Club Verde Ficticio (demo)" },
];

const place = (name: string) => {
  const p = PLACE_SEED.find((x) => x.name.startsWith(name))!;
  return { place: p.name, lat: p.lat, lng: p.lng };
};

export function getDemoData(now = new Date()) {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const plans: DemoPlan[] = [
    { id: "demo-1", title: "Atardecer y fotos en Chipre", description: "Caminata corta por la Avenida 12 de Octubre para fotografiar el atardecer. Trae celular o cámara.", category: "fotografia", kind: "community", ...place("Torre de Chipre"), startsAt: at(1, 17), capacity: 8, accepted: 5, creator: "d-u1", cover: "/images/cover-fotografia.jpg", status: "published" },
    { id: "demo-2", title: "Basket 3x3 en el Bosque Popular", description: "Partidos amistosos, todos los niveles. Llevamos balón.", category: "deporte", kind: "community", ...place("Bosque Popular"), startsAt: at(2, 9), capacity: 10, accepted: 10, creator: "d-u2", cover: "/images/cover-deporte.jpg", requirements: "Ropa deportiva e hidratación", status: "full" },
    { id: "demo-3", title: "Café de especialidad en El Cable", description: "Probemos métodos de filtrado y conversemos un rato.", category: "cafe-comida", kind: "community", ...place("Torre de Herveo"), startsAt: at(3, 16), capacity: 6, accepted: 2, creator: "d-u3", cover: "/images/cover-cafe.jpg", status: "published" },
    { id: "demo-4", title: "Sendero en Los Yarumos", description: "Recorrido de 2 horas a ritmo tranquilo. Verifica horarios del parque.", category: "naturaleza", kind: "community", ...place("Ecoparque Los Yarumos"), startsAt: at(4, 8), capacity: 12, accepted: 7, creator: "d-u3", cover: "/images/cover-naturaleza.jpg", requirements: "Zapatos cómodos e impermeable", status: "published" },
    { id: "demo-5", title: "[EJEMPLO] Taller de grabado (evento verificado ficticio)", description: "Evento de demostración de un organizador verificado ficticio. No es un evento real.", category: "cultura", kind: "verified", ...place("Teatro Los Fundadores"), startsAt: at(5, 15), capacity: 25, accepted: 18, creator: "d-u4", cover: "/images/cover-cultura.jpg", status: "published" },
    { id: "demo-6", title: "[EJEMPLO] Jornada de siembra (evento verificado ficticio)", description: "Evento de demostración. No representa ninguna actividad institucional real.", category: "ambiente", kind: "verified", ...place("Ecoparque Alcázares"), startsAt: at(6, 8), capacity: 40, accepted: 22, creator: "d-u5", cover: "/images/cover-naturaleza.jpg", status: "published" },
    { id: "demo-7", title: "Tarde de juegos de mesa", description: "Catan, Dixit y lo que traigan. Ideal para conocer gente.", category: "juegos", kind: "community", ...place("Avenida Santander"), startsAt: at(2, 18), capacity: 8, accepted: 3, creator: "d-u2", cover: "/images/cover-cafe.jpg", status: "published" },
    { id: "demo-8", title: "Grupo de estudio de cálculo", description: "Repaso para parciales cerca de la universidad.", category: "estudio", kind: "community", ...place("Universidad de Caldas"), startsAt: at(1, 14), capacity: 6, accepted: 4, creator: "d-u1", cover: "/images/cover-cultura.jpg", status: "published" },
    { id: "demo-9", title: "Recorrido por la Catedral", description: "Plan pasado de ejemplo (finalizado).", category: "cultura", kind: "community", ...place("Plaza de Bolívar"), startsAt: at(-3, 10), capacity: 10, accepted: 9, creator: "d-u4", cover: "/images/cover-cultura.jpg", status: "finished" },
  ];
  const notifications = [
    { id: 1, title: "Tu solicitud fue aceptada", body: "Ya haces parte de «Atardecer y fotos en Chipre».", ago: "hace 10 min" },
    { id: 2, title: "Nuevo plan cerca de ti", body: "«Café de especialidad en El Cable» coincide con tus intereses.", ago: "hace 2 h" },
    { id: 3, title: "Recordatorio", body: "«Grupo de estudio de cálculo» es mañana a las 2:00 p. m.", ago: "ayer" },
  ];
  const categories = CATEGORY_SEED.map((c) => ({ ...c }));
  return { plans, users: DEMO_USERS, notifications, categories, places: PLACE_SEED };
}
