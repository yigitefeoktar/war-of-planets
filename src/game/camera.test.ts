import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, zoomLimits } from './camera';
import { BREACH_LINE, FIRST_STRIKE, TURNING_TIDE } from './campaign';

test('zoom range follows map size while retaining a usable overview', () => {
  for (const [viewWidth, viewHeight] of [[1920, 1080], [390, 844]]) {
    const tutorial = zoomLimits(viewWidth, viewHeight, FIRST_STRIKE.width, FIRST_STRIKE.height);
    const breach = zoomLimits(viewWidth, viewHeight, BREACH_LINE.width, BREACH_LINE.height);
    const orbit = zoomLimits(viewWidth, viewHeight, TURNING_TIDE.width, TURNING_TIDE.height);
    const quick = zoomLimits(viewWidth, viewHeight, 3000, 3000);
    assert.ok(tutorial.min > breach.min && breach.min > orbit.min && orbit.min > quick.min);
    assert.ok(tutorial.max < breach.max && breach.max < orbit.max && orbit.max < quick.max);
    for (const [worldWidth, worldHeight, limits] of [
      [FIRST_STRIKE.width, FIRST_STRIKE.height, tutorial],
      [BREACH_LINE.width, BREACH_LINE.height, breach],
      [TURNING_TIDE.width, TURNING_TIDE.height, orbit],
      [3000, 3000, quick],
    ] as const) {
      const overview = Math.min(viewWidth / worldWidth, viewHeight / worldHeight) * 0.9;
      assert.ok(limits.min <= overview && overview <= limits.max);
      assert.equal(clampZoom(0, limits), limits.min);
      assert.equal(clampZoom(10, limits), limits.max);
    }
  }
});
