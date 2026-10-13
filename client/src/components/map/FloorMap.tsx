import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { screenToSvg } from '../../utils/svgCoords';
import type { SvgPoint } from '../../utils/svgCoords';
import { FitScreenIcon, MinusIcon, PlusIcon } from '../ui/Icons';
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
  // unitsPerPixel: how many plan units one screen pixel is right now (it changes with the zoom)
  onMapClick?: (point: SvgPoint, unitsPerPixel: number) => void;
  isPlanHidden?: boolean; // the admin editor can hide the plan, to see only the walkways
  children?: ReactNode;
}

const DRAG_THRESHOLD = 8; // pixels. Movements below this are taps/clicks
const ZOOM_STEP = 1.25;
const MAX_ZOOM_IN = 0.15; // can zoom in up to 15% of plan width
const MAX_ZOOM_OUT = 1.0;

// Safe-area padding to ensure no part of the floor plan is hidden under the floating header or dock
function getPlanPadding(width: number, height: number) {
  return {
    padX: Math.round(width * 0.05),
    padTop: Math.round(height * 0.06), // safe margin under the top search bar
    padBottom: Math.round(height * 0.16), // safe margin above the floating bottom dock
  };
}

// Initial overview viewBox that comfortably frames the entire building between header and dock
function getInitialViewBox(width: number, height: number): ViewBox {
  const { padX, padTop, padBottom } = getPlanPadding(width, height);
  return {
    x: -padX,
    y: -padTop,
    width: width + padX * 2,
    height: height + padTop + padBottom,
  };
}

// Keeps the viewBox clamped within safe bounds while allowing comfortable scrolling across all areas
function clampViewBox(box: ViewBox, planWidth: number, planHeight: number): ViewBox {
  const { padX, padTop, padBottom } = getPlanPadding(planWidth, planHeight);
  const totalWidth = planWidth + padX * 2;
  const totalHeight = planHeight + padTop + padBottom;

  const minWidth = totalWidth * MAX_ZOOM_IN;
  const maxWidth = totalWidth * MAX_ZOOM_OUT;
  const clampedWidth = Math.min(Math.max(box.width, minWidth), maxWidth);

  // Maintain natural aspect ratio
  const aspect = totalHeight / totalWidth;
  const clampedHeight = clampedWidth * aspect;

  let x = box.x;
  let y = box.y;

  // Horizontal bounds
  const minX = -padX;
  const maxX = planWidth + padX - clampedWidth;
  if (clampedWidth >= totalWidth - 2) {
    x = -padX;
  } else {
    x = Math.max(minX, Math.min(maxX, x));
  }

  // Vertical bounds: allow comfortable vertical scroll in overview and zoomed mode
  const minY = -padTop;
  const maxY = planHeight + padBottom - clampedHeight;
  if (clampedHeight >= totalHeight - 2) {
    // In overview mode, allow generous scrolling so the user can see top and bottom with zero obstruction
    const scrollAllowance = Math.round(planHeight * 0.22);
    y = Math.max(-padTop - scrollAllowance, Math.min(-padTop + scrollAllowance, y));
  } else {
    y = Math.max(minY, Math.min(maxY, y));
  }

  return {
    x,
    y,
    width: clampedWidth,
    height: clampedHeight,
  };
}

// Zoom = scale the viewBox around a center point (mouse cursor, touch pinch center, or screen center)
function zoomViewBox(
  current: ViewBox,
  factor: number,
  center: SvgPoint,
  planWidth: number,
  planHeight: number,
): ViewBox {
  const { padX } = getPlanPadding(planWidth, planHeight);
  const totalWidth = planWidth + padX * 2;

  const minWidth = totalWidth * MAX_ZOOM_IN;
  const maxWidth = totalWidth * MAX_ZOOM_OUT;
  const newWidth = Math.min(Math.max(current.width * factor, minWidth), maxWidth);
  const appliedFactor = newWidth / current.width;

  const rawBox: ViewBox = {
    x: center.x - (center.x - current.x) * appliedFactor,
    y: center.y - (center.y - current.y) * appliedFactor,
    width: newWidth,
    height: current.height * appliedFactor,
  };

  return clampViewBox(rawBox, planWidth, planHeight);
}

// Shows one floor plan. Layers (places, route, "you are here") are passed as children
// and drawn on top of the plan, in the same coordinates.
function FloorMap({ planUrl, width, height, onMapClick, isPlanHidden = false, children }: FloorMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(() => getInitialViewBox(width, height));
  const [pixelSize, setPixelSize] = useState({ width: 1, height: 1 });

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragDistance = useRef(0);
  const pinchDistance = useRef<number | null>(null);

  // Reset viewBox when floor dimensions or plan URL change
  useEffect(() => {
    setViewBox(getInitialViewBox(width, height));
  }, [width, height, planUrl]);

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

  // Mouse wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (!svg) return;
      const center = screenToSvg(svg, event.clientX, event.clientY);
      const factor = event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setViewBox((current) => zoomViewBox(current, factor, center, width, height));
    }

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [width, height]);

  // preserveAspectRatio="meet" fits the whole viewBox, so the bigger ratio wins
  const unitsPerPixel = Math.max(viewBox.width / pixelSize.width, viewBox.height / pixelSize.height);

  const { padX } = getPlanPadding(width, height);
  const totalWidth = width + padX * 2;
  const isAtMaxZoomIn = viewBox.width <= totalWidth * (MAX_ZOOM_IN + 0.02);
  const isAtOverview = viewBox.width >= totalWidth * 0.98;

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
        setViewBox((box) =>
          clampViewBox(
            {
              ...box,
              x: box.x - dx * unitsPerPixel,
              y: box.y - dy * unitsPerPixel,
            },
            width,
            height,
          ),
        );
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
        setViewBox((box) => zoomViewBox(box, factor, center, width, height));
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

  // After a drag the browser still sends a click. Stop it only if user genuinely dragged significantly.
  function handleClickCapture(event: MouseEvent<SVGSVGElement>) {
    if (dragDistance.current > 12) {
      event.stopPropagation();
    }
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onMapClick || !svgRef.current) return;
    onMapClick(screenToSvg(svgRef.current, event.clientX, event.clientY), unitsPerPixel);
  }

  // Double click / double tap: zoom in on point, or reset back to overview if already zoomed in
  function handleDoubleClick(event: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    if (!isAtOverview) {
      // Already zoomed in: reset back to overview
      setViewBox(getInitialViewBox(width, height));
    } else {
      // Zoom in on clicked point
      const center = screenToSvg(svgRef.current, event.clientX, event.clientY);
      setViewBox((current) => zoomViewBox(current, 0.45, center, width, height));
    }
  }

  function handleZoomIn(e: MouseEvent) {
    e.stopPropagation();
    const center = {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    setViewBox((box) => zoomViewBox(box, 1 / ZOOM_STEP, center, width, height));
  }

  function handleZoomOut(e: MouseEvent) {
    e.stopPropagation();
    const center = {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    setViewBox((box) => zoomViewBox(box, ZOOM_STEP, center, width, height));
  }

  function handleResetZoom(e: MouseEvent) {
    e.stopPropagation();
    setViewBox(getInitialViewBox(width, height));
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
          disabled={isAtOverview}
          aria-label="התרחק במפה"
          title="התרחק (-)"
        >
          <MinusIcon size={18} />
        </button>
        <button
          type="button"
          className="map-zoom-btn is-fit"
          onClick={handleResetZoom}
          disabled={isAtOverview}
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
