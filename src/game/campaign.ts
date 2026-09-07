export const PLAYER = '#3b82f6';
export const NEUTRAL = '#6b7280';
export const FACTIONS = [PLAYER, '#ef4444', '#22c55e', '#eab308'] as const;
export type ModeId = 'chapter-1' | 'chapter-2' | 'quick-match';
export type ChapterId = Exclude<ModeId, 'quick-match'>;
export type PlanetDefinition = { id: string; x: number; y: number; owner: typeof FACTIONS[number] | typeof NEUTRAL; ships: number; capital?: boolean };
export type OrbitDefinition = { x: number; y: number; periodSeconds: number; planetIds: string[] };
export type MapDefinition = {
  id: string;
  title: string;
  briefing: string;
  width: number;
  height: number;
  attackRange: number;
  objective: { type: 'eliminate-capitals'; description: string };
  planets: PlanetDefinition[];
  orbit?: OrbitDefinition;
  mobileFocus?: 'capital';
};
export type Chapter = { id: ChapterId; plannedLevels: number; maps: MapDefinition[] };

export const FIRST_STRIKE: MapDefinition = {
  id: 'helios-first-strike', title: 'First Strike',
  briefing: 'This system rotates around its white star. Capture nearby worlds, build your fleet, and destroy the red capital. The star cannot be captured.',
  width: 1600, height: 1400, attackRange: 600,
  objective: { type: 'eliminate-capitals', description: 'Destroy the red capital. Keep your blue capital alive.' },
  planets: [
    { id: 'player_1', x: 800, y: 1130, owner: PLAYER, ships: 180, capital: true },
    { id: 'ai_1', x: 800, y: 220, owner: '#ef4444', ships: 90, capital: true },
    { id: 'west-landing', x: 470, y: 970, owner: NEUTRAL, ships: 10 },
    { id: 'east-landing', x: 1130, y: 970, owner: NEUTRAL, ships: 10 },
    { id: 'midway', x: 800, y: 860, owner: NEUTRAL, ships: 18 },
    { id: 'west-route', x: 410, y: 610, owner: NEUTRAL, ships: 16 },
    { id: 'east-route', x: 1190, y: 610, owner: NEUTRAL, ships: 16 },
    { id: 'west-front', x: 520, y: 310, owner: NEUTRAL, ships: 24 },
    { id: 'east-front', x: 1080, y: 310, owner: NEUTRAL, ships: 24 },
  ],
  orbit: {
    x: 800, y: 700, periodSeconds: 180,
    planetIds: ['player_1', 'ai_1', 'west-landing', 'east-landing', 'midway', 'west-route', 'east-route', 'west-front', 'east-front'],
  },
};

export const TURNING_TIDE: MapDefinition = {
  id: 'helios-turning-tide', title: 'The Turning Tide',
  briefing: 'Capture the cheap worlds beside your blue capital, then board the rotating planets. Ride them into range of the red and green strongholds, or advance along the fixed outer flanks. Hold five worlds to unlock Omni-Strike. Your capital stays still: leave a defence behind.',
  width: 2600, height: 2600, attackRange: 600, mobileFocus: 'capital',
  objective: { type: 'eliminate-capitals', description: 'Destroy both enemy capitals. Use rotating worlds to open new attack routes.' },
  planets: [
    // Fixed outer ring: a safe southern opening, two flanks, and rival fortresses.
    { id: 'tide-home', x: 1300, y: 2360, owner: PLAYER, ships: 260, capital: true },
    { id: 'southwest-harbour', x: 770, y: 2218, owner: NEUTRAL, ships: 12 },
    { id: 'west-approach', x: 382, y: 1830, owner: NEUTRAL, ships: 28 },
    { id: 'west-bastion', x: 240, y: 1300, owner: NEUTRAL, ships: 40 },
    { id: 'red-outpost', x: 382, y: 770, owner: '#ef4444', ships: 50 },
    { id: 'red-command', x: 770, y: 382, owner: '#ef4444', ships: 140, capital: true },
    { id: 'northern-divide', x: 1300, y: 240, owner: NEUTRAL, ships: 55 },
    { id: 'green-command', x: 1830, y: 382, owner: '#22c55e', ships: 140, capital: true },
    { id: 'green-outpost', x: 2218, y: 770, owner: '#22c55e', ships: 50 },
    { id: 'east-bastion', x: 2360, y: 1300, owner: NEUTRAL, ships: 40 },
    { id: 'east-approach', x: 2218, y: 1830, owner: NEUTRAL, ships: 28 },
    { id: 'southeast-harbour', x: 1830, y: 2218, owner: NEUTRAL, ships: 12 },
    // Moving transport ring. Enemy footholds rotate toward the player's flank.
    { id: 'tide-boarding', x: 1300, y: 1920, owner: NEUTRAL, ships: 12 },
    { id: 'tide-southwest', x: 862, y: 1738, owner: NEUTRAL, ships: 20 },
    { id: 'tide-west', x: 680, y: 1300, owner: NEUTRAL, ships: 30 },
    { id: 'tide-red', x: 862, y: 862, owner: '#ef4444', ships: 60 },
    { id: 'tide-north', x: 1300, y: 680, owner: NEUTRAL, ships: 38 },
    { id: 'tide-green', x: 1738, y: 862, owner: '#22c55e', ships: 60 },
    { id: 'tide-east', x: 1920, y: 1300, owner: NEUTRAL, ships: 30 },
    { id: 'tide-southeast', x: 1738, y: 1738, owner: NEUTRAL, ships: 20 },
    // Inner shortcuts: the extra production is useful, but exposed on all sides.
    { id: 'inner-south', x: 1300, y: 1600, owner: NEUTRAL, ships: 18 },
    { id: 'inner-west', x: 1000, y: 1300, owner: NEUTRAL, ships: 24 },
    { id: 'inner-north', x: 1300, y: 1000, owner: NEUTRAL, ships: 35 },
    { id: 'inner-east', x: 1600, y: 1300, owner: NEUTRAL, ships: 24 },
  ],
  orbit: {
    x: 1300, y: 1300, periodSeconds: 180,
    planetIds: ['tide-boarding', 'tide-southwest', 'tide-west', 'tide-red', 'tide-north', 'tide-green', 'tide-east', 'tide-southeast', 'inner-south', 'inner-west', 'inner-north', 'inner-east'],
  },
};

export const CHAPTERS: Record<ChapterId, Chapter> = {
  'chapter-1': { id: 'chapter-1', plannedLevels: 5, maps: [FIRST_STRIKE, TURNING_TIDE] },
  'chapter-2': { id: 'chapter-2', plannedLevels: 5, maps: [] },
};

export type Progress = { version: 1; selectedMode: ModeId; completed: string[] };
export const SAVE_KEY = 'war-of-planets.campaign.v1';
export const emptyProgress = (): Progress => ({ version: 1, selectedMode: 'chapter-1', completed: [] });
export function parseProgress(raw: string | null): Progress {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1) return emptyProgress();
    const selectedMode = ['chapter-1', 'chapter-2', 'quick-match'].includes(value.selectedMode) ? value.selectedMode : 'chapter-1';
    const completed = Array.isArray(value.completed) ? [...new Set<string>(value.completed.filter((id: unknown) => typeof id === 'string'))] : [];
    return { version: 1, selectedMode, completed };
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
  return nextMission(chapter, completed) ?? chapter.maps[0];
}
export function followingMission(chapter: Chapter, currentId: string): MapDefinition | undefined {
  const index = chapter.maps.findIndex(map => map.id === currentId);
  return index < 0 ? undefined : chapter.maps[index + 1];
}
export function progressLabel(mode: ModeId, progress: Progress): string {
  if (mode === 'quick-match') return 'Instant action';
  const chapter = CHAPTERS[mode];
  if (!chapter.maps.length) return 'Coming soon';
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
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > map.width || p.y < 0 || p.y > map.height) throw new Error('Planet outside map');
    if (p.capital && p.owner === NEUTRAL) throw new Error('Neutral capital is not supported');
  }
  if (map.planets.filter(p => p.capital && p.owner === PLAYER).length !== 1 || !map.planets.some(p => p.capital && p.owner !== PLAYER)) throw new Error('Map requires one player capital and an enemy capital');
  if (map.orbit) {
    const orbit = map.orbit;
    if (![orbit.x, orbit.y, orbit.periodSeconds].every(Number.isFinite) || orbit.periodSeconds <= 0 || orbit.x < 0 || orbit.x > map.width || orbit.y < 0 || orbit.y > map.height) throw new Error('Invalid orbit centre or period');
    if (!orbit.planetIds.length || new Set(orbit.planetIds).size !== orbit.planetIds.length || orbit.planetIds.some(id => !ids.has(id))) throw new Error('Invalid orbit planet IDs');
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
