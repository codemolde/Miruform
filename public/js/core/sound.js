// ==================== TACTILE SOUND FX (Web Audio API) ====================
const SoundFX = {
  ctx: null,
  enabled: true,

  init() {
    const saved = localStorage.getItem('artpractice_sound_enabled');
    this.enabled = saved !== null ? saved === 'true' : true;
    this.updateUI();

    // Aggressively unlock Web Audio context on any user touch/click/key
    const unlockAudio = () => {
      const ctx = this._getCtx();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    };
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'].forEach(ev => {
      window.addEventListener(ev, unlockAudio, { passive: true });
    });
  },

  _getCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  _play(fn) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          try { fn(ctx, ctx.currentTime); } catch (e) { }
        }).catch(() => { });
      } else {
        fn(ctx, ctx.currentTime);
      }
    } catch (e) { }
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('artpractice_sound_enabled', String(this.enabled));
    this.updateUI();
    if (this.enabled) {
      this.chirp();
    }
    return this.enabled;
  },

  updateUI() {
    const text = this.enabled ? 'Sound' : 'Muted';
    const soundIconEl = document.getElementById('sound-icon');
    const soundTextEl = document.getElementById('sound-text');
    const iconSvg = typeof UI !== 'undefined' && UI.getIconSvg ? UI.getIconSvg(this.enabled ? 'volume' : 'volume-x', 14) : '';
    if (soundIconEl && iconSvg) soundIconEl.innerHTML = iconSvg;
    if (soundTextEl) soundTextEl.textContent = text;

    const detailIconEl = document.getElementById('detail-sound-icon');
    if (detailIconEl && iconSvg) detailIconEl.innerHTML = iconSvg;

    const sessionIconEl = document.getElementById('session-sound-icon');
    if (sessionIconEl && iconSvg) sessionIconEl.innerHTML = iconSvg;

    const btn1 = document.getElementById('btn-toggle-sound');
    if (btn1) {
      btn1.classList.toggle('btn-muted', !this.enabled);
      btn1.title = this.enabled ? 'Sound FX: On (Click to mute)' : 'Sound FX: Muted (Click to unmute)';
    }
    const btn2 = document.getElementById('btn-detail-sound');
    if (btn2) {
      btn2.classList.toggle('btn-muted', !this.enabled);
      btn2.title = this.enabled ? 'Sound FX: On (Click to mute)' : 'Sound FX: Muted (Click to unmute)';
    }
    const btn3 = document.getElementById('btn-session-sound');
    if (btn3) btn3.classList.toggle('btn-muted', !this.enabled);
  },

  // Highlighting & Fluid Tactile Click (water droplet pop + crystal snap + tactile thump)
  click() {
    this._play((ctx, t) => {
      // Micro-pitch variance (±5%) for rich organic, non-fatiguing fluidity
      const pitch = 1 + (Math.random() - 0.5) * 0.1;

      // Master output gain node
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.38, t);
      master.connect(ctx.destination);

      // --- Layer 1: Resonant Water Droplet "Bloop" Swoop ---
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const dropFilter = ctx.createBiquadFilter();

      dropOsc.type = 'sine';
      // Classic water droplet pop: starts at resonant high and sweeps down with body
      dropOsc.frequency.setValueAtTime(640 * pitch, t);
      dropOsc.frequency.exponentialRampToValueAtTime(240 * pitch, t + 0.08);

      // Peaking formant filter gives unmistakable fluid droplet resonance
      dropFilter.type = 'peaking';
      dropFilter.frequency.setValueAtTime(720 * pitch, t);
      dropFilter.Q.setValueAtTime(4.2, t);
      dropFilter.gain.setValueAtTime(6, t);

      dropGain.gain.setValueAtTime(0.001, t);
      dropGain.gain.linearRampToValueAtTime(0.85, t + 0.004);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      dropOsc.connect(dropFilter);
      dropFilter.connect(dropGain);
      dropGain.connect(master);
      dropOsc.start(t);
      dropOsc.stop(t + 0.12);

      // --- Layer 2: Highlighting Crystalline Glass Ping ---
      const glassOsc = ctx.createOscillator();
      const glassGain = ctx.createGain();
      const glassFilter = ctx.createBiquadFilter();

      glassOsc.type = 'triangle';
      glassOsc.frequency.setValueAtTime(2200 * pitch, t);
      glassOsc.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.07);

      glassFilter.type = 'highpass';
      glassFilter.frequency.setValueAtTime(1100, t);

      glassGain.gain.setValueAtTime(0.001, t);
      glassGain.gain.linearRampToValueAtTime(0.35, t + 0.002);
      glassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      glassOsc.connect(glassFilter);
      glassFilter.connect(glassGain);
      glassGain.connect(master);
      glassOsc.start(t);
      glassOsc.stop(t + 0.085);

      // --- Layer 3: Warm Tactile Sub Body ---
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(130 * pitch, t);
      subOsc.frequency.exponentialRampToValueAtTime(55 * pitch, t + 0.05);

      subGain.gain.setValueAtTime(0.001, t);
      subGain.gain.linearRampToValueAtTime(0.5, t + 0.003);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(t);
      subOsc.stop(t + 0.065);
    });
  },

  // Silky fluid droplet hover
  hover() {
    this._play((ctx, t) => {
      const pitch = 1 + (Math.random() - 0.5) * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750 * pitch, t);
      filter.Q.setValueAtTime(3.0, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(820 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(540 * pitch, t + 0.035);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.045);
    });
  },

  // Card rating sounds (Again, Hard, Medium, Easy)
  rate(diff) {
    this._play((ctx, t) => {
      if (diff === 'again') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.22);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      } else if (diff === 'hard') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.23);
      } else if (diff === 'medium') {
        [440, 554.37].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const start = t + idx * 0.05;
          osc.frequency.setValueAtTime(f, start);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.38);
        });
      } else if (diff === 'easy') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const start = t + idx * 0.06;
          osc.frequency.setValueAtTime(f, start);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.58);
        });
      }
    });
  },

  // Soft organic tick when timer <= 5s
  timerTick() {
    this._play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(580, t + 0.03);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    });
  },

  // Zen singing bowl when timer runs out
  timerAlert() {
    this._play((ctx, t) => {
      [528, 660, 792].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = t + idx * 0.07;
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.5);
      });
    });
  },

  // Session complete victory fanfare
  sessionComplete() {
    this._play((ctx, t) => {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx >= 3 ? 'sine' : 'triangle';
        const start = t + idx * 0.08;
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.2);
      });
    });
  },

  // Snappy pop for toolbar items
  toolToggle() {
    this._play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(940, t + 0.035);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.045);
    });
  },

  // Chirp when unmuting
  chirp() {
    this._play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(820, t + 0.07);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  },

  // Short pleasant chime when adding a card
  cardAdd() {
    this._play((ctx, t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08); // A5

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }
};

if (typeof window !== 'undefined') {
  window.SoundFX = SoundFX;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SoundFX = SoundFX;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundFX;
}
