import { NEUTRAL, PLAYER, type MapDefinition, type PlanetDefinition } from './campaign';

// Rotate one sector to keep openings, routes, and weapon access identical.
const sector: Omit<PlanetDefinition, 'owner'>[] = [
  { id: 'opening-west', x: 450, y: 850, ships: 16 },
  { id: 'opening-north', x: 850, y: 450, ships: 16 },
  { id: 'opening-inner', x: 850, y: 850, ships: 16 },
  { id: 'outer-west', x: 450, y: 1250, ships: 24 },
  { id: 'outer-north', x: 1250, y: 450, ships: 24 },
  { id: 'inner-gate', x: 1150, y: 1150, ships: 28, superweaponUnlocks: ['overdrive'] },
  { id: 'crossing', x: 1500, y: 1000, ships: 40, superweaponUnlocks: ['repulse'] },
  { id: 'centre', x: 1500, y: 1350, ships: 45, superweaponUnlocks: ['omni'] },
];

function rotate(x: number, y: number, turns: number): { x: number; y: number } {
  for (let turn = 0; turn < turns; turn++) [x, y] = [3000 - y, x];
  return { x, y };
}

// Keep the existing standalone ID and shuffle storage contract.
export const CLASSIC_BATTLEFIELD: MapDefinition = {
  id: 'classic-battlefield', title: 'Balanced Battlefield',
  briefing: 'Expand across the neutral worlds from your assigned capital. Capture all three enemy capitals while protecting your own.',
  width: 3000, height: 3000, attackRange: 600,
  objective: { type: 'eliminate-capitals', description: 'Capture all enemy capitals. Keep your blue capital alive.' },
  planets: [
    { id: 'player_1', x: 450, y: 450, owner: PLAYER, ships: 200, capital: true },
    { id: 'ai_1', x: 2550, y: 450, owner: '#ef4444', ships: 90, capital: true },
    { id: 'ai_2', x: 2550, y: 2550, owner: '#22c55e', ships: 90, capital: true },
    { id: 'ai_3', x: 450, y: 2550, owner: '#eab308', ships: 90, capital: true },
    ...['northwest', 'northeast', 'southeast', 'southwest'].flatMap((name, turns) =>
      sector.map((planet): PlanetDefinition => ({
        ...planet,
        id: `${name}-${planet.id}`,
        ...rotate(planet.x, planet.y, turns),
        owner: NEUTRAL,
      }))),
  ],
};

const CAPITAL_POSITION_KEY = 'war-of-planets.classic-capital-positions.v1';
const capitals = CLASSIC_BATTLEFIELD.planets.filter(planet => planet.capital);
let previousPositions: number[] | undefined;

function permutations(positions: number[]): number[][] {
  if (positions.length === 0) return [[]];
  return positions.flatMap(position => permutations(positions.filter(other => other !== position))
    .map(rest => [position, ...rest]));
}

const capitalAssignments = permutations(capitals.map((_, index) => index));

function validPositions(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === capitals.length
    && new Set(value).size === capitals.length
    && value.every(position => Number.isInteger(position) && position >= 0 && position < capitals.length);
}

/** Shuffle capitals, preserving each faction's ID and fleet and all neutral worlds. */
export function createClassicBattlefield(random: () => number = Math.random): MapDefinition {
  // Remember the previous match across mode changes and page reloads. Browsers
  // that block storage still avoid repeats during the current page session.
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CAPITAL_POSITION_KEY) ?? 'null');
    if (validPositions(saved)) previousPositions = saved;
  } catch { /* Use the last in-memory assignment when storage is unavailable. */ }

  const previous = previousPositions;
  const available = capitalAssignments.filter(assignment => !previous
    || assignment.every((position, index) => position !== previous[index]));
  const assignment = available[Math.floor(random() * available.length)];
  previousPositions = [...assignment];
  try { localStorage.setItem(CAPITAL_POSITION_KEY, JSON.stringify(assignment)); } catch { /* Storage is optional. */ }

  let capitalIndex = 0;
  return {
    ...CLASSIC_BATTLEFIELD,
    planets: CLASSIC_BATTLEFIELD.planets.map(planet => {
      if (!planet.capital) return {
        ...planet,
        ...(planet.superweaponUnlocks ? { superweaponUnlocks: [...planet.superweaponUnlocks] } : {}),
      };
      const position = capitals[assignment[capitalIndex++]];
      return { ...planet, x: position.x, y: position.y };
    }),
  };
}
