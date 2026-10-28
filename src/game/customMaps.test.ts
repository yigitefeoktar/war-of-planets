import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER, isCampaignMode } from './campaign';
import { createMatch } from './mapLoader';
import { createCustomMap, customMapCapitals, CUSTOM_MAP_PRESET_KEY, CUSTOM_MAP_PRESET_STATE_KEY, CUSTOM_MAP_RANDOM_SETTINGS, DEFAULT_CUSTOM_MAP, DEFAULT_CUSTOM_MAP_PREFERENCES, LEGACY_CUSTOM_MAP_PRESET_STATE_KEY, PREVIOUS_CUSTOM_MAP_PRESET_STATE_KEY, isCustomMapSettings, loadCustomMapPreset, loadCustomMapSettings, normalizeCustomMap, resolveCustomMapSettings, saveCustomMapPreset, saveCustomMapSettings, type CustomMapSettings } from './customMaps';

test('manual Quick settings produce certified maps across layouts, ring sizes, flanks and seeds', () => {
  for (const seed of [0, 1, 42, 284719, 0xFFFFFFFF]) for (const quickLayout of [0, 1, 2, 3]) {
    for (const orbitingPlanets of [5, 6, 7] as const) for (const flankRegions of [0, 1, 2] as const) {
      const settings = normalizeCustomMap({ ...DEFAULT_CUSTOM_MAP, seed, quickLayout, orbitingPlanets, flankRegions });
      const map = createCustomMap(settings);
      const binary = quickLayout === 1 || quickLayout === 3;
      assert.equal(map.orbits!.length, binary ? 2 : 1);
      assert.ok(map.orbits!.every(orbit => orbit.planetIds.length === (binary ? 5 : orbitingPlanets)));
      assert.equal(map.generated!.modules!.filter(module => module.id.startsWith('flank-')).length, binary ? 0 : settings.flankRegions);
    }
  }
});

test('manual Chaos compositions keep four capitals and obey requested planet and weapon choices', () => {
  for (const seed of [0, 1, 42, 284719, 0xFFFFFFFF]) for (const chaosLayout of [0, 1, 2, 3]) {
    for (const composition of [0, 1, 2, 3] as const) for (const smallPlanets of [5, 6, 7] as const) {
      for (const normalPattern of ['classic', 'scattered', 'pentagon-web'] as const) {
        const settings = normalizeCustomMap({ ...DEFAULT_CUSTOM_MAP, style: 'chaos-mode', seed, chaosLayout, composition, smallPlanets, normalPattern, weaponsPerWorld: 2 });
        const map = createCustomMap(settings);
        assert.equal(map.orbits!.length, 4);
        assert.equal(map.planets.filter(planet => planet.capital).length, 4);
        assert.ok(map.planets.every(planet => planet.superweaponUnlocks?.length === 2));
        const systems = map.generated!.systems!;
        assert.equal(systems.filter(system => system.size === 'small').length, composition === 2 ? 1 : composition === 3 ? 2 : 0);
        assert.ok(systems.filter(system => system.size === 'small').every(system => system.planetIds.length === smallPlanets));
        if (composition === 1 || composition === 2) assert.ok(systems.filter(system => system.size === 'normal').every(system => system.pattern === settings.normalPattern));
      }
    }
  }
});

test('seed and settings reproduce the exact preview, with identity including manual choices', () => {
  const a = createCustomMap(DEFAULT_CUSTOM_MAP), b = createCustomMap({ ...DEFAULT_CUSTOM_MAP });
  assert.deepEqual(a, b);
  assert.notEqual(a.id, createCustomMap({ ...DEFAULT_CUSTOM_MAP, orbitingPlanets: 7 }).id);
  assert.notEqual(a.id, createCustomMap({ ...DEFAULT_CUSTOM_MAP, defenders: 'fortified' }).id);
});

test('selected capital becomes blue and preview launches and retries with unchanged initial state', () => {
  for (const style of ['quick-match', 'chaos-mode'] as const) for (const startingCapital of [0, 1, 2, 3] as const) {
    const map = createCustomMap({ ...DEFAULT_CUSTOM_MAP, style, startingCapital });
    assert.equal(customMapCapitals(map)[startingCapital].owner, PLAYER);
    const engine = createMatch(map, { hardMode: true });
    assert.equal(engine.isHardMode, true);
    for (const planet of map.planets) {
      const base = engine.bases.get(planet.id)!;
      assert.deepEqual([base.x, base.y, base.color, base.pixelCount], [planet.x, planet.y, planet.owner, planet.ships]);
    }
    engine.update(1);
    const retry = createMatch(map);
    assert.equal(retry.bases.get(customMapCapitals(map)[startingCapital].id)!.pixelCount, 200);
    assert.equal(isCampaignMode('custom-map'), false);
  }
});

test('defender settings change contested worlds while preserving capital opening choices', () => {
  for (const style of ['quick-match', 'chaos-mode'] as const) {
    const light = createCustomMap({ ...DEFAULT_CUSTOM_MAP, style, defenders: 'light' });
    const fortified = createCustomMap({ ...DEFAULT_CUSTOM_MAP, style, defenders: 'fortified' });
    const capitals = customMapCapitals(light);
    let changed = 0;
    for (const planet of light.planets) {
      const other = fortified.planets.find(p => p.id === planet.id)!;
      if (capitals.some(capital => Math.hypot(capital.x - planet.x, capital.y - planet.y) <= light.attackRange)) assert.equal(planet.ships, other.ships);
      else if (planet.ships !== other.ships) { assert.ok(planet.ships < other.ships); changed++; }
    }
    assert.ok(changed > 0);
  }
});

test('weapon focus reserves the orbital specialty and retains all three weapons', () => {
  for (const weaponFocus of ['production', 'defense', 'strike'] as const) {
    const map = createCustomMap({ ...DEFAULT_CUSTOM_MAP, weaponFocus });
    assert.equal(map.generated!.weaponGroups![0].profile, weaponFocus);
    assert.equal(new Set(map.planets.flatMap(planet => planet.superweaponUnlocks ?? [])).size, 3);
  }
});

test('preset parsing rejects invalid or corrupt data and storage failures never block play', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = '';
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
    assert.equal(saveCustomMapSettings(DEFAULT_CUSTOM_MAP), true);
    assert.deepEqual(loadCustomMapSettings(), DEFAULT_CUSTOM_MAP);
    for (const value of ['{broken', '{}', JSON.stringify({ ...DEFAULT_CUSTOM_MAP, seed: -1 }), JSON.stringify({ ...DEFAULT_CUSTOM_MAP, orbitingPlanets: 99 })]) {
      stored = value;
      assert.deepEqual(loadCustomMapSettings(), DEFAULT_CUSTOM_MAP_PREFERENCES);
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    assert.deepEqual(loadCustomMapSettings(), DEFAULT_CUSTOM_MAP_PREFERENCES);
    assert.equal(saveCustomMapSettings(DEFAULT_CUSTOM_MAP), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  for (const seed of [-1, 0x100000000, NaN, 1.5]) {
    assert.equal(isCustomMapSettings({ ...DEFAULT_CUSTOM_MAP, seed }), false);
    assert.throws(() => createCustomMap({ ...DEFAULT_CUSTOM_MAP, seed } as CustomMapSettings));
  }
});

function withPresetStorage(run: (stored: Map<string, string>) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    } });
    run(stored);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test('preset saving defaults on, migrates existing presets and restores settings plus difficulty', () => {
  withPresetStorage(stored => {
    assert.deepEqual(loadCustomMapPreset(), { settings: DEFAULT_CUSTOM_MAP_PREFERENCES, enabled: true, hardMode: false });
    const settings: CustomMapSettings = { ...DEFAULT_CUSTOM_MAP, seed: 978321, style: 'chaos-mode', composition: 2, startingCapital: 3 };
    stored.set(CUSTOM_MAP_PRESET_KEY, JSON.stringify(settings));
    assert.deepEqual(loadCustomMapPreset(), { settings: { ...settings, randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS], quickAutomaticSeed: true }, enabled: true, hardMode: false });
    assert.equal(saveCustomMapPreset({ settings, enabled: true, hardMode: true }), true);
    assert.deepEqual(loadCustomMapPreset(), { settings, enabled: true, hardMode: true });
    const updated = { ...settings, seed: 4294967295, defenders: 'fortified' as const };
    assert.equal(saveCustomMapPreset({ settings: updated, enabled: true, hardMode: true }), true);
    assert.deepEqual(loadCustomMapSettings(), updated);
  });
});

test('turning saving off survives refresh and prevents restoring a stale legacy preset', () => {
  withPresetStorage(stored => {
    const settings = { ...DEFAULT_CUSTOM_MAP, seed: 112233, quickLayout: 1 };
    stored.set(CUSTOM_MAP_PRESET_KEY, JSON.stringify(settings));
    assert.equal(saveCustomMapPreset({ settings, enabled: false, hardMode: true }), true);
    assert.deepEqual(loadCustomMapPreset(), { settings: DEFAULT_CUSTOM_MAP_PREFERENCES, enabled: false, hardMode: false });
    assert.deepEqual(loadCustomMapSettings(), DEFAULT_CUSTOM_MAP_PREFERENCES);
    const current = { ...DEFAULT_CUSTOM_MAP, seed: 556677 };
    assert.equal(saveCustomMapPreset({ settings: current, enabled: true, hardMode: false }), true);
    assert.deepEqual(loadCustomMapPreset(), { settings: current, enabled: true, hardMode: false });
  });
});

test('malformed automatic preset records recover safely without changing generation settings', () => {
  withPresetStorage(stored => {
    for (const value of ['{broken', '{}', JSON.stringify({ version: 2, enabled: 'yes', settings: DEFAULT_CUSTOM_MAP, hardMode: false }), JSON.stringify({ version: 2, enabled: true, settings: { ...DEFAULT_CUSTOM_MAP, seed: -1 }, hardMode: false })]) {
      stored.set(CUSTOM_MAP_PRESET_STATE_KEY, value);
      assert.deepEqual(loadCustomMapPreset(), { settings: DEFAULT_CUSTOM_MAP_PREFERENCES, enabled: true, hardMode: false });
    }
    assert.equal(saveCustomMapPreset({ settings: { ...DEFAULT_CUSTOM_MAP, seed: NaN }, enabled: true, hardMode: false }), false);
  });
});

test('the nine Random controls sample valid choices while leaving other settings fixed', () => {
  const choices = new Map(CUSTOM_MAP_RANDOM_SETTINGS.map(key => [key, new Set<unknown>()]));
  const preferences: CustomMapSettings = { ...DEFAULT_CUSTOM_MAP_PREFERENCES, quickAutomaticSeed: false, composition: 2, randomSettings: CUSTOM_MAP_RANDOM_SETTINGS.filter(key => key !== 'composition') };
  for (let roll = 0; roll < 128; roll++) {
    const resolved = resolveCustomMapSettings(preferences, roll);
    assert.ok(isCustomMapSettings(resolved));
    assert.equal(resolved.randomSettings, undefined);
    for (const key of CUSTOM_MAP_RANDOM_SETTINGS) choices.get(key)!.add(resolved[key]);
    for (const key of ['seed', 'style', 'quickLayout', 'chaosLayout'] as const) assert.equal(resolved[key], preferences[key]);
  }
  for (const key of CUSTOM_MAP_RANDOM_SETTINGS) {
    if (key !== 'composition') assert.ok(choices.get(key)!.size >= 2, `${key} should vary between matches`);
  }
  const systems = new Set(Array.from({ length: 128 }, (_, roll) => resolveCustomMapSettings(DEFAULT_CUSTOM_MAP_PREFERENCES, roll).composition));
  assert.deepEqual(systems, new Set([0, 1, 2, 3]));
  assert.deepEqual(resolveCustomMapSettings(DEFAULT_CUSTOM_MAP, 1), resolveCustomMapSettings(DEFAULT_CUSTOM_MAP, 99));
});

test('Random obeys layout and composition restrictions and produces valid maps', () => {
  for (let roll = 0; roll < 32; roll++) for (const layout of [0, 1, 2, 3]) {
    const quick = resolveCustomMapSettings({ ...DEFAULT_CUSTOM_MAP_PREFERENCES, quickLayout: layout }, roll);
    if (layout === 1 || layout === 3) assert.equal(quick.orbitingPlanets, 5);
    assert.ok((layout === 2 ? [1, 2] : [0, 1]).includes(quick.flankRegions));
    const map = createCustomMap(quick);
    assert.equal(customMapCapitals(map)[quick.startingCapital].owner, PLAYER);
    const chaos = resolveCustomMapSettings({ ...DEFAULT_CUSTOM_MAP_PREFERENCES, style: 'chaos-mode', chaosLayout: layout }, roll);
    if (chaos.composition !== 2) assert.notEqual(chaos.normalPattern, 'pentagon-web');
    const chaosMap = createCustomMap(chaos);
    assert.equal(chaosMap.planets.filter(planet => planet.capital).length, 4);
    assert.ok(chaosMap.generated!.systems!.filter(system => system.size === 'small').every(system => system.planetIds.length === chaos.smallPlanets));
  }
});

test('Random stays stable within a preview, and manual edits do not reroll unrelated fields', () => {
  const preferences = { ...DEFAULT_CUSTOM_MAP_PREFERENCES };
  const resolved = resolveCustomMapSettings(preferences, 42);
  assert.deepEqual(resolved, resolveCustomMapSettings(preferences, 42));
  const edited = resolveCustomMapSettings({ ...preferences, defenders: 'fortified', randomSettings: CUSTOM_MAP_RANDOM_SETTINGS.filter(key => key !== 'defenders') }, 42);
  assert.equal(edited.defenders, 'fortified');
  for (const key of CUSTOM_MAP_RANDOM_SETTINGS) if (key !== 'defenders') assert.equal(edited[key], resolved[key]);
  const preview = createCustomMap(resolved);
  assert.deepEqual(preview, createCustomMap(resolved));
  const match = createMatch(preview);
  for (const planet of preview.planets) assert.equal(match.bases.get(planet.id)!.color, planet.owner);
  assert.deepEqual(preferences, DEFAULT_CUSTOM_MAP_PREFERENCES);
});

test('saved presets remember Random instead of freezing the resolved choice; existing presets stay manual', () => {
  withPresetStorage(stored => {
    const preset = { settings: DEFAULT_CUSTOM_MAP_PREFERENCES, enabled: true, hardMode: true };
    assert.equal(saveCustomMapPreset(preset), true);
    assert.deepEqual(loadCustomMapPreset(), preset);
    assert.equal(new Set(Array.from({ length: 32 }, (_, roll) => resolveCustomMapSettings(loadCustomMapSettings(), roll).startingCapital)).size, 4);
    stored.set(CUSTOM_MAP_PRESET_STATE_KEY, JSON.stringify({ version: 4, enabled: true, hardMode: false, settings: DEFAULT_CUSTOM_MAP }));
    assert.deepEqual(loadCustomMapSettings(), DEFAULT_CUSTOM_MAP);
    for (const randomSettings of [['seed'], ['quickLayout'], ['anything'], 'startingCapital', [null]]) {
      assert.equal(isCustomMapSettings({ ...DEFAULT_CUSTOM_MAP, randomSettings }), false);
    }
  });
});

test('older saved setups adopt all nine Random defaults once and later manual choices survive refresh', () => {
  withPresetStorage(stored => {
    const settings: CustomMapSettings = { ...DEFAULT_CUSTOM_MAP, seed: 3892, style: 'chaos-mode', chaosLayout: 2, weaponsPerWorld: 2, randomSettings: [] };
    stored.set(LEGACY_CUSTOM_MAP_PRESET_STATE_KEY, JSON.stringify({ version: 2, enabled: true, hardMode: true, settings }));
    const migrated = loadCustomMapPreset();
    assert.deepEqual(migrated, { enabled: true, hardMode: true, settings: { ...settings, randomSettings: [...CUSTOM_MAP_RANDOM_SETTINGS], quickAutomaticSeed: true } });
    assert.equal(saveCustomMapPreset(migrated), true);
    assert.equal(JSON.parse(stored.get(CUSTOM_MAP_PRESET_STATE_KEY)!).version, 4);
    const manual = { ...migrated, settings: { ...migrated.settings, weaponsPerWorld: 1 as const, defenders: 'fortified' as const, randomSettings: CUSTOM_MAP_RANDOM_SETTINGS.filter(key => key !== 'weaponsPerWorld' && key !== 'defenders') } };
    assert.equal(saveCustomMapPreset(manual), true);
    assert.deepEqual(loadCustomMapPreset(), manual);
    assert.equal(resolveCustomMapSettings(loadCustomMapSettings(), 7).weaponsPerWorld, 1);
    assert.equal(resolveCustomMapSettings(loadCustomMapSettings(), 99).defenders, 'fortified');
  });
});

test('automatic seed changes only Quick matches, and manual seeds still reproduce previews', () => {
  const automatic = { ...DEFAULT_CUSTOM_MAP_PREFERENCES, randomSettings: [] };
  const first = resolveCustomMapSettings(automatic, 17), next = resolveCustomMapSettings(automatic, 29);
  assert.equal(first.seed, 17);
  assert.equal(next.seed, 29);
  assert.notDeepEqual(createCustomMap(first).planets, createCustomMap(next).planets);
  const manual = { ...automatic, quickAutomaticSeed: false };
  assert.deepEqual(createCustomMap(resolveCustomMapSettings(manual, 17)), createCustomMap(resolveCustomMapSettings(manual, 29)));
  const chaos = { ...automatic, style: 'chaos-mode' as const };
  assert.deepEqual(resolveCustomMapSettings(chaos, 17), resolveCustomMapSettings({ ...chaos, quickAutomaticSeed: false }, 29));
  assert.equal(resolveCustomMapSettings(chaos, 17).seed, chaos.seed);
});

test('automatic Quick seeds migrate without resetting saved choices and manual opt-out persists', () => {
  withPresetStorage(stored => {
    const settings: CustomMapSettings = { ...DEFAULT_CUSTOM_MAP, seed: 3892, randomSettings: ['defenders'] };
    stored.set(PREVIOUS_CUSTOM_MAP_PRESET_STATE_KEY, JSON.stringify({ version: 3, settings, enabled: true, hardMode: true }));
    const migrated = loadCustomMapPreset();
    assert.deepEqual(migrated, { settings: { ...settings, quickAutomaticSeed: true }, enabled: true, hardMode: true });
    const manual = { ...migrated, settings: { ...migrated.settings, quickAutomaticSeed: false } };
    assert.equal(saveCustomMapPreset(manual), true);
    assert.deepEqual(loadCustomMapPreset(), manual);
    assert.equal(isCustomMapSettings({ ...settings, quickAutomaticSeed: 'yes' }), false);
  });
});

test('Random weapons per world chooses each available mode and maps obey the resolved count', () => {
  const seen = new Set<CustomMapSettings['weaponsPerWorld']>();
  for (let roll = 0; roll < 48; roll++) {
    const settings = resolveCustomMapSettings({ ...DEFAULT_CUSTOM_MAP_PREFERENCES, style: 'chaos-mode' }, roll);
    seen.add(settings.weaponsPerWorld);
    const map = createCustomMap(settings);
    assert.ok(map.planets.every(planet => settings.weaponsPerWorld === 'mixed'
      ? [1, 2].includes(planet.superweaponUnlocks?.length ?? 0)
      : planet.superweaponUnlocks?.length === settings.weaponsPerWorld));
    assert.deepEqual(map, createCustomMap(settings));
  }
  assert.deepEqual(seen, new Set(['mixed', 1, 2]));
});
