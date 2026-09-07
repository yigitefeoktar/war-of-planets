import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTutorial, tutorialHoldsOpening, tutorialTargets, type TutorialState } from './tutorial';
import { FIRST_STRIKE, TURNING_TIDE, PLAYER, NEUTRAL } from './campaign';
import { createMatch } from './mapLoader';

test('tutorial follows select, attack, real zoom-out, and win-condition acknowledgement', () => {
  let state: TutorialState = { step: 'select' };
  assert.ok(tutorialHoldsOpening(state));
  state = advanceTutorial(state, { type: 'selection', playerSelected: true });
  assert.equal(state.step, 'attack');
  state = advanceTutorial(state, { type: 'launch', hostile: true, zoom: 0.5 });
  assert.equal(state.step, 'zoom');
  assert.equal(tutorialHoldsOpening(state), false);
  state = advanceTutorial(state, { type: 'zoom', before: 0.5, after: 0.44 });
  assert.equal(state.step, 'capitals');
  state = advanceTutorial(state, { type: 'dismiss' });
  assert.equal(state.step, 'done');
});

test('deselecting returns to selection; unrelated actions cannot advance prompts', () => {
  const start: TutorialState = { step: 'select' };
  assert.equal(advanceTutorial(start, { type: 'selection', playerSelected: false }), start);
  assert.equal(advanceTutorial(start, { type: 'zoom', before: 1, after: 0.5 }), start);
  assert.equal(advanceTutorial(start, { type: 'launch', hostile: false, zoom: 1 }), start);
  const selected = advanceTutorial(start, { type: 'selection', playerSelected: true });
  assert.equal(advanceTutorial(selected, { type: 'selection', playerSelected: false }).step, 'select');
  // Rapid select-and-launch between animation frames must work too.
  assert.equal(advanceTutorial(start, { type: 'launch', hostile: true, zoom: 0.5 }).step, 'zoom');
});

test('zoom-in and tiny wheel noise do not finish zoom lesson; cumulative pinch-out does', () => {
  const zoom: TutorialState = { step: 'zoom', zoomStart: 0.5 };
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.5, after: 0.6 }), zoom);
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.5, after: 0.49 }), zoom);
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.46, after: 0.449 }).step, 'capitals');
  assert.equal(advanceTutorial(zoom, { type: 'selection', playerSelected: false }), zoom);
});

test('every lesson can be skipped and skipped tutorials never reopen', () => {
  for (const step of ['select', 'attack', 'zoom', 'capitals'] as const) {
    const state = advanceTutorial({ step }, { type: 'dismiss' });
    assert.equal(state.step, 'done');
    assert.equal(tutorialHoldsOpening(state), false);
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
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.update(1 / 60);
  const targets = tutorialTargets({ step: 'attack' }, [...engine.bases.values()], 'player_1', targetId, engine.MAX_ATTACK_RANGE);
  assert.notEqual(targets[0].x, before);
  assert.equal(targets[0], engine.bases.get(targetId));
  assert.deepEqual(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).map(p => p.id), ['ai_1']);
  engine.bases.get('ai_1')!.color = NEUTRAL;
  assert.equal(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).length, 0);
  assert.equal(tutorialTargets({ step: 'done' }, [...engine.bases.values()], null, targetId, 600).length, 0);
});
