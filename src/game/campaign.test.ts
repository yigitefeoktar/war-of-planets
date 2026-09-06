import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_STRIKE, CHAPTERS, PLAYER, completeMission, emptyProgress, followingMission, getOutcome, launchMission, nextMission, parseProgress, validateMap, type Chapter } from './campaign';
import { createMatch } from './mapLoader';

test('authored map loads exact planets, ships, factions, dimensions and range', () => {
  const engine = createMatch(FIRST_STRIKE);
  assert.equal(engine.width, FIRST_STRIKE.width);
  assert.equal(engine.height, FIRST_STRIKE.height);
  assert.equal(engine.MAX_ATTACK_RANGE, FIRST_STRIKE.attackRange);
  assert.equal(engine.bases.size, FIRST_STRIKE.planets.length);
  for (const planet of FIRST_STRIKE.planets) {
    const base = engine.bases.get(planet.id)!;
    assert.deepEqual([base.x, base.y, base.color, base.pixelCount, !!base.isCapital], [planet.x, planet.y, planet.owner, planet.ships, !!planet.capital]);
    assert.equal(engine.pixels.filter(p => p.baseId === planet.id).length, planet.ships);
  }
  assert.equal(getOutcome(engine.bases.values()), null);
});
test('retry produces a fresh map without carrying combat state', () => {
  const first = createMatch(FIRST_STRIKE);
  first.bases.delete('ai_1'); first.pixels.length = 0;
  const retry = createMatch(FIRST_STRIKE);
  assert.ok(retry.bases.has('ai_1')); assert.ok(retry.pixels.length > 0);
  assert.equal(retry.shakeAmount, 0);
});
test('Quick Match keeps random map and four capitals', () => {
  const a = createMatch(), b = createMatch();
  assert.equal(a.width, 3000);
  assert.equal([...a.bases.values()].filter(p => p.isCapital).length, 4);
  assert.ok(a.bases.size > FIRST_STRIKE.planets.length);
  assert.notDeepEqual([...a.bases.values()], [...b.bases.values()]);
});
test('victory and defeat are resolved with defeat precedence', () => {
  const engine = createMatch(FIRST_STRIKE);
  engine.bases.delete('ai_1'); assert.equal(getOutcome(engine.bases.values()), 'victory');
  engine.bases.delete('player_1'); assert.equal(getOutcome(engine.bases.values()), 'defeat');
  assert.equal(getOutcome([{ color: PLAYER, isCapital: false }]), 'defeat');
});
test('campaign advances by stable map IDs and resumes newly released levels', () => {
  let progress = emptyProgress();
  assert.equal(launchMission(CHAPTERS['chapter-1'], progress.completed)?.id, FIRST_STRIKE.id);
  progress = completeMission(progress, FIRST_STRIKE.id);
  progress = completeMission(progress, FIRST_STRIKE.id);
  assert.equal(progress.completed.length, 1);
  assert.equal(nextMission(CHAPTERS['chapter-1'], progress.completed), undefined);
  assert.equal(launchMission(CHAPTERS['chapter-1'], progress.completed)?.id, FIRST_STRIKE.id);
  const second = { ...FIRST_STRIKE, id: 'test-next-map' };
  const expanded: Chapter = { ...CHAPTERS['chapter-1'], maps: [FIRST_STRIKE, second] };
  assert.equal(nextMission(expanded, progress.completed)?.id, second.id);
  assert.equal(followingMission(expanded, FIRST_STRIKE.id)?.id, second.id);
  assert.equal(followingMission(expanded, second.id), undefined);
  assert.equal(followingMission(expanded, 'invalid'), undefined);
  assert.equal(launchMission(expanded, parseProgress(JSON.stringify(progress)).completed)?.id, second.id);
  assert.equal(launchMission(CHAPTERS['chapter-2'], []), undefined);
});
test('corrupt, outdated and malformed saves recover safely', () => {
  for (const raw of [null, '{', '{}', '{"version":2}']) assert.deepEqual(parseProgress(raw), emptyProgress());
  assert.deepEqual(parseProgress('{"version":1,"selectedMode":"nope","completed":[1,"x","x"]}'), { version: 1, selectedMode: 'chapter-1', completed: ['x'] });
});
test('invalid and disconnected maps are rejected before starting', () => {
  assert.doesNotThrow(() => validateMap(FIRST_STRIKE));
  assert.throws(() => validateMap({ ...FIRST_STRIKE, width: 0 }));
  assert.throws(() => validateMap({ ...FIRST_STRIKE, planets: [...FIRST_STRIKE.planets, FIRST_STRIKE.planets[0]] }));
  assert.throws(() => validateMap({ ...FIRST_STRIKE, planets: FIRST_STRIKE.planets.map(p => ({ ...p, ships: -1 })) }));
  assert.throws(() => validateMap({ ...FIRST_STRIKE, attackRange: 1 }));
});
test('real combat destroys an enemy capital and resolves victory', () => {
  const fixture = { ...FIRST_STRIKE, orbit: undefined, planets: [
    { ...FIRST_STRIKE.planets[0], x: 700, y: 700, ships: 40 },
    { ...FIRST_STRIKE.planets[1], x: 820, y: 700, ships: 1 },
  ] };
  const engine = createMatch(fixture);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.sendUnits('player_1', 'ai_1', 1);
  for (let i = 0; i < 1000 && !getOutcome(engine.bases.values()); i++) engine.update(1 / 60);
  assert.equal(getOutcome(engine.bases.values()), 'victory');
  assert.equal(engine.bases.get('ai_1')?.isCapital, false);
  assert.equal(engine.lastDestroyedCapital?.color, '#ef4444');
});
