export interface SvgPoint {
  x: number;
  y: number;
}

// Converts a screen position (clientX, clientY) to floor-plan coordinates.
// getScreenCTM() maps svg -> screen, inverse() maps screen -> svg.
// Works correctly after zoom and drag too.
export function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): SvgPoint {
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
