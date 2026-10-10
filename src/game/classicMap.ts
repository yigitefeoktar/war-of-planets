import { NEUTRAL, PLAYER, type MapDefinition } from './campaign';

// Restore the classic geography and starting fleets from commit 770c716,
// excluding the tutorial's weak red outpost.
// This standalone battlefield does not opt into the campaign tutorial.
export const CLASSIC_BATTLEFIELD: MapDefinition = {
  id: 'classic-battlefield', title: 'Classic Battlefield',
  briefing: 'Expand across the neutral worlds from your assigned capital. Capture all three enemy capitals while protecting your own.',
  width: 3000, height: 3000, attackRange: 600,
  objective: { type: 'eliminate-capitals', description: 'Capture all enemy capitals. Keep your blue capital alive.' },
  planets: [
    { id: 'player_1', x: 1500, y: 2400, owner: PLAYER, ships: 200, capital: true },
    { id: 'ai_1', x: 600, y: 600, owner: '#ef4444', ships: 90, capital: true },
    { id: 'ai_2', x: 2400, y: 600, owner: '#22c55e', ships: 90, capital: true },
    { id: 'ai_3', x: 1500, y: 600, owner: '#eab308', ships: 90, capital: true },
    { id: 'southwest-edge', x: 350, y: 2600, owner: NEUTRAL, ships: 20 },
    { id: 'southwest-reserve', x: 900, y: 2600, owner: NEUTRAL, ships: 12 },
    { id: 'home-reserve', x: 1500, y: 2800, owner: NEUTRAL, ships: 10 },
    { id: 'southeast-reserve', x: 2100, y: 2600, owner: NEUTRAL, ships: 12 },
    { id: 'southeast-edge', x: 2650, y: 2600, owner: NEUTRAL, ships: 20 },
    { id: 'west-landing-route', x: 550, y: 2200, owner: NEUTRAL, ships: 18 },
    { id: 'west-expansion', x: 1000, y: 2250, owner: NEUTRAL, ships: 10 },
    { id: 'east-expansion', x: 2000, y: 2250, owner: NEUTRAL, ships: 10 },
    { id: 'east-landing-route', x: 2450, y: 2200, owner: NEUTRAL, ships: 18 },
    { id: 'west-rim', x: 350, y: 1800, owner: NEUTRAL, ships: 24 },
    { id: 'west-route', x: 800, y: 1800, owner: NEUTRAL, ships: 18 },
    { id: 'midway-west', x: 1250, y: 1600, owner: NEUTRAL, ships: 20 },
    { id: 'midway-east', x: 1750, y: 1700, owner: NEUTRAL, ships: 20 },
    { id: 'east-route', x: 2200, y: 1800, owner: NEUTRAL, ships: 18 },
    { id: 'east-rim', x: 2650, y: 1800, owner: NEUTRAL, ships: 24 },
    { id: 'west-crossing', x: 350, y: 1300, owner: NEUTRAL, ships: 28 },
    { id: 'west-bridge', x: 800, y: 1350, owner: NEUTRAL, ships: 24 },
    { id: 'central-west', x: 1300, y: 1200, owner: NEUTRAL, ships: 28 },
    { id: 'central-east', x: 1800, y: 1250, owner: NEUTRAL, ships: 28 },
    { id: 'east-bridge', x: 2250, y: 1300, owner: NEUTRAL, ships: 24 },
    { id: 'east-crossing', x: 2650, y: 1300, owner: NEUTRAL, ships: 28 },
    { id: 'northwest-flank', x: 400, y: 900, owner: NEUTRAL, ships: 30 },
    { id: 'red-front', x: 900, y: 900, owner: NEUTRAL, ships: 28 },
    { id: 'north-centre-west', x: 1300, y: 850, owner: NEUTRAL, ships: 30 },
    { id: 'north-centre-east', x: 1750, y: 850, owner: NEUTRAL, ships: 30 },
    { id: 'green-front', x: 2150, y: 900, owner: NEUTRAL, ships: 28 },
    { id: 'northeast-flank', x: 2600, y: 900, owner: NEUTRAL, ships: 30 },
    { id: 'northwest-backroute', x: 950, y: 350, owner: NEUTRAL, ships: 35 },
    { id: 'northeast-backroute', x: 2000, y: 350, owner: NEUTRAL, ships: 35 },
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
      if (!planet.capital) return { ...planet };
      const position = capitals[assignment[capitalIndex++]];
      return { ...planet, x: position.x, y: position.y };
    }),
  };
}
