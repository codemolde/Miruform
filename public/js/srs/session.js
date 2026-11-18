// ==================== TIMER MANAGER ====================
const TimerManager = {
  duration: 0,
  remaining: 0,
  intervalId: null,
  isPaused: false,
  autoAdvance: false,
  onTick: null,
  onEnd: null,

  start(durationSec, autoAdvance, onTick, onEnd) {
    this.stop();
    this.duration = durationSec;
    this.remaining = durationSec;
    this.isPaused = false;
    this.autoAdvance = autoAdvance;
    this.onTick = onTick;
    this.onEnd = onEnd;

    if (this.onTick) this.onTick(this.remaining, this.duration);

    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.remaining--;
        if (this.remaining <= 5 && this.remaining > 0) {
          SoundFX.timerTick();
        }
        if (this.onTick) this.onTick(this.remaining, this.duration);

        if (this.remaining <= 0) {
          this.stop();
          SoundFX.timerAlert();
          if (this.onEnd) this.onEnd();
        }
      }
    }, 1000);
  },

  pause() {
    this.isPaused = true;
  },

  resume() {
    this.isPaused = false;
  },

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  },

  reset() {
    this.remaining = this.duration;
    this.isPaused = false;
    if (this.onTick) this.onTick(this.remaining, this.duration);
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPaused = false;
  },

  isRunning() {
    return this.intervalId !== null;
  },

  /** Gentle singing chime using Web Audio API */
  _playSingingChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const freqs = [528, 660, 792]; // Harmonious pentatonic frequencies
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 1.3);
      });
    } catch (e) {
      // Audio not supported or blocked by browser autoplay
    }
  }
};


// ==================== SESSION MANAGER ====================
const SessionManager = {
  deckId: null,
  mode: null,          // 'new', 'review', or 'free'
  tagFilter: null,     // Active sub-deck tag filter (e.g. 'hands', 'foreshortening')
  images: [],          // Images currently in rotation (filtered if tagFilter active)
  allDeckImages: [],   // Unfiltered images in deck folder
  queue: [],           // Queue of image IDs
  currentImage: null,  // Current image object
  imagesShown: 0,
  sessionStats: { again: 0, hard: 0, medium: 0, easy: 0, total: 0 },

  async loadImages(folderPath) {
    const res = await fetch(`/api/images?folder=${encodeURIComponent(folderPath)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load images');
    }
    this.allDeckImages = await res.json();
    this.images = this.allDeckImages;
    return this.images;
  },

  startSession(deckId, mode, images, newLimit, reviewLimit, tagFilter = null) {
    this.deckId = deckId;
    this.mode = mode;
    this.tagFilter = tagFilter ? tagFilter.trim().toLowerCase().replace(/^#/, '') : null;
    this.imagesShown = 0;
    this.sessionStats = { again: 0, hard: 0, medium: 0, easy: 0, total: 0 };

    const deckCards = CardManager.getCardsForDeck(deckId);

    // Merge child focal cards from CardManager into image pool without duplicating files on disk
    const childCards = CardManager.getChildCards(deckId);
    const childImages = childCards.map(c => ({
      id: c.imageId,
      path: c.parentPath,
      hash: c.parentHash,
      name: c.imageName,
      isChild: true,
      crop: c.crop,
      parentImageId: c.parentImageId
    }));

    const basePool = [...(Array.isArray(images) ? images : []), ...childImages];
    this.allDeckImages = basePool;

    // If tagFilter is active, filter image pool exclusively to tagged cards
    let pool = this.allDeckImages;
    if (this.tagFilter) {
      pool = this.allDeckImages.filter(img => {
        const card = deckCards[img.id] || (!img.isChild && img.path && deckCards[img.path]);
        return card && Array.isArray(card.tags) && card.tags.includes(this.tagFilter);
      });
    }
    this.images = pool;

    if (mode === 'free') {
      this.queue = this._shuffle(pool.map(img => img.id));
    } else if (mode === 'new') {
      const unseenIds = pool
        .map(img => img.id)
        .filter(id => {
          const imgObj = pool.find(i => i.id === id);
          const card = deckCards[id] || (!imgObj?.isChild && imgObj?.path && deckCards[imgObj.path]);
          return !card || !card.difficulty;
        });
      this.queue = this._shuffle(unseenIds).slice(0, newLimit);
    } else if (mode === 'review') {
      // Automatic daily queue sorting: orders overdue cards by highest lapse/difficulty priority first
      const dueCards = CardManager.getDueCards(deckId, this.tagFilter, true);
      const dueCardMap = new Map();
      dueCards.forEach(c => dueCardMap.set(c.imageId, c));

      // Filter pool images that are due
      const eligiblePoolImages = pool.filter(img => dueCardMap.has(img.id) || (!img.isChild && img.path && dueCardMap.has(img.path)));

      // Sort pool images in descending order of card priority score
      eligiblePoolImages.sort((a, b) => {
        const cardA = dueCardMap.get(a.id) || dueCardMap.get(a.path);
        const cardB = dueCardMap.get(b.id) || dueCardMap.get(b.path);
        return CardManager.getCardPriority(cardB) - CardManager.getCardPriority(cardA);
      });

      const selected = eligiblePoolImages.slice(0, reviewLimit);
      // SessionManager.nextImage() pops from the end of this.queue.
      // Reversing the priority-sorted array guarantees that the highest priority card is popped FIRST.
      this.queue = selected.map(img => img.id).reverse();
    }
  },

  nextImage() {
    if (this.queue.length === 0) {
      if (this.mode === 'free') {
        this.queue = this._shuffle(this.images.map(img => img.id));
      } else {
        this.currentImage = null;
        return null;
      }
    }

    const imageId = this.queue.pop();
    this.currentImage = this.images.find(img => img.id === imageId) || this.allDeckImages.find(img => img.id === imageId);
    this.imagesShown++;
    return this.currentImage;
  },

  requeueCard(imageId) {
    if (!imageId) return;
    if (this.queue.length > 3) {
      const insertIdx = Math.max(0, this.queue.length - 3);
      this.queue.splice(insertIdx, 0, imageId);
    } else {
      this.queue.unshift(imageId);
    }
  },

  getImageUrl(imageOrId) {
    if (!imageOrId) return '';
    if (typeof imageOrId === 'object') {
      const target = imageOrId.path || imageOrId.id;
      return `/api/image?path=${encodeURIComponent(target)}`;
    }
    const found = (this.images || []).find(img => img.id === imageOrId || img.hash === imageOrId || img.path === imageOrId)
      || (this.allDeckImages || []).find(img => img.id === imageOrId || img.hash === imageOrId || img.path === imageOrId);
    const target = found ? (found.path || found.id) : imageOrId;
    return `/api/image?path=${encodeURIComponent(target)}`;
  },

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
};


if (typeof window !== 'undefined') {
  window.TimerManager = TimerManager;
  window.SessionManager = SessionManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TimerManager = TimerManager;
  globalThis.SessionManager = SessionManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TimerManager,
    SessionManager
  };
}
