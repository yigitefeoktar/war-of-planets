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
  objective: { type: 'eliminate-capitals'; description: string };
  planets: PlanetDefinition[];
  orbit?: OrbitDefinition;
  mobileFocus?: 'capital';
  tutorial?: { attackTargetId: string };
};
export type Chapter = { id: ChapterId; plannedLevels: number; maps: MapDefinition[] };

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

export const THE_PINCER: MapDefinition = {
  id: 'helios-the-pincer', title: 'The Pincer',
  galaxyTheme: 'pincer',
  briefing: 'Your five blue worlds all generate Repulse Shields. Red and yellow press from opposite sides. Shield threatened worlds, capture the lightly defended Repulse sites to recharge faster, then take both enemy capitals.',
  width: 2800, height: 2600, attackRange: 600, mobileFocus: 'capital',
  objective: { type: 'eliminate-capitals', description: 'Capture both enemy capitals. Use Repulse Shields to hold the center while you advance.' },
  planets: [
    // Every world in the compact blue core generates Repulse charges and can reinforce either threatened relay.
    { id: 'pincer-home', x: 1400, y: 1300, owner: PLAYER, ships: 300, capital: true, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-north-reserve', x: 1400, y: 950, owner: PLAYER, ships: 35, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-south-reserve', x: 1400, y: 1650, owner: PLAYER, ships: 35, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-west-relay', x: 1050, y: 1300, owner: PLAYER, ships: 35, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-east-relay', x: 1750, y: 1300, owner: PLAYER, ships: 35, superweaponUnlocks: ['repulse'] },
    // Both side approaches contest a neutral shield before reaching the capital.
    { id: 'pincer-west-shield', x: 790, y: 1300, owner: NEUTRAL, ships: 12, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-east-shield', x: 2010, y: 1300, owner: NEUTRAL, ships: 12, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-red-front', x: 450, y: 1300, owner: '#ef4444', ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-red-capital', x: 150, y: 1300, owner: '#ef4444', ships: 150, capital: true },
    { id: 'pincer-yellow-front', x: 2350, y: 1300, owner: '#eab308', ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'pincer-yellow-capital', x: 2650, y: 1300, owner: '#eab308', ships: 150, capital: true },
    // Upper and lower wings can bypass a fortified center.
    { id: 'pincer-red-north-wing', x: 450, y: 760, owner: '#ef4444', ships: 40 },
    { id: 'pincer-red-south-wing', x: 450, y: 1840, owner: '#ef4444', ships: 40 },
    { id: 'pincer-yellow-north-wing', x: 2350, y: 760, owner: '#eab308', ships: 40 },
    { id: 'pincer-yellow-south-wing', x: 2350, y: 1840, owner: '#eab308', ships: 40 },
    { id: 'pincer-northwest-gate', x: 850, y: 930, owner: NEUTRAL, ships: 22 },
    { id: 'pincer-southwest-gate', x: 850, y: 1670, owner: NEUTRAL, ships: 22 },
    { id: 'pincer-northeast-gate', x: 1950, y: 930, owner: NEUTRAL, ships: 22 },
    { id: 'pincer-southeast-gate', x: 1950, y: 1670, owner: NEUTRAL, ships: 22 },
    // Optional outer routes reward the weapons learned in Missions 2 and 3.
    { id: 'pincer-northwest-overdrive', x: 950, y: 560, owner: NEUTRAL, ships: 28, superweaponUnlocks: ['overdrive'] },
    { id: 'pincer-northeast-overdrive', x: 1850, y: 560, owner: NEUTRAL, ships: 28, superweaponUnlocks: ['overdrive'] },
    { id: 'pincer-southwest-omni', x: 950, y: 2040, owner: NEUTRAL, ships: 28, superweaponUnlocks: ['omni'] },
    { id: 'pincer-southeast-omni', x: 1850, y: 2040, owner: NEUTRAL, ships: 28, superweaponUnlocks: ['omni'] },
    { id: 'pincer-north-crossing', x: 1400, y: 450, owner: NEUTRAL, ships: 36 },
    { id: 'pincer-south-crossing', x: 1400, y: 2150, owner: NEUTRAL, ships: 36 },
    { id: 'pincer-northwest-outpost', x: 250, y: 320, owner: NEUTRAL, ships: 24 },
    { id: 'pincer-southeast-outpost', x: 2550, y: 2280, owner: NEUTRAL, ships: 24 },
  ],
};

export const SIEGE_OF_HELIOS: MapDefinition = {
  // Keep the released ID so existing completion records still recognize Level 5.
  id: 'helios-siege-of-helios', title: 'Helios Counteroffensive',
  galaxyTheme: 'siege',
  briefing: 'Hold your southern foothold against the red spearheads, then counterattack through the western flank, the eastern flank, or the Helios core. Capture both red capitals to secure the system.',
  width: 3800, height: 3400, attackRange: 600, mobileFocus: 'capital',
  objective: { type: 'eliminate-capitals', description: 'Defend the blue capital, break the red line, and capture both red capitals.' },
  planets: [
    // Blue holds enough territory to choose a route; only the outer harbors face an opening attack.
    { id: 'siege-home', x: 1900, y: 3100, owner: PLAYER, ships: 320, capital: true, superweaponUnlocks: ['repulse'] },
    { id: 'siege-west-relay', x: 1550, y: 2800, owner: PLAYER, ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'siege-east-relay', x: 2250, y: 2800, owner: PLAYER, ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'siege-west-harbor', x: 1050, y: 3000, owner: PLAYER, ships: 60, superweaponUnlocks: ['overdrive'] },
    { id: 'siege-east-harbor', x: 2750, y: 3000, owner: PLAYER, ships: 60, superweaponUnlocks: ['overdrive'] },
    // Red pressure begins at the edges, away from the blue capital.
    { id: 'siege-west-spear', x: 900, y: 2500, owner: '#ef4444', ships: 40 },
    { id: 'siege-east-spear', x: 2900, y: 2500, owner: '#ef4444', ships: 40 },
    { id: 'siege-west-guard', x: 1050, y: 780, owner: '#ef4444', ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'siege-east-guard', x: 2750, y: 780, owner: '#ef4444', ships: 70, superweaponUnlocks: ['repulse'] },
    { id: 'siege-command', x: 1900, y: 700, owner: '#ef4444', ships: 90, superweaponUnlocks: ['overdrive'] },
    { id: 'siege-west-capital', x: 650, y: 350, owner: '#ef4444', ships: 160, capital: true },
    { id: 'siege-east-capital', x: 3150, y: 350, owner: '#ef4444', ships: 160, capital: true },
    // Cheap southern choices let blue expand before committing to a breakthrough.
    { id: 'siege-center-entry', x: 1900, y: 2450, owner: NEUTRAL, ships: 16, superweaponUnlocks: ['omni'] },
    { id: 'siege-west-landing', x: 1350, y: 2480, owner: NEUTRAL, ships: 12 },
    { id: 'siege-east-landing', x: 2450, y: 2480, owner: NEUTRAL, ships: 12 },
    { id: 'siege-southwest-mines', x: 700, y: 2880, owner: NEUTRAL, ships: 12, superweaponUnlocks: ['overdrive'] },
    { id: 'siege-southeast-mines', x: 3100, y: 2880, owner: NEUTRAL, ships: 12, superweaponUnlocks: ['overdrive'] },
    // Western route offers an early shield, then an Omni shortcut around the guard.
    { id: 'siege-west-crosslink', x: 1200, y: 2100, owner: NEUTRAL, ships: 22 },
    { id: 'siege-west-shield', x: 650, y: 2150, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['repulse'] },
    { id: 'siege-west-junction', x: 1200, y: 1600, owner: NEUTRAL, ships: 26 },
    { id: 'siege-west-outpost', x: 500, y: 1700, owner: NEUTRAL, ships: 28 },
    { id: 'siege-west-omni', x: 530, y: 1230, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['omni'] },
    { id: 'siege-northwest-pass', x: 420, y: 800, owner: NEUTRAL, ships: 28 },
    // Eastern route offers production sites and a link back toward the core.
    { id: 'siege-east-crosslink', x: 2600, y: 2100, owner: NEUTRAL, ships: 22 },
    { id: 'siege-east-forge', x: 3150, y: 2170, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['overdrive'] },
    { id: 'siege-east-junction', x: 2600, y: 1580, owner: NEUTRAL, ships: 26 },
    { id: 'siege-east-outpost', x: 3320, y: 1740, owner: NEUTRAL, ships: 28 },
    { id: 'siege-east-shield', x: 3100, y: 1260, owner: NEUTRAL, ships: 24, superweaponUnlocks: ['repulse'] },
    { id: 'siege-northeast-pass', x: 3400, y: 820, owner: NEUTRAL, ships: 28 },
    // Northern cross-links permit a pivot after taking either flank or the sphere.
    { id: 'siege-west-gate', x: 850, y: 1050, owner: NEUTRAL, ships: 28 },
    { id: 'siege-east-gate', x: 2950, y: 1050, owner: NEUTRAL, ships: 28 },
    { id: 'siege-west-north-bridge', x: 1400, y: 1000, owner: NEUTRAL, ships: 30 },
    { id: 'siege-east-north-bridge', x: 2400, y: 1000, owner: NEUTRAL, ships: 30 },
    { id: 'siege-north-bridge', x: 1900, y: 1050, owner: NEUTRAL, ships: 32 },
    // Four satellites keep the Dyson contest readable and leave the fixed lanes unobstructed.
    { id: 'siege-orbit-south', x: 1900, y: 2030, owner: NEUTRAL, ships: 18, superweaponUnlocks: ['omni'] },
    { id: 'siege-orbit-west', x: 1570, y: 1700, owner: NEUTRAL, ships: 22, superweaponUnlocks: ['overdrive'] },
    { id: 'siege-orbit-north', x: 1900, y: 1370, owner: NEUTRAL, ships: 26, superweaponUnlocks: ['repulse'] },
    { id: 'siege-orbit-east', x: 2230, y: 1700, owner: NEUTRAL, ships: 22, superweaponUnlocks: ['overdrive'] },
  ],
  orbit: {
    x: 1900, y: 1700, periodSeconds: 300,
    planetIds: ['siege-orbit-south', 'siege-orbit-west', 'siege-orbit-north', 'siege-orbit-east'],
    dysonSphere: { chargeIntervalSeconds: 30 },
  },
};

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
  if (map.orbit) {
    const orbit = map.orbit;
    if (![orbit.x, orbit.y, orbit.periodSeconds].every(Number.isFinite) || orbit.periodSeconds <= 0 || orbit.x < 0 || orbit.x > map.width || orbit.y < 0 || orbit.y > map.height) throw new Error('Invalid orbit centre or period');
    if (!orbit.planetIds.length || new Set(orbit.planetIds).size !== orbit.planetIds.length || orbit.planetIds.some(id => !ids.has(id))) throw new Error('Invalid orbit planet IDs');
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
