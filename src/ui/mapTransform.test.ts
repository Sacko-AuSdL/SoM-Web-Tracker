import { describe, expect, it } from "vitest";
import { worldToScreen } from "./mapTransform";

describe("shared world-map transform", () => {
  it("projects the same source point consistently for markers and future directed lines", () => {
    const view = { scale: 0.5, x: 12, y: -4 };
    expect(worldToScreen(view, 100, 200)).toEqual({ left: 62, top: 96 });
    expect(worldToScreen(view, 100, 200, 5, -8)).toEqual({ left: 67, top: 88 });
  });
});
