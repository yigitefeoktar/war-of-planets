import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_STRIKE, BREACH_LINE, TURNING_TIDE, THE_PINCER, SIEGE_OF_HELIOS, CHAPTERS, CHAPTER_ONE_TEST_MODE_IDS, PLAYER, completeMission, emptyProgress, followingMission, getOutcome, isChapterOneTestMode, launchMission, nextMission, parseProgress, progressLabel, validateMap, type Chapter } from './campaign';
import { createMatch } from './mapLoader';
import { CLASSIC_BATTLEFIELD } from './classicMap';

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
test('Quick Match and Hard Mode shuffle capital slots while retaining classic geography and fleets', () => {
  const quick = createMatch(), retry = createMatch(), hard = createMatch(undefined, { hardMode: true });
  const slots = CLASSIC_BATTLEFIELD.planets.filter(planet => planet.capital).map(planet => `${planet.x},${planet.y}`).sort();
  assert.equal(CLASSIC_BATTLEFIELD.tutorial, undefined);
  for (const engine of [quick, retry, hard]) {
    assert.equal(engine.width, 3000);
    assert.equal(engine.height, 3000);
    assert.equal(engine.MAX_ATTACK_RANGE, 600);
    assert.equal(engine.bases.size, 33);
    assert.equal(engine.bases.has('west-landing'), false);
    assert.equal([...engine.bases.values()].filter(p => p.isCapital).length, 4);
    for (const planet of CLASSIC_BATTLEFIELD.planets) {
      const base = engine.bases.get(planet.id)!;
      assert.deepEqual([base.color, base.pixelCount, !!base.isCapital], [planet.owner, planet.ships, !!planet.capital]);
      if (!planet.capital) assert.deepEqual([base.x, base.y], [planet.x, planet.y]);
      assert.equal(engine.pixels.filter(p => p.baseId === planet.id).length, planet.ships);
      assert.ok(engine.pixels.filter(p => p.baseId === planet.id).every(p => p.color === base.color));
      if (planet.capital) assert.ok(engine.pixels.filter(p => p.baseId === planet.id)
        .every(p => Math.hypot(p.x - base.x, p.y - base.y) < 80));
    }
    assert.equal(engine.bases.get('player_1')!.pixelCount, 200);
    for (const id of ['ai_1', 'ai_2', 'ai_3']) assert.equal(engine.bases.get(id)!.pixelCount, 90);
    assert.deepEqual([...engine.bases.values()].filter(base => base.isCapital).map(base => `${base.x},${base.y}`).sort(), slots);
    assert.equal(getOutcome(engine.bases.values()), null);
    assert.equal(engine.multiSelectEnabled, true);
  }
  for (const [previous, next] of [[quick, retry], [retry, hard]]) {
    for (const id of ['player_1', 'ai_1', 'ai_2', 'ai_3']) {
      const before = previous.bases.get(id)!, after = next.bases.get(id)!;
      assert.notDeepEqual([before.x, before.y], [after.x, after.y]);
    }
  }
  assert.equal(quick.isHardMode, false);
  assert.equal(hard.isHardMode, true);
  assert.notEqual(quick.backgroundColor, hard.backgroundColor);
});

test('classic matches retain four fixed weapon sites and restart without combat state', () => {
  const first = createMatch();
  assert.equal(first.superweaponUnlocksEnabled, true);
  const sites = [...first.bases.values()].filter(base => base.superweaponUnlocks?.length);
  assert.equal(sites.length, 4);
  assert.ok(sites.every(base => base.color === '#6b7280' && !base.isCapital));
  assert.equal(sites.filter(base => base.superweaponUnlocks?.length === 3).length, 1);
  for (const weapon of ['omni', 'overdrive', 'repulse'] as const) {
    assert.equal(sites.filter(base => base.superweaponUnlocks?.includes(weapon)).length, 2);
  }
  first.bases.get('ai_1')!.color = PLAYER;
  first.bases.get('ai_1')!.isCapital = false;
  first.pixels.length = 0;
  first.setSuperweaponCharge(PLAYER, 'omni', 1);
  const retry = createMatch();
  assert.equal(retry.bases.get('ai_1')!.color, '#ef4444');
  assert.equal(retry.bases.get('ai_1')!.isCapital, true);
  assert.ok(retry.pixels.length > 0);
  assert.equal(retry.getSuperweaponCharge(PLAYER, 'omni'), 0);
  assert.deepEqual([...retry.bases.values()].filter(base => base.superweaponUnlocks?.length), sites);
});
test('victory and defeat are resolved with defeat precedence', () => {
  const engine = createMatch(FIRST_STRIKE);
  for (const base of engine.bases.values()) if (base.isCapital && base.color !== PLAYER) engine.bases.delete(base.id);
  assert.equal(getOutcome(engine.bases.values()), 'victory');
  engine.bases.delete('player_1'); assert.equal(getOutcome(engine.bases.values()), 'defeat');
  assert.equal(getOutcome([{ color: PLAYER, isCapital: false }]), 'defeat');
});
test('Chapter 1 advances from the tutorial through the Helios finale', () => {
  let progress = emptyProgress();
  assert.equal(launchMission(CHAPTERS['chapter-1'], progress.completed)?.id, FIRST_STRIKE.id);
  progress = completeMission(progress, FIRST_STRIKE.id);
  progress = completeMission(progress, FIRST_STRIKE.id);
  assert.equal(progress.completed.length, 1);
  assert.equal(nextMission(CHAPTERS['chapter-1'], progress.completed)?.id, BREACH_LINE.id);
  assert.equal(launchMission(CHAPTERS['chapter-1'], progress.completed)?.id, FIRST_STRIKE.id);
  assert.ok(launchMission(CHAPTERS['chapter-1'], progress.completed)?.tutorial);
  assert.equal(CHAPTERS['chapter-1'].maps[1].orbit, undefined);
  assert.equal(CHAPTERS['chapter-1'].maps[1].tutorial, undefined);
  assert.ok(CHAPTERS['chapter-1'].maps[2].orbit);
  assert.equal(CHAPTERS['chapter-1'].maps[3].orbit, undefined);
  assert.equal(CHAPTERS['chapter-1'].maps[4].orbits?.length, 5);
  assert.equal(followingMission(CHAPTERS['chapter-1'], FIRST_STRIKE.id)?.id, BREACH_LINE.id);
  assert.equal(followingMission(CHAPTERS['chapter-1'], BREACH_LINE.id)?.id, TURNING_TIDE.id);
  assert.equal(followingMission(CHAPTERS['chapter-1'], TURNING_TIDE.id)?.id, THE_PINCER.id);
  assert.equal(followingMission(CHAPTERS['chapter-1'], THE_PINCER.id)?.id, SIEGE_OF_HELIOS.id);
  assert.equal(followingMission(CHAPTERS['chapter-1'], SIEGE_OF_HELIOS.id), undefined);
  const finishedThree = completeMission(completeMission(progress, BREACH_LINE.id), TURNING_TIDE.id);
  assert.equal(nextMission(CHAPTERS['chapter-1'], finishedThree.completed)?.id, THE_PINCER.id);
  const finishedFour = completeMission(finishedThree, THE_PINCER.id);
  assert.equal(nextMission(CHAPTERS['chapter-1'], finishedFour.completed)?.id, SIEGE_OF_HELIOS.id);
  const finished = completeMission(finishedFour, SIEGE_OF_HELIOS.id);
  assert.equal(nextMission(CHAPTERS['chapter-1'], finished.completed), undefined);
  assert.equal(nextMission(CHAPTERS['chapter-1'], completeMission(progress, TURNING_TIDE.id).completed)?.id, BREACH_LINE.id);
  assert.equal(launchMission(CHAPTERS['chapter-1'], finished.completed)?.id, FIRST_STRIKE.id);
  const second = { ...FIRST_STRIKE, id: 'test-next-map' };
  const expanded: Chapter = { ...CHAPTERS['chapter-1'], maps: [FIRST_STRIKE, second] };
  assert.equal(nextMission(expanded, progress.completed)?.id, second.id);
  assert.equal(followingMission(expanded, FIRST_STRIKE.id)?.id, second.id);
  assert.equal(followingMission(expanded, second.id), undefined);
  assert.equal(followingMission(expanded, 'invalid'), undefined);
  assert.equal(launchMission(expanded, parseProgress(JSON.stringify(progress)).completed)?.id, FIRST_STRIKE.id);
  assert.equal(launchMission(CHAPTERS['chapter-2'], []), undefined);
});
test('startup selects Chapter 1 for new and existing saves without deleting completed levels', () => {
  assert.equal(emptyProgress().selectedMode, 'chapter-1');
  for (const selectedMode of ['chapter-1', 'chapter-1-test', ...CHAPTER_ONE_TEST_MODE_IDS, 'chapter-2', 'quick-match']) {
    const completed = [FIRST_STRIKE.id, TURNING_TIDE.id];
    const loaded = parseProgress(JSON.stringify({ version: 1, selectedMode, completed }));
    assert.equal(loaded.selectedMode, 'chapter-1');
    assert.deepEqual(loaded.completed, completed);
    assert.equal(launchMission(CHAPTERS['chapter-1'], loaded.completed)?.id, FIRST_STRIKE.id);
    assert.equal(followingMission(CHAPTERS['chapter-1'], FIRST_STRIKE.id)?.id, BREACH_LINE.id);
  }
});
test('each Chapter 1 test mode starts at its selected level and advances without using saved wins', () => {
  const campaignMaps = CHAPTERS['chapter-1'].maps;
  assert.equal(CHAPTER_ONE_TEST_MODE_IDS.length, campaignMaps.length);
  assert.equal(isChapterOneTestMode('chapter-1'), false);
  for (const [index, mode] of CHAPTER_ONE_TEST_MODE_IDS.entries()) {
    const testChapter = CHAPTERS[mode];
    assert.equal(isChapterOneTestMode(mode), true);
    assert.deepEqual(testChapter.maps, campaignMaps.slice(index));
    assert.equal(testChapter.plannedLevels, campaignMaps.length - index);
    assert.equal(launchMission(testChapter, [])?.id, campaignMaps[index].id);
    assert.equal(launchMission(testChapter, campaignMaps.map(map => map.id))?.id, campaignMaps[index].id);
    assert.equal(progressLabel(mode, emptyProgress()), `Testing · starts at Level ${index + 1}`);
    assert.equal(testChapter.maps[0].tutorial !== undefined, index === 0);
    for (let offset = index; offset < campaignMaps.length; offset++) {
      assert.equal(followingMission(testChapter, campaignMaps[offset].id)?.id, campaignMaps[offset + 1]?.id);
    }
  }
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
    { ...FIRST_STRIKE.planets.find(planet => planet.id === 'player_1')!, x: 700, y: 700, ships: 40 },
    { ...FIRST_STRIKE.planets.find(planet => planet.id === 'ai_1')!, x: 820, y: 700, ships: 1 },
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
