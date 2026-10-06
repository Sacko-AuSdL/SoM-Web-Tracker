export interface MapView { scale: number; x: number; y: number }
export interface ScreenPoint { left: number; top: number }

// Shared transform for area, Orb, hint, and directed Cannon overlays.
export function worldToScreen(view: MapView, x: number, y: number, dx = 0, dy = 0): ScreenPoint {
  return { left: view.x + x * view.scale + dx, top: view.y + y * view.scale + dy };
}
