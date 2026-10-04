import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { setMusicEnabled, startMusic, stopMusic } from './audio';

class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = true;
  loop = false;
  volume = 1;
  currentTime = 0;
  playCalls = 0;
  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
  play() {
    this.playCalls++;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

// Music must work without creating or resuming a Web Audio context.
Object.assign(globalThis, {
  Audio: FakeAudio,
  document: { baseURI: 'https://war-of-planets.vercel.app/' },
});

afterEach(() => {
  stopMusic();
  FakeAudio.instances = [];
});

test('the shipped MP3 has a valid MPEG audio header after its ID3 metadata', () => {
  const bytes = readFileSync(new URL('../public/audio/bg-music.mp3', import.meta.url));
  const id3Size = bytes.subarray(6, 10).reduce((size, byte) => (size << 7) | (byte & 0x7f), 0);
  const offset = bytes.toString('ascii', 0, 3) === 'ID3' ? 10 + id3Size : 0;
  const header = bytes.subarray(offset, offset + 4);
  assert.equal(header[0], 0xff, 'MP3 binary bytes must not be converted to UTF-8 text');
  assert.equal(header[1] & 0xe0, 0xe0, 'MPEG frame sync');
  assert.equal(header[1] & 0x06, 0x02, 'MPEG Layer III');
  assert.ok((header[2] >> 4) > 0 && (header[2] >> 4) < 15, 'valid bitrate');
  assert.notEqual(header[2] & 0x0c, 0x0c, 'valid sample rate');
});

test('disabled music does not create or fetch an audio element', () => {
  startMusic('/audio/bg-music.mp3', false);
  assert.equal(FakeAudio.instances.length, 0);
});

test('enabling music starts the production URL with looping and quiet volume', () => {
  startMusic('/audio/bg-music.mp3', true);
  const audio = FakeAudio.instances[0];
  assert.equal(audio.src, 'https://war-of-planets.vercel.app/audio/bg-music.mp3');
  assert.equal(audio.paused, false);
  assert.equal(audio.loop, true);
  assert.equal(audio.volume, 0.15);
});

test('menu and game reuse one track and pause/resume without losing position', () => {
  startMusic('/audio/bg-music.mp3', true);
  const audio = FakeAudio.instances[0];
  audio.currentTime = 42;
  startMusic('/audio/bg-music.mp3', true);
  assert.equal(FakeAudio.instances.length, 1);
  assert.equal(audio.playCalls, 1);
  setMusicEnabled(false);
  assert.equal(audio.paused, true);
  setMusicEnabled(true);
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 42);
  startMusic('/audio/bg-music.mp3', false);
  assert.equal(audio.paused, true);
});

test('stopping or changing a track pauses the old element', () => {
  startMusic('/audio/bg-music.mp3', true);
  const original = FakeAudio.instances[0];
  startMusic('/audio/other.mp3', true);
  assert.equal(original.paused, true);
  assert.equal(FakeAudio.instances.length, 2);
  stopMusic();
  assert.equal(FakeAudio.instances[1].paused, true);
  setMusicEnabled(true);
  assert.equal(FakeAudio.instances[1].paused, true);
});
