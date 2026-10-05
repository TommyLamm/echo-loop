export class SoundEngine {
  private static instance: SoundEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private isUnlocked: boolean = false;
  private isMuted: boolean = false;

  private bgmTimer: number | null = null;
  private currentStep: number = 0;
  private bpm: number = 124;
  private isBgmPlaying: boolean = false;

  private lastTickSecond: number = -1;

  public static get(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  public unlock(): void {
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.8, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        this.bgmGain.connect(this.masterGain);
      }

      this.isUnlocked = true;
      if (!this.isBgmPlaying) {
        this.startBgm();
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.8, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // 1. 時鐘滴答聲 (倒數每整秒響一次，最後3秒雙音急促)
  public updateClockTick(remainingSeconds: number): void {
    if (remainingSeconds <= 0) return;
    const currentSec = Math.floor(remainingSeconds);
    if (currentSec !== this.lastTickSecond) {
      this.lastTickSecond = currentSec;
      this.playClockTick(remainingSeconds);
    }
  }

  public resetClockTick(): void {
    this.lastTickSecond = -1;
  }

  public playClockTick(remainingSeconds: number): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const isUrgent = remainingSeconds <= 3.2;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isUrgent ? 'sawtooth' : 'sine';
    const startFreq = isUrgent ? 880 : 540;
    const endFreq = isUrgent ? 220 : 160;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);

    gain.gain.setValueAtTime(isUrgent ? 0.28 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.045);

    if (isUrgent) {
      // 雙擊急促聲
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(1040, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(300, now + 0.095);
      gain2.gain.setValueAtTime(0.2, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.095);
    }
  }

  // 2. 踏板開關機械喀噠聲
  public playPedalClick(isPressed: boolean): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const startFreq = isPressed ? 280 : 420;
    const endFreq = isPressed ? 80 : 200;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.07);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.07);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // 3. 量子倒流音效 (Rewind Swoosh)
  public playRewindSwoosh(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const duration = 0.55;

    // 白噪聲掃頻
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + duration * 0.7);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // 逆向低頻音
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + duration);
    oscGain.gain.setValueAtTime(0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  // 4. 時空特工衝刺 (Blink Dash)
  public playDash(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.13);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 5. 數據核心奪取 (Core Acquired - 華麗四音琶音)
  public playCoreAcquired(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startTime = now + i * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.24, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // 6. 特工被雷射氣化或殘影悖論消散
  public playVaporized(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 7. 通關勝利 (Victory Jingle)
  public playVictory(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = now + idx * 0.1;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(st);
      osc.stop(st + 0.5);
    });
  }

  // 8. 賽博龐克 Synthwave BGM (16 步進合成器)
  public startBgm(): void {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    const stepDuration = 60 / this.bpm / 4; // 16分音符
    const bassScale = [55, 55, 65.4, 55, 73.4, 55, 82.4, 73.4]; // A1, C2, D2, E2

    const scheduleNext = () => {
      if (!this.isBgmPlaying) return;
      if (this.ctx && this.bgmGain && !this.isMuted) {
        const now = this.ctx.currentTime;

        // Bass 貝斯重拍 (偶數拍)
        if (this.currentStep % 2 === 0) {
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          const noteIdx = Math.floor(this.currentStep / 2) % bassScale.length;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(bassScale[noteIdx], now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(450, now);
          filter.frequency.exponentialRampToValueAtTime(120, now + stepDuration * 1.6);

          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.6);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.bgmGain);

          osc.start(now);
          osc.stop(now + stepDuration * 1.6);
        }

        // 電子 Hi-Hat (奇數拍輕敲)
        if (this.currentStep % 2 === 1) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(3500 + (this.currentStep % 4) * 800, now);
          gain.gain.setValueAtTime(0.035, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

          osc.connect(gain);
          gain.connect(this.bgmGain);
          osc.start(now);
          osc.stop(now + 0.03);
        }
      }

      this.currentStep = (this.currentStep + 1) % 16;
      this.bgmTimer = window.setTimeout(scheduleNext, stepDuration * 1000);
    };

    scheduleNext();
  }

  public stopBgm(): void {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
