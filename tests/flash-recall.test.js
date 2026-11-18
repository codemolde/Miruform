const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadFrontendCode } = require('./helpers/load-frontend.js');
const appJsCode = loadFrontendCode();
const indexHtmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const styleCssCode = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');

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
      checked: false,
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
      addEventListener(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      removeEventListener(event, fn) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(l => l !== fn);
      },
      dispatchEvent(event) {
        if (listeners[event.type]) {
          listeners[event.type].forEach(l => l(event));
        }
      },
      click() {
        if (listeners['click']) {
          listeners['click'].forEach(l => l({ type: 'click', target: el }));
        }
      },
      remove() {
        if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el);
      },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      focus() { },
      blur() { },
      offsetWidth: 100
    };
    return el;
  }

  const domIds = [
    'image-blur-overlay', 'drill-stage-hud', 'drill-hud-phase-text',
    'btn-drill-action', 'drill-recall-card', 'drill-mastery-container',
    'btn-drill-reveal-card', 'timer-display', 'session-rating-area',
    'btn-skip', 'toggle-flash-recall', 'flash-recall-status-text',
    'flash-recall-options-body', 'drill-critique-actions',
    'btn-drill-paste', 'btn-drill-sidebyside', 'btn-drill-flicker',
    'btn-rate-again', 'btn-rate-hard', 'btn-rate-medium', 'btn-rate-easy',
    'tab-btn-study', 'tab-btn-board', 'deck-view-study', 'deck-view-board',
    'view-session', 'view-deck-detail'
  ];

  domIds.forEach(id => {
    elements.set(id, makeElement(id));
  });

  const localStore = new Map();
  const mockLocalStorage = {
    getItem(k) { return localStore.has(k) ? localStore.get(k) : null; },
    setItem(k, v) { localStore.set(k, String(v)); },
    removeItem(k) { localStore.delete(k); },
    clear() { localStore.clear(); }
  };

  const mockDocument = {
    body: makeElement('body', 'body'),
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, makeElement(id));
      }
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement(tag) { return makeElement('gen_' + Math.random().toString(36).slice(2, 8), tag); },
    addEventListener() { }
  };

  const mockWindow = {
    location: { search: '' },
    localStorage: mockLocalStorage,
    document: mockDocument,
    navigator: { userAgent: 'NodeTest' },
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    addEventListener() { },
    removeEventListener() { }
  };

  return { elements, mockLocalStorage, mockDocument, mockWindow };
}

function createContext(setup) {
  return {
    window: setup.mockWindow,
    document: setup.mockDocument,
    navigator: setup.mockWindow.navigator,
    localStorage: setup.mockLocalStorage,
    location: setup.mockWindow.location,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    console,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout
  };
}

test('FlashRecallManager: Default state and localStorage parameter configuration', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  assert.ok(mgr, 'FlashRecallManager must be defined');
  assert.strictEqual(mgr, context.window.MemoryDrillManager, 'MemoryDrillManager must alias FlashRecallManager');

  mgr.reset();
  mgr.setEnabled(true);
  mgr.setObserveSec(20);
  mgr.setDrawSec(180);
  mgr.setVeilMode('blur');

  assert.strictEqual(mgr.enabled, true);
  assert.strictEqual(mgr.observeSec, 20);
  assert.strictEqual(mgr.drawSec, 180);
  assert.strictEqual(mgr.veilMode, 'blur');

  assert.strictEqual(setup.mockLocalStorage.getItem('artpractice_drill_enabled'), 'true');
  assert.strictEqual(setup.mockLocalStorage.getItem('artpractice_drill_observe'), '20');
  assert.strictEqual(setup.mockLocalStorage.getItem('artpractice_drill_draw'), '180');
  assert.strictEqual(setup.mockLocalStorage.getItem('artpractice_drill_veil'), 'blur');

  mgr.reset();
});

test('Phase 1 — OBSERVE: Starts on card load, keeps veil hidden, shows HUD pill', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  mgr.setEnabled(true);
  mgr.setObserveSec(15);
  mgr.setVeilMode('blackout');

  const mockImage = { id: 'img_test_1', name: 'Pose Reference 1.jpg' };
  mgr.startCard('deck_1', mockImage);

  assert.strictEqual(mgr.phase, 'observe', 'Phase must be observe');
  assert.strictEqual(mgr.phaseRemaining, 15, 'Observe countdown must start at observeSec');

  const veilOverlay = setup.elements.get('image-blur-overlay');
  assert.ok(veilOverlay.classList.contains('hidden'), 'Veil overlay must remain hidden in observe phase');

  const hud = setup.elements.get('drill-stage-hud');
  assert.ok(!hud.classList.contains('hidden'), 'Stage HUD must be visible in observe phase');

  const hudText = setup.elements.get('drill-hud-phase-text');
  assert.strictEqual(hudText.textContent, 'OBSERVE · 0:15', 'HUD text must display OBSERVE · 0:15');

  const actionBtn = setup.elements.get('btn-drill-action');
  assert.strictEqual(actionBtn.textContent, 'Draw Now →', 'HUD action button must say Draw Now →');

  mgr.reset();
});

test('Phase 2 — BLIND_DRAW: Veil engaged, recall card shown, mastery challenge badge displayed', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  mgr.setEnabled(true);
  mgr.setObserveSec(10);
  mgr.setDrawSec(120);
  mgr.setVeilMode('blackout');

  // Mastery card: easeFactor > 2.4 and interval > 7
  mgr.currentCard = {
    imageId: 'img_mastery_card',
    imageName: 'Mastery Reference.jpg',
    easeFactor: 2.7,
    interval: 14
  };

  mgr.transitionToDraw();

  assert.strictEqual(mgr.phase, 'draw', 'Phase must be draw');
  assert.strictEqual(mgr.phaseRemaining, 120, 'Draw countdown must start at drawSec');

  const veilOverlay = setup.elements.get('image-blur-overlay');
  assert.ok(!veilOverlay.classList.contains('hidden'), 'Veil overlay must be visible in draw phase');
  assert.ok(veilOverlay.classList.contains('drill-blind-active'), 'drill-blind-active class must be present');
  assert.ok(veilOverlay.classList.contains('drill-veil-blackout'), 'drill-veil-blackout class must be present');

  const recallCard = setup.elements.get('drill-recall-card');
  assert.ok(!recallCard.classList.contains('hidden'), 'Recall prompt card must be visible in draw phase');

  const masteryContainer = setup.elements.get('drill-mastery-container');
  assert.ok(!masteryContainer.classList.contains('hidden'), 'Mastery badge container must be visible');
  assert.ok(masteryContainer.innerHTML.includes('Mastery Challenge:'), 'Mastery badge must contain challenge text');

  const hudText = setup.elements.get('drill-hud-phase-text');
  assert.strictEqual(hudText.textContent, 'BLIND DRAW · 2:00', 'HUD text must display BLIND DRAW · 2:00');

  const actionBtn = setup.elements.get('btn-drill-action');
  assert.strictEqual(actionBtn.textContent, 'Reveal & Critique →', 'HUD action button must say Reveal & Critique →');

  mgr.reset();
});

test('Veil Hardening: clearBlurOverlay refuses to lift veil during BLIND_DRAW', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;

  mgr.setEnabled(true);
  mgr.transitionToDraw();

  const veilOverlay = setup.elements.get('image-blur-overlay');
  assert.ok(!veilOverlay.classList.contains('hidden'), 'Veil must be visible');

  // Attempt to clear veil without force (e.g. from hotkeys, sketch drop, optical tool)
  UI.clearBlurOverlay(false);

  assert.ok(!veilOverlay.classList.contains('hidden'), 'Veil must NOT be hidden during BLIND_DRAW without force');

  // Lifting with force (e.g. transitionToReveal) succeeds
  UI.clearBlurOverlay(true);
  assert.ok(veilOverlay.classList.contains('hidden'), 'Veil must be lifted when force is true');

  mgr.reset();
});

test('Phase 3 — REVEAL_CRITIQUE: Lifts veil, updates HUD, and opens rating dock', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  mgr.setEnabled(true);
  mgr.transitionToDraw();

  // Transition to Reveal
  mgr.transitionToReveal();

  assert.strictEqual(mgr.phase, 'reveal', 'Phase must be reveal');

  const veilOverlay = setup.elements.get('image-blur-overlay');
  assert.ok(veilOverlay.classList.contains('hidden'), 'Veil must be hidden in reveal phase');
  assert.ok(!veilOverlay.classList.contains('drill-blind-active'), 'drill-blind-active must be removed');

  const hudText = setup.elements.get('drill-hud-phase-text');
  assert.strictEqual(hudText.textContent, 'CRITIQUE & GRADE', 'HUD text must display CRITIQUE & GRADE');

  const actionBtn = setup.elements.get('btn-drill-action');
  assert.ok(actionBtn.classList.contains('hidden'), 'HUD action button must be hidden in critique phase');

  assert.ok(setup.mockDocument.body.classList.contains('rating-required'), 'rating-required class must be on body');

  mgr.reset();
});

test('Single-Interval Safety: Timer intervals are always cleared before starting new transitions', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  mgr.setEnabled(true);
  mgr.setObserveSec(10);
  mgr.setDrawSec(60);

  mgr.startCard('deck_1', { id: 'img_1' });
  const interval1 = mgr.intervalId;
  assert.ok(interval1 !== null, 'Interval must be set during observe');

  mgr.transitionToDraw();
  const interval2 = mgr.intervalId;
  assert.ok(interval2 !== null, 'Interval must be set during draw');
  assert.notStrictEqual(interval1, interval2, 'Previous interval must have been cleared');

  mgr.transitionToReveal();
  assert.strictEqual(mgr.intervalId, null, 'Interval must be null during reveal');

  mgr.reset();
  assert.strictEqual(mgr.intervalId, null, 'Interval must remain null after reset');
});

test('Grading Gate: #session-rating-area is locked/dimmed during OBSERVE and BLIND_DRAW, rateCurrentImage is gated, Skip works', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  const ratingArea = setup.elements.get('session-rating-area');

  mgr.setEnabled(true);
  mgr.setObserveSec(15);
  mgr.setDrawSec(120);

  // 1. Observe phase
  mgr.startCard('deck_1', { id: 'img_1', name: 'Ref 1.jpg' });
  assert.strictEqual(mgr.phase, 'observe');
  assert.ok(ratingArea.classList.contains('drill-rating-locked'), 'Rating area must have drill-rating-locked in observe');

  // Attempt to rate during observe
  let rated = false;
  context.window.CardManager.rateCard = () => { rated = true; };
  context.window.SessionManager.currentImage = { id: 'img_1', name: 'Ref 1.jpg' };
  context.window.SessionManager.deckId = 'deck_1';
  UI.rateCurrentImage('easy');
  assert.strictEqual(rated, false, 'rateCurrentImage must be strictly gated during OBSERVE');

  // Verify hotkeys 1-4 are ignored in observe
  let eventPrevented = false;
  UI.handleKeyboard({ key: '1', preventDefault() { eventPrevented = true; }, stopPropagation() {} });
  assert.strictEqual(eventPrevented, true, 'Key 1 must be prevented in observe');

  // Verify Skip (Shift+S) advances
  let nextCalled = false;
  UI.showNextImage = () => { nextCalled = true; };
  UI.handleKeyboard({ key: 'S', shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.strictEqual(nextCalled, true, 'Shift+S must advance to next card during OBSERVE');

  // 2. Draw phase
  mgr.transitionToDraw();
  assert.strictEqual(mgr.phase, 'draw');
  assert.ok(ratingArea.classList.contains('drill-rating-locked'), 'Rating area must remain locked in draw');

  // Attempt to rate during draw
  UI.rateCurrentImage('easy');
  assert.strictEqual(rated, false, 'rateCurrentImage must be strictly gated during BLIND_DRAW');

  // Verify hotkeys 1-4 ignored in draw
  eventPrevented = false;
  UI.handleKeyboard({ key: '4', preventDefault() { eventPrevented = true; }, stopPropagation() {} });
  assert.strictEqual(eventPrevented, true, 'Key 4 must be prevented in draw');

  // Verify Skip (Shift+S) works during draw
  nextCalled = false;
  UI.handleKeyboard({ key: 'S', shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.strictEqual(nextCalled, true, 'Shift+S must advance to next card during BLIND_DRAW');

  mgr.reset();
});

test('REVEAL_CRITIQUE: Unlocks rating area, keys 1-4 rate card with elapsed drill duration', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  const ratingArea = setup.elements.get('session-rating-area');

  mgr.setEnabled(true);
  mgr.startCard('deck_1', { id: 'img_1', name: 'Ref 1.jpg' });

  // Simulate 12 seconds passing
  mgr.drillStartTime = Date.now() - 12000;

  mgr.transitionToReveal();
  assert.strictEqual(mgr.phase, 'reveal');
  assert.ok(!ratingArea.classList.contains('drill-rating-locked'), 'drill-rating-locked must be removed in reveal');

  let recordedDuration = null;
  let ratedDiff = null;
  context.window.CardManager.rateCard = (deckId, imgId, imgName, diff, duration) => {
    ratedDiff = diff;
    recordedDuration = duration;
  };
  context.window.SessionManager.currentImage = { id: 'img_1', name: 'Ref 1.jpg' };
  context.window.SessionManager.deckId = 'deck_1';

  UI.rateCurrentImage('medium');
  assert.strictEqual(ratedDiff, 'medium');
  assert.ok(recordedDuration >= 11 && recordedDuration <= 13, `Recorded duration should be ~12s, got ${recordedDuration}`);

  mgr.reset();
});

test('Self-Critique Quick Actions: Visible in REVEAL_CRITIQUE and trigger SketchOverlay/SketchComparison methods', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;
  const critiqueActions = setup.elements.get('drill-critique-actions');
  const btnPaste = setup.elements.get('btn-drill-paste');
  const btnSideBySide = setup.elements.get('btn-drill-sidebyside');
  const btnFlicker = setup.elements.get('btn-drill-flicker');

  mgr.setEnabled(true);

  // Hidden in observe
  mgr.transitionToObserve();
  assert.ok(critiqueActions.classList.contains('hidden'), 'Critique actions must be hidden in observe');

  // Hidden in draw
  mgr.transitionToDraw();
  assert.ok(critiqueActions.classList.contains('hidden'), 'Critique actions must be hidden in draw');

  // Visible in reveal
  mgr.transitionToReveal();
  assert.ok(!critiqueActions.classList.contains('hidden'), 'Critique actions must be visible in reveal');

  // Verify button triggers
  let pasteTriggered = false;
  let splitTriggered = false;
  let flickerTriggered = false;

  context.window.SketchOverlay.active = true;
  context.window.SketchOverlay.promptPasteOrUpload = () => { pasteTriggered = true; };
  context.window.SketchOverlay.toggleVisibility = () => { flickerTriggered = true; };
  context.window.SketchComparison.toggleSplitView = () => { splitTriggered = true; };

  btnPaste.click();
  assert.strictEqual(pasteTriggered, true, 'Paste button must call promptPasteOrUpload');

  btnSideBySide.click();
  assert.strictEqual(splitTriggered, true, 'Side-by-Side button must call toggleSplitView');

  btnFlicker.click();
  assert.strictEqual(flickerTriggered, true, 'Flicker button must call toggleVisibility');

  mgr.reset();
});

test('Lifecycle & Isolation Cleanup: endSession, board tab switch, and BoardManager isolation', () => {
  const setup = setupTestEnvironment();
  const context = createContext(setup);

  const vm = require('node:vm');
  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const UI = context.window.UI;
  UI.bindEvents();

  const mgr = context.window.FlashRecallManager;

  mgr.setEnabled(true);
  mgr.startCard('deck_1', { id: 'img_1', name: 'Ref 1.jpg' });
  mgr.transitionToDraw();
  assert.strictEqual(mgr.phase, 'draw');

  // 1. endSession resets drill to idle
  UI.endSession();
  assert.strictEqual(mgr.phase, 'idle');
  assert.strictEqual(mgr.intervalId, null);

  // 2. switchDeckTab('board') resets drill
  mgr.startCard('deck_1', { id: 'img_1', name: 'Ref 1.jpg' });
  mgr.transitionToDraw();
  UI.switchDeckTab('board');
  assert.strictEqual(mgr.phase, 'idle');

  // 3. openBoardStage resets drill and ignores startCard
  mgr.startCard('deck_1', { id: 'img_1', name: 'Ref 1.jpg' });
  UI.openBoardStage({ id: 'img_ref_board', name: 'Board Ref.png' });
  assert.strictEqual(mgr.phase, 'idle');

  // While in board session, startCard returns false and stays idle
  const startedInBoard = mgr.startCard('deck_1', { id: 'img_2', name: 'Ref 2.jpg' });
  assert.strictEqual(startedInBoard, false, 'BoardManager sessions must NEVER activate Flash & Recall');
  assert.strictEqual(mgr.phase, 'idle');

  UI.closeBoardStage();
  mgr.reset();
});

test('Security check: public/index.html contains zero inline scripts or inline event handlers', () => {
  assert.doesNotMatch(indexHtmlCode, /<script\b(?![^>]*\bsrc=)[^>]*>/i, 'Zero inline <script> tags allowed');
  assert.doesNotMatch(indexHtmlCode, /\bon[a-z]+\s*=/i, 'Zero inline event handlers (onclick, onchange, etc.) allowed');
});

test('Security check: Zero continuous CSS keyframe animations (0.0% idle GPU footprint)', () => {
  const infiniteRegex = /@keyframes\s+([a-zA-Z0-9_-]+)[\s\S]*?infinite/gi;
  const matches = styleCssCode.match(infiniteRegex);
  assert.strictEqual(matches, null, 'Zero infinite CSS keyframe animations allowed');
});
