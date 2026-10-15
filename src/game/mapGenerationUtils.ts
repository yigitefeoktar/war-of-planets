import { type GeneratedMode, type MapDefinition, type OrbitDefinition, type PlanetDefinition } from './campaign';

export const TAU = Math.PI * 2;
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
export const between = (random: () => number, min: number, max: number) => min + random() * (max - min);
export const integer = (random: () => number, min: number, max: number) => Math.floor(between(random, min, max + 1));
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export function rotate(x: number, y: number, angle: number) {
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}
export function mapConnected(planets: readonly { x: number; y: number }[], range = 600): boolean {
  if (!planets.length) return false;
  const reached = new Set([0]), queue = [0];
  for (let index = 0; index < queue.length; index++) for (let other = 0; other < planets.length; other++) {
    if (!reached.has(other) && distance(planets[queue[index]], planets[other]) <= range) { reached.add(other); queue.push(other); }
  }
  return reached.size === planets.length;
}

export function wrapMap(mode: GeneratedMode, seed: number, layout: string, planets: PlanetDefinition[], orbits?: OrbitDefinition[], recipe?: Pick<NonNullable<MapDefinition['generated']>, 'modules' | 'weaponGroups'>): MapDefinition {
  // Include fixed worlds as well as the entire swept paths of moving worlds.
  const extent = Math.max(...planets.flatMap(planet => [Math.abs(planet.x), Math.abs(planet.y)]), ...(orbits ?? []).flatMap(orbit => {
    const radius = Math.max(...planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(planet, orbit)));
    return [Math.abs(orbit.x) + radius, Math.abs(orbit.y) + radius];
  }));
  const size = Math.ceil((extent + 240) * 2 / 100) * 100, offset = size / 2;
  return {
    id: `generated-${mode}-${seed}`, title: mode === 'quick-match' ? 'Quick Match' : 'Chaos Mode',
    briefing: mode === 'quick-match' ? 'Choose your expansion route, secure specialist regions and capture the rival capitals.' : 'Ride the moving systems, capture weapon worlds and protect your orbiting capital.',
    width: size, height: size, attackRange: 600, galaxyTheme: mode === 'chaos-mode' ? 'siege' : 'standard',
    objective: { type: 'eliminate-capitals', description: 'Capture all enemy capitals. Keep your blue capital alive.' },
    generated: { mode, seed, layout, ...(recipe ?? {}), ...(recipe?.modules ? { modules: recipe.modules.map(module => ({ ...module, x: module.x + offset, y: module.y + offset })) } : {}) },
    planets: planets.map(planet => ({ ...planet, x: planet.x + offset, y: planet.y + offset })),
    ...(orbits?.length ? { orbits: orbits.map(orbit => ({ ...orbit, x: orbit.x + offset, y: orbit.y + offset })) } : {}),
  };
}
