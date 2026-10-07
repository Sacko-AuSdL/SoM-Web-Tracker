import type { CannonPoint } from "../domain/cannons";
export interface MapView { scale: number; x: number; y: number }
export interface ScreenPoint { left: number; top: number }

// Shared transform for area, Orb, hint, and directed Cannon overlays.
export function worldToScreen(view: MapView, x: number, y: number, dx = 0, dy = 0): ScreenPoint {
  return { left: view.x + x * view.scale + dx, top: view.y + y * view.scale + dy };
}

// Display-only smooth declutter; pins and route endpoints share this offset.
export function cannonToScreen(view: MapView, point: CannonPoint): ScreenPoint {
  const t = Math.max(0, Math.min(1, (.35 - view.scale) / (.35 - .12)));
  const shift = point.id === "gaiasNavel" ? 36 * t * t * (3 - 2 * t) : 0;
  return worldToScreen(view, point.x, point.y, (point.screenOffset?.x ?? 18) - shift, point.screenOffset?.y ?? 16);
}
