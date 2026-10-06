import { useEffect, useState } from 'react';
import { playSound, resumeAudioContext, type SoundType } from '../audio';
import { playRejectedOrderOption, rejectedOrderOptions, type RejectedOrderOption } from '../audio/rejectedOrderOptions';
import './SoundPreview.css';

const sounds = {
  capitalDestroyed: { label: 'Capital destroyed', description: 'A capital explodes — deep square-wave rumble.', duration: 2 },
  capture: { label: 'Planet captured', description: 'You capture a planet — two blips, a thrum, and static.', duration: 0.4 },
  lose: { label: 'Defeat', description: 'You lose a match — falling siren and stuttering static.', duration: 2.5 },
  hover: { label: 'Button hover', description: 'The pointer enters a menu button.', duration: 0.02 },
  click: { label: 'Button click', description: 'A control is clicked or targeting is cancelled.', duration: 0.01 },
  select: { label: 'Selection / ready', description: 'Select a planet or mode; a weapon or ship limit becomes ready.', duration: 0.08 },
  error: { label: 'Rejected order', description: 'An order cannot be carried out — the selected muted knock.', duration: 0.14 },
  launch: { label: 'Fleet launch', description: 'You send ships from a planet.', duration: 0.3 },
  charge: { label: 'Weapon targeting', description: 'Activate superweapon targeting — rising sawtooth buzz.', duration: 1.5 },
  omniLaunch: { label: 'Omni-Strike', description: 'Any faction fires Omni-Strike — zap, bass drop, and crash.', duration: 1.5 },
  overdrive: { label: 'Overdrive', description: 'Activate the production superweapon.', duration: 0.65 },
  repulse: { label: 'Repulse', description: 'Activate the defensive superweapon.', duration: 0.65 },
  productionBurst: { label: 'Production pulse', description: 'A player Overdrive production pulse.', duration: 0.12 },
  shieldImpact: { label: 'Shield impact', description: 'A player Repulse ability pulse.', duration: 0.12 },
  win: { label: 'Victory', description: 'You win a match — ascending major chord.', duration: 2.3 },
} satisfies Record<SoundType, { label: string; description: string; duration: number }>;

type PreviewSound = { id: string; label: string; description: string; duration: number; play: () => void | Promise<void> };

const gameSounds: PreviewSound[] = (Object.keys(sounds) as SoundType[]).map(type => ({
  id: type, ...sounds[type], play: () => playSound(type, true),
}));
const comparisonSounds: PreviewSound[] = [
  { id: 'error', ...sounds.error, label: 'Rejected order — Muted knock (active)', play: () => playSound('error', true) },
  ...(Object.keys(rejectedOrderOptions) as RejectedOrderOption[]).map(option => ({
    id: option, ...rejectedOrderOptions[option], play: () => playRejectedOrderOption(option),
  })),
];

export default function SoundPreview() {
  const [playing, setPlaying] = useState<PreviewSound | null>(null);
  const [status, setStatus] = useState('Choose a sound to listen.');

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setPlaying(null);
      setStatus(`Last played: ${playing.label}`);
    }, (playing.duration + 0.2) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing]);

  const preview = async (sound: PreviewSound) => {
    setPlaying(sound);
    setStatus(`Playing: ${sound.label}`);
    try {
      await resumeAudioContext();
      await sound.play();
    } catch {
      setPlaying(null);
      setStatus('Audio could not start. Try clicking the sound again.');
    }
  };

  const soundRow = (sound: PreviewSound) => (
    <li key={sound.id} className="flex items-center gap-4 rounded border border-slate-300 bg-white p-3">
      <button
        type="button"
        aria-label={`Play ${sound.label}`}
        disabled={playing !== null}
        onClick={() => void preview(sound)}
        className="shrink-0 cursor-pointer rounded border border-slate-400 px-4 py-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:opacity-50"
      >
        {playing?.id === sound.id ? 'Playing…' : 'Play'}
      </button>
      <div>
        <div className="font-semibold">{sound.label}</div>
        <p className="text-sm text-slate-600">{sound.description}</p>
      </div>
    </li>
  );

  return (
    <main className="sound-preview-page min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">War of Planets — sound effects</h1>
        <p className="mt-2">All 15 game effects plus four replacement options. One sound at a time.</p>
        <p className="mt-2 text-sm text-slate-600">Balanced mix: quiet controls, clear gameplay cues, and slightly louder major events.</p>
        <p role="status" className="my-4 min-h-6 font-medium">{status}</p>
        <section aria-labelledby="rejected-order-title">
          <h2 id="rejected-order-title" className="text-lg font-bold">Rejected order — compare replacements</h2>
          <p className="mb-3 text-sm text-slate-600">Option 2, Muted knock, is now the game's rejected order sound.</p>
          <ul className="space-y-2">{comparisonSounds.map(soundRow)}</ul>
        </section>
        <section aria-labelledby="other-sounds-title" className="mt-6">
          <h2 id="other-sounds-title" className="mb-3 text-lg font-bold">Other game sounds</h2>
          <ul className="space-y-2">{gameSounds.filter(sound => sound.id !== 'error').map(soundRow)}</ul>
        </section>
        <a href="/" className="mt-6 inline-block text-blue-700 underline">Back to game</a>
      </div>
    </main>
  );
}
