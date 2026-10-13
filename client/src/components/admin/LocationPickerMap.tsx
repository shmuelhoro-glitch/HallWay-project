import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { MapPoint } from '../../api/admin';

interface LocationPickerMapProps {
  point: MapPoint | null; // null = no spot yet: the admin clicks on the map to set it
  onChange: (point: MapPoint) => void;
}

const ISRAEL_CENTER: [number, number] = [31.5, 34.9];
const COUNTRY_ZOOM = 7;
const STREET_ZOOM = 17;

// divIcon: Leaflet's default marker images don't load with Vite
const pinIcon = L.divIcon({
  className: '',
  html: '<div class="location-pin"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Six digits after the point are about 10 cm - more than enough for a building
function roundPoint(lat: number, lng: number): MapPoint {
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

// Keeps the pin in the middle of the map when it gets a new spot
function FollowPoint({ point }: { point: MapPoint | null }) {
  const map = useMap();

  useEffect(() => {
    if (point) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), STREET_ZOOM));
    }
  }, [point, map]);

  return null;
}

function ClickToPlace({ onChange }: { onChange: (point: MapPoint) => void }) {
  useMapEvents({
    click: (event) => onChange(roundPoint(event.latlng.lat, event.latlng.lng)),
  });
  return null;
}

// A small map with one pin: where the new building is. The admin drags the pin, or clicks the right spot.
function LocationPickerMap({ point, onChange }: LocationPickerMapProps) {
  return (
    <MapContainer className="location-map" center={ISRAEL_CENTER} zoom={COUNTRY_ZOOM}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FollowPoint point={point} />
      <ClickToPlace onChange={onChange} />

      {point && (
        <Marker
          position={[point.lat, point.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const spot = (event.target as L.Marker).getLatLng();
              onChange(roundPoint(spot.lat, spot.lng));
            },
          }}
        />
      )}
    </MapContainer>
  );
}

export default LocationPickerMap;
