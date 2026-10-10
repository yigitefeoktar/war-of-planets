import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_BATTLEFIELD, createClassicBattlefield } from './classicMap';
import { PLAYER, validateMap, type MapDefinition } from './campaign';
import { openingFrame } from './camera';

const capitalPositions = (map: MapDefinition) => map.planets.filter(planet => planet.capital).map(planet => [planet.x, planet.y]);
const neutralPlanets = (map: MapDefinition) => map.planets.filter(planet => !planet.capital);
const slots = capitalPositions(CLASSIC_BATTLEFIELD);

function withStorage(storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('every faction changes slots on each match without moving neutral planets or changing fleets', () => {
  const original = structuredClone(CLASSIC_BATTLEFIELD);
  let saved = JSON.stringify([0, 1, 2, 3]);
  withStorage({ getItem: () => saved, setItem: (_key, value) => { saved = value; } }, () => {
    let previous = slots;
    for (let index = 0; index < 30; index++) {
      const map = createClassicBattlefield(() => index / 30);
      assert.doesNotThrow(() => validateMap(map));
      assert.equal(map.planets.length, 33);
      assert.equal(map.planets.some(planet => planet.id === 'west-landing'), false);
      assert.deepEqual(neutralPlanets(map), neutralPlanets(original));
      const positions = capitalPositions(map);
      assert.deepEqual([...positions].sort(), [...slots].sort());
      positions.forEach((position, faction) => assert.notDeepEqual(position, previous[faction]));
      for (const planet of map.planets.filter(planet => planet.capital)) {
        assert.equal(planet.ships, planet.owner === PLAYER ? 200 : 90);
      }
      previous = positions;
    }
  });
  assert.deepEqual(CLASSIC_BATTLEFIELD, original);
});

test('persisted positions drive the next shuffle and unavailable or corrupt storage stays playable', () => {
  let saved = JSON.stringify([2, 3, 0, 1]);
  withStorage({ getItem: () => saved, setItem: (_key, value) => { saved = value; } }, () => {
    const map = createClassicBattlefield(() => 0);
    const positions = capitalPositions(map);
    const previous = [slots[2], slots[3], slots[0], slots[1]];
    positions.forEach((position, index) => assert.notDeepEqual(position, previous[index]));
    assert.deepEqual(JSON.parse(saved).map((slot: number) => slots[slot]), positions);
    for (const invalid of ['{', 'null', '[0,0,0,0]', '[0,1,2,4]', '[0,1,2]', '[0,1,2,"3"]']) {
      saved = invalid;
      assert.doesNotThrow(() => validateMap(createClassicBattlefield(() => 0.5)));
    }
  });
  withStorage({ getItem: () => { throw new Error('Blocked storage'); }, setItem: () => { throw new Error('Blocked storage'); } }, () => {
    const first = capitalPositions(createClassicBattlefield(() => 0));
    const next = capitalPositions(createClassicBattlefield(() => 0));
    next.forEach((position, index) => assert.notDeepEqual(position, first[index]));
  });
});

test('the opening camera follows blue at every shuffled capital slot on desktop and phone', () => {
  for (const position of slots) {
    for (const view of [
      { width: 1280, height: 720, top: 110, bottom: 125 },
      { width: 390, height: 844, top: 90, bottom: 220 },
    ]) {
      const frame = openingFrame(view, undefined, { x: position[0], y: position[1] }, CLASSIC_BATTLEFIELD.planets);
      assert.deepEqual([frame.focusX, frame.focusY], position);
      assert.ok(Number.isFinite(frame.zoom) && frame.zoom > 0);
    }
  }
});
