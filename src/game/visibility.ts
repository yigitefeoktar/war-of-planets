export type ViewBounds = { left: number; top: number; right: number; bottom: number };

// Invert every viewport corner: rotation and shake need more than transform.a.
export function visibleWorldBounds(transform: { a: number; b: number; c?: number; d?: number; e: number; f: number },
  width: number, height: number): ViewBounds {
  const { a, b, e, f } = transform;
  const c = transform.c ?? -b, d = transform.d ?? a;
  const determinant = a * d - b * c;
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([sx, sy]) => ({
    x: (d * (sx - e) - c * (sy - f)) / determinant,
    y: (-b * (sx - e) + a * (sy - f)) / determinant,
  }));
  return { left: Math.min(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)),
    right: Math.max(...corners.map(p => p.x)), bottom: Math.max(...corners.map(p => p.y)) };
}

export function overlapsView(view: ViewBounds, x: number, y: number, radius: number) {
  return x + radius >= view.left && x - radius <= view.right && y + radius >= view.top && y - radius <= view.bottom;
}
