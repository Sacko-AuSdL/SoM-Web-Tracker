import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("centers every inner marker symbol, including blocked ×, with one zero-padding grid rule", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css.match(/\.map-pin \{([^}]+)\}/)[1]).toContain("padding: 0; display: grid; place-items: center;");
  const symbolRule = css.match(/\.map-pin \.map-symbol \{([^}]+)\}/)[1];
  expect(symbolRule).toContain("place-items: center; width: 100%; height: 100%;");
  expect(symbolRule).toContain('font: 700 12px/1 "Segoe UI", sans-serif');
});

it("puts route stroke hit targets above ordinary gameplay markers without making the SVG background interactive", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css.match(/\.cannon-lines \{([^}]+)\}/)[1]).toContain("pointer-events: none; z-index: 4;");
  expect(css.match(/\.cannon-line-hit \{([^}]+)\}/)[1]).toContain("pointer-events: stroke;");
});

it("gives Square real two-column section areas with 4x2 and 3+2 grids", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toContain('grid-template-areas: "characters characters" "elements weapons" "keys seeds"');
  for (const [category, area] of [["element", "elements"], ["weapon", "weapons"], ["key-item", "keys"], ["seed", "seeds"]])
    expect(css).toContain(`[data-category="${category}"] { grid-area: ${area}; }`);
  expect(css).toContain('[data-category="key-item"] .item-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }');
  expect(css.match(/\.item-panel\[data-layout="square"\] \.item-card \{([^}]+)\}/)[1])
    .toContain("grid-template-columns: minmax(0, 1fr); grid-template-rows: 1fr; column-gap: 0;");
});

// Vitest stubs CSS imports. A Node-only stylesheet test keeps these source
// assertions independent of jsdom's incomplete CSS cascade implementation.
it("keeps grey for completed pins, green for reachable, red for blocked and amber for unknown", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toMatch(/\.map-pin\.pin-completed\s*\{\s*background: #697079;/);
  expect(css).toMatch(/\.map-pin\.pin-reachable\s*\{\s*background: #159447;/);
  expect(css).toMatch(/\.map-pin\.pin-unreachable\s*\{\s*background: #861f2d;/);
  expect(css).toMatch(/\.map-pin\.pin-unknown\s*\{\s*background: #d18a16;/);
});
