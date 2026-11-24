const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('About Screen: in-app modal and controls exist in index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  // Trigger buttons
  assert.ok(html.includes('id="btn-open-about"'), 'Must have btn-open-about in header');
  assert.ok(html.includes('id="brand-about-trigger"'), 'Must have brand-about-trigger on logo/brand badge');

  // Modal element and contents
  assert.ok(html.includes('id="modal-about"'), 'Must have modal-about container');
  assert.ok(html.includes('id="about-modal-title"'), 'Must have about-modal-title');
  assert.ok(html.includes('id="btn-close-about-x"'), 'Must have btn-close-about-x button');
  assert.ok(html.includes('id="btn-close-about"'), 'Must have btn-close-about button');
  assert.ok(html.includes('id="btn-about-copy-diag"'), 'Must have btn-about-copy-diag button');

  // Trust disclosures
  assert.ok(html.includes('100% Local-First'), 'Must declare 100% Local-First');
  assert.ok(html.includes('Zero Telemetry'), 'Must declare Zero Telemetry');
  assert.ok(html.includes('Offline Native'), 'Must declare Offline Native');

  // Security check: no inline scripts or inline event handlers
  assert.equal(html.match(/<script(?![^>]*src=)[^>]*>/i), null);
  assert.equal(html.match(/\son[a-z]+=/i), null);
});

test('About Screen: contains zero emojis for professional deliberate presentation', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const aboutModalMatch = html.match(/<div id="modal-about"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert.ok(aboutModalMatch, 'About modal markup must be found');

  const aboutText = aboutModalMatch[0].replace(/<[^>]*>/g, '');
  // Regex detecting emojis
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  // Exclude allowed standard symbols like bullet (• / &bull; \u2022) if matched in \u2000-\u3300
  const matched = aboutText.match(emojiRegex) || [];
  const illegalEmojis = matched.filter(ch => ch !== '•' && ch !== '©' && ch !== '®');
  assert.equal(illegalEmojis.length, 0, `Found emojis in about text: ${JSON.stringify(illegalEmojis)}`);
});

test('About Screen: UI logic and event bindings in ui.js', () => {
  const uiJs = fs.readFileSync(path.join(__dirname, '../public/js/ui/ui.js'), 'utf8');
  assert.ok(uiJs.includes('openAboutModal()'), 'UI must define openAboutModal');
  assert.ok(uiJs.includes('closeAboutModal()'), 'UI must define closeAboutModal');
  assert.ok(uiJs.includes("'modal-about'"), 'modal-about must be in modalIds for overlay click dismissal');
  assert.ok(uiJs.includes("'open-about'"), 'handleGlobalShortcutAction must handle open-about');
  assert.ok(uiJs.includes('btn-about-copy-diag'), 'Must bind btn-about-copy-diag for system info');
});

test('About Screen: electron-main.js wires up About Miruform menu and setAboutPanelOptions', () => {
  const mainJs = fs.readFileSync(path.join(__dirname, '../electron-main.js'), 'utf8');
  assert.ok(mainJs.includes('About Miruform'), 'Must have About Miruform in menu');
  assert.ok(mainJs.includes('setAboutPanelOptions'), 'Must configure app.setAboutPanelOptions');
  assert.ok(mainJs.includes('PolyForm Shield License 1.0.0'), 'Must disclose license');
});
