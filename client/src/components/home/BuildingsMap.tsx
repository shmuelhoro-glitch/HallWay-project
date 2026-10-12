import { useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Building, BuildingType } from '../../types/building';
import type { LocationStatus, UserPosition } from '../../hooks/useUserLocation';
import { getBuildingPoint } from '../../utils/distance';
import { LocateIcon } from '../ui/Icons';
import { getBuildingTypePaths } from '../ui/buildingTypeIcons';
import './BuildingsMap.css';

// What the page can ask the map to show:
// a point (a building that was picked) or an area (all the search results)
export type MapFocus =
  | { kind: 'point'; lat: number; lng: number; zoom: number }
  | { kind: 'area'; points: [number, number][] };

interface BuildingsMapProps {
  buildings: Building[];
  selectedId: string | null;
  onSelect: (building: Building) => void;
  userPosition: UserPosition | null;
  locationStatus: LocationStatus;
  onLocate: () => void;
  focus: MapFocus | null;
}

const ISRAEL_CENTER: [number, number] = [31.5, 34.9];
const START_ZOOM = 7;
const USER_AREA_ZOOM = 13; // about 5 km around the user
const LABELS_MIN_ZOOM = 10; // further out the names would cover each other
const FLY_OPTIONS = { duration: 0.8 };

// A round marker like in the design: yellow when selected, white otherwise.
// divIcon also avoids the known Vite problem with Leaflet's default marker images.
function createBuildingIcon(type: BuildingType, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 44 : 36;
  const svg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${getBuildingTypePaths(type)}</svg>`;

  return L.divIcon({
    className: '', // removes Leaflet's default white square
    html: `<div class="building-pin${isSelected ? ' is-selected' : ''}">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// The blue dot of the user (the pulse is done in CSS)
const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-dot"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface MapControllerProps {
  buildings: Building[];
  userPosition: UserPosition | null;
  locationStatus: LocationStatus;
  focus: MapFocus | null;
}

// Moves the map. It doesn't draw anything.
function MapController({ buildings, userPosition, locationStatus, focus }: MapControllerProps) {
  const map = useMap();
  const didShowAllRef = useRef(false);

  // 1. The device found the user: zoom to the area around them
  useEffect(() => {
    if (!userPosition) return;
    map.flyTo([userPosition.lat, userPosition.lng], USER_AREA_ZOOM, FLY_OPTIONS);
  }, [userPosition, map]);

  // 2. We can't get the location: show all the buildings instead (only once, at the start)
  useEffect(() => {
    const hasNoLocation = locationStatus !== 'locating' && locationStatus !== 'found';
    if (!hasNoLocation || buildings.length === 0 || didShowAllRef.current) return;

    didShowAllRef.current = true;
    const points = buildings.map((building) => {
      const point = getBuildingPoint(building);
      return L.latLng(point.lat, point.lng);
    });
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [locationStatus, buildings, map]);

  // 3. The page asked for a point or an area
  useEffect(() => {
    if (!focus) return;

    if (focus.kind === 'point') {
      // Zoom in to the building, but never zoom out if the user is already closer
      const zoom = Math.max(map.getZoom(), focus.zoom);
      map.flyTo([focus.lat, focus.lng], zoom, FLY_OPTIONS);
    } else {
      map.flyToBounds(L.latLngBounds(focus.points), { ...FLY_OPTIONS, padding: [48, 48], maxZoom: 14 });
    }
  }, [focus, map]);

  // 4. The map box changes size when the sheet under it grows or shrinks.
  //    Leaflet doesn't notice that by itself, so we tell it.
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

// Reports the zoom after every change, so we know when to show the names
function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (event) => onZoomChange(event.target.getZoom()),
  });
  return null;
}

function BuildingsMap({
  buildings,
  selectedId,
  onSelect,
  userPosition,
  locationStatus,
  onLocate,
  focus,
}: BuildingsMapProps) {
  const [zoom, setZoom] = useState(START_ZOOM);

  const locateClassNames = ['map-locate-btn'];
  if (locationStatus === 'locating') locateClassNames.push('is-locating');
  if (locationStatus === 'found') locateClassNames.push('is-found');

  return (
    <>
      <MapContainer className="buildings-map" center={ISRAEL_CENTER} zoom={START_ZOOM}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapController
          buildings={buildings}
          userPosition={userPosition}
          locationStatus={locationStatus}
          focus={focus}
        />
        <ZoomWatcher onZoomChange={setZoom} />

        {userPosition && (
          <>
            {/* The light circle = how accurate the location is. Very big circles only confuse. */}
            {userPosition.accuracy < 1500 && (
              <Circle
                center={[userPosition.lat, userPosition.lng]}
                radius={userPosition.accuracy}
                interactive={false}
                pathOptions={{ color: '#1d4ed8', weight: 1, fillColor: '#1d4ed8', fillOpacity: 0.1 }}
              />
            )}
            <Marker
              position={[userPosition.lat, userPosition.lng]}
              icon={userIcon}
              interactive={false}
              keyboard={false}
            />
          </>
        )}

        {buildings.map((building) => {
          const isSelected = building.id === selectedId;
          const point = getBuildingPoint(building);
          const showLabel = isSelected || zoom >= LABELS_MIN_ZOOM;

          return (
            <Marker
              key={building.id}
              position={[point.lat, point.lng]}
              icon={createBuildingIcon(building.type, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(building) }}
            >
              {showLabel && (
                <Tooltip permanent direction="bottom" offset={[0, isSelected ? 22 : 18]} className="building-label">
                  {building.name}
                </Tooltip>
              )}
            </Marker>
          );
        })}
      </MapContainer>

      <button
        type="button"
        className={locateClassNames.join(' ')}
        aria-label="הצגת המיקום שלי"
        title="הצגת המיקום שלי"
        onClick={onLocate}
      >
        <LocateIcon size={22} />
      </button>
    </>
  );
}

export default BuildingsMap;
