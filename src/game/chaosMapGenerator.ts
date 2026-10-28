import { FACTIONS, NEUTRAL, type GeneratedStarSystem, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';
import { between, distance, generatedOrbitPeriod, integer, mapConnected, rotate, seededRandom, shuffle, TAU, validateConnectionDensity, wrapMap } from './mapGenerationUtils';

export const CHAOS_LAYOUTS = ['stellar-bend', 'branching-fronts', 'orbital-circuit', 'wide-fronts'] as const;
const GAP = 420, EPSILON = 1e-5;
type Point = { x: number; y: number };
type Recipe = { count: number; radius: number; inner: number; innerRadius: number; pattern: GeneratedStarSystem['pattern']; size: GeneratedStarSystem['size']; staggered?: boolean; capSlots?: readonly number[] };
const CLASSIC: Recipe = { count: 8, radius: 590, inner: 4, innerRadius: 320, pattern: 'classic', size: 'normal', staggered: true };
const NORMAL: readonly Recipe[] = [
  CLASSIC,
  { count: 8, radius: 640, inner: 5, innerRadius: 340, pattern: 'pentagon-web', size: 'normal' },
  { ...CLASSIC, pattern: 'scattered' },
];
const LARGE: readonly Recipe[] = [
  { count: 10, radius: 680, inner: 6, innerRadius: 400, pattern: 'woven-rings', size: 'large', capSlots: [0, 3] },
  { count: 11, radius: 670, inner: 6, innerRadius: 390, pattern: 'woven-rings', size: 'large', capSlots: [0, 3] },
  { count: 11, radius: 670, inner: 7, innerRadius: 400, pattern: 'woven-rings', size: 'large', capSlots: [0, 3] },
];
const population = (recipe: Recipe) => recipe.count + recipe.inner;
export type ChaosMapOptions = {
  composition: 0 | 1 | 2 | 3;
  smallPlanets: 5 | 6 | 7;
  normalPattern: 'classic' | 'scattered' | 'pentagon-web';
  weaponsPerWorld: 'mixed' | 1 | 2;
};

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
  if (radii.length === 2) return [a, b];
  if (family === 0) {
    const bend = between(random, 0.65, 1.0), points = [a, b];
    for (let i = 2; i < radii.length; i++) { const step = rotate(span(i - 1, i), 0, bend * (i - 1)); points.push({ x: points[i - 1].x + step.x, y: points[i - 1].y + step.y }); }
    return points;
  }
  if (radii.length === 4) {
    if (family === 1) return [a, ...[1, 2, 3].map(i => rotate(span(0, i), 0, (i - 1) * TAU / 3))];
    if (family === 3) return [a, b, circleIntersections(a, b, span(0, 2), span(1, 2))[1], circleIntersections(a, b, span(0, 3), span(1, 3))[0]];
    const step = rotate(span(1, 2), 0, between(random, 1.4, 1.75)), c = { x: b.x + step.x, y: step.y };
    return [a, b, c, circleIntersections(a, c, span(0, 3), span(2, 3)).sort((p, q) => distance(q, b) - distance(p, b))[0]];
  }
  if (family === 2) return [a, b, circleIntersections(a, b, span(0, 2), span(1, 2))[1]];
  const angle = family === 1 ? between(random, 1.9, 2.4) : between(random, 1.5, 1.75);
  return [a, rotate(span(0, 1), 0, -angle / 2), rotate(span(0, 2), 0, angle / 2)];
}

function formation(recipe: Recipe, random: () => number) {
  const points: (Point & { capital: boolean })[] = [], scattered = recipe.pattern === 'scattered';
  for (let i = 0; i < recipe.count; i++) {
    const radius = recipe.radius - (scattered ? between(random, 0, recipe.size === 'small' ? 8 : 10) : 0);
    points.push({ ...rotate(radius, 0, i * TAU / recipe.count + (scattered ? between(random, -0.02, 0.02) : 0)), capital: false });
  }
  const offset = scattered && recipe.staggered ? between(random, -0.01, 0.01) : 0;
  for (let i = 0; i < recipe.inner; i++) {
    const angle = recipe.staggered ? Math.PI / 8 + Math.floor(i / 2) * Math.PI + (i % 2) * Math.PI / 4 + offset : Math.PI / recipe.count + i * TAU / recipe.inner;
    points.push({ ...rotate(recipe.staggered ? i % 2 === 0 ? 320 : 340 : recipe.innerRadius, 0, angle), capital: recipe.capSlots ? recipe.capSlots.includes(i) : i === 0 });
  }
  return points;
}

export function buildChaosMap(seed: number, family: number, options?: ChaosMapOptions): MapDefinition {
  const random = seededRandom(seed), composition = options?.composition ?? integer(random, 0, 3);
  const choose = <T,>(recipes: readonly T[]) => recipes[integer(random, 0, recipes.length - 1)];
  const small = (): Recipe => { const count = options?.smallPlanets ?? integer(random, 5, 7); return { count, radius: count === 5 ? 280 : count === 6 ? 310 : 330, inner: 0, innerRadius: 0, pattern: options ? 'ring' : random() < 0.5 ? 'ring' : 'scattered', size: 'small' }; };
  const publicSystems = composition === 2 ? [small()] : composition === 3 ? [small(), small()] : [];
  const homes: Recipe[] = composition === 0 ? Array.from({ length: 4 }, () => CLASSIC) : composition >= 2 ? [options ? LARGE[0] : choose(LARGE)] : [];
  if (composition === 3) homes.push(options ? LARGE[0] : choose(LARGE));
  let budget = 50 - [...homes, ...publicSystems].reduce((sum, recipe) => sum + population(recipe), 0);
  const normalCount = composition === 1 ? 4 : composition === 2 ? 2 : 0;
  for (let i = 0; i < normalCount; i++) {
    const recipe = options ? NORMAL.find(recipe => recipe.pattern === options.normalPattern)! : choose(NORMAL.filter(recipe => population(recipe) <= budget - (normalCount - i - 1) * 12));
    homes.push(recipe); budget -= population(recipe);
  }
  // Four classic systems remain a full recipe option. Other maps can combine
  // four normal systems, mixed fronts, or two large systems with small fronts.
  const selected = shuffle(homes, random), centers = constellation(selected.map(recipe => recipe.radius), family, random);
  for (const recipe of publicSystems) {
    const candidates: Point[] = [];
    for (let a = 0; a < centers.length; a++) for (let b = a + 1; b < centers.length; b++) {
      candidates.push(...circleIntersections(centers[a], centers[b], selected[a].radius + recipe.radius + GAP + 2, selected[b].radius + recipe.radius + GAP + 2)
        .filter(point => centers.every((center, i) => distance(point, center) - selected[i].radius - recipe.radius >= GAP - EPSILON)));
    }
    if (!candidates.length) throw new Error('No safe public system placement');
    centers.push(choose(candidates)); selected.push(recipe);
  }
  const factions = shuffle(FACTIONS, random), weapons = () => shuffle(SUPERWEAPON_IDS, random).slice(0, options && options.weaponsPerWorld !== 'mixed' ? options.weaponsPerWorld : random() < 0.5 ? 1 : 2), capitalWeapons = weapons();
  const planets: PlanetDefinition[] = [], orbits: OrbitDefinition[] = [], systems: GeneratedStarSystem[] = [];
  let factionIndex = 0;
  selected.forEach((recipe, index) => {
    const center = centers[index], phase = between(random, 0, TAU), members: PlanetDefinition[] = [];
    formation(recipe, random).forEach((point, i) => {
      const offset = rotate(point.x, point.y, phase), capital = point.capital;
      const planet: PlanetDefinition = { id: `system-${index}-${i < recipe.count ? `outer-${i}` : `inner-${i - recipe.count}`}`, x: center.x + offset.x, y: center.y + offset.y,
        owner: capital ? factions[factionIndex++] : NEUTRAL, ships: capital ? 200 : integer(random, 20, 42), ...(capital ? { capital: true } : {}), superweaponUnlocks: capital ? [...capitalWeapons] : weapons() };
      planets.push(planet); members.push(planet);
    });
    for (const capital of members.filter(planet => planet.capital)) members.filter(planet => !planet.capital && distance(planet, capital) <= 600)
      .sort((a, b) => distance(a, capital) - distance(b, capital)).slice(0, 3).forEach((planet, i) => { planet.ships = 12 + i * 2; });
    const planetIds = members.map(planet => planet.id);
    orbits.push({ ...center, periodSeconds: generatedOrbitPeriod(recipe.radius), planetIds });
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
        || !['small', 'normal', 'large'].includes(recipe.size) || !['classic', 'pentagon-web', 'woven-rings', 'ring', 'scattered'].includes(recipe.pattern))) throw new Error('Invalid system recipe membership');
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
    if (map.generated) {
      const degrees = planets.map(planet => planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange).length);
      if (degrees.filter(degree => degree === 4 || degree === 5).length < Math.ceil(planets.length * 0.70) || degrees.reduce((sum, degree) => sum + degree, 0) < planets.length * 4) throw new Error('Every Chaos system needs dense internal routes');
    }
    const envelope = beltEnvelope(orbit, planets);
    if (map.generated && orbit.periodSeconds !== generatedOrbitPeriod(envelope.radius)) throw new Error('Inconsistent orbital speed for system size');
    return envelope;
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
