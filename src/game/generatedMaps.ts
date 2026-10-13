import { FACTIONS, NEUTRAL, validateMap, type GeneratedMode, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';
import { chaosRoutes, quickRoutes } from './routeNetworks';

// Generate strategic routes first; certify the actual attacks after placement.
// Seeds reproduce the entire opening, including colors, fleets and orbit phase.
export const QUICK_LAYOUTS = ['divided-territories', 'branching-fronts', 'outer-circuits', 'linked-arenas'] as const;
export const CHAOS_LAYOUTS = ['stellar-chain', 'branching-constellation', 'orbital-circuit', 'multiple-fronts'] as const;
const RANGE = 600;
const TAU = Math.PI * 2;
const HISTORY_KEY = 'war-of-planets.generated-maps.v2';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
const between = (random: () => number, min: number, max: number) => min + random() * (max - min);
const integer = (random: () => number, min: number, max: number) => Math.floor(between(random, min, max + 1));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function rotate(x: number, y: number, angle: number) {
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

export function mapConnected(planets: readonly { x: number; y: number }[], range = RANGE): boolean {
  if (!planets.length) return false;
  const reached = new Set([0]);
  const queue = [0];
  for (let index = 0; index < queue.length; index++) {
    for (let other = 0; other < planets.length; other++) {
      if (!reached.has(other) && distance(planets[queue[index]], planets[other]) <= range) {
        reached.add(other); queue.push(other);
      }
    }
  }
  return reached.size === planets.length;
}

function wrapMap(mode: GeneratedMode, seed: number, layout: string, planets: PlanetDefinition[], orbits?: OrbitDefinition[]): MapDefinition {
  // Fit the complete swept paths with room for capital fleets and star halos.
  const extent = orbits?.length
    ? Math.max(...orbits.flatMap(orbit => {
      const radius = Math.max(...planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(planet, orbit)));
      return [Math.abs(orbit.x) + radius, Math.abs(orbit.y) + radius];
    }))
    : Math.max(...planets.flatMap(planet => [Math.abs(planet.x), Math.abs(planet.y)]));
  const size = Math.ceil((extent + 240) * 2 / 100) * 100;
  const offset = size / 2;
  return {
    id: `generated-${mode}-${seed}`, title: mode === 'quick-match' ? 'Quick Match' : 'Chaos Mode',
    briefing: mode === 'quick-match' ? 'Choose your expansion route and capture the rival capitals.' : 'Ride the moving systems, capture weapon worlds and protect your orbiting capital.',
    width: size, height: size, attackRange: RANGE,
    galaxyTheme: mode === 'chaos-mode' ? 'siege' : 'standard',
    objective: { type: 'eliminate-capitals', description: 'Capture all enemy capitals. Keep your blue capital alive.' },
    generated: { mode, seed, layout },
    planets: planets.map(planet => ({ ...planet, x: planet.x + offset, y: planet.y + offset })),
    ...(orbits?.length ? { orbits: orbits.map(orbit => ({ ...orbit, x: orbit.x + offset, y: orbit.y + offset })) } : {}),
  };
}

function circuitMap(seed: number): MapDefinition {
  const random = seededRandom(seed);
  const quarter = integer(random, 10, 12), count = quarter * 4;
  const step = between(random, 535, 540);
  const layers = Math.round(count / TAU), radius = layers * step;
  const angle = between(random, 0, TAU), factions = shuffle(FACTIONS, random);
  const opening = integer(random, 12, 18), weaponCost = integer(random, 28, 36), gateCost = integer(random, 38, 48);
  const planets: PlanetDefinition[] = [];
  for (let index = 0; index < count; index++) {
    const sector = Math.round(index / quarter) % 4;
    const delta = ((index - sector * quarter + count + count / 2) % count) - count / 2;
    const home = Math.abs(delta) <= 3;
    const role = delta === 0 ? 'capital' : Math.abs(delta) === 1 ? `opening-${delta > 0 ? 'a' : 'b'}`
      : Math.abs(delta) === 2 ? delta > 0 ? 'overdrive' : 'repulse' : `gate-${delta > 0 ? 'a' : 'b'}`;
    const weapon = home && Math.abs(delta) === 2 ? delta > 0 ? 'overdrive' : 'repulse' : home && Math.abs(delta) === 3 ? 'omni' : undefined;
    planets.push({
      id: home ? `home-${sector}-${role}` : `circuit-${index}`,
      ...rotate(radius, 0, angle + TAU * index / count), owner: delta === 0 ? factions[sector] : NEUTRAL,
      ships: delta === 0 ? 200 : Math.abs(delta) === 1 ? opening : Math.abs(delta) === 2 ? weaponCost : home ? gateCost : integer(random, 24, 44),
      ...(delta === 0 ? { capital: true } : {}), ...(weapon ? { superweaponUnlocks: [weapon] as PlanetDefinition['superweaponUnlocks'] } : {}),
    });
  }
  // Opposite crossings give everyone equivalent access; four crossings produce
  // a central multi-front arena. Both differ substantially from a maze or grid.
  const spokes = random() < 0.5 ? [0, 2] : [0, 1, 2, 3];
  for (const spoke of spokes) for (let layer = 1; layer < layers; layer++) {
    planets.push({ id: `spoke-${spoke}-${layer}`, ...rotate(radius - layer * step, 0, angle + TAU * (Math.floor(quarter / 2) + spoke * quarter) / count), owner: NEUTRAL, ships: integer(random, 24, 44) });
  }
  // Public interior branches can reconnect into another spoke or end in a
  // weapon pocket. Their location/length changes the graph, not just its angle.
  const branchCount = integer(random, 2, 6);
  for (let branch = 0; branch < branchCount; branch++) {
    const spoke = spokes[integer(random, 0, spokes.length - 1)], along = integer(random, 2, 3), side = random() < 0.5 ? -1 : 1;
    const length = integer(random, 1, 2);
    for (let segment = 1; segment <= length; segment++) {
      const point = rotate(along * step, side * segment * step, angle + TAU * Math.floor(quarter / 2) / count + spoke * Math.PI / 2);
      if (planets.some(planet => distance(planet, point) < 1)) continue;
      const weapon = segment === length && random() < 0.5 ? SUPERWEAPON_IDS[integer(random, 0, 2)] : undefined;
      planets.push({ id: `pocket-${branch}-${segment}`, ...point, owner: NEUTRAL, ships: weapon ? 48 : integer(random, 24, 44), ...(weapon ? { superweaponUnlocks: [weapon] } : {}) });
    }
  }
  planets.push({ id: 'circuit-hub', x: 0, y: 0, owner: NEUTRAL, ships: integer(random, 48, 64), superweaponUnlocks: [SUPERWEAPON_IDS[integer(random, 0, 2)]] });
  return wrapMap('quick-match', seed, QUICK_LAYOUTS[2], planets);
}

function quickMap(seed: number, layoutIndex: number): MapDefinition {
  if (layoutIndex === 2) return circuitMap(seed);
  const random = seededRandom(seed);
  const network = quickRoutes(layoutIndex, random);
  const cells = new Map<string, { x: number; y: number; sector?: number; role?: string; ships: number; weapon?: typeof SUPERWEAPON_IDS[number] }>();
  const put = (x: number, y: number, ships = integer(random, 24, 44), sector?: number, role?: string, weapon?: typeof SUPERWEAPON_IDS[number]) =>
    cells.set(`${x},${y}`, { x, y, ships, sector, role, weapon });
  for (const point of network.points) put(point.x, point.y);
  for (const [a, b] of network.edges) put((network.points[a].x + network.points[b].x) / 2, (network.points[a].y + network.points[b].y) / 2);
  const openingCost = integer(random, 12, 18);
  const weaponCost = integer(random, 28, 36);
  const gateCost = integer(random, 38, 48);
  const twoApproaches = random() < 0.5;
  // Four equivalent home networks; public routes may be asymmetric. The only
  // exit is the gate, four captures away from the capital on either home arm.
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], sector) => {
    const x = network.columns + 2, y = network.rows + 2;
    const home = (dx: number, dy: number, ships: number, role: string, weapon?: typeof SUPERWEAPON_IDS[number]) =>
      put((x - dx) * sx, (y - dy) * sy, ships, sector, role, weapon);
    home(0, 0, 200, 'capital');
    home(1, 0, openingCost, 'opening-a'); home(0, 1, openingCost, 'opening-b');
    home(2, 0, weaponCost, 'overdrive', 'overdrive'); home(0, 2, weaponCost, 'repulse', 'repulse');
    home(2, 1, 24, 'approach-a'); home(1, 2, 24, 'approach-b');
    home(2, 2, gateCost, 'gate', 'omni');
    // These approach worlds cannot attack the other side of the home perimeter.
    put((network.columns - 1) * sx, network.rows * sy, 30);
    if (twoApproaches) put(network.columns * sx, (network.rows - 1) * sy, 30);
  });
  const sites = shuffle([...cells.values()].filter(cell => cell.sector === undefined && network.points.some(point => point.x === cell.x && point.y === cell.y)), random);
  sites.slice(0, integer(random, 1, Math.min(3, sites.length))).forEach((cell, index) => {
    cell.weapon = SUPERWEAPON_IDS[index % SUPERWEAPON_IDS.length]; cell.ships = integer(random, 48, 64);
  });
  const factions = shuffle(FACTIONS, random);
  const angle = between(random, 0, TAU);
  const xStep = between(random, 520, 550), yStep = between(random, 520, 550);
  const planets: PlanetDefinition[] = [...cells.values()].map(cell => {
    const point = rotate(cell.x * xStep + between(random, -8, 8), cell.y * yStep + between(random, -8, 8), angle);
    const capital = cell.role === 'capital';
    return {
      id: cell.sector === undefined ? `route-${cell.x}-${cell.y}` : `home-${cell.sector}-${cell.role}`,
      ...point, owner: capital ? factions[cell.sector!] : NEUTRAL, ships: cell.ships,
      ...(capital ? { capital: true } : {}), ...(cell.weapon ? { superweaponUnlocks: [cell.weapon] } : {}),
    };
  });
  const map = wrapMap('quick-match', seed, QUICK_LAYOUTS[layoutIndex], planets);
  // Check the embedded graph against the intended lattice links, not just BFS.
  const list = [...cells.values()];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const intended = Math.abs(list[a].x - list[b].x) + Math.abs(list[a].y - list[b].y) === 1;
    const separation = distance(planets[a], planets[b]);
    if (intended ? separation > 575 || separation < 500 : separation < 650) throw new Error('A route gained an unintended attack shortcut');
  }
  return map;
}

export function validateQuickGeometry(map: MapDefinition): void {
  if (!mapConnected(map.planets, map.attackRange)) throw new Error('Disconnected Quick routes');
  for (const planet of map.planets) {
    const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange);
    if (neighbors.length < 1 || neighbors.length > 4) throw new Error('Too many attack routes');
    if (neighbors.some(a => neighbors.some(b => a !== b && distance(a, b) <= map.attackRange))) throw new Error('An attack bypasses a route defender');
    if (planet.capital && (neighbors.length !== 2 || neighbors.some(other => other.capital || other.superweaponUnlocks?.length || other.ships > 18))) throw new Error('Unsafe capital opening');
    const home = /^home-(\d+)-/.exec(planet.id)?.[1];
    if (home !== undefined && !/-gate(?:-[ab])?$/.test(planet.id) && neighbors.some(other => !other.id.startsWith(`home-${home}-`))) throw new Error('An attack bypasses the home frontier');
    for (const other of map.planets) if (planet !== other) {
      const separation = distance(planet, other);
      if (separation < 500 || (separation > map.attackRange && separation < 650)) throw new Error('Unsafe Quick spacing');
    }
  }
}

function chaosMap(seed: number, layoutIndex: number): MapDefinition {
  const random = seededRandom(seed);
  const outerCount = random() < 0.5 ? 10 : 12;
  const radius = between(random, 532, 552) / (2 * Math.sin(Math.PI / outerCount));
  const innerRadius = radius - 520;
  const innerCount = outerCount === 10 ? 4 : 6;
  const separation = radius * 2 + between(random, 450, 452);
  const angle = between(random, 0, TAU);
  const centers = chaosRoutes(layoutIndex, random).map(point => rotate(point.x * separation, point.y * separation, angle));
  // Prefer peripheral systems for homes, without forcing every map into four corners.
  const homes = shuffle(centers.map((center, index) => ({ index, degree: centers.filter(other => other !== center && distance(center, other) < separation + 1).length })), random)
    .sort((a, b) => a.degree - b.degree).slice(0, 4).map(home => home.index);
  const factions = shuffle(FACTIONS, random);
  const weapons = () => shuffle(SUPERWEAPON_IDS, random).slice(0, random() < 0.5 ? 1 : 2);
  const capitalWeapons = weapons();
  const planets: PlanetDefinition[] = [], orbits: OrbitDefinition[] = [];
  centers.forEach((center, system) => {
    const homeIndex = homes.indexOf(system);
    const phase = between(random, 0, TAU);
    const outward = Math.atan2(center.y, center.x);
    // Inner capitals never form the bridge between stars. Eliminating one cannot
    // remove a gateway or disconnect the remaining outer circuit.
    const capitalIndex = Math.round((outward - phase) * innerCount / TAU + innerCount * 2) % innerCount;
    const interiorCount = homeIndex >= 0 ? innerCount : integer(random, 0, innerCount);
    const interiorPhase = homeIndex >= 0 ? phase : between(random, 0, TAU);
    const members: PlanetDefinition[] = [];
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? outerCount : interiorCount;
      for (let index = 0; index < count; index++) {
        const capital = homeIndex >= 0 && ring === 1 && index === capitalIndex;
        const point = rotate(ring === 0 ? radius : innerRadius, 0, (ring === 0 ? phase : interiorPhase) + TAU * index / count);
        const planet: PlanetDefinition = {
          id: `system-${system}-${ring}-${index}`, x: center.x + point.x, y: center.y + point.y,
          owner: capital ? factions[homeIndex] : NEUTRAL, ships: capital ? 200 : integer(random, 20, 42),
          superweaponUnlocks: capital ? [...capitalWeapons] : weapons(), ...(capital ? { capital: true } : {}),
        };
        members.push(planet); planets.push(planet);
      }
    }
    const capital = members.find(planet => planet.capital);
    if (capital) members.filter(planet => !planet.capital && distance(planet, capital) <= RANGE)
      .sort((a, b) => distance(a, capital) - distance(b, capital)).slice(0, 3)
      .forEach((planet, index) => { planet.ships = 12 + index * 2; });
    // Larger orbits move slowly enough for ordinary fleets to intercept targets.
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
      if (planets.filter(other => other !== planets[i] && distance(planets[i], other) <= map.attackRange).length > 5) throw new Error('Crowded orbital routes');
      for (const other of planets.slice(i + 1)) if (distance(planets[i], other) < 450 - 1e-5) throw new Error('Unsafe orbital spacing');
    }
    const capitalRadius = Math.max(0, ...planets.filter(planet => planet.capital).map(planet => distance(planet, orbit)));
    return { orbit, radius, count: outer.length, capitalRadius };
  });
  const links = systems.map(() => new Set<number>());
  systems.forEach((first, index) => systems.slice(index + 1).forEach((second, offset) => {
    const other = index + offset + 1, centers = distance(first.orbit, second.orbit);
    if (centers - first.radius - second.radius < 450 - 1e-5) throw new Error('Swept systems overlap or violate spacing');
    if (first.capitalRadius && centers - first.capitalRadius - second.radius <= map.attackRange
      || second.capitalRadius && centers - second.capitalRadius - first.radius <= map.attackRange) throw new Error('A system can attack past the capital frontier');
    if (permanentBridge(first.radius, first.count, second.radius, second.count, centers, map.attackRange)) {
      links[index].add(other); links[other].add(index);
    }
  }));
  const reached = new Set([0]), queue = [0];
  for (let index = 0; index < queue.length; index++) for (const other of links[queue[index]]) if (!reached.has(other)) { reached.add(other); queue.push(other); }
  if (reached.size !== systems.length) throw new Error('Star systems lose their connections during rotation');
}

export function generateMap(mode: GeneratedMode, seed: number, layoutIndex = (seed >>> 0) % (mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length)): MapDefinition {
  const normalized = seed >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  if (!Number.isInteger(layoutIndex) || layoutIndex < 0 || layoutIndex >= count) throw new Error('Invalid generated layout');
  if (mode === 'chaos-mode') {
    const map = chaosMap(normalized, layoutIndex);
    validateMap(map);
    validateChaosGeometry(map);
    return map;
  }
  const map = quickMap(normalized, layoutIndex);
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
