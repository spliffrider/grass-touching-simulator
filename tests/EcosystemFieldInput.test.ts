import { describe, expect, it } from "vitest";

import {
  MOUSE_FIELD_DRAG_THRESHOLD_PX,
  TOUCH_FIELD_DRAG_THRESHOLD_PX,
  FieldPointerGestureRegistry,
  beginFieldPointerGesture,
  resizeFieldInputHitArea,
  shouldAttemptFieldTouchOnPointerDown,
  updateFieldPointerGesture,
} from "../src/game/ecosystem/EcosystemFieldInput";

describe("EcosystemFieldInput", () => {
  it("commits mouse input on press so clicking has no release latency", () => {
    expect(shouldAttemptFieldTouchOnPointerDown(false, 100, 100)).toBe(true);
  });

  it("commits touchscreen presses immediately on fixed early fields", () => {
    expect(shouldAttemptFieldTouchOnPointerDown(true, 1, 1)).toBe(true);
    expect(shouldAttemptFieldTouchOnPointerDown(true, 2, 2)).toBe(true);
    expect(shouldAttemptFieldTouchOnPointerDown(true, 5, 5)).toBe(true);
    expect(shouldAttemptFieldTouchOnPointerDown(true, 8, 8)).toBe(false);
  });

  it("does not mistake ordinary mouse jitter for a drag", () => {
    const gesture = beginFieldPointerGesture(1, false, 100, 100, 0, true);
    const becameDrag = updateFieldPointerGesture(
      gesture,
      100 + MOUSE_FIELD_DRAG_THRESHOLD_PX - 1,
      102,
    );

    expect(becameDrag).toBe(false);
    expect(gesture.moved).toBe(false);
  });

  it("uses total displacement so several tiny moves still become a real pan", () => {
    const gesture = beginFieldPointerGesture(1, false, 100, 100, 0, true);

    updateFieldPointerGesture(gesture, 103, 100);
    updateFieldPointerGesture(gesture, 106, 100);
    const becameDrag = updateFieldPointerGesture(gesture, 100 + MOUSE_FIELD_DRAG_THRESHOLD_PX + 1, 100);

    expect(becameDrag).toBe(true);
    expect(gesture.moved).toBe(true);
  });

  it("gives touch taps a larger movement allowance than mouse input", () => {
    const gesture = beginFieldPointerGesture(2, true, 50, 50, 0, false);

    updateFieldPointerGesture(gesture, 50 + TOUCH_FIELD_DRAG_THRESHOLD_PX - 1, 52);
    expect(gesture.moved).toBe(false);

    const becameDrag = updateFieldPointerGesture(gesture, 50 + TOUCH_FIELD_DRAG_THRESHOLD_PX + 1, 52);
    expect(becameDrag).toBe(true);
  });

  it("keeps overlapping pointer gestures independent", () => {
    const gestures = new FieldPointerGestureRegistry();
    const first = gestures.begin(1, true, 50, 50, 10, false);
    const second = gestures.begin(2, true, 80, 80, 20, false);

    expect(gestures.size).toBe(2);
    expect(gestures.end(1)).toBe(first);
    expect(gestures.get(2)).toBe(second);
    expect(gestures.size).toBe(1);
  });

  it("resizes the actual Phaser hit area with the visible field surface", () => {
    const hitArea = {
      x: 4,
      y: 7,
      width: 1,
      height: 1,
      setTo(x: number, y: number, width: number, height: number) {
        Object.assign(this, { x, y, width, height });
      },
    };

    expect(resizeFieldInputHitArea(hitArea, 720, 480)).toBe(true);
    expect(hitArea).toMatchObject({ x: 0, y: 0, width: 720, height: 480 });
    expect(resizeFieldInputHitArea(null, 720, 480)).toBe(false);
  });
});
