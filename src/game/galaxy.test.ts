import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREACH_LINE, FIRST_STRIKE, TURNING_TIDE } from './campaign';
import { createMatch } from './mapLoader';

test('galaxy backgrounds grow with map size and hard mode uses a warmer red palette', () => {
  const tutorial = createMatch(FIRST_STRIKE);
  const breach = createMatch(BREACH_LINE);
  const orbit = createMatch(TURNING_TIDE);
  const quick = createMatch();
  const hard = createMatch(undefined, { hardMode: true });

  assert.ok(tutorial.nebulae.length <= 1);
  assert.ok(tutorial.nebulae.length < breach.nebulae.length);
  assert.ok(breach.nebulae.length < orbit.nebulae.length);
  assert.ok(orbit.nebulae.length < quick.nebulae.length);
  assert.ok(quick.nebulae.length < hard.nebulae.length);
  assert.ok(tutorial.nebulae.every(cloud => cloud.alpha < 0.05));
  assert.ok(tutorial.stars.length < breach.stars.length && breach.stars.length < quick.stars.length);
  assert.notEqual(breach.backgroundColor, orbit.backgroundColor);
  assert.notEqual(quick.backgroundColor, hard.backgroundColor);
  assert.ok(hard.nebulae.every(cloud => {
    const [red, green] = cloud.rgb.split(',').map(Number);
    return red > green;
  }));
});
