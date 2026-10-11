import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { screenToSvg } from '../../utils/svgCoords';
import type { SvgPoint } from '../../utils/svgCoords';
import { MapScaleContext } from './mapScale';
import './FloorMap.css';

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloorMapProps {
  planUrl: string;
  width: number;
  height: number;
  onMapClick?: (point: SvgPoint) => void;
  children?: ReactNode;
}

const DRAG_THRESHOLD = 5; // pixels. More than this is a drag, not a click
const ZOOM_STEP = 1.15;
const MAX_ZOOM_IN = 0.1; // the view can shrink to 10% of the plan width
const MAX_ZOOM_OUT = 1.5; // and grow to 150% of it

// Zoom = make the viewBox smaller or bigger, while the point under
// the finger / mouse stays in the same place on the screen.
function zoomViewBox(current: ViewBox, factor: number, center: SvgPoint, planWidth: number): ViewBox {
  const minWidth = planWidth * MAX_ZOOM_IN;
  const maxWidth = planWidth * MAX_ZOOM_OUT;
  const newWidth = Math.min(Math.max(current.width * factor, minWidth), maxWidth);
  const appliedFactor = newWidth / current.width;

  return {
    x: center.x - (center.x - current.x) * appliedFactor,
    y: center.y - (center.y - current.y) * appliedFactor,
    width: newWidth,
    height: current.height * appliedFactor,
  };
}

// Shows one floor plan. Layers (places, route, "you are here") are passed as children
// and drawn on top of the plan, in the same coordinates.
// Give it key={planUrl} from the parent, so the view resets when the floor changes.
function FloorMap({ planUrl, width, height, onMapClick, children }: FloorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, width, height });
  const [pixelSize, setPixelSize] = useState({ width: 1, height: 1 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragDistance = useRef(0);
  const pinchDistance = useRef<number | null>(null);

  // Keep the on-screen size of the svg, to know how many plan units are one pixel
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      setPixelSize({ width: rect.width || 1, height: rect.height || 1 });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Mouse wheel zoom. Added by hand because React's onWheel can't call preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (!svg) return;
      const center = screenToSvg(svg, event.clientX, event.clientY);
      const factor = event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setViewBox((current) => zoomViewBox(current, factor, center, width));
    }

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [width]);

  // preserveAspectRatio="meet" fits the whole viewBox, so the bigger ratio wins
  const unitsPerPixel = Math.max(viewBox.width / pixelSize.width, viewBox.height / pixelSize.height);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      dragDistance.current = 0;
    }
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinchDistance.current = Math.hypot(first.x - second.x, first.y - second.y);
    }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    // One finger / mouse: drag the map
    if (pointers.current.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      dragDistance.current += Math.hypot(dx, dy);

      if (dragDistance.current > DRAG_THRESHOLD) {
        // Capture only after a real drag, so a simple tap still reaches the places
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setViewBox((box) => ({
          ...box,
          x: box.x - dx * unitsPerPixel,
          y: box.y - dy * unitsPerPixel,
        }));
      }
    }

    // Two fingers: pinch zoom around the middle point between them
    if (pointers.current.size === 2 && pinchDistance.current !== null) {
      const [first, second] = [...pointers.current.values()];
      const newDistance = Math.hypot(first.x - second.x, first.y - second.y);
      const svg = svgRef.current;

      if (svg && newDistance > 0) {
        const center = screenToSvg(svg, (first.x + second.x) / 2, (first.y + second.y) / 2);
        const factor = pinchDistance.current / newDistance;
        setViewBox((box) => zoomViewBox(box, factor, center, width));
      }

      pinchDistance.current = newDistance;
      dragDistance.current = DRAG_THRESHOLD + 1; // a pinch is never a click
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchDistance.current = null;
    }
  }

  // After a drag the browser still sends a click. Stop it before it reaches the layers.
  function handleClickCapture(event: MouseEvent<SVGSVGElement>) {
    if (dragDistance.current > DRAG_THRESHOLD) {
      event.stopPropagation();
    }
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onMapClick || !svgRef.current) return;
    onMapClick(screenToSvg(svgRef.current, event.clientX, event.clientY));
  }

  return (
    <div className="floor-map">
      <svg
        ref={svgRef}
        className="floor-map-svg"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClickCapture={handleClickCapture}
        onClick={handleClick}
      >
        <image href={planUrl} x={0} y={0} width={width} height={height} />
        <MapScaleContext.Provider value={unitsPerPixel}>{children}</MapScaleContext.Provider>
      </svg>
    </div>
  );
}

export default FloorMap;
