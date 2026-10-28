import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, CHAPTER_TWO_TEST_MODE_IDS, FACTIONS, PLAYER, NEUTRAL, completeMission, emptyProgress, followingMission, launchMission, mapOrbits, validateMap } from './campaign';
import { CHAPTER_TWO_MAPS } from './chapterTwo';
import { CHAPTER_TWO_WEAPONS, PINK } from './superweapons';
import { createMatch } from './mapLoader';
import { canIssueFleetOrder } from './logistics';

test('Chapter 2 progresses through five distinct maps and introduces pink after conversion', () => {
  assert.deepEqual(CHAPTERS['chapter-2'].maps, CHAPTER_TWO_MAPS);
  assert.deepEqual(CHAPTER_TWO_MAPS.map(map => map.title), ['The Spiral Breach', 'The Pink Frontier', 'Shifting Fronts', 'The Three Fortresses', 'The Galactic Crown']);
  assert.ok(CHAPTER_TWO_MAPS[0].planets.length > 100);
  assert.deepEqual(CHAPTER_TWO_MAPS.slice(1).map(map => map.planets.length), [79, 92, 101, 151]);
  assert.deepEqual(CHAPTER_TWO_MAPS.map(map => mapOrbits(map).length), [1, 3, 3, 3, 6]);
  const first = CHAPTER_TWO_MAPS[0];
  assert.ok(!first.planets.some(planet => planet.owner === PINK));
  assert.deepEqual(first.planets.find(planet => planet.owner === PLAYER)!.superweaponUnlocks, ['conversion']);
  for (const [index, map] of CHAPTER_TWO_MAPS.entries()) {
    assert.equal(followingMission(CHAPTERS['chapter-2'], map.id), CHAPTER_TWO_MAPS[index + 1]);
    assert.equal(map.pinkTerraforming, [1, 2, 4].includes(index));
    if ([1, 2, 4].includes(index)) assert.ok(map.planets.some(planet => planet.owner === PINK && planet.capital));
  }
  assert.ok(CHAPTER_TWO_MAPS.slice(4).every(map => [...FACTIONS, PINK].every(color => map.planets.some(planet => planet.owner === color && planet.capital))));
  const progress = completeMission(emptyProgress(), first.id);
  assert.equal(launchMission(CHAPTERS['chapter-2'], progress.completed), CHAPTER_TWO_MAPS[1]);
});

test('each Chapter 2 map loads with three permitted weapons, one planet per faction, and affordable openings', () => {
  for (const map of CHAPTER_TWO_MAPS) {
    validateMap(map);
    assert.deepEqual(map.weapons, CHAPTER_TWO_WEAPONS);
    assert.ok(map.planets.every(planet => !planet.superweaponUnlocks?.includes('overdrive')));
    assert.deepEqual([...new Set(map.planets.flatMap(planet => planet.superweaponUnlocks ?? []))].sort(), [...CHAPTER_TWO_WEAPONS].sort());
    const engine = createMatch(map);
    assert.equal(engine.bases.size, map.planets.length);
    assert.deepEqual(engine.weaponPalette, CHAPTER_TWO_WEAPONS);
    assert.equal(engine.multiSelectEnabled, true);
    for (const capital of map.planets.filter(planet => planet.capital)) {
      assert.equal(map.planets.filter(planet => planet.owner === capital.owner).length, 1);
      const choices = map.planets.filter(planet => planet.owner === NEUTRAL && Math.hypot(planet.x - capital.x, planet.y - capital.y) <= map.attackRange);
      assert.ok(choices.filter(planet => planet.ships <= 12).length >= 2, map.title);
      for (const target of choices) assert.equal(canIssueFleetOrder(engine.bases.values(), capital.id, target.id, map.attackRange), true);
    }
  }
});

test('orbits keep clear of fixed worlds and neighboring systems throughout a full movement sample', () => {
  for (const map of CHAPTER_TWO_MAPS) {
    const orbits = mapOrbits(map);
    const members = new Set(orbits.flatMap(orbit => orbit.planetIds));
    for (const orbit of orbits) {
      assert.equal(orbit.dysonSphere, undefined);
      for (const fixed of map.planets.filter(planet => !members.has(planet.id))) {
        assert.ok(orbit.planetIds.every(id => { const member = map.planets.find(planet => planet.id === id)!; return Math.abs(Math.hypot(fixed.x - orbit.x, fixed.y - orbit.y) - Math.hypot(member.x - orbit.x, member.y - orbit.y)) >= 250; }), `${map.title}: fixed ${fixed.id} crosses an orbit`);
      }
    }
    for (let seconds = 0; seconds <= 540; seconds += 15) {
      const live = map.planets.map(planet => {
        const orbit = orbits.find(system => system.planetIds.includes(planet.id));
        if (!orbit) return planet;
        const angle = seconds * Math.PI * 2 / orbit.periodSeconds, cos = Math.cos(angle), sin = Math.sin(angle);
        const x = planet.x - orbit.x, y = planet.y - orbit.y;
        return { ...planet, x: orbit.x + x * cos - y * sin, y: orbit.y + x * sin + y * cos };
      });
      const reached = new Set([live[0].id]);
      const frontier = [live[0]];
      for (const planet of frontier) for (const other of live) {
        if (!reached.has(other.id) && Math.hypot(planet.x - other.x, planet.y - other.y) <= map.attackRange) {
          reached.add(other.id); frontier.push(other);
        }
      }
      assert.equal(reached.size, live.length, `${map.title}: disconnected at ${seconds}s`);
      for (let index = 0; index < live.length; index++) for (const other of live.slice(index + 1)) {
        assert.ok(Math.hypot(live[index].x - other.x, live[index].y - other.y) >= 249.99, `${map.title}: ${live[index].id} overlaps ${other.id} at ${seconds}s`);
      }
    }
  }
});

test('the first map has six conversion approach worlds, two broad landings, and three nearby enemy capitals', () => {
  const map = CHAPTER_TWO_MAPS[0], orbit = mapOrbits(map)[0];
  assert.equal(mapOrbits(map).length, 1);
  assert.ok(!map.planets.some(planet => planet.id.includes('reserve')));
  assert.deepEqual(map.planets.filter(planet => planet.capital).map(planet => planet.owner).sort(), [...FACTIONS].sort());
  const home = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
  assert.equal(home.length, 12);
  assert.ok(home.every(planet => planet.superweaponUnlocks?.join() === 'conversion'));
  const path = map.planets.filter(planet => planet.id.includes('-approach-'));
  assert.equal(path.length, 6);
  assert.ok(path.every(planet => planet.superweaponUnlocks?.join() === 'conversion' && planet.ships === 8));
  const hub = map.planets.filter(planet => !orbit.planetIds.includes(planet.id) && !path.includes(planet));
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(hub.length > 61, 'the removed system makes room for a larger main battlefield');
  assert.ok(hub.every(planet => planet.superweaponUnlocks?.every(weapon => weapon === 'omni' || weapon === 'repulse')));
  for (const [step, planet] of path.entries()) {
    if (step > 0) assert.ok(d(planet, path[step - 1]) <= map.attackRange, 'continuous approach');
    for (const other of path.slice(step + 2)) assert.ok(d(planet, other) > map.attackRange, 'no skipped approach worlds');
    const exits = hub.filter(target => d(planet, target) <= map.attackRange);
    if (step < 4) assert.equal(exits.length, 0, 'the first four worlds cannot shortcut into the hub');
    else assert.ok(exits.length >= 2, 'both final worlds offer multiple landings');
    if (step > 0) assert.ok(d(planet, orbit) - 620 > map.attackRange, 'home orbit cannot skip the first port');
  }
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    assert.ok(home.some(planet => {
      const x = planet.x - orbit.x, y = planet.y - orbit.y;
      return d(path[0], { x: orbit.x + x * Math.cos(angle) - y * Math.sin(angle), y: orbit.y + x * Math.sin(angle) + y * Math.cos(angle) }) <= map.attackRange;
    }), 'the home port remains reachable throughout an orbit');
  }
  for (const capital of hub.filter(planet => planet.capital)) {
    assert.ok(path.slice(-2).some(exit => hub.some(landing => d(exit, landing) <= map.attackRange && d(landing, capital) <= map.attackRange)), 'each capital is within two captures of an exit');
  }
  const degrees = hub.map(planet => hub.filter(other => other !== planet && d(planet, other) <= map.attackRange).length);
  assert.ok(degrees.filter(degree => degree >= 3).length / hub.length >= 0.8, 'most main-area worlds offer several directions');
  assert.ok(degrees.reduce((sum, degree) => sum + degree, 0) / hub.length >= 4, 'the hub is a battlefield rather than a long chain');
});

test('chapter layouts place Pink then Blue at the center, preserve specialty systems, and put finale Pink on an edge', () => {
  const pinkMap = CHAPTER_TWO_MAPS[1], playerMap = CHAPTER_TWO_MAPS[2], fortress = CHAPTER_TWO_MAPS[3], finale = CHAPTER_TWO_MAPS[4];
  const pinkOrbit = mapOrbits(pinkMap).find(orbit => orbit.planetIds.some(id => pinkMap.planets.some(planet => planet.id === id && planet.owner === PINK)))!;
  assert.ok(Math.hypot(pinkOrbit.x - pinkMap.width / 2, pinkOrbit.y - pinkMap.height / 2) < 400);
  const player = playerMap.planets.find(planet => planet.owner === PLAYER)!;
  assert.ok(Math.hypot(player.x - playerMap.width / 2, player.y - playerMap.height / 2) < 250);
  assert.equal(playerMap.planets.filter(planet => planet.capital && planet.owner !== PLAYER).length, 3);
  assert.equal(fortress.pinkTerraforming, false);
  assert.ok(!fortress.planets.some(planet => planet.owner === PINK));
  for (const [index, orbit] of mapOrbits(fortress).entries()) {
    const worlds = fortress.planets.filter(planet => orbit.planetIds.includes(planet.id));
    assert.equal(worlds.length, 24);
    assert.ok(worlds.every(planet => planet.superweaponUnlocks?.join() === CHAPTER_TWO_WEAPONS[index]));
  }
  const pink = finale.planets.find(planet => planet.owner === PINK)!;
  assert.ok(pink.x > finale.width * 0.85 && pink.y < finale.height * 0.25);
  assert.ok([...FACTIONS, PINK].every(color => finale.planets.some(planet => planet.owner === color && planet.capital)));
});

test('direct test starts launch every Chapter 2 level and retry clears probe and construction state', () => {
  for (const [index, mode] of CHAPTER_TWO_TEST_MODE_IDS.entries()) {
    const chapter = CHAPTERS[mode];
    assert.deepEqual(chapter.maps, CHAPTER_TWO_MAPS.slice(index));
    assert.equal(launchMission(chapter, CHAPTER_TWO_MAPS.map(map => map.id)), CHAPTER_TWO_MAPS[index]);
  }
  const map = CHAPTER_TWO_MAPS[1], first = createMatch(map);
  first.bases.values().next().value!.pinkTransformSeconds = 40;
  first.conversionProbes.push({ id: 0, capitalId: 'missing', targetId: 'missing', color: PLAYER, x: 0, y: 0 });
  const retry = createMatch(map);
  assert.equal(retry.conversionProbes.length, 0);
  assert.ok([...retry.bases.values()].every(base => base.pinkTransformSeconds === undefined));
  assert.ok(map.planets.every(planet => !('pinkTransformSeconds' in planet)));
});

test('map validation rejects four weapons and sources outside the selected three', () => {
  const map = CHAPTER_TWO_MAPS[0];
  assert.throws(() => validateMap({ ...map, weapons: [...CHAPTER_TWO_WEAPONS, 'overdrive'] }), /at most three/);
  const planets = map.planets.map((planet, index) => index === 0 ? { ...planet, superweaponUnlocks: ['overdrive'] as ['overdrive'] } : planet);
  assert.throws(() => validateMap({ ...map, planets }), /outside map selection/);
});
