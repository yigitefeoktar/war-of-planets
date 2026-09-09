import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';
import { SUPERWEAPON_COSTS, SUPERWEAPON_IDS, aegisTargets, assignQuickMatchSuperweaponPlanets, isPointAccessible } from './superweapons';
import type { Base } from './types';

const BLUE = '#3b82f6';
const RED = '#ef4444';

function fixture() {
  const engine = new GameEngine(2000, 1200, { rng: () => 0.5, now: () => 0 });
  engine.bases.clear();
  engine.pixels = [];
  engine.nextPixelId = 0;
  engine.addBase('capital', 100, 100, BLUE, 10, true);
  engine.addBase('enemy', 500, 100, RED, 10);
  engine.addBase('far', 1500, 100, RED, 10);
  engine.bases.get('capital')!.superweaponUnlocks = [...SUPERWEAPON_IDS];
  engine.recordPlanetCapture('capital', BLUE);
  return engine;
}

test('Quick Match sites include two copies of every weapon and dual-unlock planets', () => {
  const bases: Base[] = Array.from({ length: 18 }, (_, index) => ({
    id: `neutral-${index}`, x: index * 100, y: 100, color: '#6b7280', pixelCount: 20,
  }));
  assignQuickMatchSuperweaponPlanets(bases);
  for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(bases.filter(base => base.superweaponUnlocks?.includes(weapon)).length, 2);
  }
  assert.equal(bases.filter(base => (base.superweaponUnlocks?.length ?? 0) > 1).length, 2);
});

test('different factions permanently unlock every weapon on a captured site', () => {
  const engine = new GameEngine(1200, 800, { rng: () => 0.5, now: () => 0 });
  engine.bases.clear();
  engine.pixels = [];
  engine.factionSuperweaponUnlocks.clear();
  engine.addBase('relic', 900, 400, '#6b7280', 0);
  engine.bases.get('relic')!.superweaponUnlocks = ['singularity', 'dominion'];

  assert.deepEqual(engine.recordPlanetCapture('relic', BLUE), ['singularity', 'dominion']);
  assert.deepEqual(engine.recordPlanetCapture('relic', RED), ['singularity', 'dominion']);
  assert.equal(engine.isSuperweaponUnlocked(BLUE, 'singularity'), true);
  assert.equal(engine.isSuperweaponUnlocked(RED, 'singularity'), true);
  assert.equal(engine.isSuperweaponUnlocked(RED, 'dominion'), true);
  assert.deepEqual(engine.recordPlanetCapture('relic', RED), []);
});

test('authored-map engines cannot unlock or activate superweapons', () => {
  const engine = new GameEngine(1000, 1000, { superweaponUnlocksEnabled: false });
  const marked = Array.from(engine.bases.values()).find(base => !base.isCapital)!;
  marked.superweaponUnlocks = ['aegis'];
  assert.deepEqual(engine.recordPlanetCapture(marked.id, BLUE), []);
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.aegis);
  assert.equal(engine.activateAegisNova(BLUE), 0);
});

test('accessible territory is the union of 600-unit areas around owned planets', () => {
  const engine = fixture();
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 700, 100, 600), true);
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 701, 100, 600), false);
});

test('Aegis Nova destroys only moving hostile ships inside accessible territory', () => {
  const engine = fixture();
  const inside = engine.createIdlePixel('enemy', 450, 100, RED);
  inside.state = 'moving'; inside.targetBaseId = 'capital'; inside.x = 450; inside.y = 100;
  const outside = engine.createIdlePixel('far', 1500, 100, RED);
  outside.state = 'moving'; outside.targetBaseId = 'capital'; outside.x = 1500; outside.y = 100;
  const friendly = engine.createIdlePixel('capital', 300, 100, BLUE);
  friendly.state = 'moving'; friendly.targetBaseId = 'enemy'; friendly.x = 300; friendly.y = 100;
  engine.pixels.push(inside, outside, friendly);

  assert.deepEqual(aegisTargets(engine.pixels, engine.bases.values(), BLUE, 600).map(p => p.id), [inside.id]);
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.aegis);
  assert.equal(engine.activateAegisNova(BLUE), 1);
  assert.equal(inside.dead, true);
  assert.notEqual(outside.dead, true);
  assert.notEqual(friendly.dead, true);
  assert.equal(engine.getEnergy(BLUE), 0);
});

test('Singularity Mine requires accessible placement and spends energy only on success', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.singularity);
  assert.equal(engine.activateSingularityMine(BLUE, 1200, 100), false);
  assert.equal(engine.getEnergy(BLUE), SUPERWEAPON_COSTS.singularity);
  assert.equal(engine.activateSingularityMine(BLUE, 650, 100), true);
  assert.equal(engine.singularities.length, 1);
  assert.equal(engine.getEnergy(BLUE), 0);
});

test('Omni Strike spends 70 energy and launches from the whole empire', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.omni);
  assert.equal(engine.activateOmniStrike(BLUE, 'enemy'), true);
  assert.equal(engine.getEnergy(BLUE), 0);
  assert.ok(engine.pixels.some(pixel => pixel.color === BLUE && pixel.state === 'moving' && pixel.isWarp));
});

test('Dominion Ark crosses the map and leaves a five-ship foothold', () => {
  const engine = fixture();
  const target = engine.bases.get('enemy')!;
  target.x = 220;
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.dominion);
  engine.addBase('neutral', 180, 180, '#6b7280', 5);
  assert.equal(engine.activateDominionArk(BLUE, 'neutral'), false);
  assert.equal(engine.getEnergy(BLUE), SUPERWEAPON_COSTS.dominion);
  assert.equal(engine.activateDominionArk(BLUE, 'enemy'), true);
  assert.equal(engine.getEnergy(BLUE), 0);
  assert.equal(engine.dominionArks.length, 1);

  for (let i = 0; i < 4; i++) engine.update(1);
  assert.equal(target.color, BLUE);
  assert.equal(engine.dominionArks.length, 0);
  assert.equal(engine.pixels.filter(pixel => !pixel.dead && pixel.baseId === target.id && pixel.color === BLUE).length, 5);
});
