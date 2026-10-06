import type { SoundType } from '../audio';

// Calibrated against frequency-weighted 100 ms RMS windows of the complete
// effects, including all layers. Controls sit below gameplay cues; major
// events are about 3 dB above gameplay cues. Repeated pulses stay softer.
const levelDb: Record<SoundType, number> = {
  hover: 1.7,
  click: 7,
  select: -0.9,
  error: 6,
  launch: -0.7,
  capture: 0.3,
  productionBurst: 3.7,
  shieldImpact: 2.1,
  charge: -3.6,
  overdrive: -8.7,
  repulse: -10.2,
  omniLaunch: -7.8,
  capitalDestroyed: -6.9,
  win: -3.8,
  lose: -4.5,
};

export function createEffectsBus(ctx: BaseAudioContext) {
  const input = ctx.createGain();
  const limiter = ctx.createWaveShaper();
  const curve = new Float32Array(4097);
  // Pass individual sounds through unchanged below -18 dB. Smoothly reduce
  // larger sums toward a 0.3 ceiling, leaving headroom for background music.
  const knee = 0.125;
  const span = 0.3 - knee;
  for (let i = 0; i < curve.length; i++) {
    const sample = 2 * i / (curve.length - 1) - 1;
    const magnitude = Math.abs(sample);
    curve[i] = magnitude <= knee ? sample
      : Math.sign(sample) * (knee + span * (1 - Math.exp(-(magnitude - knee) / span)));
  }
  limiter.curve = curve;
  input.connect(limiter);
  limiter.connect(ctx.destination);
  return input;
}

export function createSoundVoice(ctx: BaseAudioContext, destination: AudioNode, type: SoundType) {
  const output = ctx.createGain();
  output.gain.value = 10 ** (levelDb[type] / 20);
  output.connect(destination);
  let remainingSources = 0;

  const track = <T extends AudioScheduledSourceNode>(source: T): T => {
    remainingSources++;
    source.addEventListener('ended', () => {
      source.disconnect();
      remainingSources--;
      if (remainingSources === 0) output.disconnect();
    }, { once: true });
    return source;
  };
  return { output, track };
}
