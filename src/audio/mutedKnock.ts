// Shared by the game and Option 2 so the selected preview stays identical.
export function scheduleMutedKnock(ctx: AudioContext, destination: AudioNode, start: number) {
  for (const tone of [
    { frequency: 380, duration: 0.14, volume: 0.018, waveform: 'triangle' },
    { frequency: 190, duration: 0.1, volume: 0.006, waveform: 'sine' },
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.waveform;
    osc.frequency.setValueAtTime(tone.frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(tone.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration - 0.012);
    gain.gain.linearRampToValueAtTime(0, start + tone.duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(start);
    osc.stop(start + tone.duration);
  }
}
