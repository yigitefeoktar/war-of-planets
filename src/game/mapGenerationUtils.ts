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
  // Choose a compact orientation before fitting bounds. Randomly rotating a
  // narrow two-system map by 45 degrees nearly doubled its empty rectangle.
  // Sixteen bounded candidates retain seeded variety without rejection loops.
  const circles = (orbits ?? []).map(orbit => ({ ...orbit, radius: Math.max(...planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(planet, orbit))) }));
  const phase = seededRandom(seed ^ 0x71A4C295)() * TAU;
  let bestAngle = phase, bestArea = Infinity;
  for (let i = 0; i < 16; i++) {
    const angle = phase + i * TAU / 16;
    const points = planets.map(planet => ({ ...rotate(planet.x, planet.y, angle), radius: 0 }));
    points.push(...circles.map(orbit => ({ ...rotate(orbit.x, orbit.y, angle), radius: orbit.radius })));
    const spanX = Math.max(...points.map(p => p.x + p.radius)) - Math.min(...points.map(p => p.x - p.radius)) + 480;
    const spanY = Math.max(...points.map(p => p.y + p.radius)) - Math.min(...points.map(p => p.y - p.radius)) + 480;
    if (spanX * spanY < bestArea) { bestArea = spanX * spanY; bestAngle = angle; }
  }
  planets = planets.map(planet => ({ ...planet, ...rotate(planet.x, planet.y, bestAngle) }));
  orbits = orbits?.map(orbit => ({ ...orbit, ...rotate(orbit.x, orbit.y, bestAngle) }));
  if (recipe?.modules) recipe = { ...recipe, modules: recipe.modules.map(module => ({ ...module, ...rotate(module.x, module.y, bestAngle) })) };
  // Fit each axis to the actual content, including complete swept paths.
  // Centering every recipe in a large square left unnecessary empty borders.
  const bounds = planets.map(planet => ({ left: planet.x, right: planet.x, top: planet.y, bottom: planet.y }));
  for (const orbit of orbits ?? []) {
    const radius = Math.max(...planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(planet, orbit)));
    bounds.push({ left: orbit.x - radius, right: orbit.x + radius, top: orbit.y - radius, bottom: orbit.y + radius });
  }
  const left = Math.min(...bounds.map(bound => bound.left)), right = Math.max(...bounds.map(bound => bound.right));
  const top = Math.min(...bounds.map(bound => bound.top)), bottom = Math.max(...bounds.map(bound => bound.bottom));
  const width = Math.ceil((right - left + 480) / 100) * 100, height = Math.ceil((bottom - top + 480) / 100) * 100;
  const offsetX = (width - right - left) / 2, offsetY = (height - bottom - top) / 2;
  return {
    id: `generated-${mode}-${seed}`, title: mode === 'quick-match' ? 'Quick Match' : 'Chaos Mode',
    briefing: mode === 'quick-match' ? 'Choose your expansion route, secure specialist regions and capture the rival capitals.' : 'Ride the moving systems, capture weapon worlds and protect your orbiting capital.',
    width, height, attackRange: 600, galaxyTheme: mode === 'chaos-mode' ? 'siege' : 'standard',
    objective: { type: 'eliminate-capitals', description: 'Capture all enemy capitals. Keep your blue capital alive.' },
    generated: { mode, seed, layout, ...(recipe ?? {}), ...(recipe?.modules ? { modules: recipe.modules.map(module => ({ ...module, x: module.x + offsetX, y: module.y + offsetY })) } : {}) },
    planets: planets.map(planet => ({ ...planet, x: planet.x + offsetX, y: planet.y + offsetY })),
    ...(orbits?.length ? { orbits: orbits.map(orbit => ({ ...orbit, x: orbit.x + offsetX, y: orbit.y + offsetY })) } : {}),
  };
}
