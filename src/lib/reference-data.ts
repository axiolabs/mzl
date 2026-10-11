/**
 * Datos de referencia iniciales. Idempotentes (onConflictDoNothing) y administrables luego desde el panel.
 * BARRIOS: lista inicial NO OFICIAL de barrios/sectores conocidos de Manizales; coordenadas aproximadas.
 * Debe validarse contra la división político-administrativa publicada por la Alcaldía de Manizales.
 */
export const CATEGORY_SEED = [
  { slug: "deporte", name: "Deporte", icon: "dumbbell" },
  { slug: "cafe-comida", name: "Café y comida", icon: "coffee" },
  { slug: "naturaleza", name: "Naturaleza y senderismo", icon: "mountain" },
  { slug: "cultura", name: "Cultura y arte", icon: "palette" },
  { slug: "musica", name: "Música", icon: "music" },
  { slug: "juegos", name: "Videojuegos y juegos de mesa", icon: "gamepad-2" },
  { slug: "estudio", name: "Estudio y aprendizaje", icon: "book-open" },
  { slug: "fotografia", name: "Fotografía", icon: "camera" },
  { slug: "emprendimiento", name: "Emprendimiento", icon: "briefcase" },
  { slug: "ambiente", name: "Voluntariado y ambiente", icon: "leaf" },
  { slug: "social", name: "Conocer gente", icon: "users" },
] as const;

export const BARRIO_SEED: { name: string; lat: number; lng: number }[] = [
  { name: "Centro", lat: 5.0689, lng: -75.5174 },
  { name: "Chipre", lat: 5.073, lng: -75.529 },
  { name: "Campohermoso", lat: 5.066, lng: -75.528 },
  { name: "San José", lat: 5.07, lng: -75.523 },
  { name: "Cervantes", lat: 5.072, lng: -75.51 },
  { name: "El Bosque", lat: 5.076, lng: -75.505 },
  { name: "Lleras", lat: 5.065, lng: -75.505 },
  { name: "Versalles", lat: 5.06, lng: -75.502 },
  { name: "Belén", lat: 5.062, lng: -75.499 },
  { name: "Laureles", lat: 5.061, lng: -75.495 },
  { name: "La Estrella", lat: 5.056, lng: -75.495 },
  { name: "El Cable", lat: 5.056, lng: -75.492 },
  { name: "Palogrande", lat: 5.057, lng: -75.488 },
  { name: "Palermo", lat: 5.053, lng: -75.49 },
  { name: "Alta Suiza", lat: 5.051, lng: -75.494 },
  { name: "Baja Suiza", lat: 5.053, lng: -75.498 },
  { name: "Arrayanes", lat: 5.0525, lng: -75.4875 },
  { name: "Fátima", lat: 5.053, lng: -75.48 },
  { name: "La Francia", lat: 5.048, lng: -75.487 },
  { name: "Milán", lat: 5.047, lng: -75.481 },
  { name: "La Sultana", lat: 5.04, lng: -75.49 },
  { name: "La Enea", lat: 5.03, lng: -75.47 },
  { name: "Bosques del Norte", lat: 5.082, lng: -75.496 },
  { name: "Villa Pilar", lat: 5.059, lng: -75.51 },
  { name: "Minitas", lat: 5.06, lng: -75.53 },
  { name: "Aranjuez", lat: 5.059, lng: -75.523 },
];

export const PLACE_SEED: { name: string; description: string; barrio: string; lat: number; lng: number }[] = [
  { name: "Plaza de Bolívar y Catedral Basílica", description: "Corazón del centro histórico.", barrio: "Centro", lat: 5.0685, lng: -75.5175 },
  { name: "Monumento a los Colonizadores", description: "Mirador en Chipre con vista a los nevados en días despejados.", barrio: "Chipre", lat: 5.0748, lng: -75.5316 },
  { name: "Torre de Chipre (Avenida 12 de Octubre)", description: "Paseo de atardeceres y comidas.", barrio: "Chipre", lat: 5.0735, lng: -75.5285 },
  { name: "Teatro Los Fundadores", description: "Centro cultural y de eventos.", barrio: "Centro", lat: 5.0679, lng: -75.5094 },
  { name: "Parque Caldas", description: "Parque urbano en el centro.", barrio: "Centro", lat: 5.0682, lng: -75.5105 },
  { name: "Torre de Herveo (El Cable)", description: "Zona de cafés y vida nocturna.", barrio: "El Cable", lat: 5.0562, lng: -75.4912 },
  { name: "Ecoparque Los Yarumos", description: "Senderos y miradores (verificar horarios).", barrio: "La Estrella", lat: 5.0625, lng: -75.4885 },
  { name: "Bosque Popular El Prado", description: "Parque con canchas y senderos.", barrio: "La Sultana", lat: 5.0455, lng: -75.4865 },
  { name: "Estadio Palogrande", description: "Escenario deportivo principal.", barrio: "Palogrande", lat: 5.0574, lng: -75.4865 },
  { name: "Universidad de Caldas – Sede Central", description: "Campus universitario.", barrio: "Palogrande", lat: 5.0558, lng: -75.4928 },
  { name: "Recinto del Pensamiento", description: "Parque temático y jardín botánico (vía al Magdalena).", barrio: "La Enea", lat: 5.0461, lng: -75.4585 },
  { name: "Ecoparque Alcázares-Arenillo", description: "Reserva urbana y senderos.", barrio: "Minitas", lat: 5.0636, lng: -75.5385 },
  { name: "Avenida Santander – Zona Rosa", description: "Corredor de restaurantes y cafés.", barrio: "Palermo", lat: 5.0545, lng: -75.4895 },
  { name: "Parque Antonio Nariño (Los Fundadores)", description: "Plazoleta y punto de encuentro.", barrio: "Centro", lat: 5.0675, lng: -75.5085 },
];
