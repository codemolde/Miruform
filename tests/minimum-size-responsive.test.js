const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtmlPath = path.join(__dirname, '../public/index.html');
const styleCssPath = path.join(__dirname, '../public/style.css');
const soundJsPath = path.join(__dirname, '../public/js/core/sound.js');

const html = fs.readFileSync(indexHtmlPath, 'utf8');
const css = fs.readFileSync(styleCssPath, 'utf8');
const soundJs = fs.readFileSync(soundJsPath, 'utf8');

test('Problem 1: Tagline clipping fix', () => {
  // Tagline text exists in HTML
  assert.ok(html.includes('class="brand-tagline"'), 'index.html contains brand-tagline element');
  assert.ok(html.includes('Visual Library & Drawing Practice'), 'index.html contains Drawing Practice tagline');

  // CSS has ellipsis and nowrap
  assert.match(css, /\.brand-tagline\s*\{[^}]*white-space:\s*nowrap/s, 'brand-tagline has white-space: nowrap');
  assert.match(css, /\.brand-tagline\s*\{[^}]*overflow:\s*hidden/s, 'brand-tagline has overflow: hidden');
  assert.match(css, /\.brand-tagline\s*\{[^}]*text-overflow:\s*ellipsis/s, 'brand-tagline has text-overflow: ellipsis');

  // Below breakpoint, tagline is hidden so brand shows "Miruform" plus icon
  assert.match(css, /@media\s*\(\s*max-width:\s*680px\s*\)\s*\{[^}]*\.brand-tagline\s*\{[^}]*display:\s*none\s*!important/s,
    'brand-tagline is hidden at max-width: 680px breakpoint');
});

test('Problem 2: Top toolbar overflow fix & collapse into icon-only buttons with tooltips', () => {
  // Toolbar buttons have tooltips via title attributes
  assert.ok(html.includes('id="btn-toggle-sound"') && html.includes('title="Tactile Sound FX'), 'Sound button has title tooltip');
  assert.ok(html.includes('id="btn-toggle-theme"') && html.includes('title="Switch to Light Theme"'), 'Theme button has title tooltip');
  assert.ok(html.includes('id="btn-open-wallpaper"') && html.includes('title="Customize Background Wallpaper"'), 'Wallpaper button has title tooltip');
  assert.ok(html.includes('id="btn-open-backup"') && html.includes('title="Backup or Restore Data"'), 'Backup button has title tooltip');
  assert.ok(html.includes('id="btn-open-shortcuts"') && html.includes('title="View Keyboard Shortcuts (?)"'), 'Shortcuts button has title tooltip');
  assert.ok(html.includes('id="btn-starter-decks"') && html.includes('title="Explore Curated Starter Decks'), 'Starter decks button has title tooltip');
  assert.ok(html.includes('id="btn-new-deck"') && html.includes('title="Create New Deck"'), 'New deck button has title tooltip');

  // Text labels are wrapped in .btn-label spans
  assert.match(html, /id="btn-open-wallpaper"[^>]*>.*?<span class="btn-label">Wallpaper<\/span>/s, 'Wallpaper label wrapped in .btn-label');
  assert.match(html, /id="btn-open-backup"[^>]*>.*?<span class="btn-label">Data<\/span>/s, 'Backup label wrapped in .btn-label');
  assert.match(html, /id="btn-open-shortcuts"[^>]*>.*?<span class="btn-label">Hotkeys.*?<\/span>/s, 'Shortcuts label wrapped in .btn-label');

  // SoundFX.updateUI sets dynamic tooltip
  assert.ok(soundJs.includes("btn1.title = this.enabled ? 'Sound FX: On (Click to mute)' : 'Sound FX: Muted (Click to unmute)'"),
    'SoundFX.updateUI dynamically updates sound tooltip');

  // CSS collapses buttons into icon-only at small widths (max-width: 600px)
  assert.match(css, /\.header-tools\s*\.btn\s*,\s*\.deck-header-actions\s*\.btn\s*,\s*#btn-starter-decks\s*\{[^}]*width:\s*28px/s,
    'Header buttons collapse to 28px width at small widths');
  assert.match(css, /\.header-tools\s*\.btn\s*\.btn-label\s*,\s*\.header-tools\s*\.btn\s*#sound-text\s*,\s*\.header-tools\s*\.btn\s*#theme-text.*?display:\s*none\s*!important/s,
    'Button text labels are hidden at small widths');

  // At small widths, header-tools does NOT have width: 100% pushing items
  assert.ok(!css.includes('@media (max-width: 960px) {\n  .header-tools {\n    width: 100%;'),
    'header-tools width: 100% removed at max-width: 960px');
});

test('Problem 3: Search and sort controls wrap fix', () => {
  // Search placeholder is shortened
  assert.ok(html.includes('id="deck-search-input" placeholder="Search decks…"'),
    'deck-search-input placeholder is shortened to "Search decks…"');

  // Sort-box label has white-space: nowrap so "Sort by:" cannot break into two lines
  assert.match(css, /\.sort-box\s+label\s*\{[^}]*white-space:\s*nowrap/s,
    '.sort-box label has white-space: nowrap');

  // Small width layout stacks sort label above select and makes controls full width
  assert.match(css, /\.deck-filter-bar\s*\{[^}]*flex-direction:\s*column/s,
    'deck-filter-bar flex-direction: column at small widths');
  assert.match(css, /\.sort-box\s*\{[^}]*flex-direction:\s*column;\s*align-items:\s*flex-start/s,
    'sort-box stacks label above select at small widths');
  assert.match(css, /\.sort-box\s*\.select-input\s*\{[^}]*width:\s*100%/s,
    'select-input fills full width when stacked');
  assert.match(css, /\.search-box\s*\{[^}]*width:\s*100%/s,
    'search-box fills full width at small widths');
});
