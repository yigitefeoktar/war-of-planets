import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, FACTIONS, getOutcome, NEUTRAL, PLAYER, THE_PINCER, validateMap, type PlanetDefinition } from './campaign';
import { createMatch } from './mapLoader';
import { canIssueFleetOrder, issueFleetOrder } from './logistics';
import { TacticalAI } from './ai';

const map = THE_PINCER;
const branches = ['red', 'overdrive', 'green', 'omni', 'yellow', 'repulse'];
const enemyBranches = ['red', 'green', 'yellow'];
const hubIds = ['pincer-home', ...branches.map(name => `pincer-hub-${name}`)];
const branchWorlds = (name: string) => map.planets.filter(planet => planet.id.startsWith(`pincer-${name}-`));
const byId = (id: string) => map.planets.find(planet => planet.id === id)!;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const edgeKey = (a: string, b: string) => [a, b].sort().join('|');

function reachable(planets: PlanetDefinition[], sourceId: string) {
  const reached = new Set([sourceId]);
  const queue = [planets.find(planet => planet.id === sourceId)!];
  for (let index = 0; index < queue.length; index++) for (const planet of planets) {
    if (!reached.has(planet.id) && distance(queue[index], planet) <= map.attackRange) {
      reached.add(planet.id); queue.push(planet);
    }
  }
  return reached;
}

function quietEngine() {
  const engine = createMatch(map);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  return engine;
}

test('The Pincer opens with one blue capital and three enemies holding a capital and rear row', () => {
  validateMap(map);
  assert.deepEqual([map.width, map.height, map.planets.length, map.attackRange], [6000, 6000, 58, 600]);
  assert.equal(map.orbit, undefined);
  assert.equal(map.orbits, undefined);
  assert.equal(CHAPTERS['chapter-1-test-4'].maps[0], map);
  assert.deepEqual([byId('pincer-home').x, byId('pincer-home').y], [map.width / 2, map.height / 2]);
  for (const [index, owner] of FACTIONS.entries()) {
    const owned = map.planets.filter(planet => planet.owner === owner);
    assert.equal(owned.length, index === 0 ? 1 : 4);
    const capital = owned.find(planet => planet.capital)!;
    assert.equal(capital.ships, index === 0 ? 360 : 220);
    const neighbors = map.planets.filter(planet => planet.id !== capital.id && distance(capital, planet) <= map.attackRange);
    const neutralNeighbors = neighbors.filter(planet => planet.owner === NEUTRAL);
    assert.equal(neighbors.length, index === 0 ? 6 : 4);
    assert.equal(neutralNeighbors.length, index === 0 ? 6 : 3);
    if (index > 0) {
      const name = enemyBranches[index - 1];
      assert.deepEqual(owned.map(planet => planet.id), ['capital', 'left-back', 'back', 'right-back'].map(suffix => `pincer-${name}-${suffix}`));
      assert.ok(neutralNeighbors.every(planet => planet.ships <= 16));
      assert.ok(owned.filter(planet => !planet.capital).every(planet => planet.ships <= 16));
    }
  }
  assert.equal(map.planets.filter(planet => planet.owner === NEUTRAL).length, 45);
  const home = byId('pincer-home');
  const directions = enemyBranches.map(name => {
    const capital = byId(`pincer-${name}-capital`);
    return { x: capital.x - home.x, y: capital.y - home.y };
  });
  for (let index = 0; index < 3; index++) {
    const a = directions[index], b = directions[(index + 1) % 3];
    assert.ok(Math.abs((a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)) + 0.5) < 1e-6);
  }
});

test('every in-range pair is an intended hub, entrance, or neighboring branch link', () => {
  // Independent topology specification: exhaustive equality catches any shortcut,
  // including across branches, past a gate, or diagonally past a frontline.
  const expected = new Set<string>();
  const link = (a: string, b: string) => expected.add(edgeKey(a, b));
  for (const [index, name] of branches.entries()) {
    const hub = `pincer-hub-${name}`, prefix = `pincer-${name}-`;
    const rear = enemyBranches.includes(name) ? 'capital' : 'vault';
    link('pincer-home', hub);
    link(hub, `pincer-hub-${branches[(index + 1) % 6]}`);
    link(hub, `${prefix}entry`);
    for (const [a, b] of [
      ['entry', 'gate'], ['gate', rear],
      ['gate', 'left-front'], ['gate', 'right-front'],
      [rear, 'left-rear'], [rear, 'right-rear'],
      ['left-front', 'left-rear'], ['right-front', 'right-rear'],
    ]) link(prefix + a, prefix + b);
    if (enemyBranches.includes(name)) for (const [a, b] of [
      ['left-rear', 'left-back'], ['capital', 'back'], ['right-rear', 'right-back'],
      ['left-back', 'back'], ['back', 'right-back'],
    ]) link(prefix + a, prefix + b);
  }
  const actual = new Set<string>();
  for (let index = 0; index < map.planets.length; index++) for (const second of map.planets.slice(index + 1)) {
    const first = map.planets[index], key = edgeKey(first.id, second.id);
    if (distance(first, second) <= map.attackRange) actual.add(key);
    // Leave a mechanical and visual margin on both sides of the range boundary.
    assert.ok(expected.has(key) ? distance(first, second) <= 560.001 : distance(first, second) >= 700, key);
  }
  assert.deepEqual([...actual].sort(), [...expected].sort());
  assert.equal(reachable(map.planets, 'pincer-home').size, map.planets.length);
});

test('removing the hub leaves six isolated branches with ten enemy worlds or seven weapon worlds', () => {
  const outer = map.planets.filter(planet => !hubIds.includes(planet.id));
  const unseen = new Set(outer.map(planet => planet.id));
  const components: Set<string>[] = [];
  while (unseen.size) {
    const component = reachable(outer, unseen.values().next().value!);
    components.push(component);
    for (const id of component) unseen.delete(id);
  }
  assert.equal(components.length, 6);
  for (const name of branches) {
    const group = branchWorlds(name);
    const size = enemyBranches.includes(name) ? 10 : 7;
    assert.equal(group.length, size);
    assert.ok(components.some(component => component.size === size && group.every(planet => component.has(planet.id))));
    for (const other of branches.filter(other => other !== name)) for (const a of group) for (const b of branchWorlds(other)) {
      assert.ok(distance(a, b) > map.attackRange);
    }
  }
});

test('each enemy has a square three-by-three block extending behind its unchanged capital row', () => {
  const home = byId('pincer-home');
  for (const name of enemyBranches) {
    const capital = byId(`pincer-${name}-capital`);
    const dx = (capital.x - home.x) / 2200, dy = (capital.y - home.y) / 2200;
    const rows = [
      ['left-front', 'gate', 'right-front'],
      ['left-rear', 'capital', 'right-rear'],
      ['left-back', 'back', 'right-back'],
    ];
    for (const [row, suffixes] of rows.entries()) for (const [column, suffix] of suffixes.entries()) {
      const planet = byId(`pincer-${name}-${suffix}`);
      const outward = (planet.x - home.x) * dx + (planet.y - home.y) * dy;
      const sideways = -(planet.x - home.x) * dy + (planet.y - home.y) * dx;
      assert.ok(Math.abs(outward - (1640 + row * 560)) < 1e-6);
      assert.ok(Math.abs(sideways - (column - 1) * 520) < 1e-6);
      if (row === 2) {
        assert.equal(planet.owner, capital.owner);
        assert.equal(planet.capital, undefined);
        assert.equal(planet.superweaponUnlocks, undefined);
      }
    }
  }
});

test('each entrance and gate must be crossed before reaching the outer territory', () => {
  for (const name of branches) {
    const entryId = `pincer-${name}-entry`, gateId = `pincer-${name}-gate`;
    const afterEntryRemoved = reachable(map.planets.filter(planet => planet.id !== entryId), 'pincer-home');
    assert.ok(branchWorlds(name).filter(planet => planet.id !== entryId).every(planet => !afterEntryRemoved.has(planet.id)));
    const afterGateRemoved = reachable(map.planets.filter(planet => planet.id !== gateId), 'pincer-home');
    assert.ok(afterGateRemoved.has(entryId));
    assert.ok(branchWorlds(name).filter(planet => planet.id !== entryId && planet.id !== gateId).every(planet => !afterGateRemoved.has(planet.id)));
  }
});

test('fleet orders and Omni Strike cannot skip the hub shield, branch entrance, or enemy gate', () => {
  for (const name of enemyBranches) {
    const engine = quietEngine();
    const hub = `pincer-hub-${name}`, entry = `pincer-${name}-entry`, gate = `pincer-${name}-gate`, capital = `pincer-${name}-capital`;
    assert.equal(canIssueFleetOrder(engine.bases.values(), 'pincer-home', hub, engine.MAX_ATTACK_RANGE), true);
    assert.equal(issueFleetOrder(engine, 'pincer-home', entry, 0.5), false);
    assert.equal(engine.canOmniStrike(PLAYER, entry), false);
    engine.bases.get(hub)!.color = PLAYER;
    assert.equal(engine.canOmniStrike(PLAYER, entry), true);
    assert.equal(engine.canOmniStrike(PLAYER, gate), false);
    assert.equal(canIssueFleetOrder(engine.bases.values(), hub, gate, engine.MAX_ATTACK_RANGE), false);
    engine.bases.get(entry)!.color = PLAYER;
    assert.equal(engine.canOmniStrike(PLAYER, gate), true);
    assert.equal(engine.canOmniStrike(PLAYER, capital), false);
    assert.equal(canIssueFleetOrder(engine.bases.values(), entry, capital, engine.MAX_ATTACK_RANGE), false);
    engine.bases.get(gate)!.color = PLAYER;
    assert.equal(engine.canOmniStrike(PLAYER, capital), true);
    assert.equal(canIssueFleetOrder(engine.bases.values(), gate, capital, engine.MAX_ATTACK_RANGE), true);
  }
});

test('the shield hub and two weapon branches charge normally while the northeast branch has no Overdrive', () => {
  assert.ok(hubIds.every(id => byId(id).superweaponUnlocks?.includes('repulse')));
  for (const name of ['omni', 'repulse'] as const) {
    const group = branchWorlds(name);
    assert.ok(group.every(planet => planet.owner === NEUTRAL && !planet.capital));
    assert.ok(group.every(planet => planet.superweaponUnlocks?.length === 1 && planet.superweaponUnlocks[0] === name));
  }
  assert.ok(branchWorlds('overdrive').every(planet => !planet.superweaponUnlocks?.length));
  const engine = quietEngine();
  engine.pixels = [];
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 1);
  for (const color of FACTIONS.slice(1)) assert.equal(engine.getOwnedSuperweapons(color).size, 0);
  engine.update(60);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 1);
  assert.equal(engine.activatePlanetAbility(PLAYER, 'pincer-home', 'repulse'), true);
  for (const id of hubIds) engine.bases.get(id)!.color = PLAYER;
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 7);
  engine.update(8);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 1);
  for (const name of ['overdrive', 'omni'] as const) for (const planet of branchWorlds(name)) engine.bases.get(planet.id)!.color = PLAYER;
  engine.update(9);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'omni'), 1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
});

test('blue can capture its first neutral shield and each enemy has a legal opening expansion', () => {
  const engine = quietEngine();
  const ai = new TacticalAI();
  const plans = ai.plan({
    bases: [...engine.bases.values()], pixels: engine.pixels, range: engine.MAX_ATTACK_RANGE,
    seconds: 0, hard: false, canOmni: () => false, canAbility: () => false, random: () => 0.5,
  });
  for (const [index, name] of enemyBranches.entries()) {
    const orders = plans.get(FACTIONS[index + 1])!.orders;
    assert.ok(orders.length > 0);
    assert.ok(orders.some(order => order.from === `pincer-${name}-capital`));
    for (const order of orders) {
      assert.equal(byId(order.from).owner, FACTIONS[index + 1]);
      assert.ok(branchWorlds(name).some(planet => planet.id === order.to));
      assert.ok(canIssueFleetOrder(engine.bases.values(), order.from, order.to, engine.MAX_ATTACK_RANGE));
    }
  }
  assert.equal(issueFleetOrder(engine, 'pincer-home', 'pincer-hub-red', 0.5), true);
  for (let step = 0; step < 2400 && engine.bases.get('pincer-hub-red')!.color !== PLAYER; step++) engine.update(1 / 60);
  assert.equal(engine.bases.get('pincer-hub-red')!.color, PLAYER);
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 2);
  assert.equal(engine.bases.get('pincer-home')!.isCapital, true);
});

test('all three enemy capitals must fall while blue survives', () => {
  const engine = quietEngine();
  assert.equal(getOutcome(engine.bases.values()), null);
  for (const [index, name] of enemyBranches.entries()) {
    engine.bases.get(`pincer-${name}-capital`)!.isCapital = false;
    assert.equal(getOutcome(engine.bases.values()), index < 2 ? null : 'victory');
  }
  engine.bases.get('pincer-home')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'defeat');
});
