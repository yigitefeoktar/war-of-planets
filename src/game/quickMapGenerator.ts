import { FACTIONS, NEUTRAL, type GeneratedMapModule, type GeneratedWeaponGroup, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { between, distance, integer, mapConnected, rotate, seededRandom, shuffle, TAU, validateConnectionDensity, wrapMap } from './mapGenerationUtils';
import type { SuperweaponId } from './types';

type Profile = GeneratedWeaponGroup['profile'];
export const WEAPON_PROFILES: Record<Profile, readonly SuperweaponId[]> = {
  production: ['overdrive'], defense: ['repulse'], strike: ['omni'], support: ['overdrive', 'repulse'],
};
export const QUICK_LAYOUTS = ['divided-territories', 'branching-fronts', 'outer-circuits', 'linked-arenas'] as const;
const EPSILON = 1e-5;

/** Assemble compact, dense regions into branching fronts and closed circuits.
 * Region interiors provide choices; shared entrance worlds control crossings. */
export function buildQuickMap(seed: number, family: number): MapDefinition {
  const random = seededRandom(seed), coreCount = family === 3 ? 2 : 3;
  const starCount = integer(random, 1, 2), starIndices = shuffle(Array.from({ length: coreCount }, (_, i) => i), random).slice(0, starCount);
  const slots = Array.from({ length: coreCount }, (_, index) => ({
    star: starIndices.includes(index), count: starIndices.includes(index) ? 6 : 5,
    radius: starIndices.includes(index) ? between(random, 315, 325) : between(random, 285, 295),
  }));
  const edges: [number, number][] = coreCount === 2 ? [[0, 1]] : family === 1 ? [[0, 1], [1, 2]] : [[0, 1], [1, 2], [2, 0]];
  let budget = 40 - 20 - edges.length - slots.reduce((sum, slot) => sum + slot.count, 0);
  for (const index of shuffle(Array.from({ length: coreCount }, (_, i) => i), random)) if (budget > 0 && random() < 0.6) { slots[index].count++; budget--; if (!slots[index].star) slots[index].radius = between(random, 315, 325); }
  const spacing = (a: number, b: number) => slots[a].radius + slots[b].radius + 840;
  const points = [{ x: 0, y: 0 }, { x: spacing(0, 1), y: 0 }];
  if (coreCount === 3) {
    if (family === 1) {
      const theta = between(random, 0.1, 1.0);
      points.push({ x: points[1].x + Math.cos(theta) * spacing(1, 2), y: Math.sin(theta) * spacing(1, 2) });
    } else {
      const x = (spacing(0, 2) ** 2 + spacing(0, 1) ** 2 - spacing(1, 2) ** 2) / (2 * spacing(0, 1));
      points.push({ x, y: Math.sqrt(spacing(0, 2) ** 2 - x ** 2) });
    }
  }
  const center = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  const planets: PlanetDefinition[] = [], modules: GeneratedMapModule[] = [], groups: GeneratedWeaponGroup[] = [], orbits: OrbitDefinition[] = [];
  const core = points.map((point, i): GeneratedMapModule => ({ id: `core-${i}`, kind: slots[i].star ? 'star-system' : family === 0 ? 'junction' : 'arena', x: point.x - center.x, y: point.y - center.y, planetIds: [], ports: [] }));
  modules.push(...core);
  const add = (module: GeneratedMapModule, x: number, y: number, role: string, ships = integer(random, 24, 40)): PlanetDefinition => {
    const planet: PlanetDefinition = { id: `${module.id}-${role}`, x, y, owner: NEUTRAL, ships };
    planets.push(planet); module.planetIds.push(planet.id); return planet;
  };
  for (const [index, [a, b]] of edges.entries()) {
    const theta = Math.atan2(core[b].y - core[a].y, core[b].x - core[a].x), point = rotate(slots[a].radius + 420, 0, theta);
    const bridge: GeneratedMapModule = { id: `route-${index}`, kind: 'corridor', x: core[a].x + point.x, y: core[a].y + point.y, planetIds: [], ports: [] };
    modules.push(bridge);
    const gate = add(bridge, bridge.x, bridge.y, 'entrance', integer(random, 24, 32));
    core[a].ports.push(gate.id); core[b].ports.push(gate.id);
  }
  const homeParents = coreCount === 2 ? [0, 0, 1, 1] : family === 1 ? [0, 0, 2, 2] : [0, 0, 1, 2];
  const factions = shuffle(FACTIONS, random), opening = integer(random, 12, 18), gateCost = integer(random, 24, 32);
  for (let sector = 0; sector < 4; sector++) {
    const parentIndex = homeParents[sector], parent = core[parentIndex];
    const siblings = homeParents.filter(index => index === parentIndex).length;
    const sibling = homeParents.slice(0, sector).filter(index => index === parentIndex).length;
    const theta = Math.atan2(parent.y, parent.x) + (siblings === 2 ? (sibling === 0 ? -1 : 1) * 0.70 : 0) + between(random, -0.025, 0.025);
    const point = rotate(slots[parentIndex].radius + 420, 0, theta), radius = between(random, 285, 295);
    const module: GeneratedMapModule = { id: `home-${sector}`, kind: 'home', x: parent.x + point.x, y: parent.y + point.y, planetIds: [], ports: [] };
    modules.push(module);
    const capitalSlot = integer(random, 2, 3);
    for (let i = 0; i < 5; i++) {
      const offset = rotate(radius * (1 - Math.cos(i * TAU / 5)), radius * Math.sin(i * TAU / 5), theta);
      const role = i === 0 ? 'gate' : i === capitalSlot ? 'capital' : `opening-${i}`;
      const planet = add(module, module.x + offset.x, module.y + offset.y, role, i === 0 ? gateCost : i === capitalSlot ? 200 : opening);
      if (i === capitalSlot) { planet.capital = true; planet.owner = factions[sector]; }
      if (i === 0) { module.ports.push(planet.id); parent.ports.push(planet.id); }
    }
  }
  const profiles: Profile[] = shuffle(['production', 'defense', 'strike'], random) as Profile[];
  if (coreCount === 3 && random() < 0.5) profiles.push('support');
  const assignment = coreCount === 2 ? [0, 1, slots[0].count >= 6 ? 0 : 1] : shuffle([0, 1, 2], random);
  if (profiles.length === 4) assignment.push(slots.findIndex(slot => slot.count >= 6));
  for (const [index, module] of core.entries()) {
    const slot = slots[index], phase = between(random, 0, TAU), worlds: PlanetDefinition[] = [];
    for (let i = 0; i < slot.count; i++) {
      const point = rotate(slot.radius, 0, phase + i * TAU / slot.count);
      worlds.push(add(module, module.x + point.x, module.y + point.y, `ring-${i}`));
    }
    const localProfiles = profiles.filter((_, i) => assignment[i] === index);
    let cursor = integer(random, 0, worlds.length - 1), remaining = worlds.length;
    for (const [groupIndex, profile] of localProfiles.entries()) {
      const size = integer(random, 3, Math.min(5, remaining - (localProfiles.length - groupIndex - 1) * 3));
      const selected = Array.from({ length: size }, (_, i) => worlds[(cursor + i) % worlds.length]);
      const allowedWeapons = [...WEAPON_PROFILES[profile]];
      selected.forEach((planet, i) => { planet.superweaponUnlocks = [allowedWeapons[i % allowedWeapons.length]]; });
      groups.push({ id: `${module.id}-weapons-${groupIndex}`, moduleId: module.id, profile, allowedWeapons, planetIds: selected.map(planet => planet.id) });
      cursor += size; remaining -= size;
    }
    if (slot.star) orbits.push({ x: module.x, y: module.y, periodSeconds: integer(random, 260, 420), planetIds: worlds.map(planet => planet.id) });
  }
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
      if (local.length < 5 || 2 * radius * Math.sin(2 * Math.PI / local.length) > map.attackRange || !mapConnected(local, map.attackRange) || local.some(planet => Math.abs(distance(planet, orbit) - radius) > EPSILON)
        || angles.some((angle, i) => Math.abs(angles[(i + 1) % angles.length] + (i + 1 === angles.length ? TAU : 0) - angle - TAU / angles.length) > EPSILON)) throw new Error('Invalid orbital circuit');
      for (const port of ports) {
        const separation = distance(port, orbit);
        const furthestNearest = Math.sqrt(separation ** 2 + radius ** 2 - 2 * separation * radius * Math.cos(Math.PI / local.length));
        if (furthestNearest > map.attackRange - 1) throw new Error('Orbital gateway closes during rotation');
      }
      for (const planet of fixed) {
        const clearance = distance(planet, orbit) - radius;
        if (clearance < 270 - EPSILON) throw new Error('A fixed world intersects the orbital spacing');
        if (!module.ports.includes(planet.id) && clearance < 650) throw new Error('An orbit bypasses its gateways');
      }
      connectPorts(module.ports);
    } else if (module.kind === 'star-system' || !mapConnected([...local.filter(planet => !planet.capital), ...ports], map.attackRange)) throw new Error('Disconnected stationary module');
    if (module.kind === 'home') for (const planet of local) {
      const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange);
      if (planet.capital && (planet.ships !== 200 || neighbors.length !== 4 || neighbors.filter(other => other.ships <= 18 && !other.superweaponUnlocks?.length).length !== 3)) throw new Error('Unsafe capital opening');
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
    const entrance = modules.some(module => module.kind === 'corridor' && module.planetIds.includes(planet.id));
    if (staticDegree + permanentOrbitNeighbors < (entrance ? 2 : 3)) throw new Error('Quick worlds require multiple permanent neighbors');
  }
  for (let i = 0; i < map.planets.length; i++) for (let j = i + 1; j < map.planets.length; j++) {
    if (distance(map.planets[i], map.planets[j]) < 270 - EPSILON) throw new Error('Unsafe Quick spacing');
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
  validateConnectionDensity(map);
}
