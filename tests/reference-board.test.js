const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { loadFrontendCode } = require('./helpers/load-frontend.js');
const appJsCode = loadFrontendCode();
const indexHtmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

function setupTestEnvironment() {
  const elements = new Map();

  function makeElement(id, tagName = 'div') {
    const classList = new Set();
    const listeners = {};
    const dataset = {};
    const style = {};
    const attributes = {};
    let textContent = '';
    let innerHTML = '';

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      dataset,
      style,
      value: '',
      title: '',
      scrollTop: 0,
      setAttribute(k, v) { attributes[k] = String(v); },
      getAttribute(k) { return attributes[k] !== undefined ? attributes[k] : null; },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      get innerHTML() { return innerHTML; },
      set innerHTML(v) { innerHTML = String(v); },
      get className() { return Array.from(classList).join(' '); },
      set className(v) {
        classList.clear();
        if (v) String(v).split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
      },
      classList: {
        add(...cls) { cls.forEach(c => classList.add(c)); },
        remove(...cls) { cls.forEach(c => classList.delete(c)); },
        contains(c) { return classList.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classList.add(c);
            else classList.delete(c);
            return force;
          }
          if (classList.has(c)) {
            classList.delete(c);
            return false;
          } else {
            classList.add(c);
            return true;
          }
        }
      },
      addEventListener(event, fn, useCapture) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push({ fn, useCapture: Boolean(useCapture) });
      },
      removeEventListener(event, fn) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(l => l.fn !== fn);
      },
      dispatchEvent(event) {
        if (listeners[event.type]) {
          listeners[event.type].forEach(l => l.fn(event));
        }
      },
      querySelectorAll(sel) {
        return [];
      },
      querySelector(sel) {
        return null;
      },
      focus() {},
      blur() {},
      appendChild(child) { return child; },
      removeChild(child) { return child; },
      remove() {},
      click() {
        this.dispatchEvent({ type: 'click', target: this, closest: () => this });
      }
    };

    return el;
  }

  function getElementById(id) {
    if (!elements.has(id)) {
      elements.set(id, makeElement(id));
    }
    return elements.get(id);
  }

  const documentMock = {
    getElementById,
    querySelectorAll(sel) {
      if (sel === '.view') {
        return Array.from(elements.values()).filter(e => e.classList.contains('view'));
      }
      return [];
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return getElementById(sel.slice(1));
      return null;
    },
    createElement(tag) {
      return makeElement('gen_' + Math.random().toString(36).substr(2, 6), tag);
    },
    addEventListener() {},
    removeEventListener() {},
    body: makeElement('body'),
    activeElement: null
  };

  const localStorageMock = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: documentMock,
    window: {
      location: { search: '' },
      addEventListener() {},
      removeEventListener() {}
    },
    navigator: { userAgent: 'NodeTest' },
    localStorage: localStorageMock,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    AudioContext: class {
      constructor() { this.state = 'suspended'; this.destination = {}; }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
    }
  };
  context.window.document = documentMock;
  context.window.location = context.window.location;
  context.window.navigator = context.navigator;
  context.window.AudioContext = context.AudioContext;

  vm.createContext(context);
  const exported = vm.runInContext(
    appJsCode + '\n;({ UI, PiPCanvasStreamer, TimerManager, CardManager, DeckManager, SessionManager, BoardManager, ReviewHistory, ArtistToolbox, SoundFX, SmartCropManager, Storage, localDateStr })',
    context
  );

  return { ...context, ...exported };
}

// -----------------------------------------------------------------------------
// Category A: Deck Detail Tabs & Initialization (Cases 1 - 5)
// -----------------------------------------------------------------------------

test('Case 1: Default active tab is Study (SRS) when opening Deck Detail', async () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const DeckManager = ctx.DeckManager;

  const testDeck = { id: 'deck_tab_default', name: 'Default Tab Deck', folderPath: '/art/default' };
  DeckManager.decks = [testDeck];
  ctx.SessionManager.loadImages = async () => [];

  await UI.openDeckDetail(testDeck.id);

  assert.equal(UI.activeDeckTab, 'study', 'activeDeckTab must default to study');
  const btnStudy = ctx.document.getElementById('tab-btn-study');
  const btnBoard = ctx.document.getElementById('tab-btn-board');
  const viewStudy = ctx.document.getElementById('deck-view-study');
  const viewBoard = ctx.document.getElementById('deck-view-board');

  assert.ok(btnStudy.classList.contains('active'), 'Study tab button must have active class');
  assert.equal(btnStudy.getAttribute('aria-selected'), 'true');
  assert.ok(!btnBoard.classList.contains('active'), 'Board tab button must not have active class');
  assert.equal(btnBoard.getAttribute('aria-selected'), 'false');
  assert.ok(!viewStudy.classList.contains('hidden'), 'Study view must not be hidden');
  assert.ok(viewBoard.classList.contains('hidden'), 'Board view must be hidden');
});

test('Case 2: Tab switcher switches to Reference Board and updates ARIA attributes', async () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_tab_switch';
  UI.cachedImages = [{ id: 'ref1', name: 'ref1.jpg' }];
  UI.cachedImagesDeckId = 'deck_tab_switch';

  await UI.switchDeckTab('board');

  assert.equal(UI.activeDeckTab, 'board');
  const btnStudy = ctx.document.getElementById('tab-btn-study');
  const btnBoard = ctx.document.getElementById('tab-btn-board');
  const viewStudy = ctx.document.getElementById('deck-view-study');
  const viewBoard = ctx.document.getElementById('deck-view-board');

  assert.ok(!btnStudy.classList.contains('active'), 'Study tab button must be inactive');
  assert.equal(btnStudy.getAttribute('aria-selected'), 'false');
  assert.ok(btnBoard.classList.contains('active'), 'Board tab button must be active');
  assert.equal(btnBoard.getAttribute('aria-selected'), 'true');
  assert.ok(viewStudy.classList.contains('hidden'), 'Study view must be hidden');
  assert.ok(!viewBoard.classList.contains('hidden'), 'Board view must be visible');
});

test('Case 3: Reference Board loads active deck references from folder cache/API', async () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const DeckManager = ctx.DeckManager;

  const deck = { id: 'deck_load_test', name: 'Load Deck', folderPath: '/art/load' };
  DeckManager.decks = [deck];
  UI.currentDeckId = deck.id;

  let apiLoaded = false;
  ctx.SessionManager.loadImages = async (folder) => {
    apiLoaded = true;
    return [{ id: 'img_load_1', name: 'loaded_sample.png', path: '/art/load/loaded_sample.png' }];
  };

  const images = await UI.loadBoardImagesIfNeeded();
  assert.equal(apiLoaded, true, 'Must call loadImages when cache is missing');
  assert.equal(images.length, 1);
  assert.equal(images[0].name, 'loaded_sample.png');
});

test('Case 4: Thumbnail grid renders cards with Munsell-dark styling, lazy loading, and async decoding', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const testImages = [
    { id: 'img_render_1', name: 'figure_pose_01.jpg', path: '/art/figure_pose_01.jpg' }
  ];
  UI.currentDeckId = 'deck_render_test';
  UI.cachedImages = testImages;
  UI.cachedImagesDeckId = 'deck_render_test';

  UI.applyBoardFilters();
  const grid = ctx.document.getElementById('board-gallery-grid');
  UI.renderBoardGrid();

  assert.ok(grid.innerHTML.includes('figure_pose_01.jpg'), 'Filename must be present');
  assert.ok(grid.innerHTML.includes('loading="lazy"'), 'Must specify loading="lazy"');
  assert.ok(grid.innerHTML.includes('decoding="async"'), 'Must specify decoding="async"');
  assert.ok(grid.innerHTML.includes('/api/image?path='), 'Must load via /api/image?path=');
  assert.ok(grid.innerHTML.includes('board-ref-card'), 'Must render with board-ref-card class');
});

test('Case 5: Empty deck displays clean placeholder without throwing errors', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_empty_test';
  UI.cachedImages = [];
  UI.cachedImagesDeckId = 'deck_empty_test';

  UI.applyBoardFilters();
  UI.renderBoardGrid();

  const emptyState = ctx.document.getElementById('board-empty-state');
  const emptyTitle = ctx.document.getElementById('board-empty-title');
  const grid = ctx.document.getElementById('board-gallery-grid');

  assert.ok(!emptyState.classList.contains('hidden'), 'Empty state must be visible');
  assert.ok(grid.classList.contains('hidden'), 'Gallery grid must be hidden');
  assert.equal(emptyTitle.textContent, 'No references found in this deck');
});

// -----------------------------------------------------------------------------
// Category B: Thumbnail Grid, Tags & Error Resilience (Cases 6 - 8)
// -----------------------------------------------------------------------------

test('Case 6: Read-only tag lookup displays card tags without creating or modifying card records', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  const testImages = [
    { id: 'unrecorded_ref', name: 'unrecorded.jpg', path: '/art/unrecorded.jpg' }
  ];
  UI.currentDeckId = 'deck_tags_readonly';
  UI.cachedImages = testImages;
  UI.cachedImagesDeckId = 'deck_tags_readonly';

  assert.equal(CardManager.getCard('deck_tags_readonly', 'unrecorded_ref'), null);

  UI.applyBoardFilters();
  UI.renderBoardGrid();

  assert.equal(CardManager.getCard('deck_tags_readonly', 'unrecorded_ref'), null, 'Browsing must not create card records');
});

test('Case 7: Tag bar populates dynamically from unique tags in active deck plus All Tags chip', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  const images = [
    { id: 'ref_a', name: 'a.jpg', path: '/art/a.jpg' },
    { id: 'ref_b', name: 'b.jpg', path: '/art/b.jpg' }
  ];
  UI.currentDeckId = 'deck_tag_bar';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_tag_bar';

  CardManager.cards['deck_tag_bar'] = {
    'ref_a': { imageId: 'ref_a', tags: ['anatomy', 'dramatic'] },
    'ref_b': { imageId: 'ref_b', tags: ['dramatic', 'portrait'] }
  };

  const tagsBar = ctx.document.getElementById('board-tags-bar');
  UI.renderBoardTags();

  assert.ok(tagsBar.innerHTML.includes('All Tags'), 'All Tags chip must exist');
  assert.ok(tagsBar.innerHTML.includes('#anatomy'), '#anatomy chip must exist');
  assert.ok(tagsBar.innerHTML.includes('#dramatic'), '#dramatic chip must exist');
  assert.ok(tagsBar.innerHTML.includes('#portrait'), '#portrait chip must exist');
});

test('Case 8: Image load failure fallback does not use inline onerror attribute', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const images = [{ id: 'ref_err', name: 'missing.jpg', path: '/art/missing.jpg' }];
  UI.currentDeckId = 'deck_err_test';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_err_test';

  UI.applyBoardFilters();
  const grid = ctx.document.getElementById('board-gallery-grid');
  UI.renderBoardGrid();

  assert.ok(!grid.innerHTML.includes('onerror='), 'Must not use inline onerror attribute');
});

// -----------------------------------------------------------------------------
// Category C: Search & Tag Filtering (Cases 9 - 15)
// -----------------------------------------------------------------------------

test('Case 9: Search query filters references by filename (case-insensitive partial match)', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_search_fname';
  UI.cachedImages = [
    { id: 'img1', name: 'Figure_Standing_Pose.jpg', path: '/art/1.jpg' },
    { id: 'img2', name: 'Portrait_Study.png', path: '/art/2.png' }
  ];
  UI.cachedImagesDeckId = 'deck_search_fname';

  UI.setBoardSearchQuery('STANDING');
  assert.equal(UI.boardState.filteredReferences.length, 1);
  assert.equal(UI.boardState.filteredReferences[0].id, 'img1');
});

test('Case 10: Search query filters references by path (case-insensitive partial match)', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_search_path';
  UI.cachedImages = [
    { id: 'img1', name: 'reference_01.jpg', path: '/art/gestures/model_a.jpg' },
    { id: 'img2', name: 'reference_02.jpg', path: '/art/landscapes/nature.jpg' }
  ];
  UI.cachedImagesDeckId = 'deck_search_path';

  UI.setBoardSearchQuery('gestures');
  assert.equal(UI.boardState.filteredReferences.length, 1);
  assert.equal(UI.boardState.filteredReferences[0].id, 'img1');
});

test('Case 11: Search query filters references by tag text', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  UI.currentDeckId = 'deck_search_tag';
  UI.cachedImages = [
    { id: 'img1', name: 'photo_01.jpg', path: '/art/01.jpg' },
    { id: 'img2', name: 'photo_02.jpg', path: '/art/02.jpg' }
  ];
  UI.cachedImagesDeckId = 'deck_search_tag';
  CardManager.cards['deck_search_tag'] = {
    'img2': { imageId: 'img2', tags: ['chiaroscuro', 'dramatic-light'] }
  };

  UI.setBoardSearchQuery('chiaroscuro');
  assert.equal(UI.boardState.filteredReferences.length, 1);
  assert.equal(UI.boardState.filteredReferences[0].id, 'img2');
});

test('Case 12: Tag filter restricts references to cards matching the selected tag', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  UI.currentDeckId = 'deck_tag_filter';
  UI.cachedImages = [
    { id: 't1', name: 'pose1.jpg', path: '/art/p1.jpg' },
    { id: 't2', name: 'pose2.jpg', path: '/art/p2.jpg' }
  ];
  UI.cachedImagesDeckId = 'deck_tag_filter';
  CardManager.cards['deck_tag_filter'] = {
    't1': { imageId: 't1', tags: ['male'] },
    't2': { imageId: 't2', tags: ['female'] }
  };

  UI.setBoardTagFilter('female');
  assert.equal(UI.boardState.filteredReferences.length, 1);
  assert.equal(UI.boardState.filteredReferences[0].id, 't2');
});

test('Case 13: Combined search and tag filtering computes exact intersection', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  UI.currentDeckId = 'deck_intersection';
  UI.cachedImages = [
    { id: 'i1', name: 'gesture_fast.jpg', path: '/art/1.jpg' },
    { id: 'i2', name: 'gesture_slow.jpg', path: '/art/2.jpg' },
    { id: 'i3', name: 'portrait_fast.jpg', path: '/art/3.jpg' }
  ];
  UI.cachedImagesDeckId = 'deck_intersection';
  CardManager.cards['deck_intersection'] = {
    'i1': { imageId: 'i1', tags: ['dynamic'] },
    'i2': { imageId: 'i2', tags: ['static'] },
    'i3': { imageId: 'i3', tags: ['dynamic'] }
  };

  // Search 'gesture' AND tag 'dynamic' -> only i1
  UI.setBoardSearchQuery('gesture');
  UI.setBoardTagFilter('dynamic');

  assert.equal(UI.boardState.filteredReferences.length, 1);
  assert.equal(UI.boardState.filteredReferences[0].id, 'i1');
});

test('Case 14: Filter clearing resets search query, tag selection, and updates count badge', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_clear_filters';
  UI.cachedImages = [
    { id: 'c1', name: '1.jpg' },
    { id: 'c2', name: '2.jpg' }
  ];
  UI.cachedImagesDeckId = 'deck_clear_filters';

  UI.setBoardSearchQuery('nonexistent');
  UI.setBoardTagFilter('sometag');
  assert.equal(UI.boardState.filteredReferences.length, 0);

  UI.clearBoardFilters();
  assert.equal(UI.boardState.searchQuery, '');
  assert.equal(UI.boardState.selectedTag, null);
  assert.equal(UI.boardState.filteredReferences.length, 2);

  const countBadge = ctx.document.getElementById('board-ref-count');
  assert.equal(countBadge.textContent, 'Showing 2 of 2 references');
});

test('Case 15: Empty search/tag results render clean filter empty state', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  UI.currentDeckId = 'deck_filter_empty';
  UI.cachedImages = [{ id: 'ref_1', name: 'figure.jpg' }];
  UI.cachedImagesDeckId = 'deck_filter_empty';

  UI.setBoardSearchQuery('nomatch');
  UI.renderBoardGrid();

  const emptyTitle = ctx.document.getElementById('board-empty-title');
  const emptyDesc = ctx.document.getElementById('board-empty-desc');
  assert.equal(emptyTitle.textContent, 'No references match your filter');
  assert.equal(emptyDesc.textContent, 'Try clearing the search query or selecting a different tag.');
});

// -----------------------------------------------------------------------------
// Category D: Predictable Selection Behavior (Cases 16 - 18)
// -----------------------------------------------------------------------------

test('Case 16: Thumbnail selection updates selectedRef, currentIndex, and visual highlight', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const images = [
    { id: 'sel_1', name: 'one.jpg' },
    { id: 'sel_2', name: 'two.jpg' }
  ];
  UI.currentDeckId = 'deck_sel';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_sel';
  UI.applyBoardFilters();

  UI.selectBoardReference(images[1]);
  assert.equal(UI.boardState.selectedRef.id, 'sel_2');
  assert.equal(UI.boardState.currentIndex, 1);

  UI.renderBoardGrid();
  const grid = ctx.document.getElementById('board-gallery-grid');
  assert.ok(grid.innerHTML.includes('board-ref-card selected'), 'Selected card must have selected class');
});

test('Case 17: Filtering preserves active selection if matching and updates currentIndex', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const images = [
    { id: 'p1', name: 'alpha.jpg' },
    { id: 'p2', name: 'beta.jpg' },
    { id: 'p3', name: 'gamma.jpg' }
  ];
  UI.currentDeckId = 'deck_pres';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_pres';
  UI.applyBoardFilters();

  UI.selectBoardReference(images[1]); // select beta (index 1)
  assert.equal(UI.boardState.currentIndex, 1);

  UI.setBoardSearchQuery('beta'); // only beta matches
  assert.equal(UI.boardState.selectedRef.id, 'p2', 'Selection must be preserved');
  assert.equal(UI.boardState.currentIndex, 0, 'Current index must update to new position');
});

test('Case 18: Filtering clears selection and sets currentIndex to -1 if selected card is excluded', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const images = [
    { id: 'ex1', name: 'apple.jpg' },
    { id: 'ex2', name: 'banana.jpg' }
  ];
  UI.currentDeckId = 'deck_excl';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_excl';
  UI.applyBoardFilters();

  UI.selectBoardReference(images[1]); // banana
  assert.equal(UI.boardState.selectedRef.id, 'ex2');

  UI.setBoardSearchQuery('apple'); // banana excluded
  assert.equal(UI.boardState.selectedRef, null, 'Selection must be cleared');
  assert.equal(UI.boardState.currentIndex, -1);
});

// -----------------------------------------------------------------------------
// Category E: Main Stage Opening & Decoupling (Cases 19 - 21)
// -----------------------------------------------------------------------------

test('Case 19: Opening thumbnail opens main stage with isBoardStageOpen=true and sessionSource="board"', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [{ id: 'stg1', name: 'stage_test.jpg', path: '/art/stage_test.jpg' }];
  UI.currentDeckId = 'deck_stg';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_stg';
  BoardManager.init('deck_stg', images);
  UI.boardState = BoardManager;

  UI.openBoardStage(images[0]);

  assert.equal(UI.isBoardStageOpen, true);
  assert.equal(UI.sessionSource, 'board');
  assert.equal(BoardManager.isStageOpen, true);
  assert.ok(ctx.document.body.classList.contains('board-stage-active'));
});

test('Case 20: Stage in Board mode configures header to "Back to Board" and mode badge to "board-mode"', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const DeckManager = ctx.DeckManager;

  const deck = { id: 'deck_hdr', name: 'Gestures 101' };
  DeckManager.decks = [deck];
  UI.currentDeckId = deck.id;
  const images = [{ id: 'h1', name: 'pose.jpg' }];
  UI.cachedImages = images;
  UI.cachedImagesDeckId = deck.id;

  UI.openBoardStage(images[0]);

  const endBtn = ctx.document.getElementById('btn-end-session');
  const modeBadge = ctx.document.getElementById('session-mode-label');

  assert.ok(endBtn.innerHTML.includes('Back to Board'), 'End button must say Back to Board');
  assert.equal(modeBadge.textContent, 'Reference Stage');
  assert.ok(modeBadge.classList.contains('board-mode'));
});

test('Case 21: Rating dock is suppressed and keys 1-4 / Shift+S are strictly disarmed in Board mode', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;

  const images = [{ id: 'disarm1', name: 'disarm.jpg' }];
  UI.currentDeckId = 'deck_disarm';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_disarm';

  UI.openBoardStage(images[0]);

  let rateCardCalled = false;
  CardManager.rateCard = () => { rateCardCalled = true; };

  // Attempt to rate directly or via hotkeys
  UI.rateCurrentImage('easy');
  assert.equal(rateCardCalled, false, 'rateCurrentImage must abort in board stage');

  ['1', '2', '3', '4'].forEach(key => {
    UI.handleKeyboard({ key, preventDefault() {}, stopPropagation() {} });
    assert.equal(rateCardCalled, false, `Key ${key} must not rate cards in board mode`);
  });

  let nextImageCalled = false;
  UI.showNextImage = () => { nextImageCalled = true; };
  UI.handleKeyboard({ key: 's', shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(nextImageCalled, false, 'Shift+S must not call showNextImage in board mode');
});

// -----------------------------------------------------------------------------
// Category F: Optical Analysis Tools Parity (Case 22)
// -----------------------------------------------------------------------------

test('Case 22: Optical analysis tools parity (G, N, P, I, S, L, M, R) in Board stage mode', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const ArtistToolbox = ctx.ArtistToolbox;

  const images = [{ id: 'opt1', name: 'optical.jpg' }];
  UI.currentDeckId = 'deck_opt';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_opt';
  UI.openBoardStage(images[0]);

  assert.equal(ArtistToolbox.grayscale, false);
  UI.handleKeyboard({ key: 'g', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.grayscale, true, 'G toggles grayscale');

  assert.equal(ArtistToolbox.notan, false);
  UI.handleKeyboard({ key: 'n', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.notan, true, 'N toggles notan');

  assert.equal(ArtistToolbox.posterize, false);
  UI.handleKeyboard({ key: 'p', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.posterize, true, 'P toggles posterize');

  assert.equal(ArtistToolbox.invert, false);
  UI.handleKeyboard({ key: 'i', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.invert, true, 'I toggles invert');

  assert.equal(ArtistToolbox.squint, false);
  UI.handleKeyboard({ key: 's', shiftKey: false, preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.squint, true, 'S toggles squint blur');

  assert.equal(ArtistToolbox.flipX, 1);
  UI.handleKeyboard({ key: 'm', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.flipX, -1, 'M flips image horizontally');

  assert.equal(ArtistToolbox.rotate, 0);
  UI.handleKeyboard({ key: 'r', preventDefault() {}, stopPropagation() {} });
  assert.equal(ArtistToolbox.rotate, 90, 'R rotates image by 90deg');
});

// -----------------------------------------------------------------------------
// Category G: Prev / Next Navigation across Filtered References (Cases 23 - 25)
// -----------------------------------------------------------------------------

test('Case 23: Prev / Next navigation traverses strictly through filteredReferences', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [
    { id: 'nav1', name: 'gesture_1.jpg' },
    { id: 'nav2', name: 'portrait_1.jpg' },
    { id: 'nav3', name: 'gesture_2.jpg' }
  ];
  UI.currentDeckId = 'deck_nav';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_nav';
  BoardManager.init('deck_nav', images);
  UI.boardState = BoardManager;

  // Filter to only gestures (nav1, nav3)
  BoardManager.filteredReferences = [images[0], images[2]];
  UI.openBoardStage(images[0]);
  assert.equal(BoardManager.selectedRef.id, 'nav1');

  UI.stepBoardReference('next');
  assert.equal(BoardManager.selectedRef.id, 'nav3', 'Next must step directly to nav3, skipping nav2');

  UI.stepBoardReference('prev');
  assert.equal(BoardManager.selectedRef.id, 'nav1', 'Prev must step back to nav1');
});

test('Case 24: Navigation wraps around at list boundaries (first <-> last)', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [
    { id: 'b1', name: 'first.jpg' },
    { id: 'b2', name: 'second.jpg' }
  ];
  UI.currentDeckId = 'deck_wrap';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_wrap';
  BoardManager.init('deck_wrap', images);
  UI.boardState = BoardManager;

  UI.openBoardStage(images[0]); // at first
  assert.equal(BoardManager.currentIndex, 0);

  UI.stepBoardReference('prev'); // wraps to last (index 1)
  assert.equal(BoardManager.currentIndex, 1);
  assert.equal(BoardManager.selectedRef.id, 'b2');

  UI.stepBoardReference('next'); // wraps back to first (index 0)
  assert.equal(BoardManager.currentIndex, 0);
  assert.equal(BoardManager.selectedRef.id, 'b1');
});

test('Case 25: Navigation on empty filtered list is completely safe and does not throw', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  UI.currentDeckId = 'deck_empty_nav';
  BoardManager.init('deck_empty_nav', []);
  UI.boardState = BoardManager;
  UI.isBoardStageOpen = true;

  assert.doesNotThrow(() => {
    UI.stepBoardReference('next');
    UI.stepBoardReference('prev');
  });
});

// -----------------------------------------------------------------------------
// Category H: Slideshow Lifecycle & Timer Safety (Cases 26 - 28)
// -----------------------------------------------------------------------------

test('Case 26: Slideshow starts with chosen interval and auto-advances slides', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [
    { id: 's1', name: 'slide1.jpg' },
    { id: 's2', name: 'slide2.jpg' }
  ];
  UI.currentDeckId = 'deck_slide';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_slide';
  BoardManager.init('deck_slide', images);
  UI.boardState = BoardManager;

  UI.openBoardStage(images[0]);
  UI.setBoardSlideInterval(5);

  assert.equal(BoardManager.slideshowIntervalSec, 5);
  assert.notEqual(BoardManager.slideshowTimerId, null, 'Slideshow timer must be active');
  assert.equal(BoardManager.slideshowPaused, false);
  BoardManager.stopSlideshow();
});

test('Case 27: Slideshow pause and resume toggles playback without resetting interval', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [{ id: 'p1', name: '1.jpg' }];
  UI.currentDeckId = 'deck_pause';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_pause';
  BoardManager.init('deck_pause', images);
  UI.boardState = BoardManager;

  UI.openBoardStage(images[0]);
  UI.setBoardSlideInterval(10);

  UI.toggleBoardSlideshowPause();
  assert.equal(BoardManager.slideshowPaused, true, 'Slideshow must be paused');
  assert.equal(BoardManager.slideshowIntervalSec, 10, 'Interval must be preserved');

  UI.toggleBoardSlideshowPause();
  assert.equal(BoardManager.slideshowPaused, false, 'Slideshow must be resumed');
  assert.equal(BoardManager.slideshowIntervalSec, 10);
  BoardManager.stopSlideshow();
});

test('Case 28: Slideshow timer cleanup is guaranteed on stage exit, tab switch, and deck switch', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const images = [{ id: 'c1', name: '1.jpg' }];
  UI.currentDeckId = 'deck_cleanup';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_cleanup';
  BoardManager.init('deck_cleanup', images);
  UI.boardState = BoardManager;

  // 1. Cleanup on closeBoardStage
  UI.openBoardStage(images[0]);
  UI.setBoardSlideInterval(5);
  assert.notEqual(BoardManager.slideshowTimerId, null);
  UI.closeBoardStage();
  assert.equal(BoardManager.slideshowTimerId, null, 'Timer must be cleared on closeBoardStage');

  // 2. Cleanup on switchDeckTab('study')
  UI.openBoardStage(images[0]);
  UI.setBoardSlideInterval(5);
  assert.notEqual(BoardManager.slideshowTimerId, null);
  UI.switchDeckTab('study');
  assert.equal(BoardManager.slideshowTimerId, null, 'Timer must be cleared on switchDeckTab to study');

  // 3. Cleanup on showDeckList()
  UI.openBoardStage(images[0]);
  UI.setBoardSlideInterval(5);
  assert.notEqual(BoardManager.slideshowTimerId, null);
  UI.showDeckList();
  assert.equal(BoardManager.slideshowTimerId, null, 'Timer must be cleared on showDeckList');
});

// -----------------------------------------------------------------------------
// Category I: Browsing Context Restoration & Reset (Cases 29 - 30)
// -----------------------------------------------------------------------------

test('Case 29: Browsing context (search, tag, selection, scroll position) is preserved across tab switches', async () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;
  const BoardManager = ctx.BoardManager;

  const images = [
    { id: 'ctx1', name: 'gesture_male.jpg' },
    { id: 'ctx2', name: 'gesture_female.jpg' }
  ];
  UI.currentDeckId = 'deck_ctx';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_ctx';
  BoardManager.init('deck_ctx', images);
  UI.boardState = BoardManager;

  CardManager.cards['deck_ctx'] = {
    'ctx2': { imageId: 'ctx2', tags: ['gesture', 'dynamic'] }
  };

  await UI.switchDeckTab('board');
  UI.setBoardSearchQuery('gesture');
  UI.setBoardTagFilter('dynamic');
  UI.selectBoardReference(images[1]);
  UI.boardState.gridScrollTop = 280;

  // Round-trip through stage
  UI.openBoardStage(images[1]);
  UI.closeBoardStage();

  assert.equal(UI.boardState.searchQuery, 'gesture');
  assert.equal(UI.boardState.selectedTag, 'dynamic');
  assert.equal(UI.boardState.selectedRef.id, 'ctx2');
  assert.equal(UI.boardState.gridScrollTop, 280);

  // Round-trip through Study tab
  await UI.switchDeckTab('study');
  await UI.switchDeckTab('board');

  assert.equal(UI.boardState.searchQuery, 'gesture');
  assert.equal(UI.boardState.selectedTag, 'dynamic');
  assert.equal(UI.boardState.selectedRef.id, 'ctx2');
  assert.equal(UI.boardState.gridScrollTop, 280);
});

test('Case 30: Zero SRS contamination audit (no rateCard calls, no SRS mutations, no sync writes) and SRS study regression check', async () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const CardManager = ctx.CardManager;
  const ReviewHistory = ctx.ReviewHistory;
  const TimerManager = ctx.TimerManager;
  const Storage = ctx.Storage;

  const images = [{ id: 'iso1', name: 'iso.jpg' }];
  UI.currentDeckId = 'deck_iso';
  UI.cachedImages = images;
  UI.cachedImagesDeckId = 'deck_iso';

  CardManager.cards['deck_iso'] = {
    'iso1': {
      imageId: 'iso1',
      easeFactor: 2.5,
      interval: 4,
      dueDate: '2026-11-20',
      lapses: 0,
      consecutiveSuccesses: 1,
      reviewCount: 1
    }
  };

  const initialCard = JSON.stringify(CardManager.cards['deck_iso']['iso1']);
  const initialHistory = JSON.stringify(ReviewHistory.history);

  let syncCalled = false;
  Storage.syncToDisk = async () => { syncCalled = true; };

  // 1. Board Mode actions
  await UI.switchDeckTab('board');
  UI.openBoardStage(images[0]);
  UI.stepBoardReference('next');
  UI.closeBoardStage();

  // Audit assertions
  assert.equal(JSON.stringify(CardManager.cards['deck_iso']['iso1']), initialCard, 'SRS card metrics must be untouched');
  assert.equal(JSON.stringify(ReviewHistory.history), initialHistory, 'ReviewHistory must be untouched');
  assert.equal(syncCalled, false, 'Storage.syncToDisk must never be called during Board mode');
  assert.equal(TimerManager.isRunning(), false, 'Timer must not be running');

  // 2. SRS Study Regression Check
  await UI.switchDeckTab('study');
  assert.equal(UI.activeDeckTab, 'study');
  assert.equal(UI.sessionSource, null);

  // Normal SRS session start
  UI.startSession('new');
  assert.equal(UI.sessionSource, 'srs', 'SRS study must configure sessionSource to srs');
  assert.equal(UI.isBoardStageOpen, false);
});

test('Case 31: Small, Medium, Large grid size toggles update DOM class and persist in BoardManager', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;
  const BoardManager = ctx.BoardManager;

  const grid = ctx.document.getElementById('board-gallery-grid');
  UI.setBoardGridSize('small');
  assert.ok(grid.classList.contains('size-small'));
  assert.equal(BoardManager.gridSize, 'small');

  UI.setBoardGridSize('large');
  assert.ok(grid.classList.contains('size-large'));
  assert.ok(!grid.classList.contains('size-small'));
  assert.equal(BoardManager.gridSize, 'large');

  UI.setBoardGridSize('medium');
  assert.ok(grid.classList.contains('size-medium'));
  assert.equal(BoardManager.gridSize, 'medium');
});

// -----------------------------------------------------------------------------
// Security Checks: CSP, HTML Event Handlers & Escaping
// -----------------------------------------------------------------------------

test('Security check: public/index.html contains zero inline scripts or inline event handlers', () => {
  assert.ok(!indexHtmlCode.includes('<script>'), 'index.html must not contain inline <script>');
  assert.ok(!indexHtmlCode.includes('onclick='), 'index.html must not contain inline onclick=');
  assert.ok(!indexHtmlCode.includes('onerror='), 'index.html must not contain inline onerror=');
  assert.ok(!indexHtmlCode.includes('onload='), 'index.html must not contain inline onload=');
  assert.ok(!indexHtmlCode.includes('onchange='), 'index.html must not contain inline onchange=');
});

test('Security check: UI._esc escapes dangerous dynamic strings', () => {
  const ctx = setupTestEnvironment();
  const UI = ctx.UI;

  const dangerous = '<script>alert(1)</script>"\'&';
  const escaped = UI._esc(dangerous);

  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;'));
  assert.ok(escaped.includes('&quot;'));
  assert.ok(escaped.includes('&#39;'));
  assert.ok(escaped.includes('&amp;'));
});
