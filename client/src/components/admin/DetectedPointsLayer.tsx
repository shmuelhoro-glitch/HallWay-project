import type { ReviewRow } from '../../utils/placeDetection';
import { useMapScale } from '../map/mapScale';

// The stores found in the plan, as numbered circles in the middle of each store.
// Yellow = will be added. White = left out. The numbers match the review list.
function DetectedPointsLayer({ rows }: { rows: ReviewRow[] }) {
  const scale = useMapScale();

  return (
    <g pointerEvents="none">
      {rows.map((row) => (
        // Inside this group 1 unit = 1 screen pixel, thanks to scale()
        <g key={row.key} transform={`translate(${row.x} ${row.y}) scale(${scale})`}>
          <circle
            r={12}
            fill={row.include ? '#ffc93c' : '#ffffff'}
            stroke={row.include ? '#12161c' : '#9aa3ad'}
            strokeWidth={2}
          />
          <text y={4} fontSize={11} fontWeight={700} textAnchor="middle" fill={row.include ? '#12161c' : '#7b858f'}>
            {row.key}
          </text>
        </g>
      ))}
    </g>
  );
}

export default DetectedPointsLayer;
