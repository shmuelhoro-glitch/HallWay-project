export function readSvgSize(svg) {
  const match = svg.match(
    /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i
  );
  if (!match) {
    throw { status: 400, code: "INVALID_SVG", message: "The SVG must have a viewBox" };
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}