import { validateMap, type GeneratedMode, type MapDefinition } from './campaign';
import { seededRandom, shuffle } from './mapGenerationUtils';
import { buildQuickMap, QUICK_LAYOUTS, validateQuickGeometry } from './quickMapGenerator';
import { buildChaosMap, CHAOS_LAYOUTS, validateChaosGeometry } from './chaosMapGenerator';
export { mapConnected, seededRandom } from './mapGenerationUtils';
export { QUICK_LAYOUTS, validateQuickGeometry } from './quickMapGenerator';
export { buildChaosMap, CHAOS_LAYOUTS, validateChaosGeometry } from './chaosMapGenerator';
const HISTORY_KEY = 'war-of-planets.generated-maps.v3';

export function generateMap(mode: GeneratedMode, seed: number, layoutIndex = (seed >>> 0) % (mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length)): MapDefinition {
  const normalized = seed >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  if (!Number.isInteger(layoutIndex) || layoutIndex < 0 || layoutIndex >= count) throw new Error('Invalid generated layout');
  if (mode === 'chaos-mode') {
    const map = buildChaosMap(normalized, layoutIndex);
    validateMap(map);
    validateChaosGeometry(map);
    return map;
  }
  const map = buildQuickMap(normalized, layoutIndex);
  validateMap(map);
  validateQuickGeometry(map);
  return map;
}

type History = Partial<Record<GeneratedMode, { seed: number; layout: number; remaining?: number[] }>>;
let history: History = {};
let sequence = 0;

export function createGeneratedMap(mode: GeneratedMode): MapDefinition {
  // Optional storage only remembers the previous family/seed, never campaign state.
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null');
    if (saved && typeof saved === 'object') for (const key of ['quick-match', 'chaos-mode'] as const) {
      const item = (saved as History)[key];
      const count = key === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
      if (item && Number.isInteger(item.seed) && item.seed >= 0 && item.seed <= 0xFFFFFFFF
        && Number.isInteger(item.layout) && item.layout >= 0 && item.layout < count) {
        const remaining = Array.isArray(item.remaining) && new Set(item.remaining).size === item.remaining.length
          && item.remaining.every(layout => Number.isInteger(layout) && layout >= 0 && layout < count && layout !== item.layout) ? item.remaining : undefined;
        history[key] = { seed: item.seed, layout: item.layout, remaining };
      }
    }
  } catch { /* New maps work when storage is corrupt, blocked or unavailable. */ }
  const previous = history[mode];
  const entropy = new Uint32Array(1);
  try { crypto.getRandomValues(entropy); } catch { entropy[0] = Math.floor(Math.random() * 4294967296); }
  let seed = (entropy[0] ^ Math.imul(++sequence, 0x9E3779B1) ^ Date.now()) >>> 0;
  if (seed === previous?.seed) seed = (seed + 1) >>> 0;
  const count = mode === 'quick-match' ? QUICK_LAYOUTS.length : CHAOS_LAYOUTS.length;
  // A shuffled bag visits every strategic family before starting another round.
  // Across bag boundaries, also prevent the last family repeating immediately.
  let remaining = previous?.remaining;
  if (!remaining?.length) {
    remaining = shuffle(Array.from({ length: count }, (_, index) => index), seededRandom(seed));
    if (remaining[0] === previous?.layout) [remaining[0], remaining[count - 1]] = [remaining[count - 1], remaining[0]];
  }
  const layout = remaining[0];
  const map = generateMap(mode, seed, layout);
  history = { ...history, [mode]: { seed, layout, remaining: remaining.slice(1) } };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* Storage is optional. */ }
  return map;
}
