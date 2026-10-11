export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/** Área por defecto: municipio de Manizales (zona urbana y periurbana cercana). */
export const DEFAULT_BOUNDS: Bounds = { minLat: 4.98, minLng: -75.62, maxLat: 5.13, maxLng: -75.38 };
export const MANIZALES_CENTER: [number, number] = [5.0689, -75.5174];

export function parseBounds(raw: string | undefined | null): Bounds {
  if (!raw) return DEFAULT_BOUNDS;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return DEFAULT_BOUNDS;
  const [minLat, minLng, maxLat, maxLng] = parts;
  if (minLat >= maxLat || minLng >= maxLng) return DEFAULT_BOUNDS;
  return { minLat, minLng, maxLat, maxLng };
}

export function isWithinBounds(lat: number, lng: number, b: Bounds = DEFAULT_BOUNDS): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
  );
}

/** Recorta un bbox solicitado al área permitida. Devuelve null si no hay intersección. */
export function clampBbox(req: Bounds, allowed: Bounds = DEFAULT_BOUNDS): Bounds | null {
  const r = {
    minLat: Math.max(req.minLat, allowed.minLat),
    minLng: Math.max(req.minLng, allowed.minLng),
    maxLat: Math.min(req.maxLat, allowed.maxLat),
    maxLng: Math.min(req.maxLng, allowed.maxLng),
  };
  return r.minLat < r.maxLat && r.minLng < r.maxLng ? r : null;
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type ClusterPoint<T> = { lat: number; lng: number; item: T };
export type Cluster<T> = { lat: number; lng: number; items: T[] };

/** Agrupación simple por cuadrícula dependiente del zoom. */
export function clusterPoints<T>(points: ClusterPoint<T>[], zoom: number): Cluster<T>[] {
  if (zoom >= 16) return points.map((p) => ({ lat: p.lat, lng: p.lng, items: [p.item] }));
  const cell = 0.6 / Math.pow(2, zoom - 8); // grados por celda
  const map = new Map<string, { latSum: number; lngSum: number; items: T[] }>();
  for (const p of points) {
    const key = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / cell)}`;
    const c = map.get(key) ?? { latSum: 0, lngSum: 0, items: [] };
    c.latSum += p.lat;
    c.lngSum += p.lng;
    c.items.push(p.item);
    map.set(key, c);
  }
  return [...map.values()].map((c) => ({ lat: c.latSum / c.items.length, lng: c.lngSum / c.items.length, items: c.items }));
}
