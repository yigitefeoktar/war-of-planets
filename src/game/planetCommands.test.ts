import assert from 'node:assert/strict';
import test from 'node:test';
import { planetCommandPosition } from './planetCommands';

test('desktop commands sit beside a central planet without covering it', () => {
  const box = planetCommandPosition(631, 312, 48, 1262, 624, 294, 332);
  assert.ok(box.left >= 679);
  assert.ok(box.top >= 96 && box.top + 332 <= 616);
});

test('phone commands fit below or above the planet and scroll in short viewports', () => {
  for (const y of [120, 312, 560]) {
    const box = planetCommandPosition(195, y, 48, 390, 624, 294, 332);
    const bottom = box.top + Math.min(332, box.maxHeight);
    assert.ok(box.left >= 8 && box.left + 294 <= 382);
    assert.ok(box.top >= 96 && bottom <= 616);
    assert.ok(box.top >= y + 48 || bottom <= y - 48);
  }
});

test('commands flip to the left near the right edge', () => {
  const box = planetCommandPosition(1150, 400, 48, 1262, 624, 294, 332);
  assert.ok(box.left + 294 <= 1102);
});
