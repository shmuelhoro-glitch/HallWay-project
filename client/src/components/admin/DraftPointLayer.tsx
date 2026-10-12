import { useMapScale } from '../map/mapScale';

// The point the admin just clicked for the place he is adding / moving: a yellow target
function DraftPointLayer({ x, y }: { x: number; y: number }) {
  const scale = useMapScale();

  return (
    // Inside this group 1 unit = 1 screen pixel, thanks to scale()
    <g transform={`translate(${x} ${y}) scale(${scale})`} pointerEvents="none">
      <circle r={16} fill="#ffc93c" fillOpacity={0.35} />
      <circle r={8} fill="#ffc93c" stroke="#12161c" strokeWidth={2.5} />
      <path d="M0 -24V-12M0 12V24M-24 0H-12M12 0H24" stroke="#12161c" strokeWidth={2} />
    </g>
  );
}

export default DraftPointLayer;
