import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("Broadcast is pure black and borderless, compactly shares the same icons without capture controls", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toContain("body:has(.inventory-broadcast) { background: #000000; min-width: 0; overflow: hidden; }");
  expect(css).toContain("width: min(270px, 100vw)");
  expect(css).toContain(".inventory-broadcast .item-card");
  expect(css).toContain("border: 0; border-radius: 0; padding: 0; background: #000000;");
});

it("keeps unknown GP knowledge visually quiet but discoverable on hover, keyboard focus and touch", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css).toMatch(/\.gp-badge\.unknown\s*\{\s*opacity: 0;/);
  expect(css).toContain(".inventory-slot:hover .gp-badge.unknown");
  expect(css).toContain(".inventory-slot:focus-within .gp-badge.unknown");
  expect(css).toContain(".gp-badge.unknown:focus-visible");
  expect(css).toContain("@media (hover: none), (pointer: coarse)");
  expect(css).toContain(".revival-required:focus-within");
});

it("uses blank color-only checks and a compact original vector Cannon icon", () => {
  const css = readFileSync("src/styles.css", "utf8");
  expect(css.match(/\.map-pin \{([^}]+)\}/)[1]).toContain("padding: 0; display: grid; place-items: center;");
  expect(css).not.toContain(".map-symbol");
  expect(css).toContain(".cannon-symbol { width: 16px; height: 16px; display: block; }");
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
