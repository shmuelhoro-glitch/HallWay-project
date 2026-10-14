import { useMemo } from 'react';
import type { Place } from '../../types/place';
import { useMapScale } from './mapScale';
import './PlacesLayer.css';

interface PlacesLayerProps {
  places: Place[]; // only the places of the floor on screen
  selectedPlaceId: string | null;
  highlightShelters: boolean; // during a red alert
  onSelect: (place: Place) => void;
  showAllLabels?: boolean; // the admin screens show every name
}

// All in pixels.
// A visitor sees a small quiet point on each place. Most plans write the names, right under it, so a
// big marker would hide them; and a plan that is only a picture, without names, still shows where
// the places are. The admin gets a ring that is easy to find and to grab.
const POINT_RADIUS = 3.5;
const RING_RADIUS = 7;
const SMALLEST_RING = 4.5; // under this a ring is a smudge, so it is drawn as a point
const HIDDEN_DOT = 1.6; // under this the points are one grey stain: the plan alone says more
const TAP_RADIUS = 22;
const LABEL_ROOM = 46; // pixels between neighbors that a name needs

// How far apart the places of this floor are, in plan units: the usual distance from a place
// to the one closest to it. A floor with 5 stores and a floor with 120 need very different points.
function getUsualGap(places: Place[]): number {
  if (places.length < 2) return Infinity;

  const gaps = places.map((place) => {
    let closest = Infinity;
    for (const other of places) {
      if (other !== place) {
        closest = Math.min(closest, Math.hypot(other.x - place.x, other.y - place.y));
      }
    }
    return closest;
  });

  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function PlacesLayer({ places, selectedPlaceId, highlightShelters, onSelect, showAllLabels = false }: PlacesLayerProps) {
  const scale = useMapScale();
  const usualGap = useMemo(() => getUsualGap(places), [places]);

  // The points follow the zoom: far away they are small (or gone), close up they are easy to tap.
  // They never grow into each other.
  const gapOnScreen = usualGap / scale;
  const dotRadius = showAllLabels ? Math.min(RING_RADIUS, gapOnScreen * 0.24) : Math.min(POINT_RADIUS, gapOnScreen * 0.14);
  const isCrowded = dotRadius < HIDDEN_DOT;
  const tapRadius = Math.max(Math.min(TAP_RADIUS, gapOnScreen * 0.5), dotRadius);
  const hasRoomForLabels = gapOnScreen >= LABEL_ROOM;

  return (
    <g>
      {places.map((place) => {
        const isSelected = place._id === selectedPlaceId;
        const isShelter = place.type === 'shelter';
        const isBig = isSelected || (isShelter && highlightShelters);
        // Too far to tell the points apart: only what matters now is drawn.
        // (The admin always sees every place: he has to find the one he is editing.)
        if (isCrowded && !isBig && !showAllLabels) {
          return null;
        }

        // The floor plan already shows the names. A label is added only where it helps.
        const showLabel = isSelected || (isShelter && highlightShelters) || (showAllLabels && hasRoomForLabels);
        const radius = isBig ? 11 : Math.max(dotRadius, HIDDEN_DOT);
        const isPoint = !isBig && radius < SMALLEST_RING;

        const classNames = ['map-place'];
        if (isShelter) classNames.push('is-shelter');
        if (isSelected) classNames.push('is-selected');
        if (isPoint) classNames.push('is-point');

        return (
          // Clicks must not reach the map under the place
          <g
            key={place._id}
            className={classNames.join(' ')}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(place);
            }}
          >
            <title>{place.name}</title>

            {/* Transparent, bigger circle = easier to tap with a finger */}
            <circle cx={place.x} cy={place.y} r={(isBig ? TAP_RADIUS : tapRadius) * scale} fill="transparent" />

            {/* A soft halo around the selected place */}
            {isSelected && <circle className="map-place-pulse" cx={place.x} cy={place.y} r={20 * scale} />}

            <circle
              className="map-place-dot"
              cx={place.x}
              cy={place.y}
              r={radius * scale}
              strokeWidth={(isPoint ? 1 : 2.5) * scale}
            />

            {showLabel && (
              <text
                className="map-place-label"
                x={place.x}
                y={place.y + (isBig ? 26 : radius + 15) * scale}
                fontSize={12 * scale}
                strokeWidth={3 * scale}
                textAnchor="middle"
              >
                {place.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default PlacesLayer;
