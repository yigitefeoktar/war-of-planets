import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREACH_LINE, FIRST_STRIKE, SIEGE_OF_HELIOS, THE_PINCER, TURNING_TIDE } from './campaign';
import { createMatch } from './mapLoader';
import { generateMap } from './generatedMaps';

test('galaxy backgrounds grow with map size and hard mode uses a warmer red palette', () => {
  const tutorial = createMatch(FIRST_STRIKE);
  const breach = createMatch(BREACH_LINE);
  const orbit = createMatch(TURNING_TIDE);
  const pincer = createMatch(THE_PINCER);
  const battlefield = generateMap('quick-match', 4);
  const quick = createMatch(battlefield);
  const hard = createMatch(battlefield, { hardMode: true });

  assert.ok(tutorial.nebulae.length <= 1);
  assert.ok(tutorial.nebulae.length < breach.nebulae.length);
  assert.ok(breach.nebulae.length < orbit.nebulae.length);
  assert.ok(orbit.nebulae.length < pincer.nebulae.length);
  assert.ok(quick.nebulae.length < pincer.nebulae.length);
  assert.ok(quick.nebulae.length < hard.nebulae.length);
  assert.ok(tutorial.nebulae.every(cloud => cloud.alpha < 0.05));
  assert.ok(tutorial.stars.length < breach.stars.length && breach.stars.length < quick.stars.length);
  assert.notEqual(breach.backgroundColor, orbit.backgroundColor);
  assert.notEqual(orbit.backgroundColor, pincer.backgroundColor);
  assert.notEqual(quick.backgroundColor, hard.backgroundColor);
  assert.ok(hard.nebulae.every(cloud => {
    const [red, green] = cloud.rgb.split(',').map(Number);
    return red > green;
  }));
});

test('Chaos has its own violet galaxy and gold stars, while Hard Mode overrides its appearance', () => {
  const map = generateMap('chaos-mode', 4);
  const chaos = createMatch(map);
  const hardChaos = createMatch(map, { hardMode: true });
  const hardQuick = createMatch(generateMap('quick-match', 4), { hardMode: true });
  const chapterFinale = createMatch(SIEGE_OF_HELIOS);

  assert.equal(chaos.isHardMode, false);
  assert.equal(hardChaos.isHardMode, true);
  assert.notEqual(chaos.backgroundColor, hardChaos.backgroundColor);
  assert.notEqual(chaos.backgroundColor, chapterFinale.backgroundColor);
  assert.equal(chapterFinale.backgroundColor, '#0a070e');
  assert.equal(hardChaos.backgroundColor, hardQuick.backgroundColor);
  assert.ok(chaos.nebulae.every(cloud => {
    const [red, green, blue] = cloud.rgb.split(',').map(Number);
    return blue > red && red > green;
  }));
  assert.ok(chaos.stars.every(star => {
    const [red, green, blue] = star.color.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
    return red > green && green > blue;
  }));
  assert.deepEqual(new Set(hardChaos.nebulae.map(cloud => cloud.rgb)), new Set(hardQuick.nebulae.map(cloud => cloud.rgb)));
  assert.deepEqual([...chaos.bases.values()], [...hardChaos.bases.values()], 'difficulty and theme do not change the generated planets');
});
