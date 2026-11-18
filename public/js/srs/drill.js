// ==================== MEMORY DRILL (FLASH & RECALL STATE MACHINE) ====================
const FlashRecallManager = {
  enabled: false,
  observeSec: 15,
  drawSec: 120, // 0 = No Limit
  veilMode: 'blackout', // 'blackout' | 'blur'
  phase: 'idle', // 'idle' | 'observe' | 'draw' | 'reveal'
  phaseRemaining: 0,
  intervalId: null,
  currentCard: null,
  drillStartTime: null,

  init() {
    try {
      this.enabled = localStorage.getItem('artpractice_drill_enabled') === 'true';
      const obs = parseInt(localStorage.getItem('artpractice_drill_observe'), 10);
      if ([10, 15, 20, 30].includes(obs)) this.observeSec = obs;
      const drw = parseInt(localStorage.getItem('artpractice_drill_draw'), 10);
      if ([0, 60, 120, 180, 300].includes(drw)) this.drawSec = drw;
      const veil = localStorage.getItem('artpractice_drill_veil');
      if (['blackout', 'blur'].includes(veil)) this.veilMode = veil;
    } catch (e) { }
  },

  setEnabled(val) {
    this.enabled = Boolean(val);
    try { localStorage.setItem('artpractice_drill_enabled', String(this.enabled)); } catch (e) { }
    return this.enabled;
  },

  setObserveSec(sec) {
    const s = parseInt(sec, 10);
    if ([10, 15, 20, 30].includes(s)) {
      this.observeSec = s;
      try { localStorage.setItem('artpractice_drill_observe', String(s)); } catch (e) { }
    }
    return this.observeSec;
  },

  setDrawSec(sec) {
    const s = parseInt(sec, 10);
    if ([0, 60, 120, 180, 300].includes(s)) {
      this.drawSec = s;
      try { localStorage.setItem('artpractice_drill_draw', String(s)); } catch (e) { }
    }
    return this.drawSec;
  },

  setVeilMode(mode) {
    if (['blackout', 'blur'].includes(mode)) {
      this.veilMode = mode;
      try { localStorage.setItem('artpractice_drill_veil', mode); } catch (e) { }
    }
    return this.veilMode;
  },

  getElapsedDrillDuration() {
    if (!this.drillStartTime) return this.observeSec + (this.drawSec || 0);
    return Math.max(1, Math.round((Date.now() - this.drillStartTime) / 1000));
  },

  getMasteryChallenge(card) {
    if (!card || (card.easeFactor !== undefined && card.easeFactor <= 2.4) || (card.interval || 0) <= 7) {
      return null;
    }
    const challenges = [
      'Mastery Challenge: Rotate camera +45° horizontally',
      'Mastery Challenge: Flip key light to opposite top-right',
      'Mastery Challenge: Draw from lower 3/4 perspective',
      'Mastery Challenge: Exaggerate dynamic perspective tilt +15°',
      'Mastery Challenge: Invert primary light source from below (uplighting)',
      'Mastery Challenge: Shift to bird\'s-eye view (high vantage point)'
    ];
    const key = String(card.imageId || card.imageName || card.id || 'mastery');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return challenges[Math.abs(hash) % challenges.length];
  },

  // Starts card lifecycle when a study card loads
  startCard(deckId, image) {
    this.resetTimer();
    if (!this.enabled || !image) {
      this.hideHUD();
      return false;
    }

    // Board sessions must NEVER activate Flash & Recall
    if (typeof UI !== 'undefined' && (UI.sessionSource === 'board' || UI.isBoardStageOpen)) {
      this.reset();
      return false;
    }

    this.drillStartTime = Date.now();
    const card = (typeof CardManager !== 'undefined' && deckId)
      ? CardManager.getCard(deckId, image.id)
      : null;
    this.currentCard = card;

    this.transitionToObserve();
    return true;
  },

  transitionToObserve() {
    this.resetTimer();
    this.phase = 'observe';
    this.phaseRemaining = this.observeSec;

    // Veil must remain hidden in Phase 1
    if (typeof UI !== 'undefined' && UI.clearBlurOverlay) {
      UI.clearBlurOverlay(true);
    }
    const overlay = document.getElementById('image-blur-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('drill-blind-active', 'drill-veil-blackout', 'drill-veil-blur');
    }
    const recallCard = document.getElementById('drill-recall-card');
    if (recallCard) recallCard.classList.add('hidden');

    const critiqueActions = document.getElementById('drill-critique-actions');
    if (critiqueActions) critiqueActions.classList.add('hidden');

    // Rating area locked/dimmed during OBSERVE
    const ratingArea = document.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.add('drill-rating-locked');

    // Rating dock collapsed during OBSERVE
    if (typeof UI !== 'undefined' && UI.toggleRatingDock) {
      UI.toggleRatingDock(false);
      document.body.classList.remove('rating-required');
    }

    this.updateHUD();
    this.showHUD();

    // Single-interval countdown
    this.intervalId = setInterval(() => {
      this.phaseRemaining--;
      if (this.phaseRemaining <= 3 && this.phaseRemaining > 0) {
        if (typeof SoundFX !== 'undefined' && SoundFX.timerTick) {
          SoundFX.timerTick();
        }
      }
      this.updateHUD();

      if (this.phaseRemaining <= 0) {
        this.resetTimer();
        if (typeof SoundFX !== 'undefined' && SoundFX.timerAlert) {
          SoundFX.timerAlert();
        }
        this.transitionToDraw();
      }
    }, 1000);
  },

  transitionToDraw() {
    this.resetTimer();
    this.phase = 'draw';
    this.phaseRemaining = this.drawSec; // 0 = No Limit

    // Engage veil overlay
    const overlay = document.getElementById('image-blur-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('drill-blind-active');
      if (this.veilMode === 'blur') {
        overlay.classList.add('drill-veil-blur');
        overlay.classList.remove('drill-veil-blackout');
      } else {
        overlay.classList.add('drill-veil-blackout');
        overlay.classList.remove('drill-veil-blur');
      }
    }
    if (typeof UI !== 'undefined') {
      UI.imageBlurred = true;
      if (UI.toggleRatingDock) UI.toggleRatingDock(false);
      document.body.classList.remove('rating-required');
    }

    const critiqueActions = document.getElementById('drill-critique-actions');
    if (critiqueActions) critiqueActions.classList.add('hidden');

    // Rating area remains locked/dimmed during BLIND_DRAW
    const ratingArea = document.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.add('drill-rating-locked');

    // Render recall prompt card inside veil
    const recallCard = document.getElementById('drill-recall-card');
    const masteryContainer = document.getElementById('drill-mastery-container');
    if (recallCard) {
      recallCard.classList.remove('hidden');
      if (masteryContainer) {
        const challenge = this.getMasteryChallenge(this.currentCard);
        if (challenge) {
          const escChallenge = (typeof UI !== 'undefined' && UI._esc) ? UI._esc(challenge) : challenge;
          masteryContainer.innerHTML = `
            <div class="drill-mastery-badge">
              <span class="mastery-sparkle" aria-hidden="true">⚡</span>
              <span>${escChallenge}</span>
            </div>
          `;
          masteryContainer.classList.remove('hidden');
        } else {
          masteryContainer.innerHTML = '';
          masteryContainer.classList.add('hidden');
        }
      }
    }

    this.updateHUD();
    this.showHUD();

    // Timer handling for Draw Phase
    if (this.drawSec > 0) {
      this.intervalId = setInterval(() => {
        this.phaseRemaining--;
        if (this.phaseRemaining <= 3 && this.phaseRemaining > 0) {
          if (typeof SoundFX !== 'undefined' && SoundFX.timerTick) {
            SoundFX.timerTick();
          }
        }
        this.updateHUD();

        if (this.phaseRemaining <= 0) {
          this.resetTimer();
          this.transitionToReveal();
        }
      }, 1000);
    }
  },

  transitionToReveal() {
    this.resetTimer();
    this.phase = 'reveal';
    this.phaseRemaining = 0;

    // Lift veil
    const overlay = document.getElementById('image-blur-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('drill-blind-active', 'drill-veil-blackout', 'drill-veil-blur');
    }
    const recallCard = document.getElementById('drill-recall-card');
    if (recallCard) recallCard.classList.add('hidden');

    // Unlock rating area for critique and grade
    const ratingArea = document.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.remove('drill-rating-locked');

    // Show self-critique quick actions
    const critiqueActions = document.getElementById('drill-critique-actions');
    if (critiqueActions) critiqueActions.classList.remove('hidden');

    if (typeof UI !== 'undefined') {
      UI.imageBlurred = false;
      // Open ratings for critique
      if (UI.toggleRatingDock) UI.toggleRatingDock(true);
      document.body.classList.add('rating-required');
      if (UI.wakeHud) UI.wakeHud();
    }

    // Soft audio cue on reveal
    if (typeof SoundFX !== 'undefined') {
      if (typeof SoundFX.rate === 'function') {
        SoundFX.rate('medium');
      } else if (typeof SoundFX.click === 'function') {
        SoundFX.click();
      }
    }

    this.updateHUD();
    this.showHUD();
  },

  updateHUD() {
    const textEl = document.getElementById('drill-hud-phase-text');
    const actionBtn = document.getElementById('btn-drill-action');
    const critiqueActions = document.getElementById('drill-critique-actions');
    if (!textEl) return;

    if (this.phase === 'observe') {
      const mins = Math.floor(Math.max(0, this.phaseRemaining) / 60);
      const secs = Math.max(0, this.phaseRemaining) % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      textEl.textContent = `OBSERVE · ${timeStr}`;
      if (actionBtn) {
        actionBtn.textContent = 'Draw Now →';
        actionBtn.classList.remove('hidden');
      }
      if (critiqueActions) critiqueActions.classList.add('hidden');
    } else if (this.phase === 'draw') {
      if (this.drawSec > 0) {
        const mins = Math.floor(Math.max(0, this.phaseRemaining) / 60);
        const secs = Math.max(0, this.phaseRemaining) % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        textEl.textContent = `BLIND DRAW · ${timeStr}`;
      } else {
        textEl.textContent = 'BLIND DRAW · Untimed';
      }
      if (actionBtn) {
        actionBtn.textContent = 'Reveal & Critique →';
        actionBtn.classList.remove('hidden');
      }
      if (critiqueActions) critiqueActions.classList.add('hidden');
    } else if (this.phase === 'reveal') {
      textEl.textContent = 'CRITIQUE & GRADE';
      if (actionBtn) {
        actionBtn.classList.add('hidden');
      }
      if (critiqueActions) {
        critiqueActions.classList.remove('hidden');
      }
    } else {
      textEl.textContent = '';
      if (actionBtn) actionBtn.classList.add('hidden');
      if (critiqueActions) critiqueActions.classList.add('hidden');
    }
  },

  showHUD() {
    const hud = document.getElementById('drill-stage-hud');
    if (hud) hud.classList.remove('hidden');
    const timerDisp = document.getElementById('timer-display');
    if (timerDisp) timerDisp.classList.add('hidden');
  },

  hideHUD() {
    const hud = document.getElementById('drill-stage-hud');
    if (hud) hud.classList.add('hidden');
  },

  resetTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  reset() {
    this.resetTimer();
    this.phase = 'idle';
    this.phaseRemaining = 0;
    this.currentCard = null;
    this.drillStartTime = null;
    this.hideHUD();
    const overlay = document.getElementById('image-blur-overlay');
    if (overlay) {
      overlay.classList.remove('drill-blind-active', 'drill-veil-blackout', 'drill-veil-blur');
    }
    const recallCard = document.getElementById('drill-recall-card');
    if (recallCard) recallCard.classList.add('hidden');
    const critiqueActions = document.getElementById('drill-critique-actions');
    if (critiqueActions) critiqueActions.classList.add('hidden');
    const ratingArea = document.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.remove('drill-rating-locked');
  }
};

const MemoryDrillManager = FlashRecallManager;

if (typeof window !== 'undefined') {
  window.MemoryDrillManager = MemoryDrillManager;
  window.FlashRecallManager = FlashRecallManager;
}

if (typeof window !== 'undefined') {
  window.MemoryDrillManager = MemoryDrillManager;
  window.FlashRecallManager = FlashRecallManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.MemoryDrillManager = MemoryDrillManager;
  globalThis.FlashRecallManager = FlashRecallManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FlashRecallManager,
    MemoryDrillManager
  };
}
