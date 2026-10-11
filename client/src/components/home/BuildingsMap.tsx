import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Building, BuildingType } from '../../types/building';
import './BuildingsMap.css';

interface BuildingsMapProps {
  buildings: Building[];
  selectedId: string | null;
  onSelect: (building: Building) => void;
}

const ISRAEL_CENTER: [number, number] = [31.5, 34.9];

// Icon drawings for each building type (our own SVG, no user text inside)
const TYPE_ICONS: Record<BuildingType, string> = {
  mall: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
  hospital: '<path d="M12 5v14M5 12h14"/>',
  campus: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
};

// A round marker like in the design: yellow when selected, white otherwise.
// divIcon also avoids the known Vite problem with Leaflet's default marker images.
function createBuildingIcon(type: BuildingType, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 44 : 36;
  const svg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICONS[type] ?? TYPE_ICONS.mall}</svg>`;

  return L.divIcon({
    className: '', // removes Leaflet's default white square
    html: `<div class="building-pin${isSelected ? ' is-selected' : ''}">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Moves the map: shows all buildings when the list changes, and the selected one when picked
function MapController({ buildings, selected }: { buildings: Building[]; selected: Building | null }) {
  const map = useMap();

  useEffect(() => {
    if (buildings.length === 0) return;
    const bounds = L.latLngBounds(buildings.map((building) => [Number(building.lat), Number(building.lng)]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [buildings, map]);

  useEffect(() => {
    if (!selected) return;
    map.panTo([Number(selected.lat), Number(selected.lng)]);
  }, [selected, map]);

  return null;
}

function BuildingsMap({ buildings, selectedId, onSelect }: BuildingsMapProps) {
  const selected = buildings.find((building) => building.id === selectedId) ?? null;

  return (
    <MapContainer className="buildings-map" center={ISRAEL_CENTER} zoom={7}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController buildings={buildings} selected={selected} />

      {buildings.map((building) => (
        <Marker
          key={building.id}
          position={[Number(building.lat), Number(building.lng)]}
          icon={createBuildingIcon(building.type, building.id === selectedId)}
          eventHandlers={{ click: () => onSelect(building) }}
        >
          <Tooltip permanent direction="bottom" offset={[0, 18]} className="building-label">
            {building.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default BuildingsMap;
