const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { loadFrontendCode } = require('./helpers/load-frontend.js');
const appJsCode = loadFrontendCode();

function setupTestEnvironment() {
  const elements = new Map();

  function makeElement(id, tagName = 'div') {
    const classList = new Set();
    const listeners = {};
    const dataset = {};
    const style = {
      setProperty(k, v) { this[k] = v; }
    };
    const attributes = {};
    const children = [];
    let textContent = '';
    let innerHTML = '';

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      dataset,
      style,
      value: '',
      title: '',
      setAttribute(k, v) { attributes[k] = String(v); },
      getAttribute(k) { return attributes[k] !== undefined ? attributes[k] : null; },
      get textContent() { return textContent; },
      set textContent(v) { textContent = String(v); },
      get innerHTML() { return innerHTML; },
      set innerHTML(v) { innerHTML = String(v); },
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
        listeners[event] = listeners[event].filter(f => f !== fn);
      },
      dispatchEvent(event) {
        if (listeners[event.type]) {
          listeners[event.type].forEach(fn => fn(event));
        }
      },
      querySelector(sel) {
        if (sel.startsWith('.')) {
          const cls = sel.slice(1);
          return children.find(ch => ch.classList && ch.classList.contains(cls)) || null;
        }
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll() { return []; },
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
      },
      appendChild(c) { children.push(c); return c; },
      removeChild(c) {
        const idx = children.indexOf(c);
        if (idx !== -1) children.splice(idx, 1);
        return c;
      }
    };
    elements.set(id, el);
    return el;
  }

  const docElements = [
    'wallpaper-bg', 'wallpaper-overlay', 'app',
    'view-deck-list', 'view-deck-detail', 'view-session',
    'session-zen-icon', 'session-zen-text', 'hud-fs-icon',
    'btn-session-zen', 'today-strip', 'deck-grid', 'deck-empty-state',
    'today-due', 'today-practiced', 'today-streak', 'today-decks'
  ];
  docElements.forEach(id => makeElement(id));

  // Set view-deck-list as initial active view
  elements.get('view-deck-list').classList.add('view', 'active');
  elements.get('view-deck-detail').classList.add('view');
  elements.get('view-session').classList.add('view');

  const documentListeners = {};
  let fullscreenCallback = null;

  const mockDocument = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    getElementById(id) {
      if (!elements.has(id)) makeElement(id);
      return elements.get(id);
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.view') {
        return [
          elements.get('view-deck-list'),
          elements.get('view-deck-detail'),
          elements.get('view-session')
        ];
      }
      return [];
    },
    createElement(tag) {
      return makeElement('dynamic_' + Math.random().toString(36).slice(2), tag);
    },
    addEventListener(event, fn) {
      if (!documentListeners[event]) documentListeners[event] = [];
      documentListeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!documentListeners[event]) return;
      documentListeners[event] = documentListeners[event].filter(f => f !== fn);
    },
    body: makeElement('body'),
    documentElement: {
      getAttribute(k) { return null; },
      setAttribute(k, v) { },
      removeAttribute(k) { },
      style: {
        setProperty(k, v) { this[k] = v; }
      },
      requestFullscreen: async () => { },
      webkitRequestFullscreen: async () => { }
    },
    exitFullscreen: async () => { },
    webkitExitFullscreen: async () => { }
  };

  const mockWindow = {
    document: mockDocument,
    location: { search: '' },
    navigator: { userAgent: 'test-agent' },
    addEventListener() { },
    removeEventListener() { },
    requestAnimationFrame(cb) { return setTimeout(cb, 0); },
    setTimeout(cb, ms) { return setTimeout(cb, ms); },
    clearTimeout(id) { clearTimeout(id); },
    electronAPI: {
      isElectron: true,
      setFullScreen: async (flag) => ({ success: true, isFullScreen: flag }),
      onFullscreenChange: (cb) => {
        fullscreenCallback = cb;
        return () => { fullscreenCallback = null; };
      }
    },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    }
  };

  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    navigator: mockWindow.navigator,
    location: mockWindow.location,
    localStorage: mockWindow.localStorage,
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => { },
    clearInterval: () => { },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    indexedDB: {
      open: () => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      })
    },
    AudioContext: class {
      constructor() { this.state = 'suspended'; this.destination = {}; }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime() { }, exponentialRampToValueAtTime() { } }, connect() { }, start() { }, stop() { } }; }
      createGain() { return { gain: { setValueAtTime() { }, exponentialRampToValueAtTime() { } }, connect() { } }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
    },
    TAG_PRESETS: []
  };

  sandbox.window.document = mockDocument;
  sandbox.window.location = sandbox.location;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.AudioContext = sandbox.AudioContext;

  vm.createContext(sandbox);
  const exported = vm.runInContext(
    appJsCode + '\n;({ UI, WallpaperManager, Storage, ArtistToolbox, SessionManager, CardManager, DeckManager })',
    sandbox
  );

  return {
    sandbox,
    mockDocument,
    mockWindow,
    ...exported,
    triggerFullscreenChange: (inFs) => {
      if (fullscreenCallback) fullscreenCallback(inFs);
    }
  };
}

test('Fullscreen wallpaper persistence and Zen mode isolation tests', async (t) => {
  await t.test('1. Entering native fullscreen while on Deck List view does NOT activate Zen mode or hide wallpaper', () => {
    const env = setupTestEnvironment();
    const UI = env.UI;
    const WallpaperManager = env.WallpaperManager;
    const mockDocument = env.mockDocument;

    // Set custom wallpaper
    WallpaperManager.settings = { blur: 10, dim: 40, hasCustom: true };
    WallpaperManager.currentWallpaperDataUrl = 'data:image/png;base64,mockwallpaper';
    WallpaperManager.applyStyles();

    assert.equal(mockDocument.body.classList.contains('has-wallpaper'), true, 'has-wallpaper applied to body');
    const bgEl = mockDocument.getElementById('wallpaper-bg');
    assert.equal(bgEl.style.opacity, '1', 'wallpaper-bg opacity is 1');
    assert.ok(bgEl.style.backgroundImage.includes('data:image/png;base64,mockwallpaper'), 'wallpaper-bg has background image');

    // Simulate user clicking macOS green button or entering native fullscreen while on Deck List
    UI.bindFullscreenEvents();
    env.triggerFullscreenChange(true);

    // Verify Zen mode was NOT activated
    assert.equal(UI.isZenMode, false, 'UI.isZenMode remains false');
    assert.equal(mockDocument.body.classList.contains('zen-active'), false, 'body does NOT have zen-active class');

    // Verify wallpaper remains active
    assert.equal(mockDocument.body.classList.contains('has-wallpaper'), true, 'has-wallpaper remains on body');
    assert.equal(bgEl.style.opacity, '1', 'wallpaper-bg opacity remains 1');
  });

  await t.test('2. setZenMode(true) refuses to activate when outside an active session', () => {
    const env = setupTestEnvironment();
    const UI = env.UI;
    const mockDocument = env.mockDocument;

    // Currently on Deck List view (view-deck-list active, view-session inactive)
    assert.equal(mockDocument.body.classList.contains('in-session'), false);
    assert.equal(mockDocument.getElementById('view-session').classList.contains('active'), false);

    // Attempt to set Zen mode directly
    UI.setZenMode(true);

    assert.equal(UI.isZenMode, false, 'isZenMode refused to switch to true');
    assert.equal(mockDocument.body.classList.contains('zen-active'), false, 'zen-active was not added to body');
  });

  await t.test('3. setZenMode(true) works correctly inside an active study session', () => {
    const env = setupTestEnvironment();
    const UI = env.UI;
    const mockDocument = env.mockDocument;

    // Switch to session view
    UI.showView('view-session');
    assert.equal(mockDocument.body.classList.contains('in-session'), true);
    assert.equal(mockDocument.getElementById('view-session').classList.contains('active'), true);

    // Now setZenMode(true) should succeed
    UI.setZenMode(true);
    assert.equal(UI.isZenMode, true, 'isZenMode is now true in active session');
    assert.equal(mockDocument.body.classList.contains('zen-active'), true, 'zen-active added to body');

    // Leaving native fullscreen exits Zen mode cleanly
    UI.bindFullscreenEvents();
    env.triggerFullscreenChange(false);
    assert.equal(UI.isZenMode, false, 'isZenMode exited on leave-fullscreen');
    assert.equal(mockDocument.body.classList.contains('zen-active'), false, 'zen-active removed from body');
  });

  await t.test('4. showView() switching away from view-session automatically deactivates Zen mode', () => {
    const env = setupTestEnvironment();
    const UI = env.UI;
    const mockDocument = env.mockDocument;

    UI.showView('view-session');
    UI.setZenMode(true);
    assert.equal(UI.isZenMode, true);
    assert.equal(mockDocument.body.classList.contains('zen-active'), true);

    // Switch away from session to deck list
    UI.showView('view-deck-list');
    assert.equal(UI.isZenMode, false, 'Zen mode deactivated on view switch');
    assert.equal(mockDocument.body.classList.contains('zen-active'), false, 'zen-active removed on view switch');
    assert.equal(mockDocument.body.classList.contains('in-session'), false, 'in-session removed on view switch');
  });
});
