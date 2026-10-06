import { useEffect, useState } from 'react';
import { playSound, resumeAudioContext, type SoundType } from '../audio';
import './SoundPreview.css';

const sounds = {
  capitalDestroyed: { label: 'Capital destroyed', description: 'A capital explodes — deep square-wave rumble.', duration: 2 },
  capture: { label: 'Planet captured', description: 'You capture a planet — two blips, a thrum, and static.', duration: 0.4 },
  lose: { label: 'Defeat', description: 'You lose a match — falling siren and stuttering static.', duration: 2.5 },
  hover: { label: 'Button hover', description: 'The pointer enters a menu button.', duration: 0.02 },
  click: { label: 'Button click', description: 'A control is clicked or targeting is cancelled.', duration: 0.01 },
  select: { label: 'Selection / ready', description: 'Select a planet or mode; a weapon or ship limit becomes ready.', duration: 0.08 },
  error: { label: 'Rejected order', description: 'An order cannot be carried out.', duration: 0.15 },
  launch: { label: 'Fleet launch', description: 'You send ships from a planet.', duration: 0.3 },
  charge: { label: 'Weapon targeting', description: 'Activate superweapon targeting — rising sawtooth buzz.', duration: 1.5 },
  omniLaunch: { label: 'Omni-Strike', description: 'Any faction fires Omni-Strike — zap, bass drop, and crash.', duration: 1.5 },
  overdrive: { label: 'Overdrive', description: 'Activate the production superweapon.', duration: 0.65 },
  repulse: { label: 'Repulse', description: 'Activate the defensive superweapon.', duration: 0.65 },
  productionBurst: { label: 'Production pulse', description: 'A player Overdrive production pulse.', duration: 0.12 },
  shieldImpact: { label: 'Shield impact', description: 'A player Repulse ability pulse.', duration: 0.12 },
  win: { label: 'Victory', description: 'You win a match — ascending major chord.', duration: 2.3 },
} satisfies Record<SoundType, { label: string; description: string; duration: number }>;

export default function SoundPreview() {
  const [playing, setPlaying] = useState<SoundType | null>(null);
  const [status, setStatus] = useState('Choose a sound to listen.');

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setPlaying(null);
      setStatus(`Last played: ${sounds[playing].label}`);
    }, (sounds[playing].duration + 0.2) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing]);

  const preview = async (type: SoundType) => {
    setPlaying(type);
    setStatus(`Playing: ${sounds[type].label}`);
    try {
      await resumeAudioContext();
      playSound(type, true);
    } catch {
      setPlaying(null);
      setStatus('Audio could not start. Try clicking the sound again.');
    }
  };

  return (
    <main className="sound-preview-page min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">War of Planets — sound effects</h1>
        <p className="mt-2">All 15 effects, using the game's actual playback code. One sound at a time.</p>
        <p role="status" className="my-4 min-h-6 font-medium">{status}</p>
        <ul className="space-y-2">
          {(Object.keys(sounds) as SoundType[]).map(type => (
            <li key={type} className="flex items-center gap-4 rounded border border-slate-300 bg-white p-3">
              <button
                type="button"
                aria-label={`Play ${sounds[type].label}`}
                disabled={playing !== null}
                onClick={() => void preview(type)}
                className="shrink-0 cursor-pointer rounded border border-slate-400 px-4 py-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:opacity-50"
              >
                {playing === type ? 'Playing…' : 'Play'}
              </button>
              <div>
                <div className="font-semibold">{sounds[type].label}</div>
                <p className="text-sm text-slate-600">{sounds[type].description}</p>
              </div>
            </li>
          ))}
        </ul>
        <a href="/" className="mt-6 inline-block text-blue-700 underline">Back to game</a>
      </div>
    </main>
  );
}
