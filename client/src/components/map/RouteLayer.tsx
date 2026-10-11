import type { RouteNode } from '../../types/navigation';
import { splitPathByFloor } from '../../utils/route';
import { useMapScale } from './mapScale';
import './RouteLayer.css';

interface RouteLayerProps {
  path: RouteNode[];
  currentFloor: number;
}

function RouteLayer({ path, currentFloor }: RouteLayerProps) {
  const scale = useMapScale();
  const segments = splitPathByFloor(path);
  const lastNode = path[path.length - 1];

  return (
    <g className="route-layer" pointerEvents="none">
      {segments.map((segment, index) => {
        if (segment[0].floor !== currentFloor) {
          return null;
        }

        const points = segment.map((node) => `${node.x},${node.y}`).join(' ');
        const endNode = segment[segment.length - 1];
        const nextSegment = segments[index + 1];

        return (
          <g key={index}>
            {/* White wide line under the blue one, so the route stands out on any plan */}
            <polyline className="route-line-outline" points={points} strokeWidth={12 * scale} />
            <polyline className="route-line" points={points} strokeWidth={6 * scale} />

            {/* Where the visitor changes floor (elevator / stairs) */}
            {nextSegment && (
              <g transform={`translate(${endNode.x} ${endNode.y}) scale(${scale})`}>
                <circle className="route-floor-change" r={14} strokeWidth={3} />
                {nextSegment[0].floor > endNode.floor ? (
                  <path className="route-icon" d="M-5 2l5-5 5 5" strokeWidth={2.2} />
                ) : (
                  <path className="route-icon" d="M-5 -2l5 5 5-5" strokeWidth={2.2} />
                )}
              </g>
            )}
          </g>
        );
      })}

      {/* The destination */}
      {lastNode && lastNode.floor === currentFloor && (
        <g transform={`translate(${lastNode.x} ${lastNode.y}) scale(${scale})`}>
          <circle className="route-destination" r={11} strokeWidth={3} />
          <circle className="route-destination-center" r={4} />
        </g>
      )}
    </g>
  );
}

export default RouteLayer;
