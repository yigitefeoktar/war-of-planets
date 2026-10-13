import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAOS_LAYOUTS, QUICK_LAYOUTS, createGeneratedMap, generateMap, mapConnected, seededRandom, validateChaosGeometry, validateQuickGeometry } from './generatedMaps';
import { FACTIONS, NEUTRAL, validateMap, type MapDefinition, type PlanetDefinition } from './campaign';
import { createMatch } from './mapLoader';
import { OrbitingGameEngine } from './orbitingEngine';
import { issueFleetOrder } from './logistics';
import { openingFrame } from './camera';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const fingerprint = (map: MapDefinition) => JSON.stringify({ planets: map.planets.map(({ id, ...planet }) => planet), orbits: map.orbits });

function captureCosts(capital: PlanetDefinition, planets: PlanetDefinition[]) {
  const remaining = new Set(planets.filter(planet => !planet.capital || planet === capital));
  const costs = new Map([[capital.id, 0]]);
  while (remaining.size) {
    const next = [...remaining].filter(planet => costs.has(planet.id)).sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
    if (!next) break;
    remaining.delete(next);
    for (const other of remaining) if (distance(next, other) <= 600) {
      costs.set(other.id, Math.min(costs.get(other.id) ?? Infinity, costs.get(next.id)! + other.ships));
    }
  }
  return (['omni', 'overdrive', 'repulse'] as const).map(weapon =>
    Math.min(...planets.filter(planet => planet.superweaponUnlocks?.includes(weapon)).map(planet => costs.get(planet.id) ?? Infinity)));
}

function routeSignature(map: MapDefinition): string {
  const neighbors = map.planets.map(planet => map.planets.map((other, i) => other !== planet && distance(planet, other) <= map.attackRange ? i : -1).filter(i => i >= 0));
  const hash = (value: string) => { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return (result >>> 0).toString(36); };
  let labels: string[] = map.planets.map(planet => planet.capital ? 'capital' : 'world');
  // Ignore coordinates, IDs, colors, costs and weapon placements. This compares
  // the route structure itself, rather than counting cosmetic seed changes.
  for (let round = 0; round < 6; round++) labels = labels.map((label, i) => hash(`${label}:${neighbors[i].map(n => labels[n]).sort().join(',')}`));
  return labels.sort().join(':');
}

test('1000 Quick seeds preserve frontlines, equal opening costs and substantially varied routes', t => {
  const fingerprints = new Set<string>(), counts = new Set<number>(), graphs = new Set<string>();
  const families = QUICK_LAYOUTS.map(() => new Set<string>());
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('quick-match', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.doesNotThrow(() => validateQuickGeometry(map));
    assert.ok(!map.orbit && !map.orbits);
    assert.ok(map.planets.length >= 45 && map.planets.length <= 95);
    assert.equal(map.generated?.mode, 'quick-match');
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    const costs = capitals.map(capital => {
      assert.equal(capital.ships, 200);
      const neighbors = map.planets.filter(planet => planet !== capital && distance(planet, capital) <= 600);
      assert.equal(neighbors.length, 2);
      assert.ok(neighbors.every(planet => planet.owner === NEUTRAL && planet.ships <= 18 && !planet.superweaponUnlocks));
      return captureCosts(capital, map.planets);
    });
    costs.forEach(cost => assert.deepEqual(cost, costs[0]));
    assert.ok(costs[0].every(cost => Number.isFinite(cost) && cost > 18));
    for (let index = 0; index < map.planets.length; index++) {
      const planet = map.planets[index];
      const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= 600);
      assert.ok(neighbors.length >= 1 && neighbors.length <= 4);
      for (const other of map.planets.slice(index + 1)) {
        const d = distance(planet, other);
        assert.ok(d >= 500);
        assert.ok(d <= 575 || d >= 650, 'An edge sits too close to the attack threshold');
      }
      // No triangles: enemies must advance along a route, rather than jumping
      // diagonally across the planet being defended.
      for (const a of neighbors) for (const b of neighbors) if (a !== b) assert.ok(distance(a, b) > 600);
    }
    for (const capital of capitals) {
      const prefix = /^home-\d+-/.exec(capital.id)![0];
      const gates = map.planets.filter(planet => planet.id.startsWith(prefix) && /-gate(?:-[ab])?$/.test(planet.id));
      const remaining = map.planets.filter(planet => !gates.includes(planet));
      assert.equal(mapConnected(remaining), false, 'Home worlds are reachable around their frontier');
      assert.ok(mapConnected(map.planets.filter(planet => planet !== capital)), 'Capital elimination strands routes');
    }
    fingerprints.add(fingerprint(map)); counts.add(map.planets.length);
    const signature = routeSignature(map);
    graphs.add(signature); families[seed % QUICK_LAYOUTS.length].add(signature);
  }
  assert.equal(fingerprints.size, 1000);
  assert.ok(counts.size >= 8);
  assert.ok(graphs.size >= 200, `Only ${graphs.size} different route structures`);
  families.forEach((signatures, index) => assert.ok(signatures.size >= 40, `${QUICK_LAYOUTS[index]} has only ${signatures.size} route structures`));
  t.diagnostic(`1000 Quick maps: ${Math.round(performance.now() - started)}ms; ${counts.size} planet counts, ${graphs.size} route structures; per family ${families.map(f => f.size).join(', ')}.`);
});

test('1000 Chaos seeds have weapons on every world and certified non-overlapping orbit networks', t => {
  const fingerprints = new Set<string>(), starCounts = new Set<number>(), planetCounts = new Set<number>();
  const families = CHAOS_LAYOUTS.map(() => new Set<string>());
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('chaos-mode', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.doesNotThrow(() => validateChaosGeometry(map));
    assert.ok(map.planets.length >= 56 && map.planets.length <= 144);
    assert.equal(new Set(map.orbits!.flatMap(orbit => orbit.planetIds)).size, map.planets.length);
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    assert.ok(capitals.every(planet => planet.ships === 200));
    capitals.forEach(capital => {
      assert.deepEqual(capital.superweaponUnlocks, capitals[0].superweaponUnlocks);
      assert.ok(map.planets.filter(planet => planet !== capital && planet.ships <= 16 && distance(planet, capital) <= 600).length >= 3);
      assert.ok(capitals.filter(other => other !== capital).every(other => distance(other, capital) > 1200));
    });
    for (const planet of map.planets) {
      assert.ok(planet.superweaponUnlocks!.length >= 1 && planet.superweaponUnlocks!.length <= 2);
      assert.equal(new Set(planet.superweaponUnlocks).size, planet.superweaponUnlocks!.length);
    }
    for (const orbit of map.orbits!) {
      const members = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
      assert.ok(orbit.periodSeconds >= 220 && orbit.periodSeconds <= 360);
      assert.equal(orbit.dysonSphere, undefined);
      for (let index = 0; index < members.length; index++) {
        const planet = members[index], radius = distance(planet, orbit);
        assert.ok(radius >= 200);
        assert.ok(radius + 80 <= Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y));
        for (const other of members.slice(index + 1)) assert.ok(distance(planet, other) >= 450);
      }
    }
    const first = map.orbits![0];
    const radius = Math.max(...map.planets.filter(planet => first.planetIds.includes(planet.id)).map(planet => distance(planet, first)));
    const starMap: MapDefinition = { ...map, attackRange: radius * 2 + map.attackRange, planets: map.orbits!.map((orbit, index) => ({ id: `star-${index}`, x: orbit.x, y: orbit.y, owner: NEUTRAL, ships: 0, capital: map.planets.some(planet => planet.capital && orbit.planetIds.includes(planet.id)) })) };
    families[seed % CHAOS_LAYOUTS.length].add(routeSignature(starMap));
    fingerprints.add(fingerprint(map)); starCounts.add(map.orbits!.length); planetCounts.add(map.planets.length);
  }
  assert.equal(fingerprints.size, 1000);
  assert.deepEqual([...starCounts].sort((a, b) => a - b), [4, 5, 6, 7, 8]);
  assert.ok(planetCounts.size > 60);
  families.forEach((structures, i) => assert.ok(structures.size >= 10, `${CHAOS_LAYOUTS[i]} has only ${structures.size} star route structures`));
  t.diagnostic(`1000 Chaos maps: ${Math.round(performance.now() - started)}ms; ${planetCounts.size} planet counts; star route structures per family ${families.map(f => f.size).join(', ')}.`);
});

test('Chaos connects through independently varied orbit phases even after all rival capitals disappear', () => {
  const random = seededRandom(2026);
  for (let seed = 0; seed < 100; seed++) {
    const map = generateMap('chaos-mode', seed);
    for (let sample = 0; sample < 30; sample++) {
      const phases = map.orbits!.map(orbit => ({ ...orbit, phase: random() * Math.PI * 2 }));
      const planets = map.planets.map(planet => {
        const orbit = phases.find(orbit => orbit.planetIds.includes(planet.id))!;
        const x = planet.x - orbit.x, y = planet.y - orbit.y;
        return { ...planet, x: orbit.x + x * Math.cos(orbit.phase) - y * Math.sin(orbit.phase), y: orbit.y + x * Math.sin(orbit.phase) + y * Math.cos(orbit.phase) };
      });
      assert.ok(mapConnected(planets), `Seed ${seed}, phase ${sample}`);
      assert.ok(mapConnected(planets.filter(planet => !planet.capital || planet.owner === FACTIONS[0])), `Elimination strands seed ${seed}, phase ${sample}`);
      for (let i = 0; i < planets.length; i++) {
        const neighbors = planets.filter(other => other !== planets[i] && distance(planets[i], other) <= 600);
        assert.ok(neighbors.length <= 6, `Crowded orbital front, seed ${seed}, phase ${sample}`);
        for (const other of planets.slice(i + 1)) assert.ok(distance(planets[i], other) >= 450 - 1e-5, `Orbit spacing, seed ${seed}, phase ${sample}`);
      }
      for (const capital of planets.filter(planet => planet.capital)) {
        const orbit = phases.find(orbit => orbit.planetIds.includes(capital.id))!;
        assert.ok(planets.filter(planet => !orbit.planetIds.includes(planet.id)).every(other => distance(capital, other) > 600), 'An enemy system can attack past the outer frontier');
      }
    }
  }
});

test('seeds reproduce the complete opening; Play Again resets fleets, charges, ownership and orbit phase', () => {
  for (const mode of ['quick-match', 'chaos-mode'] as const) for (let seed = 0; seed < 20; seed++) {
    const map = generateMap(mode, seed), original = structuredClone(map);
    assert.deepEqual(generateMap(mode, seed), map);
    const first = createMatch(map, { hardMode: true });
    first.lastAITime = first.lastSpawnTime = Number.MAX_SAFE_INTEGER;
    first.pixels = [];
    first.update(47);
    first.bases.values().next().value!.color = FACTIONS[0];
    first.setSuperweaponCharge(FACTIONS[0], 'omni', 1);
    const again = createMatch(map, { hardMode: true });
    assert.equal(again.isHardMode, true);
    assert.equal(again.multiSelectEnabled, true);
    assert.equal(again instanceof OrbitingGameEngine, mode === 'chaos-mode');
    for (const planet of map.planets) {
      const base = again.bases.get(planet.id)!;
      assert.deepEqual([base.x, base.y, base.color, base.pixelCount, !!base.isCapital, base.superweaponUnlocks ?? []],
        [planet.x, planet.y, planet.owner, planet.ships, !!planet.capital, planet.superweaponUnlocks ?? []]);
    }
    assert.equal(again.getSuperweaponCharge(FACTIONS[0], 'omni'), 0);
    assert.deepEqual(map, original);
  }
});

test('New Map varies geometry and family on every launch, with corrupt or blocked storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cases = ['{', 'null', '{}', '{"quick-match":{"seed":-1,"layout":999}}', '{"chaos-mode":{"seed":"x","layout":null}}'];
  try {
    for (const bad of cases) {
      let saved = bad;
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
      for (const mode of ['quick-match', 'chaos-mode'] as const) {
        const layouts = mode === 'quick-match' ? QUICK_LAYOUTS : CHAOS_LAYOUTS;
        const fingerprints = new Set<string>();
        let previous: MapDefinition | undefined;
        for (let index = 0; index < 30; index++) {
          const map = createGeneratedMap(mode);
          assert.ok(layouts.includes(map.generated!.layout as never));
          if (previous) {
            assert.notEqual(map.generated!.seed, previous.generated!.seed);
            assert.notEqual(map.generated!.layout, previous.generated!.layout);
          }
          fingerprints.add(fingerprint(map)); previous = map;
        }
        assert.equal(fingerprints.size, 30);
      }
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } } });
    for (const mode of ['quick-match', 'chaos-mode'] as const) {
      const a = createGeneratedMap(mode), b = createGeneratedMap(mode);
      assert.notEqual(a.generated!.layout, b.generated!.layout);
      assert.notEqual(fingerprint(a), fingerprint(b));
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('New Map consumes all four families before refilling its shuffled bag', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = '{}';
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
    for (const mode of ['quick-match', 'chaos-mode'] as const) {
      let previous = createGeneratedMap(mode);
      for (let i = 0; i < 20; i++) {
        const before = JSON.parse(saved)[mode] as { layout: number; remaining: number[] };
        const next = createGeneratedMap(mode);
        const after = JSON.parse(saved)[mode] as { layout: number; remaining: number[] };
        assert.notEqual(next.generated!.layout, previous.generated!.layout);
        if (before.remaining.length) {
          assert.equal(after.layout, before.remaining[0]);
          assert.deepEqual(after.remaining, before.remaining.slice(1));
        } else assert.equal(new Set([after.layout, ...after.remaining]).size, 4);
        previous = next;
      }
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('generation certifies boundary seeds and 1024 distributed 32-bit seeds', () => {
  const random = seededRandom(0xC0FFEE);
  const seeds = [0, 1, 0x7FFFFFFF, 0x80000000, 0xFFFFFFFF, ...Array.from({ length: 1024 }, () => Math.floor(random() * 4294967296))];
  for (const seed of seeds) for (const mode of ['quick-match', 'chaos-mode'] as const) assert.doesNotThrow(() => generateMap(mode, seed), `${mode}, seed ${seed}`);
});

test('real fleets capture an affordable opening world on stationary and moving generated maps', () => {
  for (const mode of ['quick-match', 'chaos-mode'] as const) for (let seed = 0; seed < 5; seed++) {
    const map = generateMap(mode, seed);
    const engine = createMatch(map, { hardMode: seed % 2 === 0 });
    engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
    const capital = [...engine.bases.values()].find(base => base.isCapital && base.color === FACTIONS[0])!;
    const target = [...engine.bases.values()].filter(base => base.color === NEUTRAL && base.pixelCount <= 18 && distance(base, capital) <= 600)
      .sort((a, b) => distance(a, capital) - distance(b, capital))[0];
    assert.ok(target);
    engine.pixels = engine.pixels.filter(ship => ship.baseId === capital.id || ship.baseId === target.id);
    assert.equal(issueFleetOrder(engine, capital.id, target.id, 0.5), true);
    for (let step = 0; step < 2400 && target.color !== FACTIONS[0]; step++) engine.update(1 / 60);
    assert.equal(target.color, FACTIONS[0], `${mode}, seed ${seed}`);
    for (const weapon of target.superweaponUnlocks ?? []) assert.ok(engine.getSuperweaponSourceCount(FACTIONS[0], weapon) > 0);
    for (const view of [{ width: 1280, height: 720, top: 110, bottom: 125 }, { width: 390, height: 844, top: 90, bottom: 220 }]) {
      const frame = openingFrame(view, map, capital, [...engine.bases.values()]);
      assert.equal(frame.focusX, capital.x); assert.equal(frame.focusY, capital.y);
      assert.ok(Number.isFinite(frame.zoom) && frame.zoom > 0);
    }
  }
});

test('the geometry certificate rejects missing orbit membership, missing weapons and overlapping systems', () => {
  const map = generateMap('chaos-mode', 101);
  const missingOrbit = structuredClone(map);
  missingOrbit.orbits![0].planetIds.pop();
  assert.throws(() => validateChaosGeometry(missingOrbit), /Every Chaos world/);
  const missingWeapons = structuredClone(map);
  missingWeapons.planets[0].superweaponUnlocks = [];
  assert.throws(() => validateChaosGeometry(missingWeapons), /one or two weapons/);
  const overlapping = structuredClone(map);
  const from = overlapping.orbits![1], to = overlapping.orbits![0];
  overlapping.planets.filter(planet => from.planetIds.includes(planet.id)).forEach(planet => {
    planet.x += to.x - from.x; planet.y += to.y - from.y;
  });
  from.x = to.x; from.y = to.y;
  assert.throws(() => validateChaosGeometry(overlapping), /overlap/);
  const crowded = structuredClone(map);
  const orbit = crowded.orbits![0];
  const a = crowded.planets.find(planet => planet.id === orbit.planetIds[0])!;
  const b = crowded.planets.find(planet => planet.id === orbit.planetIds[1])!;
  b.x = a.x + 100; b.y = a.y;
  assert.throws(() => validateChaosGeometry(crowded));
});

test('continuous-phase certificate rejects a bridge that connects initially but closes later', () => {
  const map: MapDefinition = {
    id: 'unsafe-orbit-bridge', title: 'Unsafe', briefing: '', width: 6000, height: 4000, attackRange: 600,
    objective: { type: 'eliminate-capitals', description: '' }, planets: [], orbits: [],
  };
  for (let system = 0; system < 2; system++) {
    const orbit = { x: 1400 + system * 2300, y: 2000, periodSeconds: 300, planetIds: [] as string[] };
    for (let ring = 0; ring < 2; ring++) for (let index = 0; index < (ring ? 4 : 10); index++) {
      const theta = index * Math.PI * 2 / (ring ? 4 : 10), radius = ring ? 380 : 900, capital = ring === 1 && index === 0;
      const planet: PlanetDefinition = { id: `${system}-${ring}-${index}`, x: orbit.x + radius * Math.cos(theta), y: orbit.y + radius * Math.sin(theta), ships: 20, owner: capital ? FACTIONS[system] : NEUTRAL, superweaponUnlocks: ['omni'], ...(capital ? { capital: true } : {}) };
      map.planets.push(planet); orbit.planetIds.push(planet.id);
    }
    map.orbits!.push(orbit);
  }
  assert.doesNotThrow(() => validateMap(map));
  assert.throws(() => validateChaosGeometry(map), /lose their connections/);
  const orbit = map.orbits![0], angle = Math.PI / 10;
  for (const planet of map.planets.filter(planet => orbit.planetIds.includes(planet.id))) {
    const x = planet.x - orbit.x, y = planet.y - orbit.y;
    planet.x = orbit.x + x * Math.cos(angle) - y * Math.sin(angle);
    planet.y = orbit.y + x * Math.sin(angle) + y * Math.cos(angle);
  }
  assert.equal(mapConnected(map.planets), false);
});
