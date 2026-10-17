import { FACTIONS, NEUTRAL, type GeneratedStarSystem, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';
import { between, distance, generatedOrbitPeriod, integer, mapConnected, rotate, seededRandom, shuffle, TAU, validateConnectionDensity, wrapMap } from './mapGenerationUtils';

export const CHAOS_LAYOUTS = ['stellar-bend', 'branching-fronts', 'orbital-circuit', 'wide-fronts'] as const;
const GAP = 420, EPSILON = 1e-5;
type Point = { x: number; y: number };
type Recipe = { count: number; radius: number; inner: number; innerRadius: number; pattern: GeneratedStarSystem['pattern']; size: GeneratedStarSystem['size']; staggered?: boolean; capitals?: number };
const NORMAL: readonly Recipe[] = [
  { count: 8, radius: 590, inner: 4, innerRadius: 320, pattern: 'paired-rings', size: 'normal', staggered: true },
  { count: 8, radius: 590, inner: 4, innerRadius: 320, pattern: 'spiral', size: 'normal', staggered: true },
  { count: 8, radius: 590, inner: 4, innerRadius: 320, pattern: 'scattered', size: 'normal', staggered: true },
];
const LARGE: readonly Recipe[] = [
  { count: 14, radius: 640, inner: 2, innerRadius: 320, pattern: 'ring', size: 'large', capitals: 2 },
  { count: 16, radius: 720, inner: 2, innerRadius: 360, pattern: 'ring', size: 'large', capitals: 2 },
  { count: 15, radius: 700, inner: 2, innerRadius: 340, pattern: 'scattered', size: 'large', capitals: 2 },
];

/** The two exact distance constraints let differently sized systems share a
 * front without leaving oversized gaps around their smaller neighbors. */
function circleIntersections(a: Point, b: Point, ra: number, rb: number): Point[] {
  const span = distance(a, b), along = (ra * ra - rb * rb + span * span) / (2 * span);
  const heightSquared = ra * ra - along * along;
  if (heightSquared < 0) return [];
  const height = Math.sqrt(heightSquared), dx = (b.x - a.x) / span, dy = (b.y - a.y) / span;
  return [-1, 1].map(sign => ({ x: a.x + along * dx - sign * height * dy, y: a.y + along * dy + sign * height * dx }));
}

function constellation(radii: number[], family: number, random: () => number): Point[] {
  const span = (a: number, b: number) => radii[a] + radii[b] + GAP;
  const a = { x: 0, y: 0 }, b = { x: span(0, 1), y: 0 };
  if (family === 0) {
    const step = rotate(span(1, 2), 0, between(random, 0.65, 1.1));
    return [a, b, { x: b.x + step.x, y: step.y }];
  }
  if (family === 2) return [a, b, circleIntersections(a, b, span(0, 2), span(1, 2))[1]];
  const angle = family === 1 ? between(random, 1.9, 2.4) : between(random, 1.5, 1.75);
  return [a, rotate(span(0, 1), 0, -angle / 2), rotate(span(0, 2), 0, angle / 2)];
}

export function buildChaosMap(seed: number, family: number): MapDefinition {
  const random = seededRandom(seed), smallCount = integer(random, 5, 7);
  const small: Recipe = { count: smallCount, radius: smallCount === 5 ? 280 : smallCount === 6 ? 310 : 330, inner: 0, innerRadius: 0,
    pattern: random() < 0.5 ? 'ring' : 'scattered', size: 'small' };
  const large = LARGE[integer(random, 0, LARGE.length - 1)], recipes: Recipe[] = [large];
  let budget = 50 - small.count - large.count - large.inner;
  for (let i = 0; i < 2; i++) {
    const candidates = NORMAL.filter(recipe => recipe.count + recipe.inner <= budget - (1 - i) * 12);
    const recipe = candidates[integer(random, 0, candidates.length - 1)];
    recipes.push(recipe); budget -= recipe.count + recipe.inner;
  }
  const homes = [large, ...shuffle(recipes.slice(1), random)], centers = constellation(homes.map(recipe => recipe.radius), family, random);
  // The public small system adds a parallel route between two home systems.
  // Try all existing fronts and both sides; keep only collision-free positions.
  const candidates: Point[] = [];
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    candidates.push(...circleIntersections(centers[a], centers[b], homes[a].radius + small.radius + GAP + 2, homes[b].radius + small.radius + GAP + 2)
      .filter(point => centers.every((center, i) => distance(point, center) - homes[i].radius - small.radius >= GAP - EPSILON)));
  }
  if (!candidates.length) throw new Error('No safe public system placement');
  centers.push(candidates[integer(random, 0, candidates.length - 1)]);
  const selected = [...homes, small], factions = shuffle(FACTIONS, random);
  const weapons = () => shuffle(SUPERWEAPON_IDS, random).slice(0, random() < 0.5 ? 1 : 2), capitalWeapons = weapons();
  const planets: PlanetDefinition[] = [], orbits: OrbitDefinition[] = [], systems: GeneratedStarSystem[] = [];
  let factionIndex = 0;
  selected.forEach((recipe, index) => {
    const center = centers[index], phase = between(random, 0, TAU), members: PlanetDefinition[] = [];
    const add = (radius: number, angle: number, role: string, capital = false) => {
      const offset = rotate(radius, 0, phase + angle);
      const planet: PlanetDefinition = { id: `system-${index}-${role}`, x: center.x + offset.x, y: center.y + offset.y,
        owner: capital ? factions[factionIndex++] : NEUTRAL, ships: capital ? 200 : integer(random, 20, 42), ...(capital ? { capital: true } : {}),
        superweaponUnlocks: capital ? [...capitalWeapons] : weapons() };
      planets.push(planet); members.push(planet);
    };
    for (let i = 0; i < recipe.count; i++) {
      const scattered = recipe.pattern === 'scattered';
      const radius = recipe.pattern === 'spiral' ? recipe.radius - 20 + 20 * i / (recipe.count - 1) : recipe.radius - (scattered ? between(random, 0, recipe.size === 'small' ? 8 : 10) : 0);
      const jitter = scattered ? between(random, -0.02, 0.02) : 0;
      add(radius, i * TAU / recipe.count + jitter, `outer-${i}`);
    }
    const coreOffset = recipe.pattern === 'scattered' && recipe.staggered ? between(random, -0.01, 0.01) : 0;
    for (let i = 0; i < recipe.inner; i++) {
      const angle = recipe.staggered ? Math.PI / 8 + Math.floor(i / 2) * Math.PI + (i % 2) * Math.PI / 4 + coreOffset : Math.PI / recipe.count + i * TAU / recipe.inner;
      const radius = recipe.staggered ? i % 2 === 0 ? 320 : 340 : recipe.innerRadius;
      add(radius, angle, `inner-${i}`, i < (recipe.capitals ?? 1));
    }
    for (const capital of members.filter(planet => planet.capital)) members.filter(planet => !planet.capital && distance(planet, capital) <= 600)
      .sort((a, b) => distance(a, capital) - distance(b, capital)).slice(0, 3).forEach((planet, i) => { planet.ships = 12 + i * 2; });
    const planetIds = members.map(planet => planet.id);
    orbits.push({ ...center, periodSeconds: generatedOrbitPeriod(integer(random, 220, 360), recipe.radius, members.length), planetIds });
    systems.push({ id: `system-${index}`, size: recipe.size, pattern: recipe.pattern, planetIds: [...planetIds] });
  });
  return wrapMap('chaos-mode', seed, CHAOS_LAYOUTS[family], planets, orbits, { systems });
}

const bridgeCertificates = new Map<string, boolean>();

/** Interval bounds prove the reference polygons connect over every pair of
 * independent phases. Perturbation envelopes then cover the scattered worlds. */
function permanentBridge(r1: number, n1: number, r2: number, n2: number, centers: number, range: number): boolean {
  if (centers - r1 - r2 > range) return false;
  const key = [r1, n1, r2, n2, centers, range].map(value => value.toFixed(6)).join(':');
  const cached = bridgeCertificates.get(key);
  if (cached !== undefined) return cached;
  const step1 = TAU / n1, step2 = TAU / n2;
  const cover = (a: number, b: number, ha: number, hb: number, depth: number): boolean => {
    const first = [a, a - step1].map(theta => rotate(r1, 0, theta));
    const second = [b, b - step2].map(theta => ({ x: centers - r2 * Math.cos(theta), y: r2 * Math.sin(theta) }));
    const closest = Math.min(...first.flatMap(p => second.map(q => distance(p, q))));
    if (closest + 2 * r1 * Math.sin(ha / 2) + 2 * r2 * Math.sin(hb / 2) + 0.001 <= range) return true;
    if (depth === 9 || closest > range) return false;
    return [-1, 1].every(sa => [-1, 1].every(sb => cover(a + sa * ha / 2, b + sb * hb / 2, ha / 2, hb / 2, depth + 1)));
  };
  const result = cover(step1 / 2, step2 / 2, step1 / 2, step2 / 2, 0);
  if (bridgeCertificates.size >= 1024) bridgeCertificates.clear();
  bridgeCertificates.set(key, result);
  return result;
}

function beltEnvelope(orbit: OrbitDefinition, planets: PlanetDefinition[]) {
  const radius = Math.max(...planets.map(planet => distance(planet, orbit)));
  const belt = planets.filter(planet => distance(planet, orbit) >= radius - 50)
    .sort((a, b) => Math.atan2(a.y - orbit.y, a.x - orbit.x) - Math.atan2(b.y - orbit.y, b.x - orbit.x));
  if (belt.some(planet => planet.capital) || belt.length < 3) throw new Error('Capital blocks an orbital gateway');
  const referenceRadius = Math.ceil((radius - EPSILON) / 10) * 10, step = TAU / belt.length;
  const phase = belt.reduce((sum, planet, i) => sum + Math.atan2(planet.y - orbit.y, planet.x - orbit.x) - i * step, 0) / belt.length;
  const displacement = Math.max(...belt.map((planet, i) => distance({ x: planet.x - orbit.x, y: planet.y - orbit.y }, rotate(referenceRadius, 0, phase + i * step))));
  // Rounding outward makes certificates reusable without weakening the bound.
  const deviation = Math.ceil(Math.max(0, displacement - EPSILON) / 5) * 5;
  return { orbit, radius, referenceRadius, deviation, count: belt.length,
    capitalRadius: Math.max(0, ...planets.filter(planet => planet.capital).map(planet => distance(planet, orbit))) };
}

export function validateChaosGeometry(map: MapDefinition): void {
  if (map.generated && (map.planets.length < 35 || map.planets.length > 50)) throw new Error('Chaos planet budget exceeded');
  const orbits = map.orbits ?? [], membership = orbits.flatMap(orbit => orbit.planetIds);
  if (!orbits.length || membership.length !== map.planets.length || new Set(membership).size !== membership.length || map.planets.some(planet => !membership.includes(planet.id))) throw new Error('Every Chaos world must orbit');
  if (map.planets.some(planet => !planet.superweaponUnlocks?.length || planet.superweaponUnlocks.length > 2)) throw new Error('Chaos worlds need one or two weapons');
  if (map.generated?.systems) {
    const recipes = map.generated.systems;
    if (recipes.length !== orbits.length || new Set(recipes.map(recipe => recipe.id)).size !== recipes.length
      || recipes.some((recipe, i) => JSON.stringify(recipe.planetIds) !== JSON.stringify(orbits[i].planetIds)
        || !['small', 'normal', 'large'].includes(recipe.size) || !['ring', 'paired-rings', 'spiral', 'scattered'].includes(recipe.pattern))) throw new Error('Invalid system recipe membership');
  }
  const systems = orbits.map(orbit => {
    const planets = map.planets.filter(planet => orbit.planetIds.includes(planet.id)), survivors = planets.filter(planet => !planet.capital);
    if (!mapConnected(planets, map.attackRange) || !mapConnected(survivors, map.attackRange)) throw new Error('Disconnected star system');
    for (let i = 0; i < planets.length; i++) {
      const planet = planets[i], neighbors = planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange);
      if (planet.capital && neighbors.some(other => other.capital)) throw new Error('Adjacent capitals bypass their frontiers');
      if (neighbors.length < (map.generated ? 3 : 2) || neighbors.length > 9) throw new Error('Orbital worlds require multiple neighbors without crowding');
      if (map.generated && !planet.capital && survivors.filter(other => other !== planet && distance(planet, other) <= map.attackRange).length < 3) throw new Error('Capital elimination removes a required neighbor');
      for (const other of planets.slice(i + 1)) if (distance(planet, other) < 250 - EPSILON) throw new Error('Unsafe orbital spacing');
    }
    return beltEnvelope(orbit, planets);
  });
  const links = systems.map(() => new Set<number>());
  systems.forEach((first, i) => systems.slice(i + 1).forEach((second, offset) => {
    const j = i + offset + 1, centers = distance(first.orbit, second.orbit);
    if (centers - first.radius - second.radius < (map.generated ? GAP : 250) - EPSILON) throw new Error('Swept systems overlap or violate spacing');
    if (first.capitalRadius && centers - first.capitalRadius - second.radius <= map.attackRange
      || second.capitalRadius && centers - second.capitalRadius - first.radius <= map.attackRange) throw new Error('A system can attack past the capital frontier');
    if (permanentBridge(first.referenceRadius, first.count, second.referenceRadius, second.count, centers, map.attackRange - first.deviation - second.deviation)) { links[i].add(j); links[j].add(i); }
  }));
  const reached = new Set([0]), queue = [0];
  for (let i = 0; i < queue.length; i++) for (const other of links[queue[i]]) if (!reached.has(other)) { reached.add(other); queue.push(other); }
  if (reached.size !== systems.length) throw new Error('Star systems lose their connections during rotation');
  if (map.generated) validateConnectionDensity(map);
}
