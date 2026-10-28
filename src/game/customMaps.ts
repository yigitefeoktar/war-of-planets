import { FACTIONS, NEUTRAL, validateMap, type GeneratedMode, type MapDefinition } from './campaign';
import { buildQuickMap, validateQuickGeometry } from './quickMapGenerator';
import { buildChaosMap, validateChaosGeometry } from './chaosMapGenerator';
import { distance, seededRandom } from './mapGenerationUtils';

export const CUSTOM_MAP_RANDOM_SETTINGS = ['startingCapital', 'defenders', 'orbitingPlanets', 'flankRegions', 'weaponFocus', 'composition', 'smallPlanets', 'normalPattern', 'weaponsPerWorld'] as const;
export type CustomMapRandomSetting = typeof CUSTOM_MAP_RANDOM_SETTINGS[number];

export type CustomMapSettings = {
  version: 1;
  style: GeneratedMode;
  seed: number;
  quickLayout: number;
  chaosLayout: number;
  orbitingPlanets: 5 | 6 | 7;
  flankRegions: 0 | 1 | 2;
  weaponFocus: 'balanced' | 'production' | 'defense' | 'strike';
  defenders: 'light' | 'standard' | 'fortified';
  composition: 0 | 1 | 2 | 3;
  smallPlanets: 5 | 6 | 7;
  normalPattern: 'classic' | 'scattered' | 'pentagon-web';
  weaponsPerWorld: 'mixed' | 1 | 2;
  startingCapital: 0 | 1 | 2 | 3;
  randomSettings?: CustomMapRandomSetting[];
  quickAutomaticSeed?: boolean;
};

export const CUSTOM_MAP_PRESET_KEY = 'war-of-planets.custom-map.v1';
export const CUSTOM_MAP_PRESET_STATE_KEY = 'war-of-planets.custom-map.preset.v4';
export const PREVIOUS_CUSTOM_MAP_PRESET_STATE_KEY = 'war-of-planets.custom-map.preset.v3';
export const LEGACY_CUSTOM_MAP_PRESET_STATE_KEY = 'war-of-planets.custom-map.preset.v2';
export type CustomMapPreset = { settings: CustomMapSettings; enabled: boolean; hardMode: boolean };
export const DEFAULT_CUSTOM_MAP: CustomMapSettings = {
  version: 1, style: 'quick-match', seed: 284719, quickLayout: 0, chaosLayout: 0,
  orbitingPlanets: 6, flankRegions: 1, weaponFocus: 'balanced', defenders: 'standard',
  composition: 0, smallPlanets: 6, normalPattern: 'classic', weaponsPerWorld: 'mixed', startingCapital: 0,
};
export const DEFAULT_CUSTOM_MAP_PREFERENCES: CustomMapSettings = { ...DEFAULT_CUSTOM_MAP, randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS], quickAutomaticSeed: true };

export function isCustomMapSettings(value: unknown): value is CustomMapSettings {
  if (!value || typeof value !== 'object') return false;
  const v = value as CustomMapSettings;
  return v.version === 1 && ['quick-match', 'chaos-mode'].includes(v.style)
    && Number.isInteger(v.seed) && v.seed >= 0 && v.seed <= 0xFFFFFFFF
    && [v.quickLayout, v.chaosLayout, v.composition, v.startingCapital].every(n => Number.isInteger(n) && n >= 0 && n <= 3)
    && [5, 6, 7].includes(v.orbitingPlanets) && [0, 1, 2].includes(v.flankRegions)
    && ['balanced', 'production', 'defense', 'strike'].includes(v.weaponFocus)
    && ['light', 'standard', 'fortified'].includes(v.defenders)
    && [5, 6, 7].includes(v.smallPlanets) && ['classic', 'scattered', 'pentagon-web'].includes(v.normalPattern)
    && ['mixed', 1, 2].includes(v.weaponsPerWorld)
    && (v.quickAutomaticSeed === undefined || typeof v.quickAutomaticSeed === 'boolean')
    && (v.randomSettings === undefined || (Array.isArray(v.randomSettings) && v.randomSettings.every(key => CUSTOM_MAP_RANDOM_SETTINGS.includes(key))));
}

/** Normalize dependent controls before building; no silent random fallbacks. */
export function normalizeCustomMap(settings: CustomMapSettings): CustomMapSettings {
  return {
    ...settings,
    flankRegions: settings.quickLayout === 2 ? Math.max(1, settings.flankRegions) as 1 | 2 : Math.min(1, settings.flankRegions) as 0 | 1,
    normalPattern: !settings.randomSettings?.includes('composition') && settings.composition === 1 && settings.normalPattern === 'pentagon-web' ? 'classic' : settings.normalPattern,
  };
}

export function newCustomMapRoll(): number {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch { return Math.floor(Math.random() * 4294967296); }
}

/** Resolve once per setup visit; the resulting concrete map is shared by preview and launch. */
export function resolveCustomMapSettings(settings: CustomMapSettings, roll: number): CustomMapSettings {
  const { randomSettings = [], quickAutomaticSeed = false, ...concrete } = settings;
  const resolved = { ...concrete };
  if (settings.style === 'quick-match' && quickAutomaticSeed) resolved.seed = roll >>> 0;
  // Each field has its own draw, so changing one control cannot reroll unrelated settings.
  const pick = <K extends CustomMapRandomSetting>(key: K, options: readonly CustomMapSettings[K][]): CustomMapSettings[K] => {
    if (!randomSettings.includes(key)) return settings[key];
    const random = seededRandom((roll ^ Math.imul(CUSTOM_MAP_RANDOM_SETTINGS.indexOf(key) + 1, 0x9E3779B9)) >>> 0);
    return options[Math.floor(random() * options.length)];
  };
  resolved.composition = pick('composition', [0, 1, 2, 3]);
  resolved.startingCapital = pick('startingCapital', [0, 1, 2, 3]);
  resolved.defenders = pick('defenders', ['light', 'standard', 'fortified']);
  resolved.orbitingPlanets = settings.quickLayout === 1 || settings.quickLayout === 3 ? 5 : pick('orbitingPlanets', [5, 6, 7]);
  resolved.flankRegions = pick('flankRegions', settings.quickLayout === 2 ? [1, 2] : [0, 1]);
  resolved.weaponFocus = pick('weaponFocus', ['balanced', 'production', 'defense', 'strike']);
  resolved.smallPlanets = pick('smallPlanets', [5, 6, 7]);
  resolved.normalPattern = pick('normalPattern', resolved.composition === 2 ? ['classic', 'scattered', 'pentagon-web'] : ['classic', 'scattered']);
  resolved.weaponsPerWorld = pick('weaponsPerWorld', ['mixed', 1, 2]);
  return normalizeCustomMap(resolved);
}

export function loadCustomMapPreset(): CustomMapPreset {
  const defaults: CustomMapPreset = { settings: { ...DEFAULT_CUSTOM_MAP_PREFERENCES, randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS] }, enabled: true, hardMode: false };
  try {
    const stored = localStorage.getItem(CUSTOM_MAP_PRESET_STATE_KEY) ?? localStorage.getItem(PREVIOUS_CUSTOM_MAP_PRESET_STATE_KEY) ?? localStorage.getItem(LEGACY_CUSTOM_MAP_PRESET_STATE_KEY);
    if (stored !== null) {
      const saved = JSON.parse(stored);
      if ([2, 3, 4].includes(saved?.version) && typeof saved.enabled === 'boolean' && typeof saved.hardMode === 'boolean' && isCustomMapSettings(saved.settings)) {
        // Adopt the new Random defaults once; v3 presets preserve later manual choices.
        const settings = saved.version === 4 ? saved.settings : { ...saved.settings, quickAutomaticSeed: true, ...(saved.version === 2 ? { randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS] } : {}) };
        return saved.enabled
          ? { enabled: true, settings: normalizeCustomMap(settings), hardMode: saved.hardMode }
          : { ...defaults, enabled: false };
      }
    }
    // Keep presets saved before automatic saving was introduced.
    const legacy: unknown = JSON.parse(localStorage.getItem(CUSTOM_MAP_PRESET_KEY) ?? 'null');
    if (isCustomMapSettings(legacy)) return { ...defaults, settings: normalizeCustomMap({ ...legacy, randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS], quickAutomaticSeed: true }) };
  } catch { /* A preset is optional, including when storage is unavailable. */ }
  return defaults;
}

export function saveCustomMapPreset(preset: CustomMapPreset): boolean {
  if (!isCustomMapSettings(preset.settings) || typeof preset.enabled !== 'boolean' || typeof preset.hardMode !== 'boolean') return false;
  try { localStorage.setItem(CUSTOM_MAP_PRESET_STATE_KEY, JSON.stringify({ version: 4, ...preset })); return true; }
  catch { return false; }
}

export function loadCustomMapSettings(): CustomMapSettings {
  return loadCustomMapPreset().settings;
}

export function saveCustomMapSettings(settings: CustomMapSettings): boolean {
  return saveCustomMapPreset({ settings, enabled: true, hardMode: false });
}

/** Stable ordering also labels the four positions in the preview. */
export function customMapCapitals(map: MapDefinition) {
  const capitals = map.planets.filter(planet => planet.capital);
  const center = capitals.reduce((p, capital) => ({ x: p.x + capital.x / capitals.length, y: p.y + capital.y / capitals.length }), { x: 0, y: 0 });
  return capitals.sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
}

export function createCustomMap(settings: CustomMapSettings): MapDefinition {
  if (!isCustomMapSettings(settings)) throw new Error('Choose valid map settings and a whole-number seed from 0 to 4294967295.');
  const config = normalizeCustomMap(settings);
  const map = config.style === 'quick-match'
    ? buildQuickMap(config.seed, config.quickLayout, { orbitingPlanets: config.orbitingPlanets, flankRegions: config.flankRegions, weaponFocus: config.weaponFocus })
    : buildChaosMap(config.seed, config.chaosLayout, { composition: config.composition, smallPlanets: config.smallPlanets, normalPattern: config.normalPattern, weaponsPerWorld: config.weaponsPerWorld });
  const capitals = customMapCapitals(map);
  capitals.forEach((planet, index) => { planet.owner = FACTIONS[(index - config.startingCapital + FACTIONS.length) % FACTIONS.length]; });
  const multiplier = config.defenders === 'light' ? 0.8 : config.defenders === 'fortified' ? 1.3 : 1;
  for (const planet of map.planets) {
    // Keep the certified opening choices intact for all four factions.
    if (planet.owner === NEUTRAL && !capitals.some(capital => distance(planet, capital) <= map.attackRange)) {
      planet.ships = Math.max(1, Math.round(planet.ships * multiplier));
    }
  }
  let fingerprint = 2166136261;
  for (const char of JSON.stringify(config)) fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619);
  map.id = `custom-v1-${(fingerprint >>> 0).toString(36)}`;
  map.title = 'Custom Map';
  if (config.style !== 'quick-match') map.briefing = 'Your battlefield. Your rules. Capture the enemy capitals and protect your blue capital.';
  validateMap(map);
  if (config.style === 'quick-match') validateQuickGeometry(map); else validateChaosGeometry(map);
  return map;
}
