import type { MapDefinition, OrbitDefinition, PlanetDefinition } from './campaign';
import { CHAPTER_TWO_WEAPONS, PINK } from './superweapons';
import type { SuperweaponId } from './types';
import { seededRandom } from './mapGenerationUtils';

const BLUE = '#3b82f6', RED = '#ef4444', GREEN = '#22c55e', YELLOW = '#eab308', NEUTRAL = '#6b7280';
type Point = { x: number; y: number };
type Owner = PlanetDefinition['owner'];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Authored geometry: stars have clear swept orbits, and fixed lanes use explicit waypoints. */
class Battlefield {
  planets: PlanetDefinition[] = [];
  orbits: OrbitDefinition[] = [];
  private next = 0;
  constructor(readonly id: string, readonly width: number, readonly height: number) {}

  world(point: Point, weapon?: SuperweaponId, ships = 22, id = `${this.id}-link-${this.next++}`) {
    const existing = this.planets.find(planet => distance(planet, point) < 1);
    if (existing) return existing;
    const planet: PlanetDefinition = { id, ...point, owner: NEUTRAL, ships, ...(weapon ? { superweaponUnlocks: [weapon] } : {}) };
    this.planets.push(planet);
    return planet;
  }

  lane(points: Point[], weapon?: SuperweaponId) {
    // Share a junction when authored routes meet, rather than stacking two worlds.
    const insert = (point: Point) => this.planets.find(planet => distance(planet, point) < 250) ?? this.world(point, weapon);
    insert(points[0]);
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      const steps = Math.ceil(distance(a, b) / 560);
      for (let step = 1; step <= steps; step++) insert({ x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps });
    }
  }

  system(name: string, center: Point, owner: Owner = NEUTRAL, capitalIndex = 0, capitalWeapon?: SuperweaponId, period = 240,
    options: { weapon?: SuperweaponId; size?: 'large' | 'reserve' } = {}) {
    const ids: string[] = [];
    const rings = options.size === 'large' ? [{ count: 12, radius: 1040 }, { count: 8, radius: 620 }, { count: 4, radius: 300 }]
      : options.size === 'reserve' ? [{ count: 8, radius: 620 }] : [{ count: 8, radius: 620 }, { count: 4, radius: 300 }];
    let index = 0;
    for (const ring of rings) for (let member = 0; member < ring.count; member++, index++) {
      const angle = member / ring.count * Math.PI * 2;
      const radius = ring.radius;
      const capital = owner !== NEUTRAL && index === capitalIndex;
      const weapon = options.weapon ?? (capital ? capitalWeapon : CHAPTER_TWO_WEAPONS[index % 3]);
      const planet = this.world({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }, weapon,
        capital ? owner === BLUE ? 320 : owner === PINK ? 280 : 240 : 24,
        `${this.id}-${name}-${capital ? 'capital' : index}`);
      if (capital) { planet.owner = owner; planet.capital = true; }
      ids.push(planet.id);
    }
    this.orbits.push({ ...center, periodSeconds: period, planetIds: ids });
  }

  // Ports sit 330 units beyond the outer orbit, including the larger three-ring systems.
  port(a: Point, b: Point): Point {
    const d = distance(a, b), dx = (b.x - a.x) / d, dy = (b.y - a.y) / d;
    const orbit = this.orbits.find(system => system.x === a.x && system.y === a.y)!;
    const radius = Math.max(...this.planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(a, planet))) + 330;
    return { x: a.x + dx * radius, y: a.y + dy * radius };
  }

  connect(a: Point, b: Point) {
    this.lane([this.port(a, b), this.port(b, a)]);
  }

  finish(title: string, briefing: string, pink = true, lesson?: string): MapDefinition {
    // Cheap local choices preserve an affordable opening for every faction.
    for (const capital of this.planets.filter(planet => planet.capital)) {
      const neighbors = this.planets.filter(planet => !planet.capital && distance(capital, planet) <= 600)
        .sort((a, b) => distance(capital, a) - distance(capital, b));
      for (const planet of neighbors.slice(0, 3)) {
        planet.ships = 12;
      }
    }
    return {
      id: this.id, title, briefing, lesson, width: this.width, height: this.height, attackRange: 600,
      galaxyTheme: 'frontier', overviewScale: 0.85,
      mobileFocus: 'capital', weapons: [...CHAPTER_TWO_WEAPONS], pinkTerraforming: pink,
      objective: { type: 'eliminate-capitals', description: 'Capture every enemy capital and protect your blue capital. Capitals cannot be converted.' },
      planets: this.planets, ...(this.orbits.length ? { orbits: this.orbits } : {}),
    };
  }
}

function spiralBreach() {
  const map = new Battlefield('frontier-twin-suns', 6800, 8500);
  map.system('blue', { x: 1100, y: 4700 }, BLUE, 0, 'conversion', 300, { weapon: 'conversion' });
  for (const planet of map.planets) planet.ships = planet.capital ? 320 : 12;

  // Six frontier worlds curve around the western edge. Only the last two
  // open into the broad battlefield, each with several different landing choices.
  const approach = [
    { x: 2100, y: 4400 }, { x: 2280, y: 3880 }, { x: 2350, y: 3330 },
    { x: 2550, y: 2820 }, { x: 2940, y: 2400 }, { x: 3470, y: 2170 },
  ];
  for (const [index, point] of approach.entries()) map.world(point, 'conversion', 8, `${map.id}-blue-approach-${index + 1}`);

  // An early, separate fork gives Blue first access to the northern arsenal.
  // Only the last branch world contacts its orbit; the main battlefield is distant.
  const arsenalPath = [
    { x: 1750, y: 3600 }, { x: 1430, y: 3100 }, { x: 1170, y: 2620 }, { x: 750, y: 2260 },
  ];
  for (const [index, point] of arsenalPath.entries()) map.world(point, 'conversion', 8, `${map.id}-arsenal-path-${index + 1}`);
  map.system('arsenal', { x: 1150, y: 1350 }, NEUTRAL, 0, undefined, 240);
  for (const [index, planet] of map.planets.filter(planet => planet.id.includes('-arsenal-') && !planet.id.includes('-path-')).entries()) {
    planet.superweaponUnlocks = [index % 2 === 0 ? 'omni' : 'repulse'];
    planet.ships = 12;
  }

  // Four worlds occupy just 60 degrees of a large orbit. Their moving arc is
  // a ferry: boarding windows open near Blue, then near the fixed eastern dock.
  const ferry = { x: 2600, y: 6500 }, ferryIds: string[] = [];
  for (let index = 0; index < 4; index++) {
    const angle = (-120 + index * 20) * Math.PI / 180;
    const planet = map.world({ x: ferry.x + Math.cos(angle) * 1400, y: ferry.y + Math.sin(angle) * 1400 },
      undefined, 12, `${map.id}-ferry-${index}`);
    ferryIds.push(planet.id);
  }
  map.orbits.push({ ...ferry, periodSeconds: 180, planetIds: ferryIds });

  // Capitals sit at the near edge, within two captures of a spiral landing.
  // Their neutral hinterlands extend north, east and south instead of hiding
  // the victory targets at the far end of another long corridor.
  const capitals = [
    { x: 4060, y: 1700, owner: RED, name: 'red' },
    { x: 3870, y: 2910, owner: GREEN, name: 'green' },
    { x: 4480, y: 2330, owner: YELLOW, name: 'yellow' },
  ] as const;
  const hub: Point[] = [
    ...capitals,
    { x: 3130, y: 1950 }, { x: 3330, y: 2730 }, { x: 3570, y: 1670 }, { x: 3970, y: 2210 },
    { x: 4000, y: 1200 }, { x: 3830, y: 3400 }, { x: 4340, y: 2850 }, { x: 4500, y: 1530 },
  ];
  const random = seededRandom(0x6b12ea);
  const center = { x: 5800, y: 3250 };
  // Jittered triangular neighborhoods keep most worlds connected in several
  // directions. An uneven boundary and broad weapon districts soften the grid.
  for (let row = -6; row <= 6; row++) for (let col = -7; col <= 7; col++) {
    const point = {
      x: center.x + (col + (Math.abs(row) % 2) * 0.5) * 470 + (random() - 0.5) * 70,
      y: center.y + row * 407 + (random() - 0.5) * 70,
    };
    const dx = point.x - center.x, dy = point.y - center.y, angle = Math.atan2(dy, dx);
    const boundary = 1 + 0.07 * Math.sin(angle * 3 + 0.5) + 0.04 * Math.cos(angle * 5);
    if (Math.hypot(dx / 2850, dy / 2350) > boundary) continue;
    if (hub.some(other => distance(point, other) < 360)) continue;
    if (approach.slice(0, 4).some(other => distance(point, other) < 670)) continue;
    if (approach.some(other => distance(point, other) < 350)) continue;
    hub.push(point);
  }
  const districts = [
    { x: 4400, y: 1500, weapon: 'omni' }, { x: 7000, y: 1900, weapon: 'repulse' },
    { x: 4400, y: 3900, weapon: 'repulse' }, { x: 7100, y: 4400, weapon: 'omni' },
  ] as const;
  // Cut away the eastern half of the old battlefield without moving its capitals.
  const mainWorlds: PlanetDefinition[] = [];
  for (const [index, point] of hub.filter(point => point.x <= 6000).entries()) {
    const district = [...districts].sort((a, b) => distance(point, a) - distance(point, b))[0];
    const weapon = index >= capitals.length && random() < 0.08 ? district.weapon === 'omni' ? 'repulse' : 'omni' : district.weapon;
    const capital = capitals[index];
    const planet = map.world(point, weapon, capital ? 240 : 12, capital ? `${map.id}-${capital.name}-capital` : `${map.id}-hub-${index}`);
    if (capital) { planet.owner = capital.owner; planet.capital = true; }
    mainWorlds.push(planet);
  }
  const dock = map.world({ x: 3850, y: 5300 }, 'repulse', 12, `${map.id}-ferry-dock`);
  const nearest = [...mainWorlds].sort((a, b) => distance(a, dock) - distance(b, dock))[0];
  map.lane([dock, nearest], 'repulse');

  return {
    id: map.id, title: 'The Spiral Breach', width: map.width, height: map.height, attackRange: 600,
    briefing: 'Take the early spiral fork to a northern system of Omni Strike and Repulse Shield worlds, or continue toward the nearby Red, Green, and Yellow capitals. Their eastern territory has been cut back. A four-world rotating arc provides a second crossing along the bottom: board it near Blue and ride toward the battlefield dock.',
    lesson: 'Your home system and both approach paths produce Conversion Probe. The northern arsenal starts neutral. Four ordinary planets share one side of the large southern orbit, completing a turn in three minutes; boarding connections change as they rotate. Enemy capitals require ordinary attacks.',
    galaxyTheme: 'twin-suns', overviewScale: 0.9, mobileFocus: 'capital',
    weapons: [...CHAPTER_TWO_WEAPONS], pinkTerraforming: false,
    objective: { type: 'eliminate-capitals', description: 'Capture Red, Green, and Yellow capitals while protecting your blue capital. Capitals cannot be converted.' },
    planets: map.planets, orbits: map.orbits,
  } satisfies MapDefinition;
}

function pinkFrontier() {
  const map = new Battlefield('frontier-purple-frontier', 7600, 7600);
  const pink = { x: 3800, y: 3600 }, blue = { x: 1300, y: 6000 }, red = { x: 6300, y: 5600 };
  map.system('pink-core', pink, PINK, 6, 'conversion', 210, { weapon: 'conversion' });
  map.system('blue', blue, BLUE, 3, 'conversion', 270);
  map.system('red', red, RED, 1, 'repulse', 300);
  map.connect(blue, pink);
  map.connect(red, pink);
  // A southern bypass lets the outside factions meet without first conquering Pink.
  map.lane([{ x: 1300, y: 6950 }, { x: 3100, y: 6900 }, { x: 5000, y: 6750 }, { x: 6300, y: 6550 }]);
  // Longer flanks offer weapon sites and an alternative to the two direct core approaches.
  map.lane([{ x: 1300, y: 5050 }, { x: 1400, y: 3600 }, { x: 1800, y: 2100 }, { x: 2800, y: 1900 }, { x: 3800, y: 2650 }], 'omni');
  map.lane([{ x: 3800, y: 2650 }, { x: 4800, y: 1800 }, { x: 6000, y: 2100 }, { x: 6300, y: 3600 }, { x: 6300, y: 4650 }], 'repulse');
  return map.finish('The Pink Frontier', 'Pink occupies the central conversion system. Blue and Red approach from the south, with long weapon-rich flanks around the core and a southern bypass between their home systems. Raid Pink’s new factories before they finish, or seize the outer weapons to force a breakthrough.', true,
    'Pink transforms worlds it holds: existing weapon sources are stripped after 30 seconds, and Conversion Probe production begins after 60. Capture a world to interrupt construction. Completed conversion sites stay valuable when captured.');
}

function shiftingFronts() {
  const map = new Battlefield('frontier-shifting-fronts', 8000, 7600);
  const center = { x: 4000, y: 3600 };
  const capital = map.world(center, 'repulse', 380, `${map.id}-blue-capital`);
  capital.owner = BLUE; capital.capital = true;
  // Two fixed rings give Blue immediate choices between defensive and conversion sites.
  for (const [ring, radius, count] of [[1, 520, 6], [2, 1040, 12]]) {
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count;
      map.world({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
        index % 3 === 0 ? 'conversion' : ring === 1 ? 'repulse' : index % 2 === 0 ? 'repulse' : 'omni',
        ring === 1 ? 12 : 18, `${map.id}-hub-${ring}-${index}`);
    }
  }
  const enemies = [
    { name: 'red', point: { x: 4000, y: 1200 }, owner: RED, capital: 2, period: 240 },
    { name: 'green', point: { x: 6800, y: 5000 }, owner: GREEN, capital: 0, period: 300 },
    { name: 'pink', point: { x: 1200, y: 5700 }, owner: PINK, capital: 4, period: 270 },
  ] as const;
  for (const enemy of enemies) {
    map.system(enemy.name, enemy.point, enemy.owner, enemy.capital, enemy.owner === PINK ? 'conversion' : undefined, enemy.period);
    const d = distance(center, enemy.point);
    map.lane([map.port(enemy.point, center), { x: center.x + (enemy.point.x - center.x) * 1040 / d, y: center.y + (enemy.point.y - center.y) * 1040 / d }]);
  }
  // Outer routes let enemies fight each other and let Blue escape a concentrated central assault.
  map.lane([{ x: 3050, y: 1200 }, { x: 1700, y: 1500 }, { x: 1200, y: 4750 }], 'omni');
  map.lane([{ x: 4950, y: 1200 }, { x: 6800, y: 2000 }, { x: 6800, y: 4050 }], 'repulse');
  map.lane([{ x: 2150, y: 5700 }, { x: 4200, y: 6400 }, { x: 6000, y: 6000 }, { x: 6800, y: 5950 }], 'conversion');
  return map.finish('Shifting Fronts', 'Blue holds the center, surrounded by Red in the north, Green in the east, and Pink in the southwest. Capture the nearby shield and conversion sites, choose which front to reinforce, and use the outer routes when the central battle becomes crowded.');
}

function threeFortresses() {
  const map = new Battlefield('frontier-three-fortresses', 8400, 7600);
  const systems = [
    { name: 'conversion', point: { x: 3800, y: 1600 }, owner: BLUE, weapon: 'conversion', capital: 9, period: 270 },
    { name: 'omni', point: { x: 1600, y: 5800 }, owner: RED, weapon: 'omni', capital: 5, period: 330 },
    { name: 'repulse', point: { x: 6500, y: 5600 }, owner: GREEN, weapon: 'repulse', capital: 1, period: 390 },
  ] as const;
  for (const system of systems) {
    map.system(system.name, system.point, system.owner, system.capital, system.weapon, system.period, { size: 'large', weapon: system.weapon });
  }
  // Three perimeter lanes stay available while rotation changes the nearest boarding worlds.
  for (let index = 0; index < systems.length; index++) map.connect(systems[index].point, systems[(index + 1) % systems.length].point);
  const hub = { x: 4000, y: 4100 };
  map.world(hub, 'conversion', 24, `${map.id}-junction`);
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    map.world({ x: hub.x + Math.cos(angle) * 520, y: hub.y + Math.sin(angle) * 520 }, CHAPTER_TWO_WEAPONS[index % 3], 18);
  }
  for (const system of systems) {
    const d = distance(hub, system.point);
    map.lane([map.port(system.point, hub), { x: hub.x + (system.point.x - hub.x) * 520 / d, y: hub.y + (system.point.y - hub.y) * 520 / d }]);
  }
  return map.finish('The Three Fortresses', 'Three huge rotating systems, three different arsenals: Blue begins among Conversion Probes, Red among Omni Strikes, and Green among Repulse Shields. Every planet in a system shares its weapon. Take the central junction or circle along the outer lanes to build a mixed arsenal. Pink is absent from this battle.', false);
}

function galacticCrown() {
  const map = new Battlefield('frontier-galactic-crown', 10000, 8200);
  const blue = { x: 1500, y: 6500 }, red = { x: 1900, y: 1600 }, green = { x: 8400, y: 4200 };
  const yellow = { x: 6500, y: 6800 }, pink = { x: 8500, y: 1300 }, center = { x: 4900, y: 3600 };
  map.system('blue', blue, BLUE, 3, 'conversion', 270);
  map.system('red', red, RED, 5, 'omni', 300);
  map.system('green', green, GREEN, 0, 'repulse', 360, { size: 'large' });
  map.system('yellow', yellow, YELLOW, 1, 'omni', 240);
  // Pink begins on the outer edge, with access to Green, the north, and the central battlefield.
  map.system('pink-edge', pink, PINK, 0, 'conversion', 210, { weapon: 'conversion' });
  map.system('contested-core', center, NEUTRAL, 0, undefined, 330, { size: 'large' });
  for (const system of [blue, red, green, yellow, pink]) map.connect(system, center);
  map.connect(pink, green);
  map.connect(green, yellow);
  // Unequal outer fronts and an offset central system avoid a five-way radial layout.
  map.lane([{ x: 1500, y: 5550 }, { x: 1100, y: 4400 }, { x: 1200, y: 3200 }, { x: 1900, y: 2550 }], 'repulse');
  map.lane([{ x: 2450, y: 6500 }, { x: 3500, y: 7200 }, { x: 5550, y: 6800 }], 'conversion');
  map.lane([{ x: 2850, y: 1600 }, { x: 4100, y: 900 }, { x: 6500, y: 1000 }, { x: 7550, y: 1300 }], 'omni');
  for (const [index, planet] of map.planets.filter(planet => planet.id.includes('-link-')).entries()) {
    planet.superweaponUnlocks ??= [CHAPTER_TWO_WEAPONS[index % 3]];
  }
  return map.finish('The Galactic Crown', 'Five factions fight across an uneven galaxy. Blue and Red share a long western front, Yellow holds the southern approaches, and Green has a larger eastern system. Pink grows along the northeastern edge with three routes into the war. The great neutral core offers all three weapons, but outer fronts let you attack without conquering it first.');
}

export const CHAPTER_TWO_MAPS: MapDefinition[] = [spiralBreach(), pinkFrontier(), shiftingFronts(), threeFortresses(), galacticCrown()];
