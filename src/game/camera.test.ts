import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_OVERVIEW_HOLD_MS, cameraDelta, cameraDuration, cameraFrame, cameraPosition, cameraProgress, capitalFrame, clampZoom, interpolateCamera, openingFrame, overviewFrame, zoomLimits, type CameraViewport } from './camera';
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

const maps = [FIRST_STRIKE, BREACH_LINE, TURNING_TIDE, THE_PINCER, SIEGE_OF_HELIOS];
const views: CameraViewport[] = [
  { width: 1920, height: 1080, top: 110, bottom: 125 },
  { width: 1280, height: 720, top: 110, bottom: 125 },
  { width: 1024, height: 600, top: 90, bottom: 125 },
  { width: 390, height: 844, top: 90, bottom: 220 },
  { width: 360, height: 640, top: 80, bottom: 200 },
];

test('every map approaches its capital on every screen and keeps its opening context clear of the HUD', () => {
  for (const map of maps) for (const view of views) {
    const home = map.planets.find(p => p.capital && p.owner === '#3b82f6')!;
    const frame = openingFrame(view, map, home, map.planets);
    const start = overviewFrame(view, map.width, map.height, map.overviewScale);
    assert.equal(frame.focusX, home.x);
    assert.equal(frame.focusY, home.y);
    assert.ok(cameraDuration(start, frame, view) > 0, `${map.title} has a visible approach at ${view.width}px`);
    {
      const position = cameraPosition(frame, view);
      const neighbors = map.planets.filter(p => Math.hypot(p.x - home.x, p.y - home.y) <= map.attackRange * (view.width < 700 ? 1 : 2));
      for (const planet of neighbors) {
        const x = (planet.x - position.x) * position.zoom;
        const y = (planet.y - position.y) * position.zoom;
        assert.ok(x >= 35 - 1e-6 && x <= view.width - 35 + 1e-6, `${map.title}: ${planet.id} horizontally visible`);
        assert.ok(y >= view.top + 35 - 1e-6 && y <= view.height - view.bottom - 35 + 1e-6,
          `${map.title}: ${planet.id} clear of controls`);
      }
    }
  }
});

test('PC destinations show more battlefield width than phone destinations for every map', () => {
  const pc = views[1], phone = views[3];
  for (const map of maps) {
    const home = map.planets.find(p => p.capital && p.owner === '#3b82f6')!;
    const pcFrame = openingFrame(pc, map, home, map.planets);
    const phoneFrame = openingFrame(phone, map, home, map.planets);
    assert.ok(pc.width / pcFrame.zoom > phone.width / phoneFrame.zoom, map.title);
  }
});

test('Pincer PC framing includes branch entrances while phones retain the immediate shield hub', () => {
  const pc = views[1], phone = views[3];
  const home = THE_PINCER.planets.find(p => p.capital && p.owner === '#3b82f6')!;
  const immediate = THE_PINCER.planets.filter(p => Math.hypot(p.x - home.x, p.y - home.y) <= THE_PINCER.attackRange);
  const pcFrame = openingFrame(pc, THE_PINCER, home, THE_PINCER.planets);
  const tightPcFrame = capitalFrame(pc, home, immediate, THE_PINCER.width, THE_PINCER.height, THE_PINCER.attackRange, THE_PINCER.capitalFocusY);
  assert.ok(pcFrame.zoom < tightPcFrame.zoom, 'PC reveals routes beyond immediate expansion choices');
  const phoneFrame = openingFrame(phone, THE_PINCER, home, THE_PINCER.planets);
  const tightPhoneFrame = capitalFrame(phone, home, immediate, THE_PINCER.width, THE_PINCER.height, THE_PINCER.attackRange, THE_PINCER.capitalFocusY);
  assert.deepEqual(phoneFrame, tightPhoneFrame, 'mobile opening stays at its readable local framing');
  const position = cameraPosition(pcFrame, pc);
  const entries = THE_PINCER.planets.filter(p => p.id.endsWith('-entry'));
  assert.equal(entries.length, 6);
  for (const planet of entries) {
    const x = (planet.x - position.x) * position.zoom, y = (planet.y - position.y) * position.zoom;
    assert.ok(x >= 35 && x <= pc.width - 35);
    assert.ok(y >= pc.top + 35 - 1e-6 && y <= pc.height - pc.bottom - 35 + 1e-6, planet.id);
  }
});

test('map flags do not suppress capital focus on wide screens', () => {
  const map = { ...BREACH_LINE, mobileFocus: undefined, tutorial: undefined };
  const home = map.planets.find(p => p.capital && p.owner === '#3b82f6')!;
  const frame = openingFrame(views[0], map, home, map.planets);
  assert.equal(frame.focusX, home.x);
  assert.equal(frame.focusY, home.y);
});

test('intro briefly holds the overview while recalls and reduced motion skip the hold', () => {
  const duration = 800;
  assert.equal(cameraProgress(0, duration, CAMERA_OVERVIEW_HOLD_MS), 0);
  assert.equal(cameraProgress(CAMERA_OVERVIEW_HOLD_MS - 1, duration, CAMERA_OVERVIEW_HOLD_MS), 0);
  assert.equal(cameraProgress(CAMERA_OVERVIEW_HOLD_MS + duration / 2, duration, CAMERA_OVERVIEW_HOLD_MS), 0.5);
  assert.equal(cameraProgress(CAMERA_OVERVIEW_HOLD_MS + duration, duration, CAMERA_OVERVIEW_HOLD_MS), 1);
  assert.equal(cameraProgress(duration / 2, duration), 0.5, 'Space recall has no overview hold');
  assert.equal(cameraProgress(0, duration, CAMERA_OVERVIEW_HOLD_MS, true), 1);
  assert.equal(cameraProgress(0, 0, CAMERA_OVERVIEW_HOLD_MS), 1, 'stationary camera never waits');
});

test('map approaches have finite, monotonic proportional zoom and exact endpoints', () => {
  for (const map of maps) for (const view of views) {
    const home = map.planets.find(p => p.capital && p.owner === '#3b82f6')!;
    const from = overviewFrame(view, map.width, map.height, map.overviewScale);
    const to = openingFrame(view, map, home, map.planets);
    const duration = cameraDuration(from, to, view);
    assert.ok(duration === 0 || (duration >= 450 && duration <= 1600));
    assert.equal(cameraDuration(from, to, view, true), 0);
    assert.deepEqual(interpolateCamera(from, to, 0), from);
    assert.deepEqual(interpolateCamera(from, to, 1), to);
    let previous = from.zoom;
    for (let step = 0; step <= 100; step++) {
      const frame = interpolateCamera(from, to, step / 100);
      const pose = cameraPosition(frame, view);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(to.zoom >= from.zoom ? frame.zoom >= previous - 1e-9 : frame.zoom <= previous + 1e-9);
      previous = frame.zoom;
    }
    assert.ok(Math.abs(interpolateCamera(from, to, 0.5).zoom - Math.sqrt(from.zoom * to.zoom)) < 1e-9);
  }
});

test('resize rebases from the current world center, then resolves the new opening policy', () => {
  const desktop = views[0], phone = views[3];
  const home = THE_PINCER.planets.find(p => p.capital && p.owner === '#3b82f6')!;
  const start = overviewFrame(desktop, THE_PINCER.width, THE_PINCER.height, THE_PINCER.overviewScale);
  const pose = cameraPosition(start, desktop);
  const current = cameraFrame(pose.x, pose.y, pose.zoom, desktop);
  const resizedPose = cameraPosition(current, phone);
  assert.deepEqual(cameraFrame(resizedPose.x, resizedPose.y, resizedPose.zoom, phone), current);
  const target = openingFrame(phone, THE_PINCER, home, THE_PINCER.planets);
  assert.deepEqual(interpolateCamera(current, target, 0), current);
  assert.deepEqual(interpolateCamera(current, target, 1), target);
  assert.equal(cameraPosition(target, phone).zoom, target.zoom);
});

test('live Helios capital coordinates remain at the requested screen anchor', () => {
  const view = views[3];
  const capital = SIEGE_OF_HELIOS.planets.find(p => p.capital && p.owner === '#3b82f6')!;
  for (const offset of [0, 20, 50]) {
    const moving = { ...capital, x: capital.x + offset, y: capital.y - offset };
    const target = openingFrame(view, SIEGE_OF_HELIOS, moving, SIEGE_OF_HELIOS.planets);
    const pose = cameraPosition(interpolateCamera(target, target, 1), view);
    assert.ok(Math.abs((moving.x - pose.x) * pose.zoom - view.width / 2) < 1e-9);
    assert.ok(Math.abs((moving.y - pose.y) * pose.zoom - view.height * target.anchorY) < 1e-9);
  }
});

test('camera clock skips inactive time, freezes on pause, and limits stalls without skipping the approach', () => {
  assert.equal(cameraDelta(null, 50000), 0, 'first or restored frame');
  assert.equal(cameraDelta(100, 116), 16);
  assert.equal(cameraDelta(100, 30100), 50, 'long stall');
  assert.equal(cameraDelta(100, 30100, true), 0, 'paused or hidden');
  assert.equal(cameraDelta(100, 90), 0);
  for (const hz of [30, 60, 120]) {
    let elapsed = 0, previous = 0;
    for (let frame = 1; frame <= hz; frame++) {
      const now = frame * 1000 / hz;
      elapsed += cameraDelta(previous, now);
      previous = now;
    }
    assert.ok(Math.abs(elapsed - 1000) < 1e-6, `${hz} Hz consumes the same active time`);
  }
});

test('generated matches approach their capital and handle a missing capital gracefully', () => {
  for (const view of views) {
    const capital = { x: 350, y: 2600 };
    const start = overviewFrame(view, 3000, 3000);
    const target = openingFrame(view, undefined, capital, [capital]);
    assert.equal(target.focusX, capital.x);
    assert.equal(target.focusY, capital.y);
    assert.ok(cameraDuration(start, target, view) > 0);
    assert.deepEqual(openingFrame(view, undefined, undefined, []), start);
  }
});
