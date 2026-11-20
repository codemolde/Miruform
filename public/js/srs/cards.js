// ==================== TAG PRESETS ====================
const TAG_PRESETS = [
  { id: 'hands', label: 'Hands', icon: 'hand', key: '1' },
  { id: 'foreshortening', label: 'Foreshortening', icon: 'perspective', key: '2' },
  { id: 'lighting', label: 'Lighting', icon: 'lightbulb', key: '3' },
  { id: 'anatomy', label: 'Anatomy', icon: 'bone', key: '4' },
  { id: 'gesture', label: 'Gesture', icon: 'gesture', key: '5' },
  { id: 'leech', label: 'Leech', icon: 'leech', key: '6' }
];

// ==================== REVIEW HISTORY ====================
// Tracks daily review counts per deck: { [deckId]: { [dateStr]: count } }
const ReviewHistory = {
  history: {},

  init() {
    this.history = Storage.getHistory();
  },

  save() {
    Storage.saveHistory(this.history);
  },

  /** Record one review for a deck on today's date */
  record(deckId, isNewCard, now = new Date()) {
    if (!this.history[deckId]) {
      this.history[deckId] = {};
    }
    const todayStr = localDateStr(now);

    // Migrate old flat number format to object if necessary
    if (typeof this.history[deckId][todayStr] === 'number') {
      const val = this.history[deckId][todayStr];
      this.history[deckId][todayStr] = { new: 0, review: val, total: val };
    }

    if (!this.history[deckId][todayStr]) {
      this.history[deckId][todayStr] = { new: 0, review: 0, total: 0 };
    }

    const entry = this.history[deckId][todayStr];
    if (isNewCard) entry.new++;
    else entry.review++;
    entry.total++;

    this.save();
  },

  /** Get review counts for a specific deck on a specific date */
  getCounts(deckId, dateStr) {
    if (!this.history[deckId] || !this.history[deckId][dateStr]) {
      return { new: 0, review: 0, total: 0 };
    }
    const val = this.history[deckId][dateStr];
    if (typeof val === 'number') return { new: 0, review: val, total: val };
    return val;
  },

  /** Get all daily total counts across ALL decks as { dateStr: totalCount } */
  getGlobalHistory() {
    const result = {};
    for (const deckId in this.history) {
      const data = this.history[deckId] || {};
      for (const [date, val] of Object.entries(data)) {
        const count = typeof val === 'number' ? val : val.total;
        if (result[date]) {
          result[date] += count;
        } else {
          result[date] = count;
        }
      }
    }
    return result;
  },

  /** Delete history for a deck */
  deleteForDeck(deckId) {
    delete this.history[deckId];
    this.save();
  },

  _dateStr(date) {
    return localDateStr(date);
  }
};

// ==================== DECK MANAGER ====================
const DeckManager = {
  decks: [],

  init() {
    this.decks = Storage.getDecks();
  },

  save() {
    Storage.saveDecks(this.decks);
  },

  create(name, folderPath, newLimit, reviewLimit) {
    const deck = {
      id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name.trim(),
      folderPath: folderPath.trim(),
      newLimit: parseInt(newLimit, 10) || 20,
      reviewLimit: parseInt(reviewLimit, 10) || 200,
      createdAt: new Date().toISOString()
    };
    this.decks.push(deck);
    this.save();
    return deck;
  },

  update(id, name, folderPath, newLimit, reviewLimit) {
    const deck = this.getById(id);
    if (deck) {
      deck.name = name.trim();
      deck.folderPath = folderPath.trim();
      deck.newLimit = parseInt(newLimit, 10) || 20;
      deck.reviewLimit = parseInt(reviewLimit, 10) || 200;
      this.save();
    }
    return deck;
  },

  delete(id) {
    const remainingDecks = this.decks.filter(d => d.id !== id);
    let remainingCards = 0;
    const cards = (typeof CardManager !== 'undefined' && CardManager.cards) ? CardManager.cards : (Storage.getCards() || {});
    for (const [dId, dCards] of Object.entries(cards)) {
      if (dId !== id && dCards && typeof dCards === 'object') {
        remainingCards += Object.keys(dCards).length;
      }
    }

    const willBeEmpty = remainingDecks.length === 0 && remainingCards === 0;

    if (willBeEmpty) {
      const confirmed = (typeof window !== 'undefined' && typeof window.confirm === 'function')
        ? window.confirm("This will remove all decks/cards")
        : true;
      if (!confirmed) {
        return false;
      }
    }

    this.decks = remainingDecks;
    this.save();
    CardManager.deleteForDeck(id, { skipConfirm: true });
    ReviewHistory.deleteForDeck(id);

    if (willBeEmpty && typeof Storage !== 'undefined' && typeof Storage.syncToDisk === 'function') {
      Storage.syncToDisk({ confirmReplace: true }).catch(err => {
        console.error('[DeckManager] Error syncing deletion to disk:', err);
      });
    }

    return true;
  },

  getById(id) {
    const deck = this.decks.find(d => d.id === id);
    if (deck) {
      if (!deck.folder && deck.folderPath) deck.folder = deck.folderPath;
      if (!deck.folderPath && deck.folder) deck.folderPath = deck.folder;
    }
    return deck;
  },

  getAll() {
    return this.decks;
  },

  getActiveDeck() {
    const currentId = (typeof UI !== 'undefined' && UI.currentDeckId) ? UI.currentDeckId : ((typeof BoardManager !== 'undefined' && BoardManager.activeDeckId) ? BoardManager.activeDeckId : null);
    if (!currentId) return null;
    return this.getById(currentId) || null;
  }
};

// ==================== CARD MANAGER ====================
const CardManager = {
  cards: {},

  init() {
    this.cards = Storage.getCards();
  },

  save() {
    Storage.saveCards(this.cards);
  },

  getCard(deckId, imageId) {
    if (!this.cards[deckId]) return null;
    return this.cards[deckId][imageId] || null;
  },

  getOrCreateCard(deckId, imageId, imageName) {
    if (!deckId || !imageId) return null;
    if (!this.cards[deckId]) {
      this.cards[deckId] = {};
    }
    if (!this.cards[deckId][imageId]) {
      this.cards[deckId][imageId] = {
        imageId,
        imageName: imageName || imageId.split('/').pop(),
        reviewCount: 0,
        tags: [],
        attempts: []
      };
      this.save();
    }
    return this.cards[deckId][imageId];
  },

  getCardsForDeck(deckId) {
    return this.cards[deckId] || {};
  },

  /** Rate an image card (SM-2 variant with Mean Reversion & Timer-Weighted scaling) */
  rateCard(deckId, imageId, imageName, difficulty, studyDuration = null) {
    if (!this.cards[deckId]) {
      this.cards[deckId] = {};
    }

    if (studyDuration === null) {
      studyDuration = (typeof UI !== 'undefined' && UI.getTimerDuration)
        ? UI.getTimerDuration()
        : (typeof TimerManager !== 'undefined' ? TimerManager.duration : 0);
    }

    const existing = this.cards[deckId][imageId];
    const now = new Date();
    const todayStr = localDateStr(now);
    const isNewCard = !existing || !existing.difficulty;
    const prevReviews = existing ? (existing.reviewCount || 0) : 0;
    const prevEase = Math.max(1.5, Math.min(3.0, existing ? (existing.easeFactor || 1.5) : 1.5));
    const prevConsecutive = existing
      ? (existing.consecutiveSuccesses || (existing.difficulty === 'medium' || existing.difficulty === 'easy' ? 1 : 0))
      : 0;

    const targetEase = 2.3;
    const minEase = 1.5;
    const maxEase = 3.0;

    let interval, easeFactor, consecutiveSuccesses = 0;

    if (difficulty === 'again') {
      // Again (<10m reset button): resets interval, increases lapses, remains due today for immediate recall
      interval = 0;
      // Capped at minimum 1.5 ease (prevents Ease Hell)
      easeFactor = Math.max(minEase, Math.min(maxEase, Math.round((prevEase - 0.2) * 100) / 100));
      consecutiveSuccesses = 0;
    } else if (isNewCard) {
      switch (difficulty) {
        case 'hard':
          interval = 1;
          easeFactor = 1.5; // Capped at min 1.5
          consecutiveSuccesses = 0;
          break;
        case 'medium':
          interval = 3;
          easeFactor = 1.8;
          consecutiveSuccesses = 1;
          break;
        case 'easy':
          interval = 7;
          // Timer-weighted scaling: short gesture drill (<= 45s) caps Easy jump to max 4 days
          if (studyDuration > 0 && studyDuration <= 45) {
            interval = Math.min(interval, 4);
          }
          easeFactor = 2.0;
          consecutiveSuccesses = 1;
          break;
      }
    } else {
      const prevInterval = existing.interval || 1;

      switch (difficulty) {
        case 'hard':
          interval = Math.max(1, Math.round(prevInterval * 0.5));
          // Minimum ease capped at 1.5 (prevents permanent SM-2 Ease Hell)
          easeFactor = Math.max(minEase, Math.min(maxEase, Math.round((prevEase - 0.15) * 100) / 100));
          consecutiveSuccesses = 0;
          break;
        case 'medium':
          interval = Math.max(prevInterval + 1, Math.round(prevInterval * prevEase));
          // Soft mean-reversion toward 2.3 on consecutive successes with NO constant offset shift
          if (prevConsecutive >= 1) {
            const diff = targetEase - prevEase;
            if (Math.abs(diff) < 0.005) {
              easeFactor = targetEase;
            } else {
              const step = Math.round(0.10 * diff * 100) / 100;
              if (step === 0) {
                easeFactor = diff > 0 ? Math.min(targetEase, prevEase + 0.01) : Math.max(targetEase, prevEase - 0.01);
              } else {
                easeFactor = prevEase + step;
              }
            }
            consecutiveSuccesses = prevConsecutive + 1;
          } else {
            easeFactor = prevEase;
            consecutiveSuccesses = 1;
          }
          easeFactor = Math.max(minEase, Math.min(maxEase, Math.round(easeFactor * 100) / 100));
          break;
        case 'easy':
          interval = Math.max(prevInterval + 2, Math.round(prevInterval * prevEase * 1.3));
          // Timer-weighted scaling: if studied with very short timer (<= 45s) on first 2 reviews, cap to max 4 days
          if (prevReviews < 2 && studyDuration > 0 && studyDuration <= 45) {
            interval = Math.min(interval, 4);
          }
          // Easy awards an explicit ease reward (+0.10), capped at maxEase 3.0
          easeFactor = prevEase + 0.10;
          consecutiveSuccesses = prevConsecutive + 1;
          easeFactor = Math.max(minEase, Math.min(maxEase, Math.round(easeFactor * 100) / 100));
          break;
      }
    }

    const dueDate = new Date(now);
    if (interval > 0) {
      dueDate.setDate(dueDate.getDate() + interval);
    }

    const lapses = ((existing && existing.lapses) || 0) + (difficulty === 'again' ? 1 : 0);

    this.cards[deckId][imageId] = {
      imageId,
      imageName: (existing && existing.imageName) || imageName,
      isChild: Boolean(existing && existing.isChild),
      parentImageId: (existing && existing.parentImageId) || null,
      parentPath: (existing && existing.parentPath) || '',
      parentHash: (existing && existing.parentHash) || '',
      crop: (existing && existing.crop) || null,
      difficulty,
      interval,
      easeFactor,
      consecutiveSuccesses,
      lastStudyDuration: studyDuration || 0,
      dueDate: interval === 0 ? todayStr : localDateStr(dueDate),
      lapses,
      reviewCount: prevReviews + 1,
      lastReviewDate: todayStr,
      firstReviewDate: existing ? (existing.firstReviewDate || todayStr) : todayStr,
      tags: existing && Array.isArray(existing.tags) ? existing.tags : [],
      attempts: existing && Array.isArray(existing.attempts) ? existing.attempts : []
    };

    this.save();
    ReviewHistory.record(deckId, isNewCard);

    return this.cards[deckId][imageId];
  },

  getProjectedInterval(deckId, imageId, difficulty, studyDuration = null) {
    if (difficulty === 'again') {
      return '<10m';
    }

    if (studyDuration === null) {
      studyDuration = (typeof UI !== 'undefined' && UI.getTimerDuration)
        ? UI.getTimerDuration()
        : (typeof TimerManager !== 'undefined' ? TimerManager.duration : 0);
    }

    const existing = this.getCard(deckId, imageId);
    const isNew = !existing || !existing.difficulty;
    const prevReviews = existing ? (existing.reviewCount || 0) : 0;

    let projected = 1;
    if (isNew) {
      switch (difficulty) {
        case 'hard': projected = 1; break;
        case 'medium': projected = 3; break;
        case 'easy': projected = 7; break;
      }
    } else {
      const prevInterval = existing.interval || 1;
      const prevEase = Math.max(1.5, Math.min(3.0, existing.easeFactor || 1.5));

      switch (difficulty) {
        case 'hard':
          projected = Math.max(1, Math.round(prevInterval * 0.5));
          break;
        case 'medium':
          projected = Math.max(prevInterval + 1, Math.round(prevInterval * prevEase));
          break;
        case 'easy':
          projected = Math.max(prevInterval + 2, Math.round(prevInterval * prevEase * 1.3));
          break;
      }
    }

    // Timer-weighted scaling: short gesture drill (<= 45s) on first 2 reviews caps Easy jump to max 4 days
    if (difficulty === 'easy' && prevReviews < 2 && studyDuration > 0 && studyDuration <= 45) {
      projected = Math.min(projected, 4);
    }

    return projected;
  },

  getAttempts(deckId, imageId) {
    const card = this.getCard(deckId, imageId);
    return card && Array.isArray(card.attempts) ? [...card.attempts] : [];
  },

  async addAttempt(deckId, imageId, attempt) {
    if (!deckId || !imageId || !attempt) return [];
    if (!this.cards[deckId]) this.cards[deckId] = {};
    if (!this.cards[deckId][imageId]) {
      this.cards[deckId][imageId] = {
        imageId,
        imageName: imageId.split('/').pop(),
        reviewCount: 0,
        attempts: []
      };
    }
    const card = this.cards[deckId][imageId];
    if (!Array.isArray(card.attempts)) card.attempts = [];

    let sketchUrl = attempt.sketchUrl || attempt.dataUrl || '';
    if (typeof sketchUrl === 'string' && sketchUrl.startsWith('data:image/')) {
      try {
        const res = await fetch('/api/sketch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: card.imageId, dataUrl: sketchUrl })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.sketchUrl) {
            sketchUrl = data.sketchUrl;
          }
        }
      } catch (err) {
        console.warn('[CardManager] Failed to upload sketch to /api/sketch:', err);
      }
    }

    if (!isValidSketchUrl(sketchUrl)) {
      sketchUrl = '';
    }

    const attemptObj = {
      date: attempt.date || localDateStr(),
      rating: attempt.rating || 'medium',
      sketchUrl: sketchUrl
    };
    if (attempt.id) attemptObj.id = attempt.id;
    if (attempt.filename) attemptObj.filename = attempt.filename;
    if (attempt.timestamp) attemptObj.timestamp = attempt.timestamp;

    card.attempts.push(attemptObj);
    if (card.attempts.length > 15) {
      card.attempts.shift();
    }
    this.save();

    if (typeof Storage !== 'undefined') {
      if (typeof Storage.syncToServer === 'function') {
        Storage.syncToServer(false).catch(() => { });
      } else if (typeof Storage.syncToDisk === 'function') {
        Storage.syncToDisk(false).catch(() => { });
      }
    }

    return card.attempts;
  },

  deleteAttempt(deckId, imageId, indexOrId) {
    if (!this.cards[deckId] || !this.cards[deckId][imageId]) return [];
    const card = this.cards[deckId][imageId];
    if (!Array.isArray(card.attempts)) return [];

    let removed = null;
    if (typeof indexOrId === 'number' && indexOrId >= 0 && indexOrId < card.attempts.length) {
      removed = card.attempts.splice(indexOrId, 1)[0];
    } else if (typeof indexOrId === 'string') {
      const idx = card.attempts.findIndex(a => a && (a.id === indexOrId || a.sketchUrl === indexOrId));
      if (idx >= 0) {
        removed = card.attempts.splice(idx, 1)[0];
      }
    }

    if (removed) {
      this.save();
      if (typeof Storage !== 'undefined') {
        if (typeof Storage.syncToServer === 'function') {
          Storage.syncToServer(false).catch(() => { });
        } else if (typeof Storage.syncToDisk === 'function') {
          Storage.syncToDisk(false).catch(() => { });
        }
      }
    }

    return card.attempts;
  },

  getTagsForCard(deckId, imageId) {
    const card = this.getCard(deckId, imageId);
    return card && Array.isArray(card.tags) ? [...card.tags] : [];
  },

  addTagToCard(deckId, imageId, imageName, tag) {
    if (!deckId || !imageId) return [];
    const clean = (tag || '').trim().toLowerCase().replace(/^#/, '');
    if (!clean) return this.getTagsForCard(deckId, imageId);

    if (!this.cards[deckId]) {
      this.cards[deckId] = {};
    }

    if (!this.cards[deckId][imageId]) {
      this.cards[deckId][imageId] = {
        imageId,
        imageName: imageName || imageId.split('/').pop(),
        tags: [clean],
        reviewCount: 0
      };
    } else {
      const card = this.cards[deckId][imageId];
      if (!Array.isArray(card.tags)) card.tags = [];
      if (!card.tags.includes(clean)) {
        card.tags.push(clean);
      }
    }

    this.save();
    return [...this.cards[deckId][imageId].tags];
  },

  removeTagFromCard(deckId, imageId, tag) {
    if (!deckId || !imageId || !this.cards[deckId] || !this.cards[deckId][imageId]) return [];
    const clean = (tag || '').trim().toLowerCase().replace(/^#/, '');
    const card = this.cards[deckId][imageId];
    if (Array.isArray(card.tags)) {
      card.tags = card.tags.filter(t => t !== clean);
      this.save();
      return [...card.tags];
    }
    return [];
  },

  toggleTagForCard(deckId, imageId, imageName, tag) {
    const clean = (tag || '').trim().toLowerCase().replace(/^#/, '');
    if (!clean) return { tags: [], added: false };
    const currentTags = this.getTagsForCard(deckId, imageId);
    if (currentTags.includes(clean)) {
      const remaining = this.removeTagFromCard(deckId, imageId, clean);
      return { tags: remaining, added: false, tag: clean };
    } else {
      const updated = this.addTagToCard(deckId, imageId, imageName, clean);
      return { tags: updated, added: true, tag: clean };
    }
  },

  getAllTagsForDeck(deckId) {
    const deckCards = this.cards[deckId] || {};
    const tagCounts = {};
    Object.values(deckCards).forEach(card => {
      if (Array.isArray(card.tags)) {
        card.tags.forEach(t => {
          const clean = t.trim().toLowerCase();
          if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        });
      }
    });
    return tagCounts;
  },

  getCardsByTag(deckId, tag) {
    const deckCards = this.cards[deckId] || {};
    const clean = (tag || '').trim().toLowerCase().replace(/^#/, '');
    return Object.values(deckCards).filter(c => Array.isArray(c.tags) && c.tags.includes(clean));
  },

  getChildCards(deckId) {
    const deckCards = this.cards[deckId] || {};
    return Object.values(deckCards).filter(c => c && c.isChild);
  },

  createChildCard(deckId, parentImage, crop, label, tags = []) {
    if (!deckId || !parentImage || !crop) return null;
    if (!this.cards[deckId]) this.cards[deckId] = {};

    const cleanLabel = (label || '').trim();
    const parentId = parentImage.id || parentImage.hash || parentImage.path;
    const safeHash = String(parentImage.hash || parentId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(-16);
    const childId = `crop_${safeHash}_${Date.now().toString(36)}`;
    const todayStr = localDateStr();

    const cleanTags = Array.isArray(tags)
      ? tags.map(t => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean)
      : [];

    const childCard = {
      imageId: childId,
      parentImageId: parentId,
      parentPath: parentImage.path || '',
      parentHash: parentImage.hash || '',
      imageName: cleanLabel ? `[${cleanLabel}] ${parentImage.name || 'reference'}` : `[Focal Crop] ${parentImage.name || 'reference'}`,
      isChild: true,
      crop: {
        x: Math.max(0, Math.min(1, crop.x)),
        y: Math.max(0, Math.min(1, crop.y)),
        w: Math.max(0.01, Math.min(1, crop.w)),
        h: Math.max(0.01, Math.min(1, crop.h))
      },
      tags: cleanTags,
      difficulty: null,
      interval: 1,
      easeFactor: 1.5,
      dueDate: todayStr,
      reviewCount: 0,
      firstReviewDate: todayStr,
      attempts: []
    };

    this.cards[deckId][childId] = childCard;
    this.save();
    return childCard;
  },

  deleteCard(deckId, cardId) {
    if (!deckId || !cardId || !this.cards[deckId]) return false;
    const decks = (typeof DeckManager !== 'undefined' && DeckManager.decks) ? DeckManager.decks : (Storage.getDecks() || []);
    let remainingCards = 0;
    for (const [dId, dCards] of Object.entries(this.cards || {})) {
      if (dCards && typeof dCards === 'object') {
        for (const cId of Object.keys(dCards)) {
          if (dId === deckId && cId === cardId) continue;
          remainingCards++;
        }
      }
    }

    const willBeEmpty = decks.length === 0 && remainingCards === 0;

    if (willBeEmpty) {
      const confirmed = (typeof window !== 'undefined' && typeof window.confirm === 'function')
        ? window.confirm("This will remove all decks/cards")
        : true;
      if (!confirmed) return false;
    }

    delete this.cards[deckId][cardId];
    if (Object.keys(this.cards[deckId]).length === 0) {
      delete this.cards[deckId];
    }
    this.save();

    if (willBeEmpty && typeof Storage !== 'undefined' && typeof Storage.syncToDisk === 'function') {
      Storage.syncToDisk({ confirmReplace: true }).catch(err => {
        console.error('[CardManager] Error syncing deletion to disk:', err);
      });
    }
    return true;
  },

  deleteChildCard(deckId, childId) {
    if (!deckId || !childId || !this.cards[deckId]) return false;
    if (this.cards[deckId][childId] && this.cards[deckId][childId].isChild) {
      return this.deleteCard(deckId, childId);
    }
    return false;
  },

  /** Calculate overdue lapse and difficulty priority score (higher = needs review first) */
  getCardPriority(card, now = new Date()) {
    if (!card) return 0;
    const todayStr = localDateStr(now);

    let overdueDays = 0;
    const cardDue = localDateStr(card.dueDate);
    if (cardDue && cardDue < todayStr) {
      const dueTime = new Date(cardDue + 'T00:00:00').getTime();
      const todayTime = new Date(todayStr + 'T00:00:00').getTime();
      overdueDays = Math.max(0, Math.round((todayTime - dueTime) / 86400000));
    }

    const lapseNorm = 1 - Math.exp(-(card.lapses || 0) / 3);
    const overdueNorm = 1 - Math.exp(-Math.max(0, overdueDays) / 14);
    const easeNorm = Math.max(0, Math.min(1, (3.0 - (card.easeFactor || 2.5)) / 1.5));

    return (lapseNorm * 40) + (overdueNorm * 35) + (easeNorm * 25);
  },

  getDueCards(deckId, tagFilter = null, sortByPriority = true) {
    const deckCards = this.cards[deckId];
    if (!deckCards) return [];

    const todayStr = localDateStr();
    let list = Object.values(deckCards).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr);
    if (tagFilter) {
      const clean = tagFilter.trim().toLowerCase().replace(/^#/, '');
      list = list.filter(c => Array.isArray(c.tags) && c.tags.includes(clean));
    }

    if (sortByPriority) {
      list.sort((a, b) => this.getCardPriority(b) - this.getCardPriority(a));
    }

    return list;
  },

  /**
   * Overdue Backlog Load-Balancer:
   * Keeps the top `reviewLimit` highest-priority cards due today, and spreads excess
   * overdue cards evenly across the next 5 days (+1 to +5 days) with one click.
   */
  reflowOverdueBacklog(deckId) {
    if (!this.cards[deckId]) {
      return { reflowedCount: 0, retainedToday: 0, totalDue: 0, limit: 0, message: 'No cards in deck.' };
    }

    const deck = DeckManager.getById(deckId);
    const todayStr = localDateStr();

    if (deck && deck.lastReflowDate === todayStr) {
      const currentDue = this.getDueCards(deckId, null, false).length;
      const reviewLimit = (deck && deck.reviewLimit && deck.reviewLimit > 0) ? deck.reviewLimit : 200;
      return {
        reflowedCount: 0,
        retainedToday: currentDue,
        totalDue: currentDue,
        limit: reviewLimit,
        message: 'Backlog reflow has already been run today for this deck.'
      };
    }

    const reviewLimit = (deck && deck.reviewLimit && deck.reviewLimit > 0) ? deck.reviewLimit : 200;

    // Get all due cards sorted by priority (highest lapse/difficulty priority first)
    const dueCards = this.getDueCards(deckId, null, true);
    const totalDue = dueCards.length;

    if (totalDue <= reviewLimit) {
      return {
        reflowedCount: 0,
        retainedToday: totalDue,
        totalDue,
        limit: reviewLimit,
        message: `Due queue (${totalDue}) is already within your daily limit (${reviewLimit}). No reflow needed.`
      };
    }

    // Keep the top `reviewLimit` highest-priority cards due today
    const retainedToday = reviewLimit;
    const excessCards = dueCards.slice(reviewLimit);
    const reflowedCount = excessCards.length;

    const now = new Date();
    // Spread excess cards evenly across the next 5 days (+1 to +5 days)
    excessCards.forEach((card, idx) => {
      const dayOffset = (idx % 5) + 1; // 1, 2, 3, 4, 5, 1, 2, 3...
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      card.dueDate = localDateStr(targetDate);
      card.lastReflowDate = todayStr;
    });

    if (deck) {
      deck.lastReflowDate = todayStr;
      if (typeof DeckManager !== 'undefined' && typeof DeckManager.save === 'function') {
        DeckManager.save();
      }
    }

    this.save();
    if (typeof Storage !== 'undefined' && Storage.syncToDisk) {
      Storage.syncToDisk(false).catch(() => { });
    }

    return {
      reflowedCount,
      retainedToday,
      totalDue,
      limit: reviewLimit,
      message: `Reflowed ${reflowedCount} excess overdue cards across the next 5 days (keeping top ${retainedToday} today).`
    };
  },

  getStats(deckId, totalImages, tagFilter = null) {
    const deckCards = this.cards[deckId] || {};
    const todayStr = localDateStr();

    if (!tagFilter) {
      const childCount = Object.values(deckCards).filter(c => c && c.isChild).length;
      const effectiveTotal = totalImages + childCount;
      const reviewed = Object.values(deckCards).filter(c => c && c.difficulty).length;
      const due = Object.values(deckCards).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;
      return {
        total: effectiveTotal,
        reviewed,
        newCards: Math.max(0, effectiveTotal - reviewed),
        due
      };
    }

    const clean = tagFilter.trim().toLowerCase().replace(/^#/, '');
    const taggedCards = Object.values(deckCards).filter(c => Array.isArray(c.tags) && c.tags.includes(clean));
    const reviewed = taggedCards.filter(c => c && c.difficulty).length;
    const due = taggedCards.filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;
    const totalTagged = taggedCards.length;

    return {
      total: totalTagged,
      reviewed,
      newCards: Math.max(0, totalTagged - reviewed),
      due
    };
  },

  deleteForDeck(deckId, options = {}) {
    if (!options.skipConfirm) {
      const decks = (typeof DeckManager !== 'undefined' && DeckManager.decks) ? DeckManager.decks : (Storage.getDecks() || []);
      const remainingDecks = decks.filter(d => d.id !== deckId);
      let remainingCards = 0;
      for (const [dId, dCards] of Object.entries(this.cards || {})) {
        if (dId !== deckId && dCards && typeof dCards === 'object') {
          remainingCards += Object.keys(dCards).length;
        }
      }
      const willBeEmpty = remainingDecks.length === 0 && remainingCards === 0;
      if (willBeEmpty) {
        const confirmed = (typeof window !== 'undefined' && typeof window.confirm === 'function')
          ? window.confirm("This will remove all decks/cards")
          : true;
        if (!confirmed) return false;
        delete this.cards[deckId];
        this.save();
        if (typeof Storage !== 'undefined' && typeof Storage.syncToDisk === 'function') {
          Storage.syncToDisk({ confirmReplace: true }).catch(err => {
            console.error('[CardManager] Error syncing deletion to disk:', err);
          });
        }
        return true;
      }
    }
    delete this.cards[deckId];
    this.save();
    return true;
  },

  /**
   * Migrate existing path-keyed cards to content-hash IDs when folder images are loaded.
   * Ensures review history follows the image even if it's renamed or moved!
   */
  migrateLegacyPathCards(deckId, images) {
    if (!this.cards[deckId] || !Array.isArray(images) || images.length === 0) return 0;

    const deckCards = this.cards[deckId];
    let migratedCount = 0;

    images.forEach(img => {
      if (img.path && img.id && img.path !== img.id) {
        // Case 1: Card was stored under absolute file path -> migrate to content hash ID
        let oldCard = deckCards[img.path];
        let oldKey = img.path;

        if (!oldCard && !deckCards[img.id]) {
          // If a folder or subfolder was renamed or moved, find legacy card by matching file basename
          const imgBase = (img.path || '').split(/[/\\]/).pop();
          if (imgBase) {
            const candidateKey = Object.keys(deckCards).find(k => {
              if (k === img.id || k.startsWith('ch_')) return false;
              const kBase = k.split(/[/\\]/).pop();
              return kBase === imgBase;
            });
            if (candidateKey) {
              oldCard = deckCards[candidateKey];
              oldKey = candidateKey;
            }
          }
        }

        if (oldCard) {
          if (!deckCards[img.id]) {
            deckCards[img.id] = {
              ...oldCard,
              imageId: img.id,
              previousPath: img.path,
              imageName: img.name || oldCard.imageName
            };
          } else {
            // Both exist: preserve highest review count, newest stats, and merge tags
            const target = deckCards[img.id];
            const oldTags = Array.isArray(oldCard.tags) ? oldCard.tags : [];
            const newTags = Array.isArray(target.tags) ? target.tags : [];
            target.tags = Array.from(new Set([...oldTags, ...newTags]));
            const oldAttempts = Array.isArray(oldCard.attempts) ? oldCard.attempts : [];
            const newAttempts = Array.isArray(target.attempts) ? target.attempts : [];
            target.attempts = [...oldAttempts, ...newAttempts].slice(-15);
            if ((oldCard.reviewCount || 0) > (target.reviewCount || 0)) {
              target.difficulty = oldCard.difficulty || target.difficulty;
              target.interval = oldCard.interval || target.interval;
              target.easeFactor = oldCard.easeFactor || target.easeFactor;
              target.dueDate = oldCard.dueDate || target.dueDate;
              target.reviewCount = Math.max(target.reviewCount || 0, oldCard.reviewCount || 0);
            }
          }
          delete deckCards[oldKey];
          migratedCount++;
        } else if (deckCards[img.id] && img.name && deckCards[img.id].imageName !== img.name) {
          // File was renamed or moved: keep review history, update relative display name!
          deckCards[img.id].imageName = img.name;
          if (img.path) {
            deckCards[img.id].previousPath = img.path;
          }
          migratedCount++;
        }
      }
    });

    if (migratedCount > 0) {
      this.save();
      console.log(`[CardManager] Migrated/updated ${migratedCount} cards to content-hash IDs in deck "${deckId}"`);
    }

    return migratedCount;
  },

  _dateStr(date) {
    return localDateStr(date);
  }
};


if (typeof window !== 'undefined') {
  window.TAG_PRESETS = TAG_PRESETS;
  window.ReviewHistory = ReviewHistory;
  window.DeckManager = DeckManager;
  window.CardManager = CardManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TAG_PRESETS = TAG_PRESETS;
  globalThis.ReviewHistory = ReviewHistory;
  globalThis.DeckManager = DeckManager;
  globalThis.CardManager = CardManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAG_PRESETS,
    ReviewHistory,
    DeckManager,
    CardManager
  };
}
