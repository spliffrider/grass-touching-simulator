import { describe, expect, it } from "vitest";

import {
  MOUSE_FIELD_DRAG_THRESHOLD_PX,
  TOUCH_FIELD_DRAG_THRESHOLD_PX,
  beginFieldPointerGesture,
  shouldAttemptFieldTouchOnPointerDown,
  updateFieldPointerGesture,
} from "../src/game/ecosystem/EcosystemFieldInput";

describe("EcosystemFieldInput", () => {
  it("commits mouse input on press so clicking has no release latency", () => {
    expect(shouldAttemptFieldTouchOnPointerDown(false, 10_000)).toBe(true);
  });

  it("commits a touchscreen press immediately when the one-tile field cannot pan", () => {
    expect(shouldAttemptFieldTouchOnPointerDown(true, 1)).toBe(true);
    expect(shouldAttemptFieldTouchOnPointerDown(true, 4)).toBe(false);
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
});
