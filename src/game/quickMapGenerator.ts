import { FACTIONS, NEUTRAL, type GeneratedMapModule, type GeneratedWeaponGroup, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { between, distance, integer, mapConnected, rotate, seededRandom, shuffle, TAU, wrapMap } from './mapGenerationUtils';
import type { SuperweaponId } from './types';

type Profile = GeneratedWeaponGroup['profile'];
export const WEAPON_PROFILES: Record<Profile, readonly SuperweaponId[]> = {
  production: ['overdrive'], defense: ['repulse'], strike: ['omni'], support: ['overdrive', 'repulse'],
};
export const QUICK_LAYOUTS = ['single-star-fronts', 'binary-arenas', 'binary-circuits', 'single-star-flanks'] as const;
const EPSILON = 1e-5;

/** A match has a planet budget, rather than a budget of large independent
 * rooms. Homes share their frontier with the orbital modules; specialist
 * groups reuse circuit worlds instead of adding another room and corridor. */
export function buildQuickMap(seed: number, family: number): MapDefinition {
  const random = seededRandom(seed);
  const starCount = family === 0 || family === 3 ? 1 : 2;
  const counts = Array.from({ length: starCount }, () => integer(random, 10, 12));
  if (counts.reduce((sum, count) => sum + count, 0) > 23) counts[1] = 11;
  const radii = counts.map(count => between(random, 500, 510) / (2 * Math.sin(Math.PI / count)));
  const separation = starCount === 2 ? radii[0] + radii[1] + 1000 : 0;
  const planets: PlanetDefinition[] = [], modules: GeneratedMapModule[] = [], groups: GeneratedWeaponGroup[] = [], orbits: OrbitDefinition[] = [];
  const stars = radii.map((_, index): GeneratedMapModule => ({ id: `core-${index}`, kind: 'star-system', x: starCount === 1 ? 0 : (index - 0.5) * separation, y: 0, planetIds: [], ports: [] }));
  modules.push(...stars);
  const add = (module: GeneratedMapModule, x: number, y: number, role: string, ships = integer(random, 24, 40)): PlanetDefinition => {
    const planet: PlanetDefinition = { id: `${module.id}-${role}`, x, y, owner: NEUTRAL, ships };
    planets.push(planet); module.planetIds.push(planet.id);
    return planet;
  };
  if (starCount === 2) {
    // One shared gateway replaces two long corridors. It always touches both
    // rings, so its degree is at least two at every independent orbit phase.
    const x = stars[0].x + radii[0] + 500;
    const bridge: GeneratedMapModule = { id: 'shared-route', kind: 'corridor', x, y: 0, planetIds: [], ports: [] };
    modules.push(bridge);
    const port = add(bridge, x, 0, 'portal', integer(random, 24, 32));
    stars.forEach(star => star.ports.push(port.id));
  }
  const factions = shuffle(FACTIONS, random), openingCost = integer(random, 12, 18), gateCost = integer(random, 24, 32);
  const extraChoices = family === 0 ? 1 : family === 3 ? 2 : 0;
  for (let sector = 0; sector < 4; sector++) {
    const index = starCount === 1 ? 0 : Math.floor(sector / 2), star = stars[index];
    const theta = starCount === 1 ? sector * Math.PI / 2 + between(random, -0.10, 0.10)
      : (sector % 2 === 0 ? 1 : -1) * (Math.PI / 2 + (index === 0 ? 1 : -1) * between(random, 0.12, 0.28));
    const direction = rotate(radii[index] + 500, 0, theta);
    const module: GeneratedMapModule = { id: `home-${sector}`, kind: 'home', x: star.x + direction.x, y: star.y + direction.y, planetIds: [], ports: [] };
    modules.push(module);
    const unit = between(random, 505, 530), spread = between(random, Math.PI / 3, Math.PI / 2);
    const first = rotate(unit, 0, theta - spread / 2), second = rotate(unit, 0, theta + spread / 2);
    const specs = [{ x: 0, y: 0, role: 'gate' }, { ...first, role: 'opening-a' },
      { x: first.x + second.x, y: first.y + second.y, role: 'capital' }, { ...second, role: 'opening-b' }];
    // Optional equilateral flank triangles add choices without terminal leaves.
    // The rhombus angle also determines whether its two openings interconnect.
    const left = rotate(second.x, second.y, -Math.PI / 2), right = rotate(first.x, first.y, Math.PI / 2);
    const extras = [{ x: first.x + second.x / 2 + left.x * Math.sqrt(3) / 2, y: first.y + second.y / 2 + left.y * Math.sqrt(3) / 2, role: 'flank-a' },
      { x: second.x + first.x / 2 + right.x * Math.sqrt(3) / 2, y: second.y + first.y / 2 + right.y * Math.sqrt(3) / 2, role: 'flank-b' }];
    specs.push(...shuffle(extras, random).slice(0, extraChoices));
    for (const { x, y, role } of specs) {
      const planet = add(module, module.x + x, module.y + y, role, role === 'capital' ? 200 : role === 'gate' ? gateCost : openingCost);
      if (role === 'capital') { planet.capital = true; planet.owner = factions[sector]; }
      if (role === 'gate') { module.ports.push(planet.id); star.ports.push(planet.id); }
    }
  }
  const profiles: Profile[] = shuffle(['production', 'defense', 'strike'], random) as Profile[];
  if (family === 1) profiles.push('support');
  for (const [index, star] of stars.entries()) {
    const phase = between(random, 0, TAU), worlds: PlanetDefinition[] = [];
    for (let i = 0; i < counts[index]; i++) {
      const point = rotate(radii[index], 0, phase + i * TAU / counts[index]);
      worlds.push(add(star, star.x + point.x, star.y + point.y, `ring-${i}`));
    }
    // Each circuit contains one or more contiguous, disjoint specialist groups.
    // All three single-weapon specialties appear; remaining worlds are unarmed.
    const specialties = profiles.filter((_, i) => i % starCount === index);
    let cursor = integer(random, 0, worlds.length - 1), remaining = worlds.length;
    for (const [groupIndex, profile] of specialties.entries()) {
      const size = integer(random, 3, Math.min(5, remaining - (specialties.length - groupIndex - 1) * 3));
      const selected = Array.from({ length: size }, (_, i) => worlds[(cursor + i) % worlds.length]);
      const allowedWeapons = [...WEAPON_PROFILES[profile]];
      selected.forEach((planet, i) => { planet.superweaponUnlocks = [allowedWeapons[i % allowedWeapons.length]]; });
      groups.push({ id: `${star.id}-weapons-${groupIndex}`, moduleId: star.id, profile, allowedWeapons, planetIds: selected.map(planet => planet.id) });
      cursor += size; remaining -= size;
    }
    orbits.push({ x: star.x, y: star.y, periodSeconds: integer(random, 260, 420), planetIds: worlds.map(planet => planet.id) });
  }
  const orientation = between(random, 0, TAU);
  for (const point of [...planets, ...modules, ...orbits]) Object.assign(point, rotate(point.x, point.y, orientation));
  return wrapMap('quick-match', seed, QUICK_LAYOUTS[family], planets, orbits, { modules, weaponGroups: groups });
}

/** Certify every orbital phase. Fixed ports provide permanent connections;
 * non-port worlds stay outside the complete moving attack envelope. */
export function validateQuickGeometry(map: MapDefinition): void {
  if (map.planets.length < 30 || map.planets.length > 40) throw new Error('Quick planet budget exceeded');
  const modules = map.generated?.modules ?? [], groups = map.generated?.weaponGroups ?? [], orbits = map.orbits ?? [];
  const byId = new Map(map.planets.map(planet => [planet.id, planet]));
  if (orbits.length < 1 || orbits.length > 2) throw new Error('Quick Match requires one or two stars');
  if (modules.filter(module => module.kind === 'home').length !== 4) throw new Error('Missing home modules');
  const assigned = modules.flatMap(module => module.planetIds);
  if (new Set(modules.map(module => module.id)).size !== modules.length || assigned.length !== map.planets.length || new Set(assigned).size !== assigned.length || assigned.some(id => !byId.has(id))) throw new Error('Invalid module membership');
  const movingIds = orbits.flatMap(orbit => orbit.planetIds), moving = new Set(movingIds);
  if (moving.size !== movingIds.length || movingIds.some(id => !byId.has(id))) throw new Error('Invalid orbit membership');
  const fixed = map.planets.filter(planet => !moving.has(planet.id));
  const virtualLinks = new Map<string, Set<string>>();
  const connectPorts = (ports: string[]) => { for (const id of ports) { const links = virtualLinks.get(id) ?? new Set<string>(); ports.forEach(other => links.add(other)); virtualLinks.set(id, links); } };
  for (const module of modules) {
    if (!module.planetIds.length || module.kind !== 'corridor' && !module.ports.length || new Set(module.ports).size !== module.ports.length || module.ports.some(id => !byId.has(id) || moving.has(id))) throw new Error('Invalid module ports');
    const local = module.planetIds.map(id => byId.get(id)!);
    const ports = module.ports.map(id => byId.get(id)!);
    const orbit = orbits.find(orbit => orbit.planetIds.some(id => module.planetIds.includes(id)));
    if (orbit) {
      if (module.kind !== 'star-system' || distance(module, orbit) > EPSILON || orbit.planetIds.length !== local.length || local.some(planet => !orbit.planetIds.includes(planet.id) || planet.capital)) throw new Error('Invalid star module');
      const radius = distance(local[0], orbit);
      const angles = local.map(planet => Math.atan2(planet.y - orbit.y, planet.x - orbit.x)).sort((a, b) => a - b);
      if (local.length < 3 || 2 * radius * Math.sin(Math.PI / local.length) > map.attackRange || !mapConnected(local, map.attackRange) || local.some(planet => Math.abs(distance(planet, orbit) - radius) > EPSILON)
        || angles.some((angle, i) => Math.abs(angles[(i + 1) % angles.length] + (i + 1 === angles.length ? TAU : 0) - angle - TAU / angles.length) > EPSILON)) throw new Error('Invalid orbital circuit');
      for (const port of ports) {
        const separation = distance(port, orbit);
        const furthestNearest = Math.sqrt(separation ** 2 + radius ** 2 - 2 * separation * radius * Math.cos(Math.PI / local.length));
        if (furthestNearest > map.attackRange - 1) throw new Error('Orbital gateway closes during rotation');
      }
      for (const planet of fixed) {
        const clearance = distance(planet, orbit) - radius;
        if (clearance < 500 - EPSILON) throw new Error('A fixed world intersects the orbital spacing');
        if (!module.ports.includes(planet.id) && clearance < 650) throw new Error('An orbit bypasses its gateways');
      }
      connectPorts(module.ports);
    } else if (module.kind === 'star-system' || !mapConnected([...local.filter(planet => !planet.capital), ...ports], map.attackRange)) throw new Error('Disconnected stationary module');
    if (module.kind === 'home') for (const planet of local) {
      const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange);
      if (planet.capital && (planet.ships !== 200 || neighbors.length < 2 || neighbors.length > 4 || neighbors.some(other => other.ships > 18 || other.superweaponUnlocks?.length))) throw new Error('Unsafe capital opening');
      if (!planet.id.endsWith('-gate') && neighbors.some(other => !module.planetIds.includes(other.id))) throw new Error('An attack bypasses the home frontier');
    }
  }
  for (let i = 0; i < orbits.length; i++) for (const other of orbits.slice(i + 1)) {
    const radius = Math.max(...orbits[i].planetIds.map(id => distance(byId.get(id)!, orbits[i])));
    const otherRadius = Math.max(...other.planetIds.map(id => distance(byId.get(id)!, other)));
    if (distance(orbits[i], other) - radius - otherRadius < 650) throw new Error('Star systems bypass fixed gateways');
  }
  for (const planet of fixed) {
    const staticDegree = fixed.filter(other => other !== planet && distance(planet, other) <= map.attackRange).length;
    const permanentOrbitNeighbors = modules.filter(module => module.kind === 'star-system' && module.ports.includes(planet.id)).length;
    if (staticDegree + permanentOrbitNeighbors < 2 || staticDegree + 2 * permanentOrbitNeighbors > 6) throw new Error('Quick worlds require multiple permanent neighbors');
  }
  for (let i = 0; i < map.planets.length; i++) for (let j = i + 1; j < map.planets.length; j++) {
    if (distance(map.planets[i], map.planets[j]) < 500 - EPSILON) throw new Error('Unsafe Quick spacing');
  }
  // Prove the fixed skeleton connects even with every capital removed. Each
  // virtual port link has already been certified for all angles above.
  const survivors = fixed.filter(planet => !planet.capital), reached = new Set([survivors[0]?.id]);
  const queue = survivors.length ? [survivors[0]] : [];
  for (let i = 0; i < queue.length; i++) for (const planet of survivors) {
    if (!reached.has(planet.id) && (distance(queue[i], planet) <= map.attackRange || virtualLinks.get(queue[i].id)?.has(planet.id))) { reached.add(planet.id); queue.push(planet); }
  }
  if (reached.size !== survivors.length) throw new Error('Disconnected module skeleton');
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
}
