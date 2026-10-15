// Build the strategic graph before placing any worlds. Coarse links are
// subdivided later, so an unselected link cannot become an accidental attack.
export type RoutePoint = { x: number; y: number };
export type RouteEdge = [number, number];
export type RouteNetwork = { points: RoutePoint[]; edges: RouteEdge[] };

const shuffled = <T>(items: readonly T[], random: () => number): T[] =>
  items.map(value => ({ value, rank: random() })).sort((a, b) => a.rank - b.rank).map(item => item.value);
const pickInt = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

export function quickRoutes(family: number, random: () => number): RouteNetwork & { columns: number; rows: number } {
  const columns = pickInt(random, family === 1 ? 3 : 2, 3);
  const rows = pickInt(random, columns === 2 ? 3 : 2, 3);
  const points: RoutePoint[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) points.push({ x: x * 2 - columns + 1, y: y * 2 - rows + 1 });
  const index = (x: number, y: number) => y * columns + x;
  const possible: RouteEdge[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    if (x + 1 < columns) possible.push([index(x, y), index(x + 1, y)]);
    if (y + 1 < rows) possible.push([index(x, y), index(x, y + 1)]);
  }
  const edges: RouteEdge[] = [];
  const parent = points.map((_, i) => i);
  const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
  const add = (edge: RouteEdge) => {
    if (edges.some(([a, b]) => a === edge[0] && b === edge[1])) return;
    edges.push(edge); parent[root(edge[0])] = root(edge[1]);
  };
  const edgeAt = (a: number, b: number) => possible.find(edge => edge[0] === Math.min(a, b) && edge[1] === Math.max(a, b))!;
  if (family === 3) {
    // Connected arenas can overlap or occupy opposite parts of the battlefield.
    const rooms: [number, number][] = [];
    for (let y = 0; y < rows - 1; y++) for (let x = 0; x < columns - 1; x++) rooms.push([x, y]);
    for (const [x, y] of shuffled(rooms, random).slice(0, pickInt(random, 1, Math.min(3, rooms.length)))) {
      const a = index(x, y), b = index(x + 1, y), c = index(x, y + 1), d = index(x + 1, y + 1);
      [edgeAt(a, b), edgeAt(a, c), edgeAt(b, d), edgeAt(c, d)].forEach(add);
    }
  }
  const ranked = possible.map(edge => {
    const a = points[edge[0]], b = points[edge[1]];
    const crossing = Math.sign(a.x) !== Math.sign(b.x) || Math.sign(a.y) !== Math.sign(b.y);
    return { edge, rank: random() + (family === 0 && crossing ? 2 : 0) };
  }).sort((a, b) => a.rank - b.rank);
  // Kruskal connects every arena without filling the empty passages between them.
  for (const { edge } of ranked) if (root(edge[0]) !== root(edge[1])) add(edge);
  const extra = family === 1 ? pickInt(random, 1, 2) : family === 0 ? pickInt(random, 2, 4) : pickInt(random, 0, 1);
  const unused = shuffled(possible.filter(edge => !edges.includes(edge)), random);
  if (family === 0) unused.sort((a, b) => {
    const crossing = ([first, second]: RouteEdge) => Number(Math.sign(points[first].x) !== Math.sign(points[second].x) || Math.sign(points[first].y) !== Math.sign(points[second].y));
    return crossing(a) - crossing(b);
  });
  unused.slice(0, extra).forEach(add);
  return { points, edges, columns, rows };
}

const HEX = [[1, 0], [0.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2], [-1, 0], [-0.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2]];
const apart = (a: RoutePoint, b: RoutePoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function chaosRoutes(family: number, random: () => number): RoutePoint[] {
  if (family === 2) {
    const count = pickInt(random, 4, 8);
    const radius = 1 / (2 * Math.sin(Math.PI / count));
    return Array.from({ length: count }, (_, i) => ({ x: radius * Math.cos(i * Math.PI * 2 / count), y: radius * Math.sin(i * Math.PI * 2 / count) }));
  }
  const points: RoutePoint[] = [{ x: 0, y: 0 }];
  const count = pickInt(random, family === 0 ? 4 : 6, family === 0 ? 7 : 8);
  const loopBias = random() * 0.35;
  while (points.length < count) {
    const candidates = shuffled(points.flatMap((point, source) => HEX.map(([x, y]) => ({ x: point.x + x, y: point.y + y, source }))), random);
    const degree = (point: RoutePoint) => points.filter(other => other !== point && apart(point, other) < 1.01).length;
    const valid = candidates.filter(point => {
      if (points.some(other => apart(point, other) < 0.99)) return false;
      const neighbors = points.filter(other => apart(point, other) < 1.01);
      if (neighbors.some(other => degree(other) >= 4)) return false;
      // Monotonic growth leaves a guaranteed outward step, so chains cannot
      // trap themselves and fail to generate. They can still turn and bend.
      if (family === 0) return point.source === points.length - 1 && point.x > points[point.source].x + 0.49 && neighbors.length === 1;
      if (family === 1) return neighbors.length === 1;
      return neighbors.length <= 3;
    });
    // Guarantee a fork, then let every branch grow rather than always filling
    // the same central hub. Loop density also varies within the multi-front family.
    let next = valid[0];
    if (family === 1 && points.length >= 3 && points.every(point => degree(point) < 3)) next = valid.find(point => degree(points[point.source]) >= 2) ?? next;
    if (family === 3) {
      next = valid.map(point => ({ point, rank: random() + loopBias * points.filter(p => apart(point, p) < 1.01).length }))
        .sort((a, b) => b.rank - a.rank)[0]?.point;
      if (points.length >= 3 && points.reduce((sum, point) => sum + degree(point), 0) / 2 < points.length) {
        next = valid.find(point => points.filter(p => apart(point, p) < 1.01).length >= 2) ?? next;
      }
    }
    if (!next) throw new Error('Could not grow a star route');
    points.push({ x: next.x, y: next.y });
  }
  // Centre irregular constellations before applying their orientation and scale.
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return points.map(point => ({ x: point.x - cx, y: point.y - cy }));
}
