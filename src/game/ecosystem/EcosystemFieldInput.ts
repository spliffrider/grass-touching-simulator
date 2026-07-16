export const MOUSE_FIELD_DRAG_THRESHOLD_PX = 8;
export const TOUCH_FIELD_DRAG_THRESHOLD_PX = 14;

export interface FieldPointerGesture {
  pointerId: number;
  pointerWasTouch: boolean;
  startedAtMs: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  deltaX: number;
  deltaY: number;
  moved: boolean;
  touchAttemptedOnDown: boolean;
}

export function shouldAttemptFieldTouchOnPointerDown(pointerWasTouch: boolean, logicalTiles: number): boolean {
  return !pointerWasTouch || logicalTiles <= 1;
}

export function beginFieldPointerGesture(
  pointerId: number,
  pointerWasTouch: boolean,
  x: number,
  y: number,
  startedAtMs: number,
  touchAttemptedOnDown: boolean,
): FieldPointerGesture {
  return {
    pointerId,
    pointerWasTouch,
    startedAtMs,
    startX: x,
    startY: y,
    lastX: x,
    lastY: y,
    deltaX: 0,
    deltaY: 0,
    moved: false,
    touchAttemptedOnDown,
  };
}

export function updateFieldPointerGesture(
  gesture: FieldPointerGesture,
  x: number,
  y: number,
): boolean {
  gesture.deltaX = x - gesture.lastX;
  gesture.deltaY = y - gesture.lastY;
  const threshold = gesture.pointerWasTouch
    ? TOUCH_FIELD_DRAG_THRESHOLD_PX
    : MOUSE_FIELD_DRAG_THRESHOLD_PX;
  const totalX = x - gesture.startX;
  const totalY = y - gesture.startY;
  const wasMoved = gesture.moved;

  if (totalX * totalX + totalY * totalY > threshold * threshold) {
    gesture.moved = true;
  }
  gesture.lastX = x;
  gesture.lastY = y;

  return !wasMoved && gesture.moved;
}
