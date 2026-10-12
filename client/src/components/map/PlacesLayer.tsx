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

function PlacesLayer({ places, selectedPlaceId, highlightShelters, onSelect, showAllLabels = false }: PlacesLayerProps) {
  const scale = useMapScale();

  return (
    <g>
      {places.map((place) => {
        const isSelected = place._id === selectedPlaceId;
        const isShelter = place.type === 'shelter';
        const isBig = isSelected || (isShelter && highlightShelters);
        // The floor plan already shows the names. A label is added only where it helps.
        const showLabel = showAllLabels || isSelected || (isShelter && highlightShelters);

        const classNames = ['map-place'];
        if (isShelter) classNames.push('is-shelter');
        if (isSelected) classNames.push('is-selected');

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
            <circle cx={place.x} cy={place.y} r={20 * scale} fill="transparent" />

            <circle
              className="map-place-dot"
              cx={place.x}
              cy={place.y}
              r={(isBig ? 11 : 7) * scale}
              strokeWidth={2.5 * scale}
            />

            {showLabel && (
              <text
                className="map-place-label"
                x={place.x}
                y={place.y + (isBig ? 26 : 22) * scale}
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
