import { FACTIONS, NEUTRAL, validateMap, type GeneratedMode, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';
import { between, distance, integer, mapConnected, rotate, seededRandom, shuffle, TAU, validateConnectionDensity, wrapMap } from './mapGenerationUtils';
import { buildQuickMap, QUICK_LAYOUTS, validateQuickGeometry } from './quickMapGenerator';
export { mapConnected, seededRandom } from './mapGenerationUtils';
export { QUICK_LAYOUTS, validateQuickGeometry } from './quickMapGenerator';

export const CHAOS_LAYOUTS = ['stellar-bend', 'branching-fronts', 'orbital-circuit', 'wide-fronts'] as const;
const HISTORY_KEY = 'war-of-planets.generated-maps.v3';

export function buildChaosMap(seed: number, layoutIndex: number): MapDefinition {
  const random = seededRandom(seed);
  const radius = between(random, 590, 594), separation = radius * 2 + between(random, 400, 402);
  const bend = layoutIndex === 2 ? Math.PI / 3 : layoutIndex === 1 ? between(random, 1.6, 2.1) : layoutIndex === 0 ? between(random, 2.15, 2.45) : between(random, 2.5, 2.8);
  const points = [rotate(1, 0, -bend / 2), rotate(1, 0, bend / 2), { x: 0, y: 0 }];
  const mean = { x: points.reduce((sum, point) => sum + point.x, 0) / 3, y: points.reduce((sum, point) => sum + point.y, 0) / 3 };
  const centers = points.map(point => ({ x: (point.x - mean.x) * separation, y: (point.y - mean.y) * separation }));
  const factions = shuffle(FACTIONS, random), weapons = () => shuffle(SUPERWEAPON_IDS, random).slice(0, random() < 0.5 ? 1 : 2), capitalWeapons = weapons();
  const planets: PlanetDefinition[] = [], orbits: OrbitDefinition[] = [];
  centers.forEach((center, system) => {
    const phase = between(random, 0, TAU), count = system < 2 ? 8 : integer(random, 8, 11), members: PlanetDefinition[] = [];
    for (let i = 0; i < count; i++) {
      const point = rotate(radius, 0, phase + i * TAU / count);
      const planet: PlanetDefinition = { id: `system-${system}-outer-${i}`, x: center.x + point.x, y: center.y + point.y, owner: NEUTRAL, ships: integer(random, 20, 42), superweaponUnlocks: weapons() };
      planets.push(planet); members.push(planet);
    }
    // The staggered inner pairs give each outer world several local choices.
    // Opposing capitals are 640 units apart; inner fronts remain protected
    // from every foreign system throughout their independent rotations.
    for (let i = 0; i < 4; i++) {
      const capital = system < 2 && i % 2 === 0;
      const point = rotate(i % 2 === 0 ? 320 : 340, 0, phase + Math.PI / 8 + Math.floor(i / 2) * Math.PI + (i % 2) * Math.PI / 4);
      const planet: PlanetDefinition = { id: `system-${system}-inner-${i}`, x: center.x + point.x, y: center.y + point.y,
        owner: capital ? factions[system * 2 + i / 2] : NEUTRAL, ships: capital ? 200 : integer(random, 24, 36),
        ...(capital ? { capital: true } : {}), superweaponUnlocks: capital ? [...capitalWeapons] : weapons() };
      planets.push(planet); members.push(planet);
    }
    for (const capital of members.filter(planet => planet.capital)) members.filter(planet => !planet.capital && distance(planet, capital) <= 600)
      .sort((a, b) => distance(a, capital) - distance(b, capital)).slice(0, 3).forEach((planet, i) => { planet.ships = 12 + i * 2; });
    orbits.push({ ...center, periodSeconds: integer(random, 220, 360), planetIds: members.map(planet => planet.id) });
  });
  return wrapMap('chaos-mode', seed, CHAOS_LAYOUTS[layoutIndex], planets, orbits);
}

const bridgeCertificates = new Map<string, boolean>();

/** Prove a bridge for every independent phase, with interval bounds. Samples
 * choose a candidate pair; the bound covers every angle around that sample. */
function permanentBridge(r1: number, n1: number, r2: number, n2: number, centers: number, range: number): boolean {
  if (centers - r1 - r2 > range) return false;
  const key = [r1, n1, r2, n2, centers, range].map(value => value.toFixed(6)).join(':');
  const cached = bridgeCertificates.get(key);
  if (cached !== undefined) return cached;
  const step1 = TAU / n1, step2 = TAU / n2;
  const cover = (a: number, b: number, ha: number, hb: number, depth: number): boolean => {
    // Both facing vertices adjacent to the line of centres suffice as candidates.
    const first = [a, a - step1].map(theta => ({ x: r1 * Math.cos(theta), y: r1 * Math.sin(theta) }));
    const second = [b, b - step2].map(theta => ({ x: centers - r2 * Math.cos(theta), y: r2 * Math.sin(theta) }));
    const closest = Math.min(...first.flatMap(p => second.map(q => distance(p, q))));
    // Arc displacement bounds each chosen world's entire angular interval.
    const upper = closest + 2 * r1 * Math.sin(ha / 2) + 2 * r2 * Math.sin(hb / 2) + 0.001;
    if (upper <= range) return true;
    if (depth === 8 || closest > range) return false;
    return [-1, 1].every(sa => [-1, 1].every(sb => cover(a + sa * ha / 2, b + sb * hb / 2, ha / 2, hb / 2, depth + 1)));
  };
  const certified = cover(step1 / 2, step2 / 2, step1 / 2, step2 / 2, 0);
  if (bridgeCertificates.size >= 256) bridgeCertificates.clear();
  bridgeCertificates.set(key, certified);
  return certified;
}

/** Rigid systems preserve internal spacing; disjoint swept discs protect the
 * space between systems. Certified outer rings retain links after capital loss. */
export function validateChaosGeometry(map: MapDefinition): void {
  if (map.generated && (map.planets.length < 30 || map.planets.length > 40)) throw new Error('Chaos planet budget exceeded');
  const orbits = map.orbits ?? [];
  const membership = orbits.flatMap(orbit => orbit.planetIds);
  if (!orbits.length || membership.length !== map.planets.length || new Set(membership).size !== membership.length || map.planets.some(planet => !membership.includes(planet.id))) throw new Error('Every Chaos world must orbit');
  if (map.planets.some(planet => !planet.superweaponUnlocks?.length || planet.superweaponUnlocks.length > 2)) throw new Error('Chaos worlds need one or two weapons');
  const systems = orbits.map(orbit => {
    const planets = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
    if (!mapConnected(planets, map.attackRange) || !mapConnected(planets.filter(planet => !planet.capital), map.attackRange)) throw new Error('Disconnected star system');
    const radius = Math.max(...planets.map(planet => distance(planet, orbit)));
    const outer = planets.filter(planet => Math.abs(distance(planet, orbit) - radius) < 1e-5);
    if (outer.some(planet => planet.capital) || outer.length < 3) throw new Error('Capital blocks an orbital gateway');
    const angles = outer.map(planet => Math.atan2(planet.y - orbit.y, planet.x - orbit.x)).sort((a, b) => a - b);
    if (angles.some((angle, i) => Math.abs(angles[(i + 1) % angles.length] + (i + 1 === angles.length ? TAU : 0) - angle - TAU / angles.length) > 1e-6)) throw new Error('Irregular outer circuit');
    for (let i = 0; i < planets.length; i++) {
      const neighbors = planets.filter(other => other !== planets[i] && distance(planets[i], other) <= map.attackRange);
      if (planets[i].capital && neighbors.some(planet => planet.capital)) throw new Error('Adjacent capitals bypass their frontiers');
      const degree = neighbors.length;
      if (degree < (map.generated ? 3 : 2) || degree > 9) throw new Error('Orbital worlds require multiple neighbors without crowding');
      for (const other of planets.slice(i + 1)) if (distance(planets[i], other) < 250 - 1e-5) throw new Error('Unsafe orbital spacing');
    }
    const capitalRadius = Math.max(0, ...planets.filter(planet => planet.capital).map(planet => distance(planet, orbit)));
    return { orbit, radius, count: outer.length, capitalRadius };
  });
  const links = systems.map(() => new Set<number>());
  systems.forEach((first, index) => systems.slice(index + 1).forEach((second, offset) => {
    const other = index + offset + 1, centers = distance(first.orbit, second.orbit);
    if (centers - first.radius - second.radius < (map.generated ? 400 : 250) - 1e-5) throw new Error('Swept systems overlap or violate spacing');
    if (first.capitalRadius && centers - first.capitalRadius - second.radius <= map.attackRange
      || second.capitalRadius && centers - second.capitalRadius - first.radius <= map.attackRange) throw new Error('A system can attack past the capital frontier');
    if (permanentBridge(first.radius, first.count, second.radius, second.count, centers, map.attackRange)) {
      links[index].add(other); links[other].add(index);
    }
  }));
  const reached = new Set([0]), queue = [0];
  for (let index = 0; index < queue.length; index++) for (const other of links[queue[index]]) if (!reached.has(other)) { reached.add(other); queue.push(other); }
  if (reached.size !== systems.length) throw new Error('Star systems lose their connections during rotation');
  if (map.generated) validateConnectionDensity(map);
}

export function generateMap(mode: GeneratedMode, seed: number, layoutIndex = (seed >>> 0) % (mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length)): MapDefinition {
  const normalized = seed >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  if (!Number.isInteger(layoutIndex) || layoutIndex < 0 || layoutIndex >= count) throw new Error('Invalid generated layout');
  if (mode === 'chaos-mode') {
    const map = buildChaosMap(normalized, layoutIndex);
    validateMap(map);
    validateChaosGeometry(map);
    return map;
  }
  const map = buildQuickMap(normalized, layoutIndex);
  validateMap(map);
  validateQuickGeometry(map);
  return map;
}

type History = Partial<Record<GeneratedMode, { seed: number; layout: number; remaining?: number[] }>>;
let history: History = {};
let sequence = 0;

export function createGeneratedMap(mode: GeneratedMode): MapDefinition {
  // Optional storage only remembers the previous family/seed, never campaign state.
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null');
    if (saved && typeof saved === 'object') for (const key of ['quick-match', 'chaos-mode'] as const) {
      const item = (saved as History)[key];
      const count = key === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
      if (item && Number.isInteger(item.seed) && item.seed >= 0 && item.seed <= 0xFFFFFFFF
        && Number.isInteger(item.layout) && item.layout >= 0 && item.layout < count) {
        const remaining = Array.isArray(item.remaining) && new Set(item.remaining).size === item.remaining.length
          && item.remaining.every(layout => Number.isInteger(layout) && layout >= 0 && layout < count && layout !== item.layout) ? item.remaining : undefined;
        history[key] = { seed: item.seed, layout: item.layout, remaining };
      }
    }
  } catch { /* New maps work when storage is corrupt, blocked or unavailable. */ }
  const previous = history[mode];
  const entropy = new Uint32Array(1);
  try { crypto.getRandomValues(entropy); } catch { entropy[0] = Math.floor(Math.random() * 4294967296); }
  let seed = (entropy[0] ^ Math.imul(++sequence, 0x9E3779B1) ^ Date.now()) >>> 0;
  if (seed === previous?.seed) seed = (seed + 1) >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  // A shuffled bag visits every strategic family before starting another round.
  // Across bag boundaries, also prevent the last family repeating immediately.
  let remaining = previous?.remaining;
  if (!remaining?.length) {
    remaining = shuffle(Array.from({ length: count }, (_, index) => index), seededRandom(seed));
    if (remaining[0] === previous?.layout) [remaining[0], remaining[count - 1]] = [remaining[count - 1], remaining[0]];
  }
  const layout = remaining[0];
  const map = generateMap(mode, seed, layout);
  history = { ...history, [mode]: { seed, layout, remaining: remaining.slice(1) } };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* Storage is optional. */ }
  return map;
}
