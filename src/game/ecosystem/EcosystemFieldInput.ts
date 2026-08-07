import { isFieldViewportFixed } from "./EcosystemViewport";

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

export class FieldPointerGestureRegistry {
  private readonly gestures = new Map<number, FieldPointerGesture>();

  get size(): number {
    return this.gestures.size;
  }

  begin(
    pointerId: number,
    pointerWasTouch: boolean,
    x: number,
    y: number,
    startedAtMs: number,
    touchAttemptedOnDown: boolean,
  ): FieldPointerGesture {
    const gesture = beginFieldPointerGesture(
      pointerId,
      pointerWasTouch,
      x,
      y,
      startedAtMs,
      touchAttemptedOnDown,
    );
    this.gestures.set(pointerId, gesture);
    return gesture;
  }

  get(pointerId: number): FieldPointerGesture | null {
    return this.gestures.get(pointerId) ?? null;
  }

  end(pointerId: number): FieldPointerGesture | null {
    const gesture = this.gestures.get(pointerId) ?? null;
    this.gestures.delete(pointerId);
    return gesture;
  }

  clear(): void {
    this.gestures.clear();
  }
}

export function resizeFieldInputHitArea(
  hitArea: unknown,
  width: number,
  height: number,
): boolean {
  const rectangle = hitArea as { setTo?: (x: number, y: number, width: number, height: number) => unknown } | null;
  if (typeof rectangle?.setTo !== "function") return false;
  rectangle.setTo(0, 0, width, height);
  return true;
}

export function shouldAttemptFieldTouchOnPointerDown(
  pointerWasTouch: boolean,
  fieldWidth: number,
  fieldHeight: number,
): boolean {
  return !pointerWasTouch || isFieldViewportFixed(fieldWidth, fieldHeight);
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
