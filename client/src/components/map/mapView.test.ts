import { describe, expect, test } from 'vitest';
import { clampView, getHomeView, getWholeView, zoomView } from './mapView';

const PHONE = { width: 390, height: 600 };
const DESKTOP = { width: 1400, height: 800 };

describe('getHomeView', () => {
  test('a plan that is readable whole opens whole', () => {
    const home = getHomeView(640, 1000, PHONE);

    expect(home).toEqual(getWholeView(640, 1000, PHONE));
  });

  test('a long plan on a phone opens filling the screen across, from its top', () => {
    const home = getHomeView(1420, 3720, PHONE);

    expect(home.width).toBeCloseTo(1420 * 1.1); // the plan and its padding on both sides
    expect(home.height / home.width).toBeCloseTo(PHONE.height / PHONE.width);
    expect(home.y).toBe(-Math.round(3720 * 0.06)); // the top of the frame (the padding is whole units)
  });

  test('a long plan opens around the point that was asked for', () => {
    const home = getHomeView(1420, 3720, PHONE, { x: 700, y: 2000 });

    expect(home.y + home.height / 2).toBeCloseTo(2000);
  });

  test('a point at the very end does not push the view out of the plan', () => {
    const home = getHomeView(1420, 3720, PHONE, { x: 700, y: 3719 });

    expect(home.y + home.height).toBeCloseTo(3720 + Math.round(3720 * 0.16));
  });

  test('a long plan on a screen long enough to read it opens whole', () => {
    const tallScreen = { width: 400, height: 1200 };

    expect(getHomeView(1420, 3720, tallScreen)).toEqual(getWholeView(1420, 3720, tallScreen));
  });

  test('a plan of the usual shape opens whole on a big screen too', () => {
    expect(getHomeView(640, 1000, DESKTOP)).toEqual(getWholeView(640, 1000, DESKTOP));
  });
});

describe('clampView and zoomView', () => {
  test('a view keeps the shape of the screen', () => {
    const home = getHomeView(1420, 3720, PHONE);
    const moved = clampView({ ...home, y: home.y + 500 }, 1420, 3720);

    expect(moved.height / moved.width).toBeCloseTo(home.height / home.width);
    expect(moved.y).toBeCloseTo(home.y + 500);
  });

  test('zooming out stops at the whole plan, and the whole plan stays in the middle', () => {
    const home = getHomeView(1420, 3720, PHONE);
    const out = zoomView(home, 50, { x: 0, y: 0 }, 1420, 3720);

    const whole = getWholeView(1420, 3720, PHONE);

    for (const side of ['x', 'y', 'width', 'height'] as const) {
      expect(out[side]).toBeCloseTo(whole[side]);
    }
  });

  test('zooming in stops at 15% of the plan width', () => {
    const home = getHomeView(640, 1000, PHONE);
    const zoomedIn = zoomView(home, 0.01, { x: 320, y: 500 }, 640, 1000);

    expect(zoomedIn.width).toBeCloseTo(640 * 1.1 * 0.15);
  });

  test('a view can not be dragged away from the plan', () => {
    const home = getHomeView(1420, 3720, PHONE);
    const dragged = clampView({ ...home, y: 99999 }, 1420, 3720);

    expect(dragged.y + dragged.height).toBeCloseTo(3720 + Math.round(3720 * 0.16));
  });
});
