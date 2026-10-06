import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Vitest stubs CSS imports. A Node-only stylesheet test keeps these source
// assertions independent of jsdom's incomplete CSS cascade implementation.
it("keeps grey for completed pins, green for reachable, red for blocked and amber for unknown", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toMatch(/\.map-pin\.pin-completed\s*\{\s*background: #697079;/);
  expect(css).toMatch(/\.map-pin\.pin-reachable\s*\{\s*background: #159447;/);
  expect(css).toMatch(/\.map-pin\.pin-unreachable\s*\{\s*background: #861f2d;/);
  expect(css).toMatch(/\.map-pin\.pin-unknown\s*\{\s*background: #d18a16;/);
});
