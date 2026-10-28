import { FACTIONS, NEUTRAL, type GeneratedMapModule, type GeneratedWeaponGroup, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { between, distance, generatedOrbitPeriod, integer, mapConnected, rotate, seededRandom, shuffle, TAU, validateConnectionDensity, wrapMap } from './mapGenerationUtils';
import type { SuperweaponId } from './types';

type Profile = GeneratedWeaponGroup['profile'];
export const WEAPON_PROFILES: Record<Profile, readonly SuperweaponId[]> = {
  production: ['overdrive'], defense: ['repulse'], strike: ['omni'], support: ['overdrive', 'repulse'],
};
export const QUICK_LAYOUTS = ['crossroads', 'twin-fronts', 'outer-arsenals', 'linked-arenas'] as const;
export const QUICK_BATTLE_PLANS = [
  { title: 'Control the center or raid the edges', description: 'A guarded central weapon prize faces four approaches. Cheaper outer routes let you raid opponents who commit to the middle.', profiles: ['production', 'defense', 'strike'] },
  { title: 'Choose your front', description: 'Two weapon fronts reward committing your fleet. Fortified crossings make switching fronts costly; an outer bypass offers another way through.', profiles: ['production', 'strike', 'defense'] },
  { title: 'Race for the outer arsenals', description: 'Guarded outer arsenals reward a detour. Take the cheaper inner route to pressure capitals while opponents invest outside.', profiles: ['defense', 'strike', 'production'] },
  { title: 'Stage an attack or seize the assault arena', description: 'Two outer arenas offer different commitments: a cheaper staging area and a guarded weapon prize. Multiple entrances let you flank either one.', profiles: ['defense', 'production', 'strike'] },
] as const satisfies readonly { title: string; description: string; profiles: readonly Profile[] }[];
export const QUICK_ROUTE_VARIANTS = [
  ['central-crossing', 'clockwise-bypasses', 'split-approaches'],
  ['parallel-fronts', 'wide-crossings', 'close-fronts'],
  ['outer-circuit', 'opposite-arsenals', 'offset-arsenals'],
  ['opposite-arenas', 'outer-arenas', 'corner-arenas'],
] as const;
export function quickRouteVariant(seed: number): number { return (seed >>> 2) % 3; }
const EPSILON = 1e-5;
export type QuickMapOptions = {
  orbitingPlanets: 5 | 6 | 7;
  flankRegions: 0 | 1 | 2;
  weaponFocus: 'balanced' | 'production' | 'defense' | 'strike';
};

/** Capitals are crossroads in a continuous outer network, with a separate
 * route through the orbital interior. Every district has several approaches. */
export function buildQuickMap(seed: number, family: number, options?: QuickMapOptions): MapDefinition {
  const random = seededRandom(seed), binary = family === 1 || family === 3;
  const variant = quickRouteVariant(seed);
  const inwardApproaches = family === 0 || family === 1 ? [0, 1, 2, 3] : family === 3 && variant === 1 ? [] : [[1, 3], [0, 2], [2, 3]][variant];
  const starCount = binary ? 2 : 1, count = binary ? 5 : options?.orbitingPlanets ?? integer(random, 5, 7);
  const radius = count === 5 ? between(random, 312, 315) : between(random, 315, 320);
  const separationBase = family === 1 ? [910, 1000, 1150][variant] : [1060, 960, 1120][variant];
  const homeReach = 600, starReach = radius + 270, separation = binary ? between(random, separationBase, separationBase + 10) : 0;
  const homeDistance = homeReach + starReach;
  const aspect = family === 0 ? [.705, .68, .735][variant] : [.68, .72, .73][variant];
  const halfWidth = binary ? between(random, 1180, 1190) : homeDistance * between(random, aspect, aspect + .005);
  const halfHeight = binary ? Math.sqrt(homeDistance ** 2 - (halfWidth - separation / 2) ** 2) : Math.sqrt(homeDistance ** 2 - halfWidth ** 2);
  const planets: PlanetDefinition[] = [], modules: GeneratedMapModule[] = [], groups: GeneratedWeaponGroup[] = [], orbits: OrbitDefinition[] = [];
  const add = (module: GeneratedMapModule, x: number, y: number, role: string, ships = integer(random, 24, 40)): PlanetDefinition => {
    const planet: PlanetDefinition = { id: `${module.id}-${role}`, x, y, owner: NEUTRAL, ships };
    planets.push(planet); module.planetIds.push(planet.id); return planet;
  };
  const makeModule = (id: string, kind: GeneratedMapModule['kind'], x: number, y: number): GeneratedMapModule => {
    const module = { id, kind, x, y, planetIds: [], ports: [] }; modules.push(module); return module;
  };
  const stars = Array.from({ length: starCount }, (_, i) => makeModule(`core-${i}`, 'star-system', binary ? (i - 0.5) * separation : 0, 0));
  const corners = [{ x: -halfWidth, y: -halfHeight }, { x: halfWidth, y: -halfHeight }, { x: halfWidth, y: halfHeight }, { x: -halfWidth, y: halfHeight }];
  const factions = shuffle(FACTIONS, random), cheap = integer(random, 12, 18), reserve = integer(random, 24, 30);
  const homes = corners.map((point, sector) => {
    const module = makeModule(`home-${sector}`, 'home', point.x, point.y);
    const inward = Math.atan2(-Math.sign(point.y), -Math.sign(point.x));
    const unit = between(random, 292, 296);
    for (let row = 0; row < 2; row++) for (let column = -1; column <= 1; column++) {
      if (row === 1 && column === 0) continue;
      const capital = row === 0 && column === 0;
      const offset = rotate((row - 0.5) * unit, column * unit, inward);
      const role = capital ? 'capital' : `front-${row}-${column}`;
      const planet = add(module, point.x + offset.x, point.y + offset.y, role, capital ? 200 : row === 0 || column === -1 ? cheap : reserve);
      if (capital) { planet.capital = true; planet.owner = factions[sector]; }
    }
    return module;
  });
  const roads: GeneratedMapModule[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], span = distance(a, b), dx = (b.x - a.x) / span, dy = (b.y - a.y) / span;
    const module = makeModule(`outer-route-${i}`, 'corridor', (a.x + b.x) / 2, (a.y + b.y) / 2); roads.push(module);
    const approachCost = family === 0 ? 18 : family === 1 ? 22 : family === 2 ? 20 : 24;
    const crossingCost = family === 1 ? i % 2 === 0 ? 48 : 22 : 28;
    add(module, a.x + dx * homeReach, a.y + dy * homeReach, 'approach-a', approachCost);
    if (binary) add(module, module.x, module.y, 'crossing', crossingCost);
    add(module, b.x - dx * homeReach, b.y - dy * homeReach, 'approach-b', approachCost);
  }
  for (const i of inwardApproaches) {
    // Perimeter and arena families enter the interior through two selected
    // fronts. Crossroads and Twin Fronts retain all four inward approaches.
    const home = homes[i], star = stars[binary && home.x > 0 ? 1 : 0], theta = Math.atan2(star.y - home.y, star.x - home.x), offset = rotate(homeReach, 0, theta);
    // Small independent offsets vary actual orbital contacts without opening
    // gaps in the stationary loop or changing the protected home geometry.
    const turn = family === 0 ? [0, .18, i % 2 === 0 ? .15 : -.15][variant] : [.12, -.12, i % 2 === 0 ? -.15 : .15][variant];
    const position = rotate(home.x + offset.x - star.x, home.y + offset.y - star.y, binary ? family === 3 && variant > 0 ? .07 : 0 : turn + between(random, -0.025, 0.025));
    const module = makeModule(`inner-route-${i}`, 'corridor', star.x + position.x, star.y + position.y);
    add(module, module.x, module.y, 'crossing', family === 0 ? 34 : family === 2 ? 22 : 28);
  }
  const objectives: { module: GeneratedMapModule; worlds: PlanetDefinition[] }[] = [];
  for (const star of stars) {
    const phase = between(random, 0, TAU), worlds: PlanetDefinition[] = [];
    for (let i = 0; i < count; i++) {
      const offset = rotate(radius, 0, phase + i * TAU / count);
      worlds.push(add(star, star.x + offset.x, star.y + offset.y, `ring-${i}`));
    }
    objectives.push({ module: star, worlds });
    random(); // Preserve the seeded geometry/garrison sequence after removing the random period.
    orbits.push({ x: star.x, y: star.y, periodSeconds: generatedOrbitPeriod(radius), planetIds: worlds.map(planet => planet.id) });
  }
  if (binary) {
    const road = shuffle(roads.filter(road => Math.abs(road.y) > 1), random)[0];
    if (family === 3) {
      // Two public arenas create separate objectives, rather than Twin Fronts' single bypass.
      const arenaSides = [[0, 2], [0, 2], [0, 1]][variant];
      for (const side of arenaSides) {
        const arena = roads[side], normal = rotate(1, 0, -Math.PI / 2 + side * Math.PI / 2);
        const tangent = rotate(normal.x, normal.y, Math.PI / 2);
        const depth = side % 2 === 1 ? 460 : 240;
        for (const direction of [-1, 1]) add(arena, arena.x + normal.x * depth + tangent.x * direction * 180, arena.y + normal.y * depth + tangent.y * direction * 180, `arena-${direction}`);
        objectives.push({ module: arena, worlds: arena.planetIds.map(id => planets.find(planet => planet.id === id)!) });
      }
    } else {
      objectives.push({ module: road, worlds: road.planetIds.map(id => planets.find(planet => planet.id === id)!) });
      const normal = { x: 0, y: Math.sign(road.y) }, module = makeModule('outer-bypass', 'weapon-cluster', road.x, road.y + normal.y * 400), worlds: PlanetDefinition[] = [];
      const bypass = variant === 1 ? [[0, 300], [-300, 500], [300, 500], [0, 700]] : [[-200, 250], [200, 250], [-200, 550], [200, 550]];
      for (const [side, depth] of bypass) worlds.push(add(module, road.x + side, road.y + normal.y * depth, `${depth}-${side}`));
      objectives.push({ module, worlds });
    }
  } else {
    // Approach arsenals occupy connected public crossings, rather than adding
    // isolated weapon rooms. Each has two paths back into the wider network.
    const usedRoads = new Set<GeneratedMapModule>();
    for (const i of shuffle([0, 1, 2, 3], random)) {
      if (usedRoads.size === 2) break;
      const inner = modules.find(module => module.id === `inner-route-${i}`);
      if (!inner) continue;
      const road = roads.find(candidate => !usedRoads.has(candidate) && mapConnected([...candidate.planetIds, ...inner.planetIds].map(id => planets.find(planet => planet.id === id)!), 600));
      if (!road) continue;
      usedRoads.add(road);
      road.planetIds.push(...inner.planetIds); modules.splice(modules.indexOf(inner), 1);
      objectives.push({ module: road, worlds: road.planetIds.map(id => planets.find(planet => planet.id === id)!) });
    }
    for (const i of shuffle([0, 1, 2, 3], random).slice(0, options?.flankRegions ?? ((family === 2 ? 1 : 0) + (random() < 0.5 ? 1 : 0)))) {
      const road = roads[i], normal = rotate(1, 0, -Math.PI / 2 + i * Math.PI / 2);
      const tangent = rotate(normal.x, normal.y, Math.PI / 2), offset = family === 2 ? (variant === 1 ? -75 : 75) : 0, depth = family === 2 ? 740 : 765;
      const module = makeModule(`flank-${i}`, 'weapon-cluster', road.x + normal.x * depth + tangent.x * offset, road.y + normal.y * depth + tangent.y * offset), worlds: PlanetDefinition[] = [];
      const flankRadius = between(random, 230, 240);
      for (let j = 0; j < 5; j++) {
        const offset = rotate(flankRadius, 0, Math.atan2(-normal.y, -normal.x) + Math.PI / 5 + j * TAU / 5);
        worlds.push(add(module, module.x + offset.x, module.y + offset.y, `world-${j}`));
      }
      objectives.push({ module, worlds });
    }
  }
  // Outer Arsenals puts its strike/production rewards on the detours, ahead
  // of the ordinary approach groups. The other layouts retain their front order.
  if (family === 2) objectives.sort((a, b) => {
    const priority = (module: GeneratedMapModule) => module.kind === 'star-system' ? 0 : module.id.startsWith('flank-') ? 1 : 2;
    return priority(a.module) - priority(b.module);
  });
  const profiles: Profile[] = [...QUICK_BATTLE_PLANS[family].profiles];
  if (options && options.weaponFocus !== 'balanced') {
    profiles.splice(profiles.indexOf(options.weaponFocus), 1);
    profiles.unshift(options.weaponFocus);
  }
  while (profiles.length < objectives.length) profiles.push(options && options.weaponFocus !== 'balanced' ? options.weaponFocus : 'support');
  for (let index = 0; index < objectives.length; index++) {
    const { module, worlds } = objectives[index], profile = profiles[index], allowedWeapons = [...WEAPON_PROFILES[profile]];
    const start = integer(random, 0, worlds.length - 1), size = integer(random, 3, Math.min(5, worlds.length));
    const chosen = [worlds[start]];
    while (chosen.length < size) {
      const frontier = worlds.filter(planet => !chosen.includes(planet) && chosen.some(other => distance(planet, other) <= 600));
      chosen.push(frontier[integer(random, 0, frontier.length - 1)]);
    }
    chosen.forEach((planet, j) => { planet.superweaponUnlocks = [allowedWeapons[j % allowedWeapons.length]]; });
    groups.push({ id: `${module.id}-weapons-0`, moduleId: module.id, profile, allowedWeapons, planetIds: chosen.map(planet => planet.id) });
  }
  // Price public opportunities by their strategic role. Protected homes are
  // intentionally excluded, so the three equal affordable openings stay intact.
  for (const group of groups) {
    const core = group.moduleId.startsWith('core-'), outer = group.moduleId.startsWith('flank-');
    const arena = family === 3 && group.moduleId.startsWith('outer-route-');
    const assaultArena = arena && group === groups[2];
    const [low, high] = family === 0 ? core ? [44, 54] : [30, 38]
      : family === 1 ? core ? group.profile === 'strike' ? [40, 48] : [30, 38] : [26, 34]
      : family === 2 ? outer ? [48, 58] : core ? [22, 28] : [28, 34]
      : arena ? assaultArena ? [46, 56] : [24, 30] : [28, 36];
    for (const id of group.planetIds) {
      const planet = planets.find(planet => planet.id === id)!;
      planet.ships = Math.max(planet.ships, integer(random, low, high));
      // Keep the inner route and staging arena cheaper even with custom weapons.
      if (family === 2 && core || arena) planet.ships = integer(random, low, high);
    }
  }
  // Ports include optional orbital contacts as well as permanent crossings.
  // The outer network remains usable even when every orbital route is removed.
  const moving = new Set(orbits.flatMap(orbit => orbit.planetIds));
  for (const module of modules) module.ports = planets.filter(planet => !module.planetIds.includes(planet.id) && !moving.has(planet.id)
    && (module.kind === 'star-system' ? distance(planet, module) - radius <= 600 : module.planetIds.some(id => distance(planet, planets.find(world => world.id === id)!) <= 600))).map(planet => planet.id);
  const map = wrapMap('quick-match', seed, QUICK_LAYOUTS[family], planets, orbits, { modules, weaponGroups: groups });
  map.briefing = QUICK_BATTLE_PLANS[family].description;
  return map;
}

/** Certify protected openings, redundant fixed routes and permanent access
 * to the moving interior. Optional orbital contacts may change with rotation. */
export function validateQuickGeometry(map: MapDefinition): void {
  if (map.planets.length < 35 || map.planets.length > 50) throw new Error('Quick planet budget exceeded');
  const modules = map.generated?.modules ?? [], groups = map.generated?.weaponGroups ?? [], orbits = map.orbits ?? [];
  const byId = new Map(map.planets.map(planet => [planet.id, planet]));
  if (orbits.length < 1 || orbits.length > 2) throw new Error('Quick Match requires one or two stars');
  if (modules.filter(module => module.kind === 'home').length !== 4) throw new Error('Missing home modules');
  const assigned = modules.flatMap(module => module.planetIds);
  if (new Set(modules.map(module => module.id)).size !== modules.length || assigned.length !== map.planets.length || new Set(assigned).size !== assigned.length || assigned.some(id => !byId.has(id))) throw new Error('Invalid module membership');
  const movingIds = orbits.flatMap(orbit => orbit.planetIds), moving = new Set(movingIds);
  if (moving.size !== movingIds.length || movingIds.some(id => !byId.has(id))) throw new Error('Invalid orbit membership');
  const fixed = map.planets.filter(planet => !moving.has(planet.id));
  for (const module of modules) {
    if (!module.planetIds.length || !module.ports.length || new Set(module.ports).size !== module.ports.length || module.ports.some(id => !byId.has(id) || moving.has(id) || module.planetIds.includes(id))) throw new Error('Invalid module ports');
    const local = module.planetIds.map(id => byId.get(id)!);
    const orbit = orbits.find(orbit => orbit.planetIds.some(id => module.planetIds.includes(id)));
    if (orbit) {
      if (module.kind !== 'star-system' || distance(module, orbit) > EPSILON || orbit.planetIds.length !== local.length || local.some(planet => !orbit.planetIds.includes(planet.id) || planet.capital)) throw new Error('Invalid star module');
      const radius = distance(local[0], orbit);
      if (orbit.periodSeconds !== generatedOrbitPeriod(radius)) throw new Error('Inconsistent orbital speed for system size');
      const angles = local.map(planet => Math.atan2(planet.y - orbit.y, planet.x - orbit.x)).sort((a, b) => a - b);
      if (local.length < 5 || 2 * radius * Math.sin(2 * Math.PI / local.length) > map.attackRange || !mapConnected(local, map.attackRange) || local.some(planet => Math.abs(distance(planet, orbit) - radius) > EPSILON)
        || angles.some((angle, i) => Math.abs(angles[(i + 1) % angles.length] + (i + 1 === angles.length ? TAU : 0) - angle - TAU / angles.length) > EPSILON)) throw new Error('Invalid orbital circuit');
      const permanent = module.ports.filter(id => {
        const separation = distance(byId.get(id)!, orbit);
        return Math.sqrt(separation ** 2 + radius ** 2 - 2 * separation * radius * Math.cos(Math.PI / local.length)) <= map.attackRange - 1;
      });
      if (permanent.length < 2) throw new Error('Orbital gateways close during rotation');
      for (const planet of fixed) {
        const clearance = distance(planet, orbit) - radius;
        if (clearance < 270 - EPSILON) throw new Error('A fixed world intersects the orbital spacing');
        if (planet.capital && clearance <= map.attackRange) throw new Error('An orbit bypasses the capital frontier');
        if (!module.ports.includes(planet.id) && clearance <= map.attackRange) throw new Error('An orbit bypasses its declared gateways');
      }
    } else if (module.kind === 'star-system' || !mapConnected(local, map.attackRange)) throw new Error('Disconnected stationary module');
    if (module.kind === 'home') {
      const exits = local.filter(planet => !planet.capital && fixed.some(other => !module.planetIds.includes(other.id) && distance(planet, other) <= map.attackRange));
      if (exits.length < 2) throw new Error('Home has only one approach');
      for (const planet of local.filter(planet => planet.capital)) {
        const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange);
        if (planet.ships !== 200 || neighbors.length !== 4 || neighbors.some(other => !module.planetIds.includes(other.id)) || neighbors.filter(other => other.ships <= 18 && !other.superweaponUnlocks?.length).length !== 3) throw new Error('Unsafe capital opening');
      }
    }
  }
  for (let i = 0; i < orbits.length; i++) for (const other of orbits.slice(i + 1)) {
    const radius = Math.max(...orbits[i].planetIds.map(id => distance(byId.get(id)!, orbits[i])));
    const otherRadius = Math.max(...other.planetIds.map(id => distance(byId.get(id)!, other)));
    if (distance(orbits[i], other) - radius - otherRadius < 270 - EPSILON) throw new Error('Star systems violate spacing');
  }
  const survivors = fixed.filter(planet => !planet.capital);
  for (const planet of fixed) {
    const degree = survivors.filter(other => other !== planet && distance(planet, other) <= map.attackRange).length;
    const entrance = modules.some(module => module.kind === 'corridor' && module.planetIds.includes(planet.id));
    if (degree < (entrance ? 2 : 3)) throw new Error('Quick worlds require multiple permanent neighbors');
  }
  for (let i = 0; i < map.planets.length; i++) for (let j = i + 1; j < map.planets.length; j++) {
    if (distance(map.planets[i], map.planets[j]) < 270 - EPSILON) throw new Error('Unsafe Quick spacing');
  }
  // No moving planet or single fixed crossing controls the entire battlefield.
  if (!mapConnected(survivors, map.attackRange) || survivors.some(removed => !mapConnected(survivors.filter(planet => planet !== removed), map.attackRange))) throw new Error('A single crossing disconnects the fixed battlefield');
  const grouped = new Set<string>();
  for (const group of groups) {
    const module = modules.find(module => module.id === group.moduleId);
    const worlds = group.planetIds.map(id => byId.get(id));
    if (!module || worlds.length < 3 || worlds.length > 5 || new Set(group.planetIds).size !== worlds.length || worlds.some(planet => !planet || grouped.has(planet.id) || !module.planetIds.includes(planet.id))) throw new Error('Invalid weapon group membership');
    if (!WEAPON_PROFILES[group.profile] || JSON.stringify(group.allowedWeapons) !== JSON.stringify(WEAPON_PROFILES[group.profile])) throw new Error('Invalid weapon group profile');
    if (!mapConnected(worlds as PlanetDefinition[], map.attackRange) || worlds.some(planet => !planet!.superweaponUnlocks?.length || planet!.superweaponUnlocks.some(weapon => !group.allowedWeapons.includes(weapon)))) throw new Error('Weapon group violates its allowed types');
    group.allowedWeapons.forEach(weapon => { if (!worlds.some(planet => planet!.superweaponUnlocks?.includes(weapon))) throw new Error('Weapon group is missing a specialty'); });
    group.planetIds.forEach(id => grouped.add(id));
  }
  if (map.planets.some(planet => Boolean(planet.superweaponUnlocks?.length) !== grouped.has(planet.id))) throw new Error('Ungrouped weapon planet');
  validateConnectionDensity(map);
}
