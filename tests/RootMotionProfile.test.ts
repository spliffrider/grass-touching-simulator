import { describe, expect, it } from "vitest";

import { createRootMotionProfile } from "../src/game/redesign/RootMotionProfile";

describe("RootMotionProfile", () => {
  it("is deterministic for a root without synchronizing neighboring roots", () => {
    expect(createRootMotionProfile(7)).toEqual(createRootMotionProfile(7));
    expect(createRootMotionProfile(7)).not.toEqual(createRootMotionProfile(8));
  });

  it("keeps organic motion inside restrained rendering bounds", () => {
    for (let rootId = 0; rootId < 25; rootId += 1) {
      const profile = createRootMotionProfile(rootId);
      expect(profile.phase).toBeGreaterThanOrEqual(0);
      expect(profile.phase).toBeLessThanOrEqual(Math.PI * 2);
      expect(profile.breathSpeed).toBeGreaterThanOrEqual(1.72);
      expect(profile.breathSpeed).toBeLessThanOrEqual(2.58);
      expect(profile.breathAmount).toBeGreaterThanOrEqual(0.014);
      expect(profile.breathAmount).toBeLessThanOrEqual(0.03);
      expect(profile.swayAmount).toBeGreaterThanOrEqual(0.72);
      expect(profile.swayAmount).toBeLessThanOrEqual(1.72);
      expect(profile.bobAmount).toBeGreaterThanOrEqual(0.42);
      expect(profile.bobAmount).toBeLessThanOrEqual(1.08);
      expect(profile.tiltAmount).toBeGreaterThanOrEqual(0.48);
      expect(profile.tiltAmount).toBeLessThanOrEqual(1.12);
    }
  });
});
