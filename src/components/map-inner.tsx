"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { clusterPoints, DEFAULT_BOUNDS, MANIZALES_CENTER } from "@/lib/geo";
import { fmtDate } from "./ui";

export type MapPlan = { id: string; title: string; kind: "community" | "verified"; lat: number; lng: number; startsAt: string; locationName: string; category: { name: string }; capacity: number; acceptedCount: number; approximateLocation?: boolean };

const pin = (color: string, label: string, size = 34) =>
  L.divIcon({ className: "", html: `<div class="mzl-pin" style="width:${size}px;height:${size}px;background:${color}">${label}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

function Events({ onView }: { onView: (b: L.LatLngBounds, z: number) => void }) {
  const map = useMapEvents({ moveend: () => onView(map.getBounds(), map.getZoom()) });
  useEffect(() => onView(map.getBounds(), map.getZoom()), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function MapInner({ plans, hrefBase, onView, flyTarget }: { plans: MapPlan[]; hrefBase: string; onView: (b: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => void; flyTarget: [number, number] | null }) {
  const [zoom, setZoom] = useState(14);
  const [map, setMap] = useState<L.Map | null>(null);
  const clusters = useMemo(() => clusterPoints(plans.map((p) => ({ lat: p.lat, lng: p.lng, item: p })), zoom), [plans, zoom]);
  const maxBounds = L.latLngBounds([DEFAULT_BOUNDS.minLat - 0.05, DEFAULT_BOUNDS.minLng - 0.05], [DEFAULT_BOUNDS.maxLat + 0.05, DEFAULT_BOUNDS.maxLng + 0.05]);
  return (
    <MapContainer center={MANIZALES_CENTER} zoom={14} minZoom={12} maxBounds={maxBounds} className="h-full w-full" ref={setMap} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Events onView={(b, z) => { setZoom(z); onView({ minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() }); }} />
      <FlyTo target={flyTarget} />
      {clusters.map((c, i) => {
        if (c.items.length > 1) {
          return <Marker key={`c${i}`} position={[c.lat, c.lng]} icon={pin("#16161f", String(c.items.length), 42)} title={`${c.items.length} planes`} eventHandlers={{ click: () => map?.flyTo([c.lat, c.lng], Math.min(zoom + 2, 18)) }} />;
        }
        const p = c.items[0];
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p.kind === "verified" ? "#0e8f80" : "#ff5a3c", p.kind === "verified" ? "✓" : "•")} title={p.title}>
            <Popup>
              <div className="min-w-48 space-y-1">
                <p className="text-xs font-bold uppercase text-black/50">{p.category.name}{p.kind === "verified" ? " · Verificado" : ""}</p>
                <p className="font-bold">{p.title}</p>
                <p className="text-xs">{fmtDate(p.startsAt)} · {p.locationName}</p>
                <p className="text-xs">{Math.max(0, p.capacity - p.acceptedCount)} cupos{p.approximateLocation ? " · ubicación aproximada" : ""}</p>
                <Link href={`${hrefBase}${p.id}`} className="font-semibold text-accent-dark">Ver detalle →</Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
