import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, zoomLimits } from './camera';
import { BREACH_LINE, FIRST_STRIKE, SIEGE_OF_HELIOS, THE_PINCER, TURNING_TIDE, validateMap } from './campaign';

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
      [THE_PINCER.width, THE_PINCER.height, zoomLimits(viewWidth, viewHeight, THE_PINCER.width, THE_PINCER.height)],
      [SIEGE_OF_HELIOS.width, SIEGE_OF_HELIOS.height, zoomLimits(viewWidth, viewHeight, SIEGE_OF_HELIOS.width, SIEGE_OF_HELIOS.height)],
    ] as const) {
      const overview = Math.min(viewWidth / worldWidth, viewHeight / worldHeight) * 0.9;
      assert.ok(limits.min <= overview && overview <= limits.max);
      assert.equal(clampZoom(0, limits), limits.min);
      assert.equal(clampZoom(10, limits), limits.max);
    }
  }
});


test('Pincer overview keeps all six branches clear of the desktop controls', () => {
  assert.ok(THE_PINCER.overviewScale);
  for (const [viewWidth, viewHeight] of [[1280, 720], [1920, 1080], [1024, 600]]) {
    const zoom = clampZoom(Math.min(viewWidth / THE_PINCER.width, viewHeight / THE_PINCER.height) * THE_PINCER.overviewScale,
      zoomLimits(viewWidth, viewHeight, THE_PINCER.width, THE_PINCER.height));
    const cameraX = (THE_PINCER.width - viewWidth / zoom) / 2;
    const cameraY = (THE_PINCER.height - viewHeight / zoom) / 2;
    for (const planet of THE_PINCER.planets) {
      const x = (planet.x - cameraX) * zoom, y = (planet.y - cameraY) * zoom;
      // Room above for weapon badges and below for the fleet/weapon bar.
      assert.ok(x >= 30 && x <= viewWidth - 30);
      assert.ok(y >= 110 && y <= viewHeight - 125, planet.id);
    }
  }
  for (const overviewScale of [0, -1, Infinity, NaN, 1.1]) {
    assert.throws(() => validateMap({ ...THE_PINCER, overviewScale }), /Invalid overview scale/);
  }
});


test('Pincer phone opening shows the capital and all six neutral shield choices above the command bar', () => {
  const viewWidth = 390, viewHeight = 844;
  const home = THE_PINCER.planets.find(planet => planet.capital && planet.owner === '#3b82f6')!;
  const zoom = clampZoom(Math.min(0.35, viewWidth / (THE_PINCER.attackRange * 2 + 100)),
    zoomLimits(viewWidth, viewHeight, THE_PINCER.width, THE_PINCER.height));
  const cameraX = home.x - viewWidth / 2 / zoom;
  const cameraY = home.y - viewHeight * THE_PINCER.capitalFocusY! / zoom;
  const opening = THE_PINCER.planets.filter(planet => planet.id === home.id || planet.id.startsWith('pincer-hub-'));
  assert.equal(opening.length, 7);
  for (const planet of opening) {
    const x = (planet.x - cameraX) * zoom, y = (planet.y - cameraY) * zoom;
    assert.ok(x >= 35 && x <= viewWidth - 35);
    assert.ok(y >= 90 && y <= viewHeight - 220, planet.id);
  }
  for (const capitalFocusY of [-0.1, Infinity, NaN, 1.1]) {
    assert.throws(() => validateMap({ ...THE_PINCER, capitalFocusY }), /Invalid capital camera position/);
  }
});
