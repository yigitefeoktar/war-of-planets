import assert from 'node:assert/strict';
import test from 'node:test';
import { superweaponIconLayout } from './superweaponVisuals';

test('superweapon badges stay readable, spaced, and anchored throughout camera zoom', () => {
  for (const zoom of [0.1, 0.2, 0.6, 1, 1.4, 2, 3]) {
    const radius = 20;
    const { scale, gap, y } = superweaponIconLayout(zoom, radius);
    const screenDiameter = 30 * scale * zoom;

    assert.ok(screenDiameter >= 20 - 1e-9 && screenDiameter <= 42 + 1e-9);
    assert.ok(gap * zoom - screenDiameter >= 4 - 1e-9);
    assert.ok((-y - radius) * zoom - screenDiameter / 2 >= 6 - 1e-9);
  }

  assert.equal(superweaponIconLayout(1, 20).scale, 1);
  assert.ok(Math.abs(superweaponIconLayout(0.6, 20).scale - superweaponIconLayout(0.600001, 20).scale) < 0.00001);
});
