import { SUPERWEAPON_IDS } from './superweapons';
import type { SuperweaponId } from './types';
import type { GalaxyTheme } from './galaxy';

export const PLAYER = '#3b82f6';
export const NEUTRAL = '#6b7280';
export const FACTIONS = [PLAYER, '#ef4444', '#22c55e', '#eab308'] as const;
export const DYSON_SPHERE_ID = 'dyson-sphere';
export const CHAPTER_ONE_TEST_MODE_IDS = [
  'chapter-1-test-1', 'chapter-1-test-2', 'chapter-1-test-3', 'chapter-1-test-4', 'chapter-1-test-5',
] as const;
export type ChapterOneTestModeId = typeof CHAPTER_ONE_TEST_MODE_IDS[number];
export type ModeId = 'chapter-1' | ChapterOneTestModeId | 'chapter-2' | 'quick-match' | 'hard-mode';
export type ChapterId = Exclude<ModeId, 'quick-match' | 'hard-mode'>;
export function isChapterOneTestMode(mode: ModeId): mode is ChapterOneTestModeId {
  return (CHAPTER_ONE_TEST_MODE_IDS as readonly string[]).includes(mode);
}
export function testLevelForMode(mode: ChapterOneTestModeId): number {
  return CHAPTER_ONE_TEST_MODE_IDS.indexOf(mode) + 1;
}
export type PlanetDefinition = { id: string; x: number; y: number; owner: typeof FACTIONS[number] | typeof NEUTRAL; ships: number; capital?: boolean; superweaponUnlocks?: SuperweaponId[] };
export type DysonSphereDefinition = { chargeIntervalSeconds: number };
export type OrbitDefinition = { x: number; y: number; periodSeconds: number; planetIds: string[]; dysonSphere?: DysonSphereDefinition };
export type MapDefinition = {
  id: string;
  title: string;
  briefing: string;
  width: number;
  height: number;
  attackRange: number;
  galaxyTheme?: GalaxyTheme;
  overviewScale?: number;
  objective: { type: 'eliminate-capitals'; description: string };
  planets: PlanetDefinition[];
  orbit?: OrbitDefinition;
  orbits?: OrbitDefinition[];
  mobileFocus?: 'capital';
  tutorial?: { attackTargetId: string };
};
export type Chapter = { id: ChapterId; plannedLevels: number; maps: MapDefinition[] };

export function mapOrbits(map?: MapDefinition): OrbitDefinition[] {
  return map?.orbits ?? (map?.orbit ? [map.orbit] : []);
}

export const FIRST_STRIKE: MapDefinition = {
  id: 'helios-first-strike', title: 'First Strike',
  galaxyTheme: 'tutorial',
  briefing: 'Break through the weak red outpost, use your blue harbours to expand, and take the red capital. Keep your blue capital safe.',
  width: 1500, height: 1500, attackRange: 600,
  tutorial: { attackTargetId: 'west-landing' },
  objective: { type: 'eliminate-capitals', description: 'Capture the red capital. Keep your blue capital alive.' },
  planets: [
    // Red holds four worlds across the far side; the first target stays weak.
    { id: 'player_1', x: 650, y: 1200, owner: PLAYER, ships: 170, capital: true },
    { id: 'west-landing', x: 650, y: 870, owner: '#ef4444', ships: 10 },
    { id: 'ai_1', x: 1170, y: 450, owner: '#ef4444', ships: 70, capital: true },
    { id: 'central-crossing', x: 820, y: 570, owner: '#ef4444', ships: 14 },
    { id: 'west-harbour', x: 290, y: 1150, owner: PLAYER, ships: 12 },
    { id: 'west-approach', x: 300, y: 760, owner: NEUTRAL, ships: 20 },
    { id: 'northwest-pass', x: 430, y: 430, owner: NEUTRAL, ships: 24 },
    { id: 'east-harbour', x: 1150, y: 1020, owner: PLAYER, ships: 12 },
    { id: 'east-approach', x: 1320, y: 760, owner: '#ef4444', ships: 20 },
  ],
};

export const BREACH_LINE: MapDefinition = {
  id: 'helios-breach-line', title: 'The Breach Line',
  galaxyTheme: 'breach',
  briefing: 'Your upper and lower blue junctions already generate Overdrive charges. Capture more of the seven central Overdrive worlds to speed up production bursts, then break through the red eastern front and take its capital.',
  width: 2500, height: 2500, attackRange: 600, mobileFocus: 'capital',
  objective: { type: 'eliminate-capitals', description: 'Capture the red capital. Hold Overdrive worlds to charge production bursts faster.' },
  planets: [
    // Blue's western front reaches the neutral central weapon cluster.
    { id: 'breach-home', x: 220, y: 1250, owner: PLAYER, ships: 220, capital: true },
    { id: 'breach-supply', x: 510, y: 1250, owner: PLAYER, ships: 14 },
    { id: 'breach-overdrive', x: 840, y: 1250, owner: NEUTRAL, ships: 30, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-gate', x: 1250, y: 1250, owner: NEUTRAL, ships: 50, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-overdrive-north', x: 1740, y: 1250, owner: NEUTRAL, ships: 42, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-north-gate', x: 2050, y: 1250, owner: '#ef4444', ships: 48 },
    { id: 'breach-red-capital', x: 2350, y: 1250, owner: '#ef4444', ships: 125, capital: true },
    // The upper flank keeps its established planet IDs after rotation.
    { id: 'breach-west-harbour', x: 400, y: 700, owner: PLAYER, ships: 12 },
    { id: 'breach-west-entry', x: 760, y: 680, owner: PLAYER, ships: 16 },
    { id: 'breach-west-relay', x: 790, y: 350, owner: PLAYER, ships: 20 },
    { id: 'breach-west-bastion', x: 1250, y: 500, owner: '#ef4444', ships: 36 },
    { id: 'breach-west-junction', x: 1065, y: 860, owner: PLAYER, ships: 32, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-west-approach', x: 1740, y: 500, owner: '#ef4444', ships: 30 },
    { id: 'breach-northwest-signal', x: 1515, y: 860, owner: '#ef4444', ships: 38, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-west-outpost', x: 2160, y: 720, owner: '#ef4444', ships: 35 },
    // The lower flank mirrors the upper route into the central sites.
    { id: 'breach-east-harbour', x: 400, y: 1800, owner: PLAYER, ships: 12 },
    { id: 'breach-east-entry', x: 760, y: 1820, owner: PLAYER, ships: 16 },
    { id: 'breach-east-relay', x: 790, y: 2150, owner: PLAYER, ships: 20 },
    { id: 'breach-east-bastion', x: 1250, y: 2000, owner: '#ef4444', ships: 36 },
    { id: 'breach-east-junction', x: 1065, y: 1640, owner: PLAYER, ships: 32, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-east-approach', x: 1740, y: 2000, owner: '#ef4444', ships: 30 },
    { id: 'breach-northeast-signal', x: 1515, y: 1640, owner: '#ef4444', ships: 38, superweaponUnlocks: ['overdrive'] },
    { id: 'breach-east-lookout', x: 2160, y: 1780, owner: '#ef4444', ships: 35 },
  ],
};

export const TURNING_TIDE: MapDefinition = {
  id: 'helios-turning-tide', title: 'The Turning Tide',
  galaxyTheme: 'orbit',
  briefing: 'Blue, red, and green each begin with one capital. Capture the cheap worlds beside yours or board the rotating ring while your rivals expand. Omni Strike and Production Overdrive worlds alternate around the star. Leave a defence at home.',
  width: 2600, height: 2600, attackRange: 600, mobileFocus: 'capital',
  objective: { type: 'eliminate-capitals', description: 'Destroy both enemy capitals. Use rotating worlds to open new attack routes.' },
  planets: [
    // Fixed outer ring: a safe southern opening, two flanks, and rival fortresses.
    { id: 'tide-home', x: 1300, y: 2360, owner: PLAYER, ships: 260, capital: true },
    { id: 'southwest-harbour', x: 770, y: 2218, owner: NEUTRAL, ships: 12 },
    { id: 'west-approach', x: 382, y: 1830, owner: NEUTRAL, ships: 28 },
    { id: 'west-bastion', x: 240, y: 1300, owner: NEUTRAL, ships: 40 },
    { id: 'red-outpost', x: 382, y: 770, owner: NEUTRAL, ships: 18 },
    { id: 'red-command', x: 770, y: 382, owner: '#ef4444', ships: 200, capital: true },
    { id: 'northern-divide', x: 1300, y: 240, owner: NEUTRAL, ships: 35 },
    { id: 'green-command', x: 1830, y: 382, owner: '#22c55e', ships: 200, capital: true },
    { id: 'green-outpost', x: 2218, y: 770, owner: NEUTRAL, ships: 18 },
    { id: 'east-bastion', x: 2360, y: 1300, owner: NEUTRAL, ships: 40 },
    { id: 'east-approach', x: 2218, y: 1830, owner: NEUTRAL, ships: 28 },
    { id: 'southeast-harbour', x: 1830, y: 2218, owner: NEUTRAL, ships: 12 },
    // Both rotating rings alternate Omni Strike and Production Overdrive sites.
    { id: 'tide-boarding', x: 1300, y: 1920, owner: NEUTRAL, ships: 12, superweaponUnlocks: ['omni'] },
    { id: 'tide-southwest', x: 862, y: 1738, owner: NEUTRAL, ships: 20, superweaponUnlocks: ['overdrive'] },
    { id: 'tide-west', x: 680, y: 1300, owner: NEUTRAL, ships: 30, superweaponUnlocks: ['omni'] },
    { id: 'tide-red', x: 862, y: 862, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['overdrive'] },
    { id: 'tide-north', x: 1300, y: 680, owner: NEUTRAL, ships: 38, superweaponUnlocks: ['omni'] },
    { id: 'tide-green', x: 1738, y: 862, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['overdrive'] },
    { id: 'tide-east', x: 1920, y: 1300, owner: NEUTRAL, ships: 30, superweaponUnlocks: ['omni'] },
    { id: 'tide-southeast', x: 1738, y: 1738, owner: NEUTRAL, ships: 20, superweaponUnlocks: ['overdrive'] },
    // Inner shortcuts offer the same alternating rewards closer to the star.
    { id: 'inner-south', x: 1300, y: 1600, owner: NEUTRAL, ships: 18, superweaponUnlocks: ['omni'] },
    { id: 'inner-west', x: 1000, y: 1300, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['overdrive'] },
    { id: 'inner-north', x: 1300, y: 1000, owner: NEUTRAL, ships: 35, superweaponUnlocks: ['omni'] },
    { id: 'inner-east', x: 1600, y: 1300, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['overdrive'] },
  ],
  orbit: {
    x: 1300, y: 1300, periodSeconds: 180,
    planetIds: ['tide-boarding', 'tide-southwest', 'tide-west', 'tide-red', 'tide-north', 'tide-green', 'tide-east', 'tide-southeast', 'inner-south', 'inner-west', 'inner-north', 'inner-east'],
  },
};

// Six independent branches meet only at the Repulse hub. The 520 to 560-unit
// links fit the 600-unit attack range; diagonal and skipped-row distances do not.
function buildPincer(): MapDefinition {
  const center = 2600;
  const planets: PlanetDefinition[] = [
    { id: 'pincer-home', x: center, y: center, owner: PLAYER, ships: 360, capital: true, superweaponUnlocks: ['repulse'] },
  ];
  const branches: { name: string; owner?: PlanetDefinition['owner']; weapon?: SuperweaponId }[] = [
    { name: 'red', owner: FACTIONS[1] },
    { name: 'overdrive', weapon: 'overdrive' },
    { name: 'green', owner: FACTIONS[2] },
    { name: 'omni', weapon: 'omni' },
    { name: 'yellow', owner: FACTIONS[3] },
    { name: 'repulse', weapon: 'repulse' },
  ];
  for (const [index, branch] of branches.entries()) {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const position = (radius: number, side = 0) => ({
      x: center + radius * cos - side * sin,
      y: center + radius * sin + side * cos,
    });
    // The player must take this neutral hub shield to reach its branch entrance.
    planets.push({ id: `pincer-hub-${branch.name}`, ...position(540), owner: NEUTRAL, ships: 12, superweaponUnlocks: ['repulse'] });
    const sites = [
      { suffix: 'entry', radius: 1080, side: 0, ships: branch.owner ? 24 : 18 },
      { suffix: 'gate', radius: 1640, side: 0, ships: branch.owner ? 16 : 24 },
      { suffix: branch.owner ? 'capital' : 'vault', radius: 2200, side: 0, ships: branch.owner ? 220 : 32 },
      { suffix: 'left-front', radius: 1640, side: -520, ships: branch.owner ? 18 : 22 },
      { suffix: 'right-front', radius: 1640, side: 520, ships: branch.owner ? 18 : 22 },
      { suffix: 'left-rear', radius: 2200, side: -520, ships: branch.owner ? 12 : 28 },
      { suffix: 'right-rear', radius: 2200, side: 520, ships: branch.owner ? 12 : 28 },
    ];
    for (const site of sites) {
      const capital = site.suffix === 'capital';
      planets.push({
        id: `pincer-${branch.name}-${site.suffix}`, ...position(site.radius, site.side),
        owner: capital ? branch.owner! : NEUTRAL, ships: site.ships,
        ...(capital ? { capital: true } : {}),
        ...(branch.weapon ? { superweaponUnlocks: [branch.weapon] } : {}),
      });
    }
  }
  return {
    // Preserve campaign saves and the existing Level 4 test option.
    id: 'helios-the-pincer', title: 'The Pincer', galaxyTheme: 'pincer',
    briefing: 'Red, green, and yellow expand toward your central capital from three directions. Capture nearby Repulse Shield worlds to hold the hub. Push through enemy gates or secure the three rich weapon branches; every route passes through the center.',
    width: 5200, height: 5200, attackRange: 600, mobileFocus: 'capital', overviewScale: 0.68,
    objective: { type: 'eliminate-capitals', description: 'Capture all three enemy capitals. Hold the Repulse hub and protect the blue capital.' },
    planets,
  };
}

export const THE_PINCER = buildPincer();

// Five authored systems share Level 3's eight outer and four inner worlds.
// Fixed lanes sit outside every swept orbit, so rotation never closes the map.
function buildHeliosFinale(): MapDefinition {
  const planets: PlanetDefinition[] = [];
  const orbits: OrbitDefinition[] = [];
  const weapons: SuperweaponId[] = ['omni', 'overdrive', 'repulse'];
  const systems: { name: string; x: number; y: number; owner: PlanetDefinition['owner']; capitalIndex: number }[] = [
    { name: 'blue', x: 1200, y: 4400, owner: PLAYER, capitalIndex: 7 },
    { name: 'red', x: 1200, y: 1200, owner: FACTIONS[1], capitalIndex: 1 },
    { name: 'green', x: 4400, y: 1200, owner: FACTIONS[2], capitalIndex: 3 },
    { name: 'yellow', x: 4400, y: 4400, owner: FACTIONS[3], capitalIndex: 5 },
    { name: 'core', x: 2800, y: 2800, owner: NEUTRAL, capitalIndex: -1 },
  ];
  for (const system of systems) {
    const planetIds: string[] = [];
    for (let index = 0; index < 12; index++) {
      const outer = index < 8;
      const angle = (outer ? index / 8 : (index - 8) / 4) * Math.PI * 2;
      const radius = outer ? 620 : 300;
      const capital = index === system.capitalIndex;
      const id = capital ? `helios-${system.name}-capital` : `helios-${system.name}-${index}`;
      const besideCapital = outer && ((index + 1) % 8 === system.capitalIndex || (index + 7) % 8 === system.capitalIndex);
      const core = system.name === 'core';
      const weapon = core ? weapons[index % 3]
        : besideCapital ? ((index + 1) % 8 === system.capitalIndex ? 'omni' : 'repulse')
          : index === 8 || index === 10 ? 'overdrive' : undefined;
      planets.push({
        id, x: system.x + Math.cos(angle) * radius, y: system.y + Math.sin(angle) * radius,
        owner: capital ? system.owner : NEUTRAL,
        ships: capital ? (system.owner === PLAYER ? 300 : 240) : core ? (outer ? 32 : 44) : besideCapital ? 12 : outer ? 18 : 16,
        ...(capital ? { capital: true } : {}),
        ...(weapon ? { superweaponUnlocks: [weapon] } : {}),
      });
      planetIds.push(id);
    }
    orbits.push({ x: system.x, y: system.y, periodSeconds: system.name === 'core' ? 180 : 240, planetIds });
  }
  const addLink = (id: string, x: number, y: number, ships = 22, weapon?: SuperweaponId) => {
    planets.push({ id: `helios-${id}`, x, y, owner: NEUTRAL, ships,
      ...(weapon ? { superweaponUnlocks: [weapon] } : {}) });
  };
  // An unbroken fixed necklace feeds the central rings from every direction.
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    addLink(`core-link-${index}`, 2800 + Math.cos(angle) * 950, 2800 + Math.sin(angle) * 950,
      index % 2 === 0 ? 28 : 22, index % 2 === 0 ? weapons[(index / 2) % 3] : undefined);
  }
  // Four perimeter lanes bypass the core and join neighboring factions.
  for (let index = 0; index < 4; index++) {
    const position = [2100, 2570, 3030, 3500][index];
    addLink(`north-${index}`, position, 1200);
    addLink(`south-${index}`, position, 4400);
    addLink(`west-${index}`, 1200, position);
    addLink(`east-${index}`, 4400, position);
  }
  for (const [name, x, y] of [
    ['north-crossing', 2800, 1450], ['south-crossing', 2800, 4150],
    ['west-crossing', 1450, 2800], ['east-crossing', 4150, 2800],
  ] as const) addLink(name, x, y, 24);
  // Diagonal approaches and their two branches join the perimeter to the core.
  for (const system of systems.slice(0, 4)) {
    const dx = Math.sign(2800 - system.x), dy = Math.sign(2800 - system.y);
    addLink(`${system.name}-approach`, system.x + dx * 920 / Math.sqrt(2), system.y + dy * 920 / Math.sqrt(2), 16);
    addLink(`${system.name}-horizontal-branch`, system.x + dx * 880, system.y + dy * 430, 18);
    addLink(`${system.name}-vertical-branch`, system.x + dx * 430, system.y + dy * 880, 18);
  }
  return {
    // Preserve the released ID for saves, campaign progression, and test modes.
    id: 'helios-siege-of-helios', title: 'The Battle for Helios', galaxyTheme: 'siege',
    briefing: 'Four factions rise from orbiting capitals across five stars. Expand through your home ring, choose the outer lanes or race for the weapon-rich Helios core. Capture all three rival capitals while protecting your own.',
    width: 5600, height: 5600, attackRange: 600, mobileFocus: 'capital',
    objective: { type: 'eliminate-capitals', description: 'Capture the red, green, and yellow capitals. Keep the blue capital alive.' },
    planets, orbits,
  };
}

export const SIEGE_OF_HELIOS = buildHeliosFinale();

const CHAPTER_ONE_MAPS = [FIRST_STRIKE, BREACH_LINE, TURNING_TIDE, THE_PINCER, SIEGE_OF_HELIOS];

export const CHAPTERS: Record<ChapterId, Chapter> = {
  'chapter-1': { id: 'chapter-1', plannedLevels: 5, maps: CHAPTER_ONE_MAPS },
  'chapter-1-test-1': { id: 'chapter-1-test-1', plannedLevels: 5, maps: CHAPTER_ONE_MAPS.slice(0) },
  'chapter-1-test-2': { id: 'chapter-1-test-2', plannedLevels: 4, maps: CHAPTER_ONE_MAPS.slice(1) },
  'chapter-1-test-3': { id: 'chapter-1-test-3', plannedLevels: 3, maps: CHAPTER_ONE_MAPS.slice(2) },
  'chapter-1-test-4': { id: 'chapter-1-test-4', plannedLevels: 2, maps: CHAPTER_ONE_MAPS.slice(3) },
  'chapter-1-test-5': { id: 'chapter-1-test-5', plannedLevels: 1, maps: CHAPTER_ONE_MAPS.slice(4) },
  'chapter-2': { id: 'chapter-2', plannedLevels: 5, maps: [] },
};

export type Progress = { version: 1; selectedMode: ModeId; completed: string[] };
export const SAVE_KEY = 'war-of-planets.campaign.v1';
export const emptyProgress = (): Progress => ({ version: 1, selectedMode: 'chapter-1', completed: [] });
export function parseProgress(raw: string | null): Progress {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1) return emptyProgress();
    const completed = Array.isArray(value.completed) ? [...new Set<string>(value.completed.filter((id: unknown) => typeof id === 'string'))] : [];
    // Always open on Chapter 1, even if an older save selected another mode.
    return { version: 1, selectedMode: 'chapter-1', completed };
  } catch { return emptyProgress(); }
}
export function loadProgress(): Progress {
  try { return parseProgress(localStorage.getItem(SAVE_KEY)); } catch { return emptyProgress(); }
}
export function saveProgress(progress: Progress): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
export function completeMission(progress: Progress, id: string): Progress {
  return { ...progress, completed: [...new Set([...progress.completed, id])] };
}
export function nextMission(chapter: Chapter, completed: readonly string[]): MapDefinition | undefined {
  return chapter.maps.find(map => !completed.includes(map.id));
}
export function launchMission(chapter: Chapter, completed: readonly string[]): MapDefinition | undefined {
  // A new Chapter 1 run always teaches the basics before the larger map.
  // In-run advancement still uses followingMission, not saved completion IDs.
  if (chapter.id === 'chapter-1' || isChapterOneTestMode(chapter.id)) return chapter.maps[0];
  return nextMission(chapter, completed) ?? chapter.maps[0];
}
export function followingMission(chapter: Chapter, currentId: string): MapDefinition | undefined {
  const index = chapter.maps.findIndex(map => map.id === currentId);
  return index < 0 ? undefined : chapter.maps[index + 1];
}
export function progressLabel(mode: ModeId, progress: Progress): string {
  if (mode === 'quick-match') return 'Instant action';
  if (mode === 'hard-mode') return 'Hard AI · Instant action';
  if (isChapterOneTestMode(mode)) return `Testing · starts at Level ${testLevelForMode(mode)}`;
  const chapter = CHAPTERS[mode];
  if (!chapter.maps.length) return 'Coming soon';
  if (mode === 'chapter-1') return 'Tutorial first · Breach Line next';
  const next = nextMission(chapter, progress.completed);
  return next ? `Mission ${chapter.maps.indexOf(next) + 1} · ${chapter.plannedLevels} planned` : `${chapter.maps.length}/${chapter.plannedLevels} complete · More coming soon`;
}

export function validateMap(map: MapDefinition): void {
  if (!Number.isFinite(map.width) || !Number.isFinite(map.height) || map.width <= 0 || map.height <= 0 || !Number.isFinite(map.attackRange) || map.attackRange <= 0) throw new Error('Invalid map dimensions or attack range');
  if (map.overviewScale !== undefined && (!Number.isFinite(map.overviewScale) || map.overviewScale <= 0 || map.overviewScale > 1)) throw new Error('Invalid overview scale');
  if (map.objective.type !== 'eliminate-capitals') throw new Error('Unsupported map objective');
  const ids = new Set<string>();
  for (const p of map.planets) {
    if (!p.id || ids.has(p.id)) throw new Error('Planet IDs must be unique');
    ids.add(p.id);
    if (![...FACTIONS, NEUTRAL].includes(p.owner) || !Number.isInteger(p.ships) || p.ships < 0) throw new Error('Invalid planet owner or ships');
    if (p.superweaponUnlocks && (new Set(p.superweaponUnlocks).size !== p.superweaponUnlocks.length || p.superweaponUnlocks.some(weapon => !SUPERWEAPON_IDS.includes(weapon)))) throw new Error('Invalid planet superweapons');
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > map.width || p.y < 0 || p.y > map.height) throw new Error('Planet outside map');
    if (p.capital && p.owner === NEUTRAL) throw new Error('Neutral capital is not supported');
  }
  if (map.planets.filter(p => p.capital && p.owner === PLAYER).length !== 1 || !map.planets.some(p => p.capital && p.owner !== PLAYER)) throw new Error('Map requires one player capital and an enemy capital');
  if (map.orbit && map.orbits) throw new Error('Use orbit or orbits, not both');
  if (map.orbits && !map.orbits.length) throw new Error('Orbit systems must not be empty');
  const orbitMembers = new Set<string>();
  const orbits = mapOrbits(map);
  if (orbits.filter(orbit => orbit.dysonSphere).length > 1) throw new Error('Only one Dyson sphere is supported');
  for (const orbit of orbits) {
    if (![orbit.x, orbit.y, orbit.periodSeconds].every(Number.isFinite) || orbit.periodSeconds <= 0 || orbit.x < 0 || orbit.x > map.width || orbit.y < 0 || orbit.y > map.height) throw new Error('Invalid orbit centre or period');
    if (!orbit.planetIds.length || new Set(orbit.planetIds).size !== orbit.planetIds.length || orbit.planetIds.some(id => !ids.has(id))) throw new Error('Invalid orbit planet IDs');
    for (const id of orbit.planetIds) {
      if (orbitMembers.has(id)) throw new Error('A planet cannot belong to multiple orbit systems');
      orbitMembers.add(id);
    }
    if (orbit.dysonSphere) {
      if (ids.has(DYSON_SPHERE_ID)) throw new Error('Dyson sphere ID is reserved');
      if (!Number.isFinite(orbit.dysonSphere.chargeIntervalSeconds) || orbit.dysonSphere.chargeIntervalSeconds <= 0) throw new Error('Invalid Dyson sphere settings');
      if (!map.planets.some(planet => Math.hypot(planet.x - orbit.x, planet.y - orbit.y) <= map.attackRange)) throw new Error('Dyson sphere is unreachable');
    }
    for (const planet of map.planets.filter(p => orbit.planetIds.includes(p.id))) {
      const radius = Math.hypot(planet.x - orbit.x, planet.y - orbit.y);
      const margin = planet.capital ? 80 : 50;
      if (radius < 110 || radius + margin > Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y)) throw new Error('Orbit intersects star or map edge');
    }
  }
  const reached = new Set([map.planets.find(p => p.capital && p.owner === PLAYER)!.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of map.planets) if (!reached.has(p.id) && map.planets.some(q => reached.has(q.id) && Math.hypot(q.x - p.x, q.y - p.y) <= map.attackRange)) { reached.add(p.id); changed = true; }
  }
  if (reached.size !== map.planets.length) throw new Error('Map has unreachable planets');
}

export function getOutcome(bases: Iterable<{ color: string; isCapital?: boolean }>): 'victory' | 'defeat' | null {
  const capitals = [...bases].filter(b => b.isCapital);
  if (!capitals.some(b => b.color === PLAYER)) return 'defeat';
  return capitals.some(b => b.color !== PLAYER && b.color !== NEUTRAL) ? null : 'victory';
}
