import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTutorial, drawTutorialHighlights, tutorialTargets, TUTORIAL_ACCENT, TUTORIAL_PULSE_MS, TUTORIAL_POST_ATTACK_DELAY_MS, type TutorialState } from './tutorial';
import { FIRST_STRIKE, TURNING_TIDE, PLAYER, NEUTRAL, validateMap } from './campaign';
import { createMatch } from './mapLoader';

test('tutorial follows select, attack, and win-condition acknowledgement without zooming', () => {
  let state: TutorialState = { step: 'select' };
  state = advanceTutorial(state, { type: 'selection', playerSelected: true });
  assert.equal(state.step, 'attack');
  state = advanceTutorial(state, { type: 'launch', hostile: true });
  assert.equal(state.step, 'watch');
  state = advanceTutorial(state, { type: 'tick', now: TUTORIAL_POST_ATTACK_DELAY_MS });
  assert.equal(state.step, 'capitals');
  state = advanceTutorial(state, { type: 'dismiss' });
  assert.equal(state.step, 'done');
});

test('deselecting returns to selection; unrelated actions cannot advance prompts', () => {
  const start: TutorialState = { step: 'select' };
  assert.equal(advanceTutorial(start, { type: 'selection', playerSelected: false }), start);
  assert.equal(advanceTutorial(start, { type: 'tick', now: 5000 }), start);
  assert.equal(advanceTutorial(start, { type: 'launch', hostile: false }), start);
  const selected = advanceTutorial(start, { type: 'selection', playerSelected: true });
  assert.equal(advanceTutorial(selected, { type: 'selection', playerSelected: false }).step, 'select');
  // Rapid select-and-launch between animation frames must work too.
  assert.equal(advanceTutorial(start, { type: 'launch', hostile: true }).step, 'watch');
});

test('every lesson can be skipped and skipped tutorials never reopen', () => {
  for (const step of ['select', 'attack', 'watch', 'capitals'] as const) {
    const state = advanceTutorial({ step }, { type: 'dismiss' });
    assert.equal(state.step, 'done');
    assert.equal(advanceTutorial(state, { type: 'selection', playerSelected: true }), state);
  }
});

test('only mission one enables the tutorial, with a reachable weak red attack target', () => {
  assert.ok(FIRST_STRIKE.tutorial);
  assert.equal(TURNING_TIDE.tutorial, undefined);
  const engine = createMatch(FIRST_STRIKE);
  const bases = [...engine.bases.values()];
  const source = tutorialTargets({ step: 'select' }, bases, null, FIRST_STRIKE.tutorial!.attackTargetId, engine.MAX_ATTACK_RANGE)[0];
  assert.equal(source.color, PLAYER);
  const targets = tutorialTargets({ step: 'attack' }, bases, source.id, FIRST_STRIKE.tutorial!.attackTargetId, engine.MAX_ATTACK_RANGE);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].color, '#ef4444');
  assert.equal(targets[0].pixelCount, 10);
  assert.ok(Math.hypot(source.x - targets[0].x, source.y - targets[0].y) < engine.MAX_ATTACK_RANGE);
});

test('highlights follow current planet positions and ignore captured capitals', () => {
  const engine = createMatch(FIRST_STRIKE);
  const targetId = FIRST_STRIKE.tutorial!.attackTargetId;
  const before = engine.bases.get(targetId)!.x;
  engine.bases.get(targetId)!.x += 1;
  const targets = tutorialTargets({ step: 'attack' }, [...engine.bases.values()], 'player_1', targetId, engine.MAX_ATTACK_RANGE);
  assert.notEqual(targets[0].x, before);
  assert.equal(targets[0], engine.bases.get(targetId));
  assert.deepEqual(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).map(p => p.id), ['ai_1']);
  engine.bases.get('ai_1')!.color = NEUTRAL;
  assert.deepEqual(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).map(p => p.id), []);
  assert.equal(tutorialTargets({ step: 'done' }, [...engine.bases.values()], null, targetId, 600).length, 0);
});

test('tutorial map is compact, deterministic, connected and stationary', () => {
  assert.equal(FIRST_STRIKE.width, 1500);
  assert.equal(FIRST_STRIKE.height, 1500);
  assert.equal(FIRST_STRIKE.orbit, undefined);
  assert.equal(FIRST_STRIKE.planets.length, 9);
  assert.deepEqual(FIRST_STRIKE.planets.filter(p => p.capital).map(p => p.id), ['player_1', 'ai_1']);
  const red = FIRST_STRIKE.planets.filter(p => p.owner === '#ef4444');
  const blue = FIRST_STRIKE.planets.filter(p => p.owner === PLAYER);
  assert.equal(red.length, 4);
  assert.equal(blue.length, 3);
  assert.ok(red.every(planet => planet.y < Math.min(...blue.map(p => p.y))));
  validateMap(FIRST_STRIKE);
  const a = createMatch(FIRST_STRIKE), b = createMatch(FIRST_STRIKE);
  assert.deepEqual([...a.bases.values()], [...b.bases.values()]);
  const before = [...a.bases.values()].map(p => [p.id, p.x, p.y]);
  a.lastAITime = Number.MAX_SAFE_INTEGER;
  a.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  a.pixels = [];
  a.update(180);
  assert.deepEqual([...a.bases.values()].map(p => [p.id, p.x, p.y]), before);
  for (const p of FIRST_STRIKE.planets) for (const q of FIRST_STRIKE.planets) {
    if (p.id !== q.id) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 250, `${p.id} overlaps ${q.id}`);
  }
});

test('tutorial first attack leads to a reachable second step toward the enemy capital', () => {
  const planets = new Map(FIRST_STRIKE.planets.map(planet => [planet.id, planet]));
  const distance = (a: string, b: string) => Math.hypot(planets.get(a)!.x - planets.get(b)!.x, planets.get(a)!.y - planets.get(b)!.y);
  const target = FIRST_STRIKE.tutorial!.attackTargetId;
  assert.ok(distance('player_1', target) <= FIRST_STRIKE.attackRange);
  assert.ok(distance(target, 'ai_1') > FIRST_STRIKE.attackRange);
  assert.ok(distance(target, 'central-crossing') <= FIRST_STRIKE.attackRange);
  assert.ok(distance('central-crossing', 'ai_1') <= FIRST_STRIKE.attackRange);
  assert.equal(planets.get('central-crossing')!.ships, 14);
  assert.equal(planets.get('ai_1')!.ships, 70);
  assert.ok(FIRST_STRIKE.planets.some(planet => planet.owner === NEUTRAL && distance('player_1', planet.id) <= FIRST_STRIKE.attackRange));
});

test('click cues draw blue circles whose radius pulses, without arrow geometry', () => {
  const circles: number[][] = [];
  const context = {
    strokeStyle: '', shadowColor: '', shadowBlur: 0, lineWidth: 0, globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, stroke() {},
    arc(x: number, y: number, radius: number) { circles.push([x, y, radius]); },
  };
  const target = [...createMatch(FIRST_STRIKE).bases.values()][0];
  drawTutorialHighlights(context as unknown as CanvasRenderingContext2D, [target], 0.5, 0);
  drawTutorialHighlights(context as unknown as CanvasRenderingContext2D, [target], 0.5, TUTORIAL_PULSE_MS / 4);
  assert.equal(context.strokeStyle, '#73dcff');
  assert.equal(context.shadowColor, TUTORIAL_ACCENT);
  assert.equal(TUTORIAL_PULSE_MS, 700);
  assert.equal(circles.length, 2);
  assert.deepEqual(circles[0].slice(0, 2), [target.x, target.y]);
  assert.ok(circles[1][2] > circles[0][2]);
});

test('win-condition lesson waits four active seconds after launch and later launches do not restart the delay', () => {
  const launch = { type: 'launch', hostile: true, now: 12000 } as const;
  const waiting = advanceTutorial({ step: 'attack' }, launch);
  assert.equal(waiting.step, 'watch');
  assert.equal(waiting.capitalsReadyAt, 16000);
  assert.equal(advanceTutorial(waiting, { type: 'tick', now: 15999 }), waiting);
  assert.equal(advanceTutorial(waiting, { type: 'selection', playerSelected: true }), waiting);
  assert.equal(advanceTutorial(waiting, { ...launch, now: 15000 }), waiting);
  assert.equal(tutorialTargets(waiting, [], null, undefined, 600).length, 0);
  assert.equal(advanceTutorial(waiting, { type: 'tick', now: 16000 }).step, 'capitals');
});
