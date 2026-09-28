import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canIssueFleetOrder, connectedFriendlyIds, issueFleetOrder } from './logistics';
import { PLAYER } from './campaign';
import { GameEngine } from './engine';
import type { Base } from './types';

const RED = '#ef4444';
const planet = (id: string, x: number, color = PLAYER): Base => ({ id, x, y: 0, color, pixelCount: 10 });

test('friendly ships can transfer without a direct distance limit through a connected chain', () => {
  const bases = [planet('a', 0), planet('b', 500), planet('c', 1000)];
  assert.deepEqual([...connectedFriendlyIds(bases, 'a', 600)], ['a', 'b', 'c']);
  assert.equal(canIssueFleetOrder(bases, 'a', 'c', 600), true);
});

test('friendly transfer fails when no friendly chain connects the planets', () => {
  const bases = [planet('a', 0), planet('b', 500), planet('c', 1200)];
  assert.deepEqual([...connectedFriendlyIds(bases, 'a', 600)], ['a', 'b']);
  assert.equal(canIssueFleetOrder(bases, 'a', 'c', 600), false);
});

test('hostile and neutral attacks always use source-to-target range, not the friendly network', () => {
  const bases = [planet('a', 0), planet('bridge', 500), planet('red-near-bridge', 1000, RED), planet('neutral-near', 550, '#6b7280')];
  assert.equal(canIssueFleetOrder(bases, 'a', 'red-near-bridge', 600), false);
  assert.equal(canIssueFleetOrder(bases, 'bridge', 'red-near-bridge', 600), true);
  assert.equal(canIssueFleetOrder(bases, 'a', 'neutral-near', 600), true);
});

test('capturing a bridge immediately changes which friendly transfers are legal', () => {
  const bases = [planet('a', 0), planet('bridge', 500), planet('c', 1000)];
  assert.equal(canIssueFleetOrder(bases, 'a', 'c', 600), true);
  bases[1].color = RED;
  assert.equal(canIssueFleetOrder(bases, 'a', 'c', 600), false);
});

test('an issued long-distance transfer keeps travelling after its network breaks', () => {
  const engine = new GameEngine(1600, 800);
  engine.bases.clear(); engine.pixels = []; engine.nextPixelId = 0; engine.MAX_ATTACK_RANGE = 600;
  engine.addBase('a', 100, 400, PLAYER, 20);
  engine.addBase('bridge', 600, 400, PLAYER, 1);
  engine.addBase('c', 1100, 400, PLAYER, 1);
  assert.equal(issueFleetOrder(engine, 'a', 'c', 1), true);
  const launched = engine.pixels.filter(ship => ship.baseId === 'a' && ship.state === 'moving');
  assert.equal(launched.length, 20);
  engine.bases.get('bridge')!.color = RED;
  assert.equal(canIssueFleetOrder(engine.bases.values(), 'a', 'c', 600), false);
  engine.lastAITime = Number.MAX_SAFE_INTEGER; engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  const x = launched[0].x;
  engine.update(1 / 60);
  assert.ok(launched[0].x > x);
  assert.equal(launched[0].targetBaseId, 'c');
});

test('invalid, missing and same-planet orders are rejected without launching ships', () => {
  const engine = new GameEngine(1000, 1000);
  const movingBefore = engine.pixels.filter(ship => ship.state === 'moving').length;
  assert.equal(issueFleetOrder(engine, 'player_1', 'player_1', 1), false);
  assert.equal(issueFleetOrder(engine, 'missing', 'player_1', 1), false);
  assert.equal(issueFleetOrder(engine, 'player_1', 'missing', 1), false);
  assert.equal(engine.pixels.filter(ship => ship.state === 'moving').length, movingBefore);
});

test('a full launch keeps a small garrison when hostile ships are inbound', () => {
  const engine = new GameEngine(1200, 800);
  engine.bases.clear(); engine.pixels = []; engine.nextPixelId = 0;
  engine.addBase('source', 100, 400, PLAYER, 20);
  engine.addBase('target', 300, 400, RED, 1);
  engine.addBase('enemy', 500, 400, RED, 1);
  engine.sendUnits('enemy', 'source', 1);
  const attacker = engine.pixels.find(ship => ship.baseId === 'enemy' && ship.state === 'moving')!;
  attacker.x = 101; attacker.y = 400;

  assert.equal(issueFleetOrder(engine, 'source', 'target', 1), true);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'source' && ship.state === 'idle').length, 2);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'source' && ship.state === 'moving').length, 18);
  engine.lastAITime = Number.MAX_SAFE_INTEGER; engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.update(1 / 60);
  assert.equal(engine.bases.get('source')!.color, PLAYER);
});

test('a full launch still sends every ship when no hostile fleet is inbound', () => {
  const engine = new GameEngine(1200, 800);
  engine.bases.clear(); engine.pixels = []; engine.nextPixelId = 0;
  engine.addBase('source', 100, 400, PLAYER, 20);
  engine.addBase('target', 300, 400, RED, 1);
  engine.addBase('enemy', 500, 400, RED, 1);
  engine.sendUnits('enemy', 'target', 1);

  assert.equal(issueFleetOrder(engine, 'source', 'target', 1), true);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'source' && ship.state === 'idle').length, 0);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'source' && ship.state === 'moving').length, 20);
});
