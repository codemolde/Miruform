const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ThemeManager = require('../public/js/core/theme.js');

test('ThemeManager: defaults to dark theme when no preference stored', () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); }
  };

  const attrs = {};
  global.document = {
    documentElement: {
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
      getAttribute: (k) => attrs[k] || null
    },
    body: {
      setAttribute: (k, v) => { attrs['body_' + k] = v; },
      removeAttribute: (k) => { delete attrs['body_' + k]; },
      getAttribute: (k) => attrs['body_' + k] || null
    },
    getElementById: () => null,
    querySelector: () => null
  };

  ThemeManager.init();
  assert.equal(ThemeManager.getTheme(), 'dark');
  assert.equal(attrs['data-theme'], undefined);
});

test('ThemeManager: toggles to light theme and persists preference', () => {
  const mockStorage = {};
  global.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); }
  };

  const attrs = {};
  const mockElements = {
    'theme-text': { textContent: '' },
    'theme-icon': { innerHTML: '' },
    'detail-theme-text': { textContent: '' },
    'detail-theme-icon': { innerHTML: '' },
    'btn-toggle-theme': { title: '' },
    'btn-detail-theme': { title: '' }
  };
  const mockLogo = { src: '' };

  global.document = {
    documentElement: {
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
      getAttribute: (k) => attrs[k] || null
    },
    body: {
      setAttribute: (k, v) => { attrs['body_' + k] = v; },
      removeAttribute: (k) => { delete attrs['body_' + k]; },
      getAttribute: (k) => attrs['body_' + k] || null
    },
    getElementById: (id) => mockElements[id] || null,
    querySelector: (sel) => sel === '.brand-logo-img' ? mockLogo : null
  };

  ThemeManager.init();
  assert.equal(ThemeManager.getTheme(), 'dark');

  // Toggle to light
  const newTheme = ThemeManager.toggle();
  assert.equal(newTheme, 'light');
  assert.equal(ThemeManager.getTheme(), 'light');
  assert.equal(attrs['data-theme'], 'light');
  assert.equal(mockStorage['miruform_theme'], 'light');
  assert.equal(mockElements['theme-text'].textContent, 'Dark');
  assert.equal(mockLogo.src, 'assets/miruform_icon.svg');

  // Toggle back to dark
  const backTheme = ThemeManager.toggle();
  assert.equal(backTheme, 'dark');
  assert.equal(ThemeManager.getTheme(), 'dark');
  assert.equal(attrs['data-theme'], undefined);
  assert.equal(mockStorage['miruform_theme'], 'dark');
  assert.equal(mockElements['theme-text'].textContent, 'Light');
  assert.equal(mockLogo.src, 'assets/miruform_icon.svg');
});

test('ThemeManager: restores light theme on init if stored in localStorage', () => {
  const mockStorage = { miruform_theme: 'light' };
  global.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); }
  };

  const attrs = {};
  global.document = {
    documentElement: {
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
      getAttribute: (k) => attrs[k] || null
    },
    body: {
      setAttribute: (k, v) => { attrs['body_' + k] = v; },
      removeAttribute: (k) => { delete attrs['body_' + k]; },
      getAttribute: (k) => attrs['body_' + k] || null
    },
    getElementById: () => null,
    querySelector: () => null
  };

  ThemeManager.init();
  assert.equal(ThemeManager.getTheme(), 'light');
  assert.equal(attrs['data-theme'], 'light');
});

test('index.html: contains theme toggle buttons and updated Drawing Practice brand text', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('id="btn-toggle-theme"'), 'Must have btn-toggle-theme in index.html');
  assert.ok(html.includes('id="btn-detail-theme"'), 'Must have btn-detail-theme in index.html');
  assert.ok(html.includes('Visual Library & Drawing Practice'), 'Must have updated Drawing Practice tagline');
  assert.ok(html.includes('js/core/theme.js'), 'Must load js/core/theme.js');

  // Security check: no inline scripts or inline event handlers
  assert.equal(html.match(/<script(?![^>]*src=)[^>]*>/i), null);
  assert.equal(html.match(/\son[a-z]+=/i), null);
});

test('Streak SVG glow: white glow in dark mode and light ember glow in light mode', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const uiJs = fs.readFileSync(path.join(__dirname, '../public/js/ui/ui.js'), 'utf8');

  // Verify streak SVG classes
  assert.ok(html.includes('atelier-flame-icon') && html.includes('today-streak'));
  assert.ok(uiJs.includes('atelier-flame-icon'));

  // Verify dark mode glow contains white drop-shadow
  assert.match(css, /\.atelier-flame-icon[^{]*\{[^}]*drop-shadow\([^)]*rgba\(255,\s*255,\s*255/s);

  // Verify light mode glow contains ember drop-shadow
  assert.match(css, /\[data-theme="light"\][^{]*\.atelier-flame-icon[^{]*\{[^}]*drop-shadow\([^)]*rgba\((245,\s*158,\s*11|217,\s*119,\s*6|234,\s*88,\s*12)/s);
});

test('WallpaperManager: dynamic overlay calculation responds to theme and slider', () => {
  const { WallpaperManager } = require('../public/js/core/storage.js');
  const docProps = {};
  const bodyProps = {};
  const overlayStyle = {};

  global.document = {
    documentElement: {
      getAttribute: (k) => k === 'data-theme' ? 'light' : null,
      style: {
        setProperty: (k, v) => { docProps[k] = v; }
      }
    },
    body: {
      getAttribute: (k) => k === 'data-theme' ? 'light' : null,
      classList: { toggle: () => {} },
      style: {
        setProperty: (k, v) => { bodyProps[k] = v; }
      }
    },
    getElementById: (id) => {
      if (id === 'wallpaper-bg') return { style: {} };
      if (id === 'wallpaper-overlay') return { style: overlayStyle };
      return null;
    }
  };

  WallpaperManager.settings = { blur: 10, dim: 35, hasCustom: true };
  WallpaperManager.currentWallpaperDataUrl = 'data:image/png;base64,123';
  WallpaperManager.applyStyles();

  assert.equal(docProps['--wallpaper-overlay-dim'], 'rgba(245, 245, 247, 0.35)');
  assert.equal(bodyProps['--wallpaper-overlay-dim'], 'rgba(245, 245, 247, 0.35)');
  assert.equal(overlayStyle.backgroundColor, 'rgba(245, 245, 247, 0.35)');

  // In dark mode:
  global.document.documentElement.getAttribute = () => null;
  global.document.body.getAttribute = () => null;
  WallpaperManager.settings.dim = 70;
  WallpaperManager.applyStyles();

  assert.equal(docProps['--wallpaper-overlay-dim'], 'rgba(13, 17, 23, 0.70)');
  assert.equal(bodyProps['--wallpaper-overlay-dim'], 'rgba(13, 17, 23, 0.70)');
  assert.equal(overlayStyle.backgroundColor, 'rgba(13, 17, 23, 0.70)');
});
