import type { PlaceType } from '../types/place';

// Finds the stores in a floor plan (SVG): a shape (rect / path / polygon) with a name written inside it.
// Every store gets its point in the MIDDLE of its shape. The admin reviews the list before anything is saved.

export interface DetectedPlace {
  key: number; // 1, 2, 3... - the number shown on the map and in the list
  name: string;
  category: string;
  type: PlaceType;
  x: number; // the middle of the shape, in floor-plan coordinates
  y: number;
  isSuggested: boolean; // false for things that are usually not destinations: elevators, stairs, entrances...
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlanText {
  text: string;
  box: Box;
  fontSize: number;
}

// Words that tell what a room is. English and Hebrew.
const SHELTER_WORDS = /shelter|protected space|safe room|ממ"?ד|מרחב מוגן|מקלט/i;
const SERVICE_WORDS = /restroom|toilet|\bwc\b|info|desk|first aid|atm|lost and found|שירותים|מודיעין|עזרה ראשונה|כספומט/i;
const NOT_A_PLACE_WORDS = /elevator|\blift\b|stairs|escalator|atrium|corridor|entrance|exit|seating|parking|מעלית|מדרגות|דרגנוע|אטריום|מסדרון|כניסה|יציאה|חניה/i;

const MIN_SHAPE_SHARE = 0.002; // a room is at least 0.2% of the plan (smaller = a table, an icon)
const MAX_SHAPE_SHARE = 0.4; // and at most 40% (bigger = the building outline, a big hall)

function centerOf(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function contains(box: Box, point: { x: number; y: number }): boolean {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

// The pure part: which texts sit inside which shapes. No browser needed here.
export function matchTextsToShapes(shapes: Box[], texts: PlanText[], planWidth: number, planHeight: number): DetectedPlace[] {
  const planArea = planWidth * planHeight;

  const rooms = shapes.filter((box) => {
    const share = (box.width * box.height) / planArea;
    return share >= MIN_SHAPE_SHARE && share <= MAX_SHAPE_SHARE;
  });

  // Each text goes to the SMALLEST room around its middle (a store inside a corridor goes to the store)
  const textsByRoom = new Map<Box, PlanText[]>();
  for (const text of texts) {
    const middle = centerOf(text.box);
    let bestRoom: Box | null = null;

    for (const room of rooms) {
      const fitsInside = contains(room, middle) && text.box.width <= room.width * 1.1;
      if (fitsInside && (bestRoom === null || room.width * room.height < bestRoom.width * bestRoom.height)) {
        bestRoom = room;
      }
    }

    if (bestRoom) {
      const list = textsByRoom.get(bestRoom) ?? [];
      list.push(text);
      textsByRoom.set(bestRoom, list);
    }
  }

  const found: Omit<DetectedPlace, 'key'>[] = [];

  for (const [room, roomTexts] of textsByRoom) {
    // The name is the biggest text (the topmost one if they are the same size)
    const byImportance = [...roomTexts].sort((a, b) => b.fontSize - a.fontSize || a.box.y - b.box.y);
    const nameText = byImportance[0];
    // The category is the next line under it, if there is one
    const others = roomTexts.filter((text) => text !== nameText).sort((a, b) => a.box.y - b.box.y);

    const name = nameText.text;
    const allWords = roomTexts.map((text) => text.text).join(' ');

    let type: PlaceType = 'store';
    if (SHELTER_WORDS.test(allWords)) type = 'shelter';
    else if (SERVICE_WORDS.test(allWords)) type = 'service';

    let category = others.length > 0 ? others[0].text : '';
    if (category === '') {
      if (type === 'shelter') category = 'מרחב מוגן';
      else if (type === 'service') category = 'שירותים';
      else category = 'חנויות';
    }

    const middle = centerOf(room);
    found.push({
      name,
      category,
      type,
      x: Math.round(middle.x),
      y: Math.round(middle.y),
      isSuggested: !NOT_A_PLACE_WORDS.test(allWords),
    });
  }

  // Top to bottom, then left to right - the order a person reads the plan
  found.sort((a, b) => a.y - b.y || a.x - b.x);
  return found.map((place, index) => ({ key: index + 1, ...place }));
}

// ---------- The browser part: measuring the plan ----------

// Removes everything that could run code or load files. The plan is only measured, never shown.
function makeSafe(root: Element) {
  root.querySelectorAll('script, foreignObject, image, use').forEach((element) => element.remove());
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith('on')) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

// Finds the stores in an SVG text. Returns [] when there are none (for example, a plan made from a photo).
export function detectPlacesInPlan(svgText: string): DetectedPlace[] {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const parsedRoot = parsed.documentElement;
  if (parsedRoot.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
    return [];
  }
  makeSafe(parsedRoot);

  // To measure sizes the browser must lay the SVG out, so we put it in the page, hidden and off screen
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;left:-20000px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none;';
  const svg = document.importNode(parsedRoot, true) as unknown as SVGSVGElement;
  svg.setAttribute('width', '1000');
  svg.setAttribute('height', '1000');
  holder.appendChild(svg);
  document.body.appendChild(holder);

  try {
    const viewBox = svg.viewBox.baseVal;
    const rootMatrix = svg.getScreenCTM();
    if (!rootMatrix || !viewBox || viewBox.width === 0) return [];
    const toPlan = rootMatrix.inverse();

    // The box of an element in plan coordinates (after all its transforms).
    // Plan coordinates start at 0, 0 - like the floor map shows the plan.
    function boxInPlan(element: SVGGraphicsElement): Box | null {
      const local = element.getBBox();
      const elementMatrix = element.getScreenCTM();
      if (!elementMatrix) return null;
      const matrix = toPlan.multiply(elementMatrix);

      const corners = [
        new DOMPoint(local.x, local.y),
        new DOMPoint(local.x + local.width, local.y),
        new DOMPoint(local.x, local.y + local.height),
        new DOMPoint(local.x + local.width, local.y + local.height),
      ].map((corner) => corner.matrixTransform(matrix));

      const xs = corners.map((corner) => corner.x);
      const ys = corners.map((corner) => corner.y);
      return {
        x: Math.min(...xs) - viewBox.x,
        y: Math.min(...ys) - viewBox.y,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }

    const shapes: Box[] = [];
    svg.querySelectorAll<SVGGraphicsElement>('rect, path, polygon').forEach((element) => {
      const box = boxInPlan(element);
      if (box) shapes.push(box);
    });

    const texts: PlanText[] = [];
    svg.querySelectorAll<SVGTextElement>('text').forEach((element) => {
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      const box = boxInPlan(element);
      if (text !== '' && box) {
        texts.push({ text, box, fontSize: parseFloat(getComputedStyle(element).fontSize) || 0 });
      }
    });

    return matchTextsToShapes(shapes, texts, viewBox.width, viewBox.height);
  } finally {
    holder.remove();
  }
}

// One line in the review list: what was found, plus the admin's choices
export interface ReviewRow extends DetectedPlace {
  include: boolean; // add this one?
  alreadyAdded: boolean; // a place with this name is already on this floor
}
