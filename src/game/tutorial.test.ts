import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTutorial, drawTutorialHighlights, tutorialTargets, TUTORIAL_ACCENT, TUTORIAL_PULSE_MS, TUTORIAL_ZOOM_DELAY_MS, type TutorialState } from './tutorial';
import { FIRST_STRIKE, TURNING_TIDE, PLAYER, NEUTRAL, validateMap } from './campaign';
import { createMatch } from './mapLoader';

test('tutorial follows select, attack, real zoom-out, and win-condition acknowledgement', () => {
  let state: TutorialState = { step: 'select' };
  state = advanceTutorial(state, { type: 'selection', playerSelected: true });
  assert.equal(state.step, 'attack');
  state = advanceTutorial(state, { type: 'launch', hostile: true, zoom: 0.5 });
  assert.equal(state.step, 'watch');
  state = advanceTutorial(state, { type: 'tick', now: TUTORIAL_ZOOM_DELAY_MS });
  assert.equal(state.step, 'zoom');
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
  assert.equal(advanceTutorial(start, { type: 'launch', hostile: true, zoom: 0.5 }).step, 'watch');
});

test('zoom-in and tiny wheel noise do not finish zoom lesson; cumulative pinch-out does', () => {
  const zoom: TutorialState = { step: 'zoom', zoomStart: 0.5 };
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.5, after: 0.6 }), zoom);
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.5, after: 0.49 }), zoom);
  assert.equal(advanceTutorial(zoom, { type: 'zoom', before: 0.46, after: 0.449 }).step, 'capitals');
  assert.equal(advanceTutorial(zoom, { type: 'selection', playerSelected: false }), zoom);
});

test('every lesson can be skipped and skipped tutorials never reopen', () => {
  for (const step of ['select', 'attack', 'watch', 'zoom', 'capitals'] as const) {
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
  assert.deepEqual(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).map(p => p.id), ['ai_1', 'ai_2', 'ai_3']);
  engine.bases.get('ai_1')!.color = NEUTRAL;
  assert.deepEqual(tutorialTargets({ step: 'capitals' }, [...engine.bases.values()], null, targetId, 600).map(p => p.id), ['ai_2', 'ai_3']);
  assert.equal(tutorialTargets({ step: 'done' }, [...engine.bases.values()], null, targetId, 600).length, 0);
});

test('tutorial map is large, deterministic, connected and stationary', () => {
  assert.equal(FIRST_STRIKE.width, 3000);
  assert.equal(FIRST_STRIKE.height, 3000);
  assert.equal(FIRST_STRIKE.orbit, undefined);
  assert.equal(FIRST_STRIKE.planets.length, 34);
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

test('larger tutorial requires zooming to the overview, not just one small wheel step', () => {
  let state = advanceTutorial({ step: 'attack' }, { type: 'launch', hostile: true, zoom: 0.6, overviewZoom: 0.23 });
  state = advanceTutorial(state, { type: 'tick', now: TUTORIAL_ZOOM_DELAY_MS });
  state = advanceTutorial(state, { type: 'zoom', before: 0.6, after: 0.5 });
  assert.equal(state.step, 'zoom');
  state = advanceTutorial(state, { type: 'zoom', before: 0.3, after: 0.23 });
  assert.equal(state.step, 'capitals');
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

test('zoom cue waits four active seconds after launch and later launches do not restart the delay', () => {
  const launch = { type: 'launch', hostile: true, zoom: 0.6, now: 12000 } as const;
  const waiting = advanceTutorial({ step: 'attack' }, launch);
  assert.equal(waiting.step, 'watch');
  assert.equal(waiting.zoomReadyAt, 16000);
  assert.equal(advanceTutorial(waiting, { type: 'tick', now: 15999 }), waiting);
  assert.equal(advanceTutorial(waiting, { type: 'selection', playerSelected: true }), waiting);
  assert.equal(advanceTutorial(waiting, { ...launch, now: 15000 }), waiting);
  assert.equal(tutorialTargets(waiting, [], null, undefined, 600).length, 0);
  assert.equal(advanceTutorial(waiting, { type: 'tick', now: 16000 }).step, 'zoom');
});

test('early manual zoom is remembered without showing the next lesson immediately', () => {
  let state = advanceTutorial({ step: 'attack' }, { type: 'launch', hostile: true, zoom: 0.6, overviewZoom: 0.23, now: 0 });
  state = advanceTutorial(state, { type: 'zoom', before: 0.6, after: 0.2 });
  assert.equal(state.step, 'watch');
  assert.equal(state.zoomCompleted, true);
  assert.equal(advanceTutorial(state, { type: 'tick', now: 3999 }).step, 'watch');
  assert.equal(advanceTutorial(state, { type: 'tick', now: 4000 }).step, 'capitals');
  const skipped = advanceTutorial(state, { type: 'dismiss' });
  assert.equal(advanceTutorial(skipped, { type: 'tick', now: 4000 }).step, 'done');
});

test('PC tutorial skips zoom entirely after the normal post-attack delay', () => {
  let state: TutorialState = { step: 'select', showZoomLesson: false };
  state = advanceTutorial(state, { type: 'selection', playerSelected: true });
  assert.equal(state.showZoomLesson, false);
  state = advanceTutorial(state, { type: 'launch', hostile: true, zoom: 0.6, now: 0 });
  assert.equal(state.step, 'watch');
  state = advanceTutorial(state, { type: 'tick', now: 3999 });
  assert.equal(state.step, 'watch');
  state = advanceTutorial(state, { type: 'tick', now: 4000 });
  assert.equal(state.step, 'capitals');
  assert.equal(state.showZoomLesson, false);
});

test('touch tutorial retains its delayed zoom lesson', () => {
  let state: TutorialState = { step: 'select', showZoomLesson: true };
  state = advanceTutorial(state, { type: 'selection', playerSelected: true });
  state = advanceTutorial(state, { type: 'launch', hostile: true, zoom: 0.3, now: 0 });
  state = advanceTutorial(state, { type: 'tick', now: 4000 });
  assert.equal(state.step, 'zoom');
  assert.equal(state.showZoomLesson, true);
});
