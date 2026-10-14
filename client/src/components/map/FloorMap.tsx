import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { screenToSvg } from '../../utils/svgCoords';
import type { SvgPoint } from '../../utils/svgCoords';
import { FitScreenIcon, MinusIcon, PlusIcon } from '../ui/Icons';
import { MapScaleContext } from './mapScale';
import { MAX_ZOOM_IN, clampView, getFrameView, getHomeView, getWholeView, isSameView, zoomView } from './mapView';
import type { ViewBox } from './mapView';
import './FloorMap.css';

interface FloorMapProps {
  planUrl: string;
  width: number;
  height: number;
  // unitsPerPixel: how many plan units one screen pixel is right now (it changes with the zoom)
  onMapClick?: (point: SvgPoint, unitsPerPixel: number) => void;
  isPlanHidden?: boolean; // the admin editor can hide the plan, to see only the walkways
  // Where a long plan opens (see getHomeView): around this point. Read once, when the map opens.
  startAt?: SvgPoint | null;
  children?: ReactNode;
}

const DRAG_THRESHOLD = 8; // pixels. A move longer than this is a drag, not a tap - for the map AND for the clicks
const ZOOM_STEP = 1.25;

// Shows one floor plan. Layers (places, route, "you are here") are passed as children
// and drawn on top of the plan, in the same coordinates.
// Give it a new key from the parent (a new floor, a new route) to open it again from its home view.
function FloorMap({ planUrl, width, height, onMapClick, isPlanHidden = false, startAt = null, children }: FloorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(() => getFrameView(width, height));
  const [pixelSize, setPixelSize] = useState({ width: 1, height: 1 });
  // Where the map opened, for "fit to screen" and the double tap. Known once the size on screen is.
  const [homeView, setHomeView] = useState<ViewBox | null>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragDistance = useRef(0);
  const pinchDistance = useRef<number | null>(null);
  const startAtRef = useRef(startAt);

  // Keep the on-screen size of the svg, to know how many plan units are one pixel.
  // The first time it is known, the map opens at its home view.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let hasHome = false;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      setPixelSize({ width: rect.width || 1, height: rect.height || 1 });

      if (!hasHome && rect.width > 1 && rect.height > 1) {
        hasHome = true;
        const home = getHomeView(width, height, { width: rect.width, height: rect.height }, startAtRef.current);
        setHomeView(home);
        setViewBox(home);
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [width, height]);

  // Mouse wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (!svg) return;
      const center = screenToSvg(svg, event.clientX, event.clientY);
      const factor = event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setViewBox((current) => zoomView(current, factor, center, width, height));
    }

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [width, height]);

  // preserveAspectRatio="meet" fits the whole viewBox, so the bigger ratio wins
  const unitsPerPixel = Math.max(viewBox.width / pixelSize.width, viewBox.height / pixelSize.height);

  const frameWidth = getFrameView(width, height).width;
  const isAtMaxZoomIn = viewBox.width <= frameWidth * (MAX_ZOOM_IN + 0.02);
  const isWhole = viewBox.width >= getWholeView(width, height, pixelSize).width * 0.98;
  const isAtHome = homeView === null || isSameView(viewBox, homeView);

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

    // One finger / mouse: drag / scroll the map
    if (pointers.current.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      dragDistance.current += Math.hypot(dx, dy);

      if (dragDistance.current > DRAG_THRESHOLD) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setViewBox((box) => clampView({ ...box, x: box.x - dx * unitsPerPixel, y: box.y - dy * unitsPerPixel }, width, height));
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
        setViewBox((box) => zoomView(box, factor, center, width, height));
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
  // The same threshold as the drag: a move that moved the map is never also a tap.
  function handleClickCapture(event: MouseEvent<SVGSVGElement>) {
    if (dragDistance.current > DRAG_THRESHOLD) {
      event.stopPropagation();
    }
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onMapClick || !svgRef.current) return;
    onMapClick(screenToSvg(svgRef.current, event.clientX, event.clientY), unitsPerPixel);
  }

  // Double click / double tap: zoom in on the point, or back to the home view if already zoomed in
  function handleDoubleClick(event: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    if (!isAtHome && homeView) {
      setViewBox(homeView);
    } else {
      const center = screenToSvg(svgRef.current, event.clientX, event.clientY);
      setViewBox((current) => zoomView(current, 0.45, center, width, height));
    }
  }

  function handleZoomIn(e: MouseEvent) {
    e.stopPropagation();
    const center = {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    setViewBox((box) => zoomView(box, 1 / ZOOM_STEP, center, width, height));
  }

  function handleZoomOut(e: MouseEvent) {
    e.stopPropagation();
    const center = {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    setViewBox((box) => zoomView(box, ZOOM_STEP, center, width, height));
  }

  function handleResetZoom(e: MouseEvent) {
    e.stopPropagation();
    if (homeView) setViewBox(homeView);
  }

  return (
    <div className="floor-map">
      <svg
        ref={svgRef}
        className="floor-map-svg is-draggable"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClickCapture={handleClickCapture}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isPlanHidden ? (
          // The outline of the plan stays, so the admin still sees where the floor ends
          <rect x={0} y={0} width={width} height={height} fill="#ffffff" stroke="#d3d8dd" strokeWidth={2 * unitsPerPixel} />
        ) : (
          <image href={planUrl} x={0} y={0} width={width} height={height} />
        )}
        <MapScaleContext.Provider value={unitsPerPixel}>{children}</MapScaleContext.Provider>
      </svg>

      {/* Floating Zoom Controls: positioned bottom-left away from stores and header */}
      <div className="map-zoom-controls" role="group" aria-label="בקרת תצוגת מפה">
        <button
          type="button"
          className="map-zoom-btn"
          onClick={handleZoomIn}
          disabled={isAtMaxZoomIn}
          aria-label="התקרב במפה"
          title="התקרב (+)"
        >
          <PlusIcon size={18} />
        </button>
        <button
          type="button"
          className="map-zoom-btn"
          onClick={handleZoomOut}
          disabled={isWhole}
          aria-label="התרחק במפה"
          title="התרחק (-)"
        >
          <MinusIcon size={18} />
        </button>
        <button
          type="button"
          className="map-zoom-btn is-fit"
          onClick={handleResetZoom}
          disabled={isAtHome}
          aria-label="התאמה למסך"
          title="התאמה למסך (מרכוז)"
        >
          <FitScreenIcon size={16} />
        </button>
      </div>
    </div>
  );
}

export default FloorMap;
