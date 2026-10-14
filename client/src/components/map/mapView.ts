import type { SvgPoint } from '../../utils/svgCoords';

// What part of the floor plan is on screen, and how it may move.
// Pure functions, so FloorMap stays about pointers and buttons.

// The part of the plan that is on screen, in plan units
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The size of the map on screen, in pixels
export interface ScreenSize {
  width: number;
  height: number;
}

export const MAX_ZOOM_IN = 0.15; // the view can shrink to 15% of the plan width
// A plan whose short side would be smaller than this on screen is too small to read whole
// (a long mall on a phone). Such a plan opens filling the screen across, and the visitor drags along it.
const READABLE_SIDE = 300; // pixels

// Room around the plan, so its edges are not hidden under the floating header and the bottom dock
export function getPlanPadding(width: number, height: number) {
  return {
    padX: Math.round(width * 0.05),
    padTop: Math.round(height * 0.06),
    padBottom: Math.round(height * 0.16),
  };
}

// The plan with its padding: everything that may ever be on screen
function getFrame(width: number, height: number) {
  const { padX, padTop, padBottom } = getPlanPadding(width, height);
  return { x: -padX, y: -padTop, width: width + padX * 2, height: height + padTop + padBottom };
}

// Before the size on screen is known: the whole plan (the svg fits it to the screen by itself)
export function getFrameView(width: number, height: number): ViewBox {
  return getFrame(width, height);
}

// The most zoomed-out view: the whole plan, in the shape of the screen
export function getWholeView(width: number, height: number, screen: ScreenSize): ViewBox {
  const frame = getFrame(width, height);
  const ratio = screen.height / screen.width;
  const viewWidth = Math.max(frame.width, frame.height / ratio);
  const viewHeight = viewWidth * ratio;
  return {
    x: frame.x - (viewWidth - frame.width) / 2,
    y: frame.y - (viewHeight - frame.height) / 2,
    width: viewWidth,
    height: viewHeight,
  };
}

// Keeps a view inside the plan (with its padding), and between the zoom limits.
// The view keeps its own shape: the shape of the screen.
export function clampView(box: ViewBox, width: number, height: number): ViewBox {
  const frame = getFrame(width, height);
  const ratio = box.height / box.width;
  const maxWidth = Math.max(frame.width, frame.height / ratio);
  const viewWidth = Math.min(Math.max(box.width, frame.width * MAX_ZOOM_IN), maxWidth);
  const viewHeight = viewWidth * ratio;

  // Narrower than the plan: may move inside it. Wider: stays in the middle.
  const x =
    viewWidth >= frame.width
      ? frame.x - (viewWidth - frame.width) / 2
      : Math.min(Math.max(box.x, frame.x), frame.x + frame.width - viewWidth);
  const y =
    viewHeight >= frame.height
      ? frame.y - (viewHeight - frame.height) / 2
      : Math.min(Math.max(box.y, frame.y), frame.y + frame.height - viewHeight);

  return { x, y, width: viewWidth, height: viewHeight };
}

// Zoom = make the view smaller or bigger, while the point under the finger / mouse stays put
export function zoomView(box: ViewBox, factor: number, center: SvgPoint, width: number, height: number): ViewBox {
  return clampView(
    {
      x: center.x - (center.x - box.x) * factor,
      y: center.y - (center.y - box.y) * factor,
      width: box.width * factor,
      height: box.height * factor,
    },
    width,
    height,
  );
}

// Where the map opens: the whole plan, or - for a plan too long to read whole - the plan filling the
// screen across, around startAt ("you are here", the route) or at its start
export function getHomeView(width: number, height: number, screen: ScreenSize, startAt?: SvgPoint | null): ViewBox {
  const whole = getWholeView(width, height, screen);
  const pixelsPerUnit = screen.width / whole.width;
  if (Math.min(width, height) * pixelsPerUnit >= READABLE_SIDE) {
    return whole;
  }

  const frame = getFrame(width, height);
  const ratio = screen.height / screen.width;
  const isTall = frame.height / frame.width > ratio;

  if (isTall) {
    const viewHeight = frame.width * ratio;
    const top = startAt ? startAt.y - viewHeight / 2 : frame.y;
    return clampView({ x: frame.x, y: top, width: frame.width, height: viewHeight }, width, height);
  }

  const viewWidth = frame.height / ratio;
  const left = startAt ? startAt.x - viewWidth / 2 : frame.x;
  return clampView({ x: left, y: frame.y, width: viewWidth, height: frame.height }, width, height);
}

export function isSameView(a: ViewBox, b: ViewBox): boolean {
  const tolerance = a.width * 0.01;
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance
  );
}
