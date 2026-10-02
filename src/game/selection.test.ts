import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyPlanetsInRectangle } from './selection';
import { issueFriendlyGroupOrder } from './logistics';
import { GameEngine } from './engine';
import type { Base } from './types';

const PLAYER = '#3b82f6', ENEMY = '#ef4444';
const planet = (id: string, x: number, y: number, color = PLAYER): Base => ({ id, x, y, color, pixelCount: 20 });

test('box selection includes only friendly centers, with inclusive edges in every drag direction', () => {
  const bases = [planet('inside', 50, 50), planet('edge', 100, 100), planet('outside', 101, 50), planet('enemy', 50, 50, ENEMY), planet('neutral', 50, 50, '#6b7280')];
  for (const [start, end] of [
    [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    [{ x: 100, y: 100 }, { x: 0, y: 0 }],
    [{ x: 100, y: 0 }, { x: 0, y: 100 }],
    [{ x: 0, y: 100 }, { x: 100, y: 0 }],
  ]) assert.deepEqual([...friendlyPlanetsInRectangle(bases, start, end, PLAYER)], ['inside', 'edge']);
});

test('live box selection removes planets when the rectangle shrinks or ownership changes', () => {
  const bases = [planet('a', 50, 50), planet('b', 100, 100)];
  assert.equal(friendlyPlanetsInRectangle(bases, { x: 0, y: 0 }, { x: 100, y: 100 }, PLAYER).size, 2);
  assert.deepEqual([...friendlyPlanetsInRectangle(bases, { x: 0, y: 0 }, { x: 60, y: 60 }, PLAYER)], ['a']);
  bases[0].color = ENEMY;
  assert.equal(friendlyPlanetsInRectangle(bases, { x: 0, y: 0 }, { x: 60, y: 60 }, PLAYER).size, 0);
});

function match() {
  const engine = new GameEngine(2000, 1000);
  engine.bases.clear(); engine.pixels = []; engine.nextPixelId = 0; engine.MAX_ATTACK_RANGE = 600;
  engine.addBase('a', 100, 400, PLAYER, 20);
  engine.addBase('b', 600, 400, PLAYER, 20);
  engine.addBase('target', 1100, 400, PLAYER, 20);
  engine.addBase('disconnected', 1900, 400, PLAYER, 20);
  engine.addBase('enemy', 300, 400, ENEMY, 20);
  return engine;
}

test('group transfer launches each connected source once and excludes the target and unreachable sources', () => {
  const engine = match();
  assert.equal(issueFriendlyGroupOrder(engine, ['a', 'a', 'b', 'target', 'disconnected', 'missing', 'enemy'], 'target', 0.5, PLAYER), 2);
  for (const id of ['a', 'b']) {
    const ships = engine.pixels.filter(ship => ship.baseId === id && ship.state === 'moving');
    assert.equal(ships.length, 10);
    assert.ok(ships.every(ship => ship.targetBaseId === 'target'));
  }
  for (const id of ['target', 'disconnected', 'enemy']) assert.equal(engine.pixels.filter(ship => ship.baseId === id && ship.state === 'moving').length, 0);
});

test('group orders reject enemy, neutral, missing, and newly captured targets without launching any ships', () => {
  for (const target of ['enemy', 'neutral', 'missing', 'target']) {
    const engine = match();
    engine.addBase('neutral', 400, 400, '#6b7280', 20);
    engine.bases.get('target')!.color = ENEMY;
    assert.equal(issueFriendlyGroupOrder(engine, ['a', 'b'], target, 1, PLAYER), 0);
    assert.equal(engine.pixels.filter(ship => ship.state === 'moving').length, 0);
  }
});

test('a source captured after selection cannot send a group fleet', () => {
  const engine = match();
  engine.bases.get('a')!.color = ENEMY;
  assert.equal(issueFriendlyGroupOrder(engine, ['a', 'b'], 'target', 1, PLAYER), 1);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'a' && ship.state === 'moving').length, 0);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'b' && ship.state === 'moving').length, 20);
});

test('group transfers preserve threatened-planet garrisons with the full fleet setting', () => {
  const engine = match();
  engine.sendUnits('enemy', 'a', 1);
  assert.equal(issueFriendlyGroupOrder(engine, ['a', 'b'], 'target', 1, PLAYER), 2);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'a' && ship.state === 'moving').length, 18);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'a' && ship.state === 'idle').length, 2);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'b' && ship.state === 'moving').length, 20);
});
