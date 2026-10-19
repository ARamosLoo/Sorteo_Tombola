/**
 * Audio Engine using Web Audio API
 * 100% Autonomous, works offline, zero external audio asset dependencies.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('inei_sorteo_muted') === 'true';
    this.drumrollLoop = null;
    this.initialized = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('inei_sorteo_muted', this.isMuted);
    if (this.isMuted) {
      this.stopDrumroll();
    }
    return this.isMuted;
  }

  // Quick mechanical tick for slot / number scroll
  playTick(frequency = 750, duration = 0.035) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + duration);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // AudioContext error safeguard
    }
  }

  // Tension whoosh or ball bounce
  playBallBounce() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = 300 + Math.random() * 200;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  // Continuous drumroll using filtered synthesized noise
  startDrumroll() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    this.stopDrumroll();

    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate pinkish noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.35;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Filter for drum body
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);
      filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      // Rhythmic tremolo
      const tremolo = this.ctx.createOscillator();
      tremolo.frequency.setValueAtTime(26, this.ctx.currentTime); // 26 hits per second
      const tremoloGain = this.ctx.createGain();
      tremoloGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      tremolo.connect(tremoloGain.gain);

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(tremoloGain);
      tremoloGain.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      tremolo.start();
      noise.start();

      this.drumrollLoop = { noise, tremolo, masterGain, filter };
    } catch (e) {
      console.warn('Drumroll error:', e);
    }
  }

  stopDrumroll() {
    if (this.drumrollLoop) {
      try {
        const now = this.ctx ? this.ctx.currentTime : 0;
        if (this.drumrollLoop.masterGain && this.ctx) {
          this.drumrollLoop.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
        }
        setTimeout(() => {
          try {
            if (this.drumrollLoop) {
              this.drumrollLoop.noise.stop();
              this.drumrollLoop.tremolo.stop();
              this.drumrollLoop = null;
            }
          } catch (e) {}
        }, 120);
      } catch (e) {
        this.drumrollLoop = null;
      }
    }
  }

  // Triumphant orchestral brass fanfare on winning
  playFanfare() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      this.stopDrumroll();
      const now = this.ctx.currentTime;

      // Notes: G3 (196), C4 (261.63), E4 (329.63), G4 (392.00), C5 (523.25)
      const sequence = [
        { freq: 261.63, time: 0.0, dur: 0.14 },
        { freq: 329.63, time: 0.14, dur: 0.14 },
        { freq: 392.00, time: 0.28, dur: 0.18 },
        { freq: 523.25, time: 0.46, dur: 0.9 },
        // Harmonic layers for the big finish chord at 0.46
        { freq: 659.25, time: 0.46, dur: 0.9 }, // E5
        { freq: 783.99, time: 0.46, dur: 0.9 }, // G5
        { freq: 1046.50, time: 0.46, dur: 0.9 } // C6
      ];

      sequence.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Brass-like sawtooth blended with square
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        const startTime = now + note.time;
        const endTime = startTime + note.dur;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.03);
        gain.gain.setValueAtTime(0.15, endTime - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });

      // Add triumphant stadium crowd cheer
      this.playCrowdCheer(now + 0.3);
    } catch (e) {
      console.warn('Fanfare error:', e);
    }
  }

  // Ambient crowd cheer & applause effect
  playCrowdCheer(delayTime = 0) {
    if (this.isMuted || !this.ctx) return;

    try {
      const startTime = delayTime || this.ctx.currentTime;
      const duration = 2.5;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        // Clapping pulses
        const clap = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 3 : 0;
        data[i] = (Math.random() * 2 - 1) * 0.4 + clap;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, startTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.4);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(startTime);
      noise.stop(startTime + duration);
    } catch (e) {}
  }

  // Descending "wah-wah" for a ball that does not win (same synth family as the fanfare)
  playMissSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      this.stopDrumroll();
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 392.0, time: 0.0, dur: 0.22 },  // G4
        { freq: 349.23, time: 0.24, dur: 0.22 }, // F4
        { freq: 311.13, time: 0.48, dur: 0.22 }, // Eb4
        { freq: 233.08, time: 0.72, dur: 0.7 },  // Bb3, long falling tail
      ];

      notes.forEach((note, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + note.time;
        const end = start + note.dur;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, start);
        // Last note slides down like a deflating balloon
        osc.frequency.exponentialRampToValueAtTime(i === notes.length - 1 ? note.freq * 0.6 : note.freq * 0.94, end);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      });
    } catch (e) {}
  }

  // Pop sound for confetti explosions
  playPop() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }
}

// Global sound manager instance
window.soundEngine = new SoundEngine();
