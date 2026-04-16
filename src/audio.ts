let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let bgMusic: HTMLAudioElement | null = null;
let musicSource: MediaElementAudioSourceNode | null = null;
let keepAliveOsc: OscillatorNode | null = null;

const MUSIC_VOLUME = 0.15;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive'
    });
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    musicGain = audioCtx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(masterGain!);
    
    (window as any)._audioCtx = audioCtx;
  }
  return audioCtx;
};

const startKeepAlive = (ctx: AudioContext) => {
  if (keepAliveOsc) return;
  // A silent oscillator keeps the audio thread active even when no other sounds are playing
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.00001; // Virtually silent
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  keepAliveOsc = osc;
};

export const resumeAudioContext = async () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  startKeepAlive(ctx);
};

export type SoundType = 'hover' | 'click' | 'select' | 'error' | 'launch' | 'capture' | 'charge' | 'omniLaunch' | 'capitalDestroyed' | 'win' | 'lose';

export const playSound = (type: SoundType, enabled: boolean) => {
  if (!enabled) return;
  
  try {
    const ctx = getAudioContext();
    
    // Non-blocking resume attempt
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Use a small look-ahead (10ms) to ensure the sound is scheduled in the future
    // and avoid "late" sound warnings/delays in the audio thread.
    const now = ctx.currentTime + 0.01;
    
    if (type === 'hover') {
      // Crystalline Blip (detuned high-frequency sines)
      [1600, 1610].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.008, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(now);
        osc.stop(now + 0.02);
      });
    } else if (type === 'click') {
      // Neural Link click (glassy resonance)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3000, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + 0.01);
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(now);
      osc.stop(now + 0.01);
    } else if (type === 'select') {
      // Module Online chirp (fast 3-note ascending arpeggio)
      [1200, 1800, 2400].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.02);
        gain.gain.setValueAtTime(0, now + i * 0.02);
        gain.gain.linearRampToValueAtTime(0.015, now + i * 0.02 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.04);
        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(now + i * 0.02);
        osc.stop(now + i * 0.02 + 0.04);
      });
    } else if (type === 'error') {
      // System Rejection (fast descending digital chirp)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'launch') {
      // Clean high-velocity power surge (no LFO)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.3);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(masterGain!);

      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'capture') {
      // Tactical System Integration (fast double-blip + resonant thrum + static burst)
      
      // 1. Fast Double-Blip (High Precision)
      [2800, 3200].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0, now + i * 0.04);
        gain.gain.linearRampToValueAtTime(0.015, now + i * 0.04 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.03);
        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.05);
      });

      // 2. Resonant Thrum (System Lock)
      const thrumOsc = ctx.createOscillator();
      const thrumGain = ctx.createGain();
      thrumOsc.type = 'triangle';
      thrumOsc.frequency.setValueAtTime(440, now + 0.08);
      thrumOsc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
      thrumGain.gain.setValueAtTime(0, now + 0.08);
      thrumGain.gain.linearRampToValueAtTime(0.02, now + 0.1);
      thrumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      thrumOsc.connect(thrumGain);
      thrumGain.connect(masterGain!);
      thrumOsc.start(now + 0.08);
      thrumOsc.stop(now + 0.4);

      // 3. Digital Static Burst (Hardware Feel)
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.005, now + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      noise.connect(noiseGain);
      noiseGain.connect(masterGain!);
      noise.start(now + 0.08);
      noise.stop(now + 0.13);
    } else if (type === 'charge') {
      // Omni-Strike Charging (rising frequency + pulsing filter)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 1.5);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.02, now + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 1.5);
      
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(now);
      osc.stop(now + 1.5);
    } else if (type === 'omniLaunch') {
      // Massive Orbital Strike (Laser Zap + Sub-Bass Drop + Heavy Crash)
      
      // 1. The Initial Zap (High-energy laser)
      const zapOsc = ctx.createOscillator();
      const zapGain = ctx.createGain();
      zapOsc.type = 'sawtooth';
      zapOsc.frequency.setValueAtTime(2000, now);
      zapOsc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      zapGain.gain.setValueAtTime(0.05, now);
      zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      zapOsc.connect(zapGain);
      zapGain.connect(masterGain!);
      zapOsc.start(now);
      zapOsc.stop(now + 0.3);

      // 2. The Sub-Bass Drop (Massive impact)
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(150, now);
      bassOsc.frequency.exponentialRampToValueAtTime(20, now + 1.5);
      bassGain.gain.setValueAtTime(0.15, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      bassOsc.connect(bassGain);
      bassGain.connect(masterGain!);
      bassOsc.start(now);
      bassOsc.stop(now + 1.5);

      // 3. The Heavy Crash (Filtered white noise)
      const bufferSize = ctx.sampleRate * 1.0; // 1 second of noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      // Filter the noise to make it sound like a heavy explosion, not just static
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 1.0);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.1, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain!);
      
      noise.start(now);
      noise.stop(now + 1.0);
    } else if (type === 'capitalDestroyed') {
      // Massive structural collapse / Supernova
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 2.0);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(now);
      osc.stop(now + 2.0);

      // Heavy rumble noise
      const bufferSize = ctx.sampleRate * 2.0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.linearRampToValueAtTime(50, now + 2.0);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.linearRampToValueAtTime(0, now + 2.0);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain!);
      noise.start(now);
      noise.stop(now + 2.0);
    } else if (type === 'win') {
      // Triumphant ascending chord (C major: C4, E4, G4, C5)
      const freqs = [261.63, 329.63, 392.00, 523.25];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        
        // Slight arpeggio delay
        const startTime = now + i * 0.1;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.05, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);
        
        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(startTime);
        osc.stop(startTime + 2.0);
      });
    } else if (type === 'lose') {
      // Ominous descending power-down
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 2.5);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 2.5);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain!);
      
      osc.start(now);
      osc.stop(now + 2.5);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

let playPromise: Promise<void> | null = null;

export const startMusic = (src: string, enabled: boolean) => {
  if (!src) return;

  // If music already exists and is the same src
  if (bgMusic && bgMusic.src.includes(src)) {
    if (enabled && bgMusic.paused) {
      playPromise = bgMusic.play();
      playPromise.catch(() => {});
    } else if (!enabled && !bgMusic.paused) {
      bgMusic.pause();
    }
    return;
  }

  // Clean up old music
  if (bgMusic) {
    bgMusic.pause();
    bgMusic = null;
  }

  bgMusic = new Audio(src);
  bgMusic.loop = true;
  bgMusic.volume = MUSIC_VOLUME; // Set volume directly instead of using Web Audio API routing
  
  if (enabled) {
    playPromise = bgMusic.play();
    playPromise.catch((e) => {
      console.warn("Autoplay prevented or audio load failed:", e);
    });
  }
};

export const stopMusic = () => {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic = null;
  }
};

export const setMusicEnabled = (enabled: boolean) => {
  if (!bgMusic) return;
  
  if (enabled) {
    if (bgMusic.paused) {
      bgMusic.play().catch(() => {});
    }
  } else {
    if (!bgMusic.paused) {
      bgMusic.pause();
    }
  }
};
