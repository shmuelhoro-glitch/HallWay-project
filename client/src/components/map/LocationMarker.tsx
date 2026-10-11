import { useMapScale } from './mapScale';
import './LocationMarker.css';

interface LocationMarkerProps {
  x: number;
  y: number;
  label?: string;
}

// "You are here": a big see-through circle with a small full circle on it
function LocationMarker({ x, y, label = 'You are here' }: LocationMarkerProps) {
  const scale = useMapScale();
  const labelWidth = label.length * 7 + 20; // a rough text width, good enough for a short label

  return (
    // Inside this group 1 unit = 1 screen pixel, thanks to scale()
    <g transform={`translate(${x} ${y}) scale(${scale})`} pointerEvents="none">
      <circle className="location-halo" r={17} />
      <circle className="location-dot" r={9} strokeWidth={3} />
      <rect className="location-pill" x={18} y={-12} width={labelWidth} height={24} rx={8} />
      <text className="location-text" x={18 + labelWidth / 2} y={4} fontSize={12} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export default LocationMarker;
