// sound.js — Web Audio API sound system

export class SoundSystem {
  constructor() {
    this.enabled = true;
    this.ctx     = null;
    this.bgGain  = null;
    this.sfxGain = null;
    this._bgTimer = null;
    this._initialized = false;
  }

  // Must be called after a user gesture
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.bgGain  = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.bgGain.gain.value  = 0.25;
    this.sfxGain.gain.value = 0.5;
    this.bgGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this._startBGM();
  }

  // ── Procedural BGM ────────────────────────────────────────
  _startBGM() {
    if (!this.enabled || !this.ctx) return;
    const bpm  = 140;
    const beat = 60 / bpm;
    const loop = beat * 8;

    const schedule = (time) => {
      [0, beat * 2, beat * 4, beat * 6].forEach(t => this._kick(time + t));
      for (let i = 0; i < 8; i++) this._hihat(time + i * beat * 0.5, i % 2 === 0 ? 0.4 : 0.2);
      [55, 55, 65, 55, 50, 55, 65, 73].forEach((freq, i) => this._bass(time + i * beat, freq));
    };

    let nextTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.enabled) return;
      while (nextTime < this.ctx.currentTime + 0.3) {
        schedule(nextTime);
        nextTime += loop;
      }
      this._bgTimer = setTimeout(tick, 100);
    };
    tick();
  }

  _kick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.bgGain);
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.start(time); osc.stop(time + 0.3);
  }

  _hihat(time, vol = 0.3) {
    if (!this.ctx) return;
    const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src  = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 8000;
    src.buffer = buf;
    src.connect(filt); filt.connect(gain); gain.connect(this.bgGain);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    src.start(time); src.stop(time + 0.05);
  }

  _bass(time, freq) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain); gain.connect(this.bgGain);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.start(time); osc.stop(time + 0.25);
  }

  // ── SFX ──────────────────────────────────────────────────
  playCoin() {
    if (!this.enabled || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.start(); osc.stop(this.ctx.currentTime + 0.15);
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  playMagnet() {
    if (!this.enabled || !this.ctx) return;
    // Ascending chime — magnetic pickup feel
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
  }

  playBoost() {
    if (!this.enabled || !this.ctx) return;
    // Rising whoosh
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const dist = this.ctx.createWaveShaper();
    // Simple distortion curve
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = (i / 128 - 1) * 0.5;
    dist.curve = curve;
    osc.connect(dist); dist.connect(gain); gain.connect(this.sfxGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.start(); osc.stop(this.ctx.currentTime + 0.4);
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.start(); osc.stop(this.ctx.currentTime + 0.25);
  }

  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    [440, 330, 220, 165].forEach((f, i) => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const t = this.ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
  }

  playFootstep() {
    if (!this.enabled || !this.ctx) return;
    const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src  = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 400;
    src.buffer = buf;
    src.connect(filt); filt.connect(gain); gain.connect(this.sfxGain);
    gain.gain.value = 0.15;
    src.start(); src.stop(this.ctx.currentTime + 0.04);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.bgGain)  this.bgGain.gain.value  = this.enabled ? 0.25 : 0;
    if (this.sfxGain) this.sfxGain.gain.value = this.enabled ? 0.5  : 0;
    if (this.enabled && this.ctx) this._startBGM();
    else if (this._bgTimer) clearTimeout(this._bgTimer);
    return this.enabled;
  }

  stopBGM() {
    if (this._bgTimer) clearTimeout(this._bgTimer);
    if (this.bgGain) this.bgGain.gain.value = 0;
  }

  resumeBGM() {
    if (!this.enabled) return;
    if (this.bgGain) this.bgGain.gain.value = 0.25;
    this._startBGM();
  }
}
