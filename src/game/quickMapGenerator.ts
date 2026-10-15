import { FACTIONS, NEUTRAL, type GeneratedMapModule, type GeneratedWeaponGroup, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';
import { quickRoutes, type RouteNetwork } from './routeNetworks';
import { between, distance, integer, mapConnected, rotate, seededRandom, shuffle, TAU, wrapMap } from './mapGenerationUtils';
import type { SuperweaponId } from './types';

type Profile = GeneratedWeaponGroup['profile'];
export const WEAPON_PROFILES: Record<Profile, readonly SuperweaponId[]> = {
  production: ['overdrive'], defense: ['repulse'], strike: ['omni'], support: ['overdrive', 'repulse'],
};
export const QUICK_LAYOUTS = ['divided-territories', 'branching-fronts', 'outer-circuits', 'linked-arenas'] as const;
const EPSILON = 1e-5;

function recipeRoutes(family: number, random: () => number): RouteNetwork {
  if (family !== 2) return quickRoutes(family, random);
  const count = integer(random, 4, 8), radius = 2 / (2 * Math.sin(Math.PI / count));
  return {
    points: Array.from({ length: count }, (_, index) => rotate(radius, 0, TAU * index / count)),
    edges: Array.from({ length: count }, (_, index) => [index, (index + 1) % count]),
  };
}

/** Ports are fixed worlds shared by adjacent modules. Interiors can change
 * shape without changing how the assembler joins the surrounding territory. */
export function buildQuickMap(seed: number, family: number): MapDefinition {
  const random = seededRandom(seed), unit = between(random, 500, 503);
  const network = recipeRoutes(family, random);
  const planets: PlanetDefinition[] = [], modules: GeneratedMapModule[] = [], groups: GeneratedWeaponGroup[] = [], orbits: OrbitDefinition[] = [];
  const core = network.points.map((point, index): GeneratedMapModule => ({ id: `core-${index}`, kind: 'junction', x: point.x * 3 * unit, y: point.y * 3 * unit, planetIds: [], ports: [] }));
  modules.push(...core);
  const byId = new Map<string, PlanetDefinition>();
  const add = (module: GeneratedMapModule, x: number, y: number, role: string, ships = integer(random, 24, 40)): PlanetDefinition => {
    const planet: PlanetDefinition = { id: `${module.id}-${role}`, x, y, owner: NEUTRAL, ships };
    planets.push(planet); byId.set(planet.id, planet); module.planetIds.push(planet.id);
    return planet;
  };
  const portal = (id: string, x: number, y: number) => {
    const module: GeneratedMapModule = { id, kind: 'corridor', x, y, planetIds: [], ports: [] };
    modules.push(module);
    return add(module, x, y, 'portal', 30);
  };
  for (const [index, [a, b]] of network.edges.entries()) {
    const gate = portal(`route-${index}`, (core[a].x + core[b].x) / 2, (core[a].y + core[b].y) / 2);
    core[a].ports.push(gate.id); core[b].ports.push(gate.id);
  }
  // Outward attachments leave the core's approaches clear, including swept orbits.
  const homes = family === 2 ? Array.from({ length: 4 }, (_, i) => Math.floor(i * core.length / 4))
    : [0, core.findIndex(node => node.x === Math.max(...core.map(p => p.x)) && node.y === core[0].y), core.length - 1,
      core.findIndex(node => node.x === core[0].x && node.y === Math.max(...core.map(p => p.y)))];
  const factions = shuffle(FACTIONS, random), starter = shuffle(['production', 'defense', 'strike'] as const, random)[0];
  const openingCost = integer(random, 12, 18), specialistCost = integer(random, 28, 36), homeCross = random() < 0.5;
  const group = (module: GeneratedMapModule, candidates: PlanetDefinition[], profile: Profile, ring: boolean, count?: number) => {
    const size = count ?? integer(random, 3, Math.min(5, candidates.length));
    let selected: PlanetDefinition[];
    if (ring) {
      const start = integer(random, 0, candidates.length - 1);
      selected = Array.from({ length: size }, (_, i) => candidates[(start + i) % candidates.length]);
    } else {
      selected = [candidates[0]];
      while (selected.length < size) {
        const next = shuffle(candidates.filter(planet => !selected.includes(planet) && selected.some(other => distance(planet, other) <= 600)), random)[0];
        if (!next) throw new Error('Weapon group has no connected growth path');
        selected.push(next);
      }
    }
    const allowed = [...WEAPON_PROFILES[profile]];
    selected.forEach((planet, index) => { planet.superweaponUnlocks = [allowed[index % allowed.length]]; });
    groups.push({ id: `${module.id}-weapons`, moduleId: module.id, profile, allowedWeapons: allowed, planetIds: selected.map(planet => planet.id) });
  };
  homes.forEach((index, sector) => {
    const parent = core[index], theta = Math.atan2(parent.y, parent.x);
    const direction = rotate(1, 0, theta);
    const port = portal(`route-home-${sector}`, parent.x + direction.x * 3 * unit, parent.y + direction.y * 3 * unit);
    parent.ports.push(port.id);
    const module: GeneratedMapModule = { id: `home-${sector}`, kind: 'home', x: parent.x + direction.x * 4 * unit, y: parent.y + direction.y * 4 * unit, planetIds: [], ports: [port.id] };
    modules.push(module);
    const first = rotate(1, 0, theta - Math.PI / 4), second = rotate(1, 0, theta + Math.PI / 4);
    const specs: [number, number, string][] = [[0, 0, 'gate'], [0, 1, 'specialist-approach'], [0, 2, 'specialist'], [1, 2, 'opening-a'], [2, 2, 'capital'], [2, 1, 'opening-b'], [2, 0, 'supply'], [1, 0, 'supply-approach']];
    if (homeCross) specs.push([1, 1, 'crossing']);
    const worlds = specs.map(([x, y, role]) => {
      const planet = add(module, module.x + (x * first.x + y * second.x) * unit, module.y + (x * first.y + y * second.y) * unit, role,
        role === 'capital' ? 200 : role.startsWith('opening') ? openingCost : role.startsWith('specialist') || role === 'gate' ? specialistCost : 24);
      if (role === 'capital') { planet.capital = true; planet.owner = factions[sector]; }
      return planet;
    });
    // The same single specialty and opening costs for all four homes. Other
    // specialties must be earned from public clusters instead of local arsenals.
    group(module, worlds.slice(0, 3), starter, false, 3);
  });

  const shuffledCore = shuffle(core, random), starCount = integer(random, 1, 2);
  const stars = shuffledCore.slice(0, starCount);
  const clusterCount = integer(random, 1, Math.min(3, core.length - starCount));
  const clusters = shuffledCore.slice(starCount, starCount + clusterCount);
  const objectiveModules = shuffle([...stars, ...clusters], random);
  const profiles: Profile[] = [...shuffle((['production', 'defense', 'strike'] as const).filter(profile => profile !== starter), random)];
  while (profiles.length < objectiveModules.length) profiles.push(shuffle(['production', 'defense', 'strike', 'support'] as const, random)[0]);
  for (const module of core) {
    const star = stars.includes(module), objective = clusters.includes(module);
    const ring = star || (!objective && random() < (family === 3 ? 0.6 : 0.25));
    module.kind = star ? 'star-system' : objective ? 'weapon-cluster' : ring ? 'arena' : 'junction';
    const worlds: PlanetDefinition[] = [];
    if (ring) {
      const phase = between(random, 0, TAU);
      for (let i = 0; i < 12; i++) {
        const point = rotate(unit * 2, 0, phase + i * TAU / 12);
        worlds.push(add(module, module.x + point.x, module.y + point.y, `ring-${i}`));
      }
      if (star) orbits.push({ x: module.x, y: module.y, periodSeconds: integer(random, 260, 420), planetIds: worlds.map(planet => planet.id) });
    } else {
      worlds.push(add(module, module.x, module.y, 'hub'));
      for (const [index, id] of module.ports.entries()) {
        const port = byId.get(id)!, dx = (port.x - module.x) / 3, dy = (port.y - module.y) / 3;
        for (let step = 1; step <= 2; step++) worlds.push(add(module, module.x + dx * step, module.y + dy * step, `arm-${index}-${step}`));
      }
    }
    const objectiveIndex = objectiveModules.indexOf(module);
    if (objectiveIndex >= 0) group(module, worlds, profiles[objectiveIndex], ring);
  }
  const orientation = between(random, 0, TAU);
  for (const point of [...planets, ...modules, ...orbits]) Object.assign(point, rotate(point.x, point.y, orientation));
  return wrapMap('quick-match', seed, QUICK_LAYOUTS[family], planets, orbits, { modules, weaponGroups: groups });
}

/** Certify every orbital phase. Fixed ports provide permanent connections;
 * non-port worlds stay outside the complete moving attack envelope. */
export function validateQuickGeometry(map: MapDefinition): void {
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
      if (!mapConnected(local, map.attackRange) || local.some(planet => Math.abs(distance(planet, orbit) - radius) > EPSILON)
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
      if (planet.capital && (planet.ships !== 200 || neighbors.length !== 2 || neighbors.some(other => other.ships > 18 || other.superweaponUnlocks?.length))) throw new Error('Unsafe capital opening');
      if (!planet.id.endsWith('-gate') && neighbors.some(other => !module.planetIds.includes(other.id))) throw new Error('An attack bypasses the home frontier');
    }
  }
  for (let i = 0; i < orbits.length; i++) for (const other of orbits.slice(i + 1)) {
    const radius = Math.max(...orbits[i].planetIds.map(id => distance(byId.get(id)!, orbits[i])));
    const otherRadius = Math.max(...other.planetIds.map(id => distance(byId.get(id)!, other)));
    if (distance(orbits[i], other) - radius - otherRadius < 650) throw new Error('Star systems bypass fixed gateways');
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
