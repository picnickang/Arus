export const SVG_W = 200;
export const SVG_H = 80;
export const HULL_LEFT = 8;
export const HULL_RIGHT = 192;
export const HULL_TOP = 10;
export const HULL_BOTTOM = 70;
export const HULL_W = HULL_RIGHT - HULL_LEFT;
export const WATERLINE_Y = 62;
export const DECK_Y = 30;
export const SUPER_TOP = 12;
export const SUPER_BOTTOM = DECK_Y;
export const SUPER_LEFT = 155;
export const SUPER_RIGHT = 190;

export function hullTopAt(x: number): number {
  if (x >= SUPER_LEFT && x <= SUPER_RIGHT) {
    return SUPER_TOP;
  }
  if (x > SUPER_RIGHT) {
    const t = (x - SUPER_RIGHT) / (HULL_RIGHT - SUPER_RIGHT);
    return DECK_Y + t * (DECK_Y - HULL_TOP);
  }
  return DECK_Y;
}

export function hullBottomAt(x: number): number {
  if (x < HULL_LEFT + 20) {
    const t = (x - HULL_LEFT) / 20;
    return HULL_BOTTOM - (1 - t) * 5;
  }
  if (x > HULL_RIGHT - 15) {
    const t = (HULL_RIGHT - x) / 15;
    return HULL_BOTTOM - (1 - t) * 12;
  }
  return HULL_BOTTOM;
}

export function hullPath(): string {
  return `M ${HULL_LEFT},${HULL_BOTTOM - 5}
    L ${HULL_LEFT},${DECK_Y}
    L ${SUPER_LEFT},${DECK_Y}
    L ${SUPER_LEFT},${SUPER_TOP}
    L ${SUPER_RIGHT},${SUPER_TOP}
    L ${SUPER_RIGHT},${DECK_Y}
    Q ${HULL_RIGHT - 2},${DECK_Y} ${HULL_RIGHT},${DECK_Y + 8}
    L ${HULL_RIGHT},${HULL_BOTTOM - 12}
    Q ${HULL_RIGHT},${HULL_BOTTOM} ${HULL_RIGHT - 10},${HULL_BOTTOM}
    L ${HULL_LEFT + 5},${HULL_BOTTOM}
    Q ${HULL_LEFT},${HULL_BOTTOM} ${HULL_LEFT},${HULL_BOTTOM - 5}
    Z`;
}
