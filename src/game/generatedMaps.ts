import { FACTIONS, NEUTRAL, validateMap, type GeneratedMode, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';
import type { SuperweaponId } from './types';

// Construct connected layouts first, then vary their geometry and objectives.
// Seeds reproduce the entire opening, including colors, fleets and orbit phase.
export const QUICK_LAYOUTS = ['crossroads', 'frontier', 'islands', 'lanes'] as const;
export const CHAOS_LAYOUTS = ['constellation', 'convergence', 'binary-lanes', 'stellar-loop', 'starfield'] as const;
const RANGE = 600;
const TAU = Math.PI * 2;
const HISTORY_KEY = 'war-of-planets.generated-maps.v1';

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

function quickMap(seed: number, layoutIndex: number, attempt: number): MapDefinition {
  const random = seededRandom(seed ^ Math.imul(attempt + 1, 0x9E3779B1));
  const half = integer(random, 3, 4);
  const spacing = between(random, 385, 415);
  const angle = between(random, 0, TAU);
  const layout = QUICK_LAYOUTS[layoutIndex];
  const fullGrid = attempt === 12;
  const cells = new Map<string, { x: number; y: number; opening: boolean; capital: boolean }>();
  const key = (x: number, y: number) => `${x},${y}`;
  const add = (x: number, y: number) => {
    for (let turn = 0; turn < 4; turn++) {
      const capital = Math.abs(x) === half && Math.abs(y) === half;
      const opening = Math.abs(x) >= half - 1 && Math.abs(y) >= half - 1 && !capital;
      cells.set(key(x, y), { x, y, opening, capital });
      [x, y] = [-y, x];
    }
  };
  for (let x = -half; x <= half; x++) for (let y = -half; y <= half; y++) {
    const perimeter = Math.max(Math.abs(x), Math.abs(y)) === half;
    const diagonal = Math.abs(x) === Math.abs(y);
    const core = Math.max(Math.abs(x), Math.abs(y)) <= 1;
    const opening = Math.abs(x) >= half - 1 && Math.abs(y) >= half - 1;
    const axes = x === 0 || y === 0;
    const include = fullGrid || perimeter || opening || core
      || (layout === 'crossroads' && (diagonal || axes))
      || (layout === 'frontier' && diagonal)
      || (layout === 'islands' && Math.min(Math.abs(x), Math.abs(y)) >= half - 1)
      || (layout === 'lanes' && (Math.abs(x) <= 1 || Math.abs(y) <= 1));
    if (include) add(x, y);
  }
  // Islands get two approaches from each home cluster into the central arena.
  if (layout === 'islands') for (let index = 1; index < half; index++) { add(index, index); add(index, index - 1); }
  for (let x = 0; x <= half; x++) for (let y = 1; y <= half; y++) {
    if (!cells.has(key(x, y)) && random() < 0.24) add(x, y);
  }

  const factions = shuffle(FACTIONS, random);
  const planets: PlanetDefinition[] = [];
  const groups: PlanetDefinition[][] = [];
  const used = new Set<string>();
  let faction = 0;
  for (const cell of cells.values()) {
    if (used.has(key(cell.x, cell.y))) continue;
    const jitter = fullGrid ? 0 : 18;
    const x = cell.x * spacing + between(random, -jitter, jitter);
    const y = cell.y * spacing + between(random, -jitter, jitter);
    const ships = cell.opening ? integer(random, 12, 18) : integer(random, 20, 42);
    const group: PlanetDefinition[] = [];
    let cx = cell.x, cy = cell.y;
    for (let turn = 0; turn < (cx === 0 && cy === 0 ? 1 : 4); turn++) {
      used.add(key(cx, cy));
      const point = cell.x === 0 && cell.y === 0 ? { x: 0, y: 0 } : rotate(x, y, angle + turn * Math.PI / 2);
      const owner = cell.capital ? factions[faction++] : NEUTRAL;
      const id = cell.capital ? `capital-${owner}` : `world-${cx}-${cy}`;
      const planet: PlanetDefinition = { id, ...point, owner, ships: cell.capital ? 200 : ships, ...(cell.capital ? { capital: true } : {}) };
      group.push(planet); planets.push(planet);
      [cx, cy] = [-cy, cx];
    }
    if (!cell.capital && !cell.opening && group.length === 4) groups.push(group);
  }
  // Objective locations change along with the routes, but every weapon has
  // four identical sources, one in each rotated sector. No opening arsenal.
  const sites = shuffle(groups, random);
  const siteCount = integer(random, 3, Math.min(6, groups.length));
  sites.slice(0, siteCount).forEach((group, index) => {
    const weapon = SUPERWEAPON_IDS[index % SUPERWEAPON_IDS.length];
    for (const planet of group) { planet.superweaponUnlocks = [weapon]; planet.ships = integer(seededRandom(seed + index), 28, 48); }
  });
  return wrapMap('quick-match', seed, layout, planets);
}

function quickValid(map: MapDefinition): boolean {
  const planets = map.planets;
  if (!mapConnected(planets)) return false;
  for (const planet of planets) {
    const neighbors = planets.filter(other => other !== planet && distance(planet, other) <= RANGE);
    if (neighbors.length < 2) return false;
    if (planet.capital && (neighbors.length !== 3 || neighbors.some(other => other.capital || other.superweaponUnlocks?.length || other.ships > 18))) return false;
  }
  return planets.filter(planet => !planet.capital).every(removed => mapConnected(planets.filter(planet => planet !== removed)));
}

function chaosMap(seed: number, layoutIndex: number): MapDefinition {
  const random = seededRandom(seed);
  const radius = between(random, 410, 470);
  const innerRadius = between(random, 210, 240);
  const separation = radius * 2 + between(random, 210, 220);
  const angle = between(random, 0, TAU);
  // Home systems come first. The remaining systems are neutral objectives.
  const layouts: number[][][] = [
    [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],
    [[-1,0],[0,-1],[1,0],[0,1],[0,0]],
    [[-1,-0.5],[1,-0.5],[1,0.5],[-1,0.5],[0,-0.5],[0,0.5]],
    [[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[1,0],[0,1],[-1,0]],
    [[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[1,0],[0,1],[-1,0],[0,0]],
  ];
  const centers = layouts[layoutIndex].map(([x, y]) => rotate(x * separation + between(random, -6, 6), y * separation + between(random, -6, 6), angle));
  const factions = shuffle(FACTIONS, random);
  const weapons = () => shuffle(SUPERWEAPON_IDS, random).slice(0, random() < 0.5 ? 1 : 2);
  const capitalWeapons = weapons();
  const planets: PlanetDefinition[] = [];
  const orbits: OrbitDefinition[] = [];
  centers.forEach((center, system) => {
    const outerCount = [12, 14, 16][integer(random, 0, 2)];
    const innerCount = integer(random, 4, 6);
    const phase = between(random, 0, TAU);
    const outward = Math.atan2(center.y, center.x);
    let capitalIndex = 0, best = Infinity;
    for (let index = 0; index < outerCount; index++) {
      const delta = Math.abs(Math.atan2(Math.sin(phase + TAU * index / outerCount - outward), Math.cos(phase + TAU * index / outerCount - outward)));
      if (delta < best) { capitalIndex = index; best = delta; }
    }
    const members: PlanetDefinition[] = [];
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? outerCount : innerCount;
      const orbitRadius = ring === 0 ? radius : innerRadius;
      const ringPhase = ring === 0 ? phase : between(random, 0, TAU);
      for (let index = 0; index < count; index++) {
        const capital = system < 4 && ring === 0 && index === capitalIndex;
        const point = rotate(orbitRadius, 0, ringPhase + TAU * index / count);
        const planet: PlanetDefinition = {
          id: `system-${system}-${ring}-${index}`, x: center.x + point.x, y: center.y + point.y,
          owner: capital ? factions[system] : NEUTRAL,
          ships: capital ? 200 : integer(random, 18, 40),
          superweaponUnlocks: capital ? [...capitalWeapons] : weapons(),
          ...(capital ? { capital: true } : {}),
        };
        planets.push(planet); members.push(planet);
      }
    }
    // Affordable opening choices even though every one of them is a weapon site.
    const capital = members.find(planet => planet.capital);
    if (capital) members.filter(planet => !planet.capital && distance(planet, capital) <= RANGE)
      .sort((a, b) => distance(a, capital) - distance(b, capital)).slice(0, 3)
      .forEach((planet, index) => { planet.ships = 12 + index * 2; });
    orbits.push({ ...center, periodSeconds: integer(random, 160, 320), planetIds: members.map(planet => planet.id) });
  });
  return wrapMap('chaos-mode', seed, CHAOS_LAYOUTS[layoutIndex], planets, orbits);
}

/** Certify the entire swept paths, rather than hoping sampled phases connect. */
export function validateChaosGeometry(map: MapDefinition): void {
  const orbits = map.orbits ?? [];
  if (!orbits.length || orbits.flatMap(orbit => orbit.planetIds).length !== map.planets.length) throw new Error('Every Chaos world must orbit');
  if (map.planets.some(planet => !planet.superweaponUnlocks?.length || planet.superweaponUnlocks.length > 2)) throw new Error('Chaos worlds need one or two weapons');
  const systems = orbits.map(orbit => {
    const planets = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
    if (!mapConnected(planets) || !mapConnected(planets.filter(planet => !planet.capital))) throw new Error('Disconnected star system');
    const radius = Math.max(...planets.map(planet => distance(planet, orbit)));
    const outer = planets.filter(planet => Math.abs(distance(planet, orbit) - radius) < 1e-5);
    const angles = outer.map(planet => Math.atan2(planet.y - orbit.y, planet.x - orbit.x)).sort((a, b) => a - b);
    const gap = Math.max(...angles.map((angle, index) => (angles[(index + 1) % angles.length] + (index + 1 === angles.length ? TAU : 0)) - angle));
    // Twice the usual half-gap covers losing any one outer planet, including
    // the capital. An eliminated faction cannot strand the surviving systems.
    return { orbit, radius, gap };
  });
  const links = systems.map(() => new Set<number>());
  systems.forEach((first, index) => systems.slice(index + 1).forEach((second, offset) => {
    const other = index + offset + 1;
    const centers = distance(first.orbit, second.orbit);
    if (centers - first.radius - second.radius < 180) throw new Error('Swept systems overlap');
    const axial = centers - first.radius * Math.cos(first.gap) - second.radius * Math.cos(second.gap);
    const lateral = first.radius * Math.sin(first.gap) + second.radius * Math.sin(second.gap);
    if (Math.hypot(axial, lateral) <= map.attackRange) { links[index].add(other); links[other].add(index); }
  }));
  const reached = new Set([0]);
  const queue = [0];
  for (let index = 0; index < queue.length; index++) for (const other of links[queue[index]]) {
    if (!reached.has(other)) { reached.add(other); queue.push(other); }
  }
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
  // Bounded retries; the final full lattice is connected by construction.
  for (let attempt = 0; attempt <= 12; attempt++) {
    const map = quickMap(normalized, layoutIndex, attempt);
    if (quickValid(map)) { validateMap(map); return map; }
  }
  throw new Error('Could not construct a connected battlefield');
}

type History = Partial<Record<GeneratedMode, { seed: number; layout: number }>>;
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
        && Number.isInteger(item.layout) && item.layout >= 0 && item.layout < count) history[key] = item;
    }
  } catch { /* New maps work when storage is corrupt, blocked or unavailable. */ }
  const previous = history[mode];
  const entropy = new Uint32Array(1);
  try { crypto.getRandomValues(entropy); } catch { entropy[0] = Math.floor(Math.random() * 4294967296); }
  let seed = (entropy[0] ^ Math.imul(++sequence, 0x9E3779B1) ^ Date.now()) >>> 0;
  if (seed === previous?.seed) seed = (seed + 1) >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  const layout = previous ? (previous.layout + 1 + seed % (count - 1)) % count : seed % count;
  const map = generateMap(mode, seed, layout);
  history = { ...history, [mode]: { seed, layout } };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* Storage is optional. */ }
  return map;
}
