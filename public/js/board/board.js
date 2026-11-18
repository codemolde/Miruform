// ==================== BOARD MANAGER (REFERENCE BOARD & GALLERY) ====================
const BoardManager = {
  activeDeckId: null,
  allReferences: [],
  filteredReferences: [],
  searchQuery: '',
  selectedTag: null,
  selectedRef: null,
  currentIndex: -1,
  isStageOpen: false,
  slideshowIntervalSec: 0,
  slideshowTimerId: null,
  slideshowPaused: false,
  gridScrollTop: 0,
  gridSize: 'medium',

  init(deckId, images) {
    this.activeDeckId = deckId;
    this.allReferences = Array.isArray(images) ? images : [];
    this.filteredReferences = [...this.allReferences];
    this.searchQuery = '';
    this.selectedTag = null;
    this.selectedRef = null;
    this.currentIndex = -1;
    this.isStageOpen = false;
    this.slideshowIntervalSec = 0;
    this.slideshowPaused = false;
    this.gridScrollTop = 0;
    this.stopSlideshow();
  },

  selectReference(ref) {
    this.selectedRef = ref;
    const list = (this.filteredReferences && this.filteredReferences.length > 0)
      ? this.filteredReferences
      : (this.allReferences || []);
    if (ref && list.length > 0) {
      const idx = list.findIndex(r => r.id === ref.id || (r.path && r.path === ref.path));
      this.currentIndex = idx >= 0 ? idx : 0;
    } else {
      this.currentIndex = -1;
    }
    return this.selectedRef;
  },

  openStage(ref) {
    if (ref) this.selectReference(ref);
    this.isStageOpen = true;
    if (this.slideshowIntervalSec > 0) {
      this.startSlideshowTimer();
    }
    return this.selectedRef;
  },

  closeStage() {
    this.isStageOpen = false;
    this.stopSlideshow();
  },

  prevReference() {
    const list = (this.filteredReferences && this.filteredReferences.length > 0)
      ? this.filteredReferences
      : (this.allReferences || []);
    if (!list || list.length === 0) return null;
    const total = list.length;
    let nextIdx = (this.currentIndex >= 0 ? this.currentIndex : 0) - 1;
    if (nextIdx < 0) nextIdx = total - 1;
    const nextRef = list[nextIdx];
    this.selectReference(nextRef);
    if (this.slideshowIntervalSec > 0 && !this.slideshowPaused) {
      this.startSlideshowTimer();
    }
    return nextRef;
  },

  nextReference() {
    const list = (this.filteredReferences && this.filteredReferences.length > 0)
      ? this.filteredReferences
      : (this.allReferences || []);
    if (!list || list.length === 0) return null;
    const total = list.length;
    let nextIdx = ((this.currentIndex >= 0 ? this.currentIndex : 0) + 1) % total;
    const nextRef = list[nextIdx];
    this.selectReference(nextRef);
    if (this.slideshowIntervalSec > 0 && !this.slideshowPaused) {
      this.startSlideshowTimer();
    }
    return nextRef;
  },

  setSlideshowInterval(sec) {
    const s = Math.max(0, parseInt(sec, 10) || 0);
    this.slideshowIntervalSec = s;
    this.stopSlideshowTimer();
    this.slideshowPaused = false;
    if (s > 0 && this.isStageOpen) {
      this.startSlideshowTimer();
    }
  },

  startSlideshowTimer() {
    this.stopSlideshowTimer();
    if (this.slideshowIntervalSec <= 0 || !this.isStageOpen) return;
    this.slideshowTimerId = setInterval(() => {
      if (this.slideshowPaused || !this.isStageOpen) return;
      if (typeof UI !== 'undefined' && UI.stepBoardReference) {
        UI.stepBoardReference('next');
      } else {
        this.nextReference();
      }
    }, this.slideshowIntervalSec * 1000);
  },

  stopSlideshowTimer() {
    if (this.slideshowTimerId) {
      clearInterval(this.slideshowTimerId);
      this.slideshowTimerId = null;
    }
  },

  pauseSlideshow() {
    this.slideshowPaused = true;
  },

  resumeSlideshow() {
    this.slideshowPaused = false;
  },

  toggleSlideshowPause() {
    this.slideshowPaused = !this.slideshowPaused;
    return this.slideshowPaused;
  },

  stopSlideshow() {
    this.stopSlideshowTimer();
    this.slideshowPaused = false;
    this.slideshowIntervalSec = 0;
  },

  setGridSize(size) {
    if (['small', 'medium', 'large'].includes(size)) {
      this.gridSize = size;
    }
    return this.gridSize;
  },

  reset() {
    this.activeDeckId = null;
    this.allReferences = [];
    this.filteredReferences = [];
    this.searchQuery = '';
    this.selectedTag = null;
    this.selectedRef = null;
    this.currentIndex = -1;
    this.isStageOpen = false;
    this.gridScrollTop = 0;
    this.stopSlideshow();
  }
};

if (typeof window !== 'undefined') {
  window.BoardManager = BoardManager;
}

if (typeof window !== 'undefined') {
  window.BoardManager = BoardManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.BoardManager = BoardManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BoardManager
  };
}
