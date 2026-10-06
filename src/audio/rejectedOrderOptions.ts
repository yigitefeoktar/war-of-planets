import { scheduleMutedKnock } from './mutedKnock';
import { createEffectsBus, createSoundVoice } from './soundMix';

export const rejectedOrderOptions = {
  softTwoNote: { label: 'Option 1 — Soft two-note', description: 'Two short, rounded notes stepping down.', duration: 0.24 },
  mutedKnock: { label: 'Option 2 — Muted knock', description: 'A single soft tap with a little body.', duration: 0.14 },
  gentleChime: { label: 'Option 3 — Gentle chime', description: 'A light descending chime with a short tail.', duration: 0.36 },
  lowDoublePulse: { label: 'Option 4 — Low double pulse', description: 'Two calm, low beeps at the same pitch.', duration: 0.25 },
};

export type RejectedOrderOption = keyof typeof rejectedOrderOptions;

let previewContext: AudioContext | null = null;
let previewBus: GainNode | null = null;

// Only the sound comparison page imports this module.
export async function playRejectedOrderOption(option: RejectedOrderOption) {
  previewContext ??= new AudioContext({ latencyHint: 'interactive' });
  const ctx = previewContext;
  previewBus ??= createEffectsBus(ctx);
  if (ctx.state === 'suspended') await ctx.resume();
  const now = ctx.currentTime + 0.01;
  const voice = createSoundVoice(ctx, previewBus, 'error');

  const tone = (frequency: number, offset: number, duration: number, volume = 0.018, waveform: OscillatorType = 'sine') => {
    const osc = voice.track(ctx.createOscillator());
    const gain = ctx.createGain();
    const start = now + offset;
    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.012);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain);
    gain.connect(voice.output);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(start);
    osc.stop(start + duration);
  };

  switch (option) {
    case 'softTwoNote':
      tone(660, 0, 0.1);
      tone(494, 0.12, 0.12);
      break;
    case 'mutedKnock':
      scheduleMutedKnock(ctx, voice.output, now).forEach(voice.track);
      break;
    case 'gentleChime':
      tone(880, 0, 0.22, 0.014);
      tone(1320, 0, 0.16, 0.003);
      tone(660, 0.09, 0.27, 0.014);
      break;
    case 'lowDoublePulse':
      tone(330, 0, 0.09);
      tone(330, 0.15, 0.1);
      break;
  }
}
