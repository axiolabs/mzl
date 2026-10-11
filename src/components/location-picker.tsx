"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { MANIZALES_CENTER } from "@/lib/geo";

const icon = L.divIcon({ className: "", html: '<div class="mzl-pin" style="width:30px;height:30px;background:#ff5a3c">•</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function Click({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

export default function LocationPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={lat && lng ? [lat, lng] : MANIZALES_CENTER} zoom={14} minZoom={12} className="h-64 w-full" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Click onPick={onPick} />
      {lat && lng && <Marker position={[lat, lng]} icon={icon} />}
    </MapContainer>
  );
}
