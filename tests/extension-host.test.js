const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const vm = require('vm');

const {
  app,
  startServer,
  loadExtensions,
  loadedExtensions,
  extensionAllowedFolders,
  isPathAllowedInRegisteredDecks,
  clearLoadedExtensions
} = require('../server.js');

const {
  loadMainExtensions,
  loadedMainExtensions,
  extensionMenuItems,
  clearLoadedMainExtensions,
  setMainWindow,
  setServerPort
} = require('../electron-main.js');

const { loadFrontendCode } = require('./helpers/load-frontend.js');
const appJsCode = loadFrontendCode();
const styleCssCode = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
const indexHtmlCode = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

// Minimal 1x1 transparent PNG buffer for testing image serving
const TINY_PNG_BUFFER = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d450000000049454e44ae426082', 'hex');

function makeRequest(port, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path || '/api/extensions',
      method: options.method || 'GET',
      headers: { ...options.headers }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function setupTestDOM() {
  const elements = new Map();

  function makeElement(id, tagName = 'div') {
    const classList = new Set();
    const listeners = {};
    const attributes = {};
    const children = [];
    let textContent = '';
    let innerHTML = '';

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      dataset: {},
      style: {},
      value: '',
      title: '',
      type: 'button',
      get className() { return Array.from(classList).join(' '); },
      set className(v) {
        classList.clear();
        (v || '').split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
      },
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
      click() {
        if (listeners['click']) {
          listeners['click'].forEach(fn => fn({ type: 'click', target: el }));
        }
      },
      querySelector(sel) {
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        if (sel.startsWith('.')) {
          const cls = sel.slice(1);
          return children.find(ch => ch.classList && ch.classList.contains(cls)) || null;
        }
        return null;
      },
      querySelectorAll() { return []; },
      appendChild(child) {
        children.push(child);
        child.parentNode = el;
        return child;
      },
      removeChild(child) {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        child.parentNode = null;
        return child;
      }
    };
    elements.set(id, el);
    return el;
  }

  // Pre-seed layout elements
  makeElement('dock-tools-container');
  makeElement('image-stage');
  makeElement('image-frame');
  makeElement('session-image-container');
  makeElement('view-session');

  const headEl = makeElement('head', 'head');
  const bodyEl = makeElement('body', 'body');

  const mockDocument = {
    activeElement: null,
    head: headEl,
    body: bodyEl,
    getElementById(id) { return elements.get(id) || null; },
    querySelector(sel) {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const el of elements.values()) {
          if (el.classList && el.classList.contains(cls)) return el;
        }
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const matches = [];
        for (const el of elements.values()) {
          if (el.classList && el.classList.contains(cls)) matches.push(el);
        }
        return matches;
      }
      return [];
    },
    createElement(tag) {
      const generatedId = 'gen_' + Math.random().toString(36).slice(2, 8);
      return makeElement(generatedId, tag);
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const mockWindow = {
    document: mockDocument,
    location: { search: '' },
    navigator: { userAgent: 'test-agent' },
    localStorage: {
      _data: new Map(),
      getItem(k) { return this._data.get(k) || null; },
      setItem(k, v) { this._data.set(k, String(v)); },
      removeItem(k) { this._data.delete(k); }
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const context = {
    window: mockWindow,
    document: mockDocument,
    localStorage: mockWindow.localStorage,
    navigator: { userAgent: 'test-agent' },
    location: { search: '' },
    console,
    setTimeout,
    clearTimeout,
    Date: global.Date
  };

  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  return { context, elements, mockDocument, mockWindow };
}

test('Extension Host Test Suite', async (t) => {
  let serverInstance = null;
  let testPort = null;
  let tempUserDir = null;
  let extensionsDir = null;

  t.before(async () => {
    tempUserDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artpractice-user-test-'));
    extensionsDir = path.join(tempUserDir, 'extensions');

    // Notice: we do NOT create the 'extensions' folder yet so we can test requirement 1
    const started = await startServer(0);
    serverInstance = started.server;
    testPort = started.port;
    setServerPort(testPort);
  });

  t.after(() => {
    if (serverInstance && serverInstance.close) {
      serverInstance.close();
    }
    clearLoadedExtensions();
    clearLoadedMainExtensions();
    try {
      if (tempUserDir) fs.rmSync(tempUserDir, { recursive: true, force: true });
    } catch (e) { }
  });

  // =========================================================================
  // REQUIREMENT 1
  // =========================================================================
  await t.test('1. Core boots cleanly and GET /api/extensions returns [] when no extensions folder exists', async () => {
    clearLoadedExtensions();
    clearLoadedMainExtensions();

    // Verify extensions folder does not exist
    const nonExistentExtPath = path.join(tempUserDir, 'extensions');
    assert.equal(fs.existsSync(nonExistentExtPath), false, 'Extensions folder does not exist yet');

    // Load with searchDir pointing to the missing folder
    assert.doesNotThrow(() => {
      loadExtensions({ searchDirs: [nonExistentExtPath] });
    });

    // Request GET /api/extensions
    const res = await makeRequest(testPort, {
      path: '/api/extensions',
      headers: { host: `127.0.0.1:${testPort}` }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), [], 'GET /api/extensions returns empty array []');
  });

  // =========================================================================
  // REQUIREMENT 2
  // =========================================================================
  await t.test('2. Valid test extension fixture in temporary USERDATA_DIR/extensions/test-addon mounts route & serves client.js', async () => {
    clearLoadedExtensions();

    extensionsDir = path.join(tempUserDir, 'extensions');
    const testAddonDir = path.join(extensionsDir, 'test-addon');
    fs.mkdirSync(testAddonDir, { recursive: true });

    // Write manifest.json
    const manifest = {
      id: 'test-addon',
      name: 'Test Addon Extension',
      version: '1.0.0',
      serverEntry: 'server.js',
      clientEntry: 'client.js'
    };
    fs.writeFileSync(path.join(testAddonDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Write server.js (mounts /ping)
    const serverScript = `
      module.exports = {
        registerFeature: (api) => {
          api.registerRoute('GET', '/ping', (req, res) => {
            res.json({ pong: true, extension: 'test-addon' });
          });
        }
      };
    `;
    fs.writeFileSync(path.join(testAddonDir, 'server.js'), serverScript);

    // Write client.js
    const clientScript = `/* test-addon client script */\nwindow.__testAddonLoaded = true;`;
    fs.writeFileSync(path.join(testAddonDir, 'client.js'), clientScript);

    // Discover extensions
    loadExtensions({ searchDirs: [extensionsDir] });

    // A. Verify GET /api/extensions returns the loaded extension metadata
    const resMeta = await makeRequest(testPort, {
      path: '/api/extensions',
      headers: { host: `127.0.0.1:${testPort}` }
    });
    assert.equal(resMeta.statusCode, 200);
    const metaList = JSON.parse(resMeta.body);
    const item = metaList.find(e => e.id === 'test-addon');
    assert.ok(item, 'test-addon is returned in /api/extensions');
    assert.equal(item.name, 'Test Addon Extension');
    assert.equal(item.version, '1.0.0');
    assert.equal(item.hasClient, true);

    // B. Verify GET /api/ext/test-addon/ping returns mounted route response
    const resPing = await makeRequest(testPort, {
      path: '/api/ext/test-addon/ping',
      headers: { host: `127.0.0.1:${testPort}` }
    });
    assert.equal(resPing.statusCode, 200);
    const pingData = JSON.parse(resPing.body);
    assert.deepEqual(pingData, { pong: true, extension: 'test-addon' });

    // C. Verify GET /api/ext/test-addon/client.js serves JS file with required headers
    const resClient = await makeRequest(testPort, {
      path: '/api/ext/test-addon/client.js',
      headers: { host: `127.0.0.1:${testPort}` }
    });
    assert.equal(resClient.statusCode, 200);
    assert.ok(
      resClient.headers['content-type'].includes('application/javascript'),
      `Content-Type must be application/javascript, got ${resClient.headers['content-type']}`
    );
    assert.equal(resClient.headers['x-content-type-options'], 'nosniff');
    assert.equal(resClient.headers['cache-control'], 'no-store');
    assert.equal(resClient.body.trim(), clientScript.trim());
  });

  // =========================================================================
  // REQUIREMENT 3
  // =========================================================================
  await t.test('3. Malformed manifest.json, invalid IDs, and throwing registerFeature are isolated without crashing', async () => {
    // A. Path traversal / invalid extension ID
    const badIdDir = path.join(extensionsDir, 'bad-id-addon');
    fs.mkdirSync(badIdDir, { recursive: true });
    fs.writeFileSync(path.join(badIdDir, 'manifest.json'), JSON.stringify({
      id: '../evil',
      name: 'Evil Path Traversal',
      version: '1.0.0'
    }));

    // B. Malformed JSON manifest
    const malformedDir = path.join(extensionsDir, 'malformed-json');
    fs.mkdirSync(malformedDir, { recursive: true });
    fs.writeFileSync(path.join(malformedDir, 'manifest.json'), '{ broken: json [');

    // C. Extension whose registerFeature() throws an unhandled error
    const throwDir = path.join(extensionsDir, 'throw-addon');
    fs.mkdirSync(throwDir, { recursive: true });
    fs.writeFileSync(path.join(throwDir, 'manifest.json'), JSON.stringify({
      id: 'throw-addon',
      name: 'Throwing Addon',
      version: '1.0.0',
      serverEntry: 'server.js'
    }));
    fs.writeFileSync(path.join(throwDir, 'server.js'), `
      module.exports = {
        registerFeature: () => {
          throw new Error('Fatal explosion inside extension registerFeature');
        }
      };
    `);

    // D. Safe, working extension alongside broken ones
    const safeDir = path.join(extensionsDir, 'safe-addon');
    fs.mkdirSync(safeDir, { recursive: true });
    fs.writeFileSync(path.join(safeDir, 'manifest.json'), JSON.stringify({
      id: 'safe-addon',
      name: 'Safe Addon',
      version: '1.0.0',
      serverEntry: 'server.js'
    }));
    fs.writeFileSync(path.join(safeDir, 'server.js'), `
      module.exports = {
        registerFeature: (api) => {
          api.registerRoute('GET', '/status', (req, res) => res.json({ safe: true }));
        }
      };
    `);

    // Loading extensions must NOT throw and must isolate each failure
    assert.doesNotThrow(() => {
      loadExtensions({ searchDirs: [extensionsDir] });
    });

    assert.equal(loadedExtensions.has('../evil'), false, '../evil was rejected');
    assert.equal(loadedExtensions.has('malformed-json'), false, 'malformed-json was rejected');
    assert.equal(loadedExtensions.has('throw-addon'), false, 'throw-addon was skipped after throwing');
    assert.equal(loadedExtensions.has('safe-addon'), true, 'safe-addon was loaded despite adjacent errors');

    // Verify safe-addon route responds cleanly
    const resSafe = await makeRequest(testPort, {
      path: '/api/ext/safe-addon/status',
      headers: { host: `127.0.0.1:${testPort}` }
    });
    assert.equal(resSafe.statusCode, 200);
    assert.deepEqual(JSON.parse(resSafe.body), { safe: true });
  });

  // =========================================================================
  // REQUIREMENT 4
  // =========================================================================
  await t.test('4. /api/ext/* endpoints enforce the Origin Gate (rejecting spoofed Host and Sec-Fetch-Site: cross-site with 403)', async () => {
    // A. Spoofed Host header -> 403
    const resSpoofedHost = await makeRequest(testPort, {
      path: '/api/ext/test-addon/ping',
      headers: { host: 'evil-attacker.com' }
    });
    assert.equal(resSpoofedHost.statusCode, 403, 'Rejected spoofed Host header with 403');
    const errHost = JSON.parse(resSpoofedHost.body);
    assert.equal(errHost.error, 'Forbidden: invalid Host header');

    // B. Sec-Fetch-Site: cross-site -> 403
    const resCrossSite = await makeRequest(testPort, {
      path: '/api/ext/test-addon/ping',
      headers: {
        host: `127.0.0.1:${testPort}`,
        'sec-fetch-site': 'cross-site'
      }
    });
    assert.equal(resCrossSite.statusCode, 403, 'Rejected Sec-Fetch-Site: cross-site with 403');
    const errCross = JSON.parse(resCrossSite.body);
    assert.equal(errCross.error, 'Forbidden: cross-site request rejected');

    // C. Null origin header -> 403
    const resNullOrigin = await makeRequest(testPort, {
      path: '/api/ext/test-addon/ping',
      headers: {
        host: `127.0.0.1:${testPort}`,
        origin: 'null'
      }
    });
    assert.equal(resNullOrigin.statusCode, 403, 'Rejected null origin with 403');

    // D. Valid trusted local origin & host -> 200
    const resValid = await makeRequest(testPort, {
      path: '/api/ext/test-addon/ping',
      headers: {
        host: `127.0.0.1:${testPort}`,
        origin: `http://127.0.0.1:${testPort}`,
        'sec-fetch-site': 'same-origin'
      }
    });
    assert.equal(resValid.statusCode, 200, 'Valid same-origin request succeeded');
  });

  // =========================================================================
  // REQUIREMENT 5
  // =========================================================================
  await t.test('5. registerAllowedFolder() grants read-only /api/image access strictly to registered directory while blocking unrelated paths with 403', async () => {
    process.env.APP_RUNTIME = 'electron';

    // Create an extension assets directory with a test image
    const folderAddonDir = path.join(extensionsDir, 'folder-addon');
    fs.mkdirSync(folderAddonDir, { recursive: true });
    const assetsDir = path.join(folderAddonDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const extImagePath = path.join(assetsDir, 'model-thumb.png');
    fs.writeFileSync(extImagePath, TINY_PNG_BUFFER);

    // Create an unrelated forbidden folder OUTSIDE userdata with an image
    const forbiddenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forbidden-outside-'));
    const forbiddenImagePath = path.join(forbiddenDir, 'secret.png');
    fs.writeFileSync(forbiddenImagePath, TINY_PNG_BUFFER);

    try {
      // Manifest for folder-addon
      fs.writeFileSync(path.join(folderAddonDir, 'manifest.json'), JSON.stringify({
        id: 'folder-addon',
        name: 'Folder Addon',
        version: '1.0.0',
        serverEntry: 'server.js'
      }));

      // Server script that calls registerAllowedFolder
      const serverScriptWithFolder = `
        const path = require('path');
        module.exports = {
          registerFeature: (api) => {
            api.registerAllowedFolder(path.join(__dirname, 'assets'));
          }
        };
      `;
      fs.writeFileSync(path.join(folderAddonDir, 'server.js'), serverScriptWithFolder);
      loadExtensions({ searchDirs: [extensionsDir] });

      // Verify folder was added to extensionAllowedFolders Set
      const realAssetsDir = fs.realpathSync(assetsDir);
      assert.equal(extensionAllowedFolders.has(realAssetsDir), true);
      assert.equal(isPathAllowedInRegisteredDecks(extImagePath), true);
      assert.equal(isPathAllowedInRegisteredDecks(forbiddenImagePath), false);

      // A. Request to registered extension asset via /api/image?path= -> 200
      const resAllowedImage = await makeRequest(testPort, {
        path: `/api/image?path=${encodeURIComponent(extImagePath)}`,
        headers: { host: `127.0.0.1:${testPort}` }
      });
      assert.equal(resAllowedImage.statusCode, 200, 'Allowed extension folder serves 200');
      assert.ok(resAllowedImage.headers['content-type'].includes('image/png'));

      // B. Request to outside forbidden path via /api/image?path= -> 403
      const resForbiddenImage = await makeRequest(testPort, {
        path: `/api/image?path=${encodeURIComponent(forbiddenImagePath)}`,
        headers: { host: `127.0.0.1:${testPort}` }
      });
      assert.equal(resForbiddenImage.statusCode, 403, 'Unregistered outside directory returns 403');
      const errData = JSON.parse(resForbiddenImage.body);
      assert.ok(errData.error.includes('Access denied') || errData.error.includes('not permitted'));
    } finally {
      delete process.env.APP_RUNTIME;
      try { fs.rmSync(forbiddenDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  // =========================================================================
  // REQUIREMENT 6
  // =========================================================================
  await t.test('6. Verify public/index.html retains zero inline <script> tags or on*= attributes', () => {
    // A. Check for any inline <script> blocks (excluding external <script src="...">)
    const inlineScriptMatch = indexHtmlCode.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
    assert.equal(inlineScriptMatch, null, `index.html must not contain inline <script> tags; found: ${inlineScriptMatch}`);

    // B. Check for any inline event handler attributes (e.g. onclick=, onload=, onerror=)
    const inlineHandlerMatch = indexHtmlCode.match(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi);
    assert.equal(inlineHandlerMatch, null, `index.html must not contain inline event handlers; found: ${inlineHandlerMatch}`);
  });

  // =========================================================================
  // BONUS: Comprehensive Frontend & Electron Main Extension Host Verification
  // =========================================================================
  await t.test('7. Frontend StudioExtensions registry & scoped API contracts', () => {
    const { context, mockDocument } = setupTestDOM();
    const { StudioExtensions, UI, FlashRecallManager, DeckManager } = context.window;

    // A. StudioExtensions is frozen
    assert.ok(Object.isFrozen(StudioExtensions), 'StudioExtensions is frozen');

    // B. Scoped API methods
    let scopedApi = null;
    StudioExtensions.registerFeature((api) => {
      scopedApi = api;
    });
    assert.ok(scopedApi, 'registerFeature invoked with api');
    assert.equal(typeof scopedApi.registerToolbarAction, 'function');
    assert.equal(typeof scopedApi.registerPanel, 'function');
    assert.equal(typeof scopedApi.registerStageMode, 'function');
    assert.equal(typeof scopedApi.registerShortcut, 'function');
    assert.equal(typeof scopedApi.esc, 'function');
    assert.equal(typeof scopedApi.getActiveDeck, 'function');

    // C. Toolbar action creation
    let actionClicked = false;
    scopedApi.registerToolbarAction({
      id: 'test-action',
      label: '<script>3D Gizmo',
      onClick: () => { actionClicked = true; }
    });
    const btn = mockDocument.querySelector('.ext-toolbar-action');
    assert.ok(btn, 'Toolbar button created');
    assert.ok(btn.innerHTML.includes('&lt;script&gt;3D Gizmo'), 'Escapes label with UI._esc');
    btn.click();
    assert.equal(actionClicked, true, 'onClick fired');

    // D. Shortcut dispatch & veil guard
    let shortcutFired = false;
    scopedApi.registerShortcut({
      key: 'k',
      ctrlOrCmd: true,
      handler: () => { shortcutFired = true; }
    });

    // Guard: active BLIND_DRAW veil blocks shortcut
    FlashRecallManager.phase = 'draw';
    UI.handleKeyboard({ key: 'k', metaKey: true, preventDefault() {}, stopPropagation() {} });
    assert.equal(shortcutFired, false, 'Blocked during blind draw veil');

    // Idle phase fires shortcut
    FlashRecallManager.phase = 'idle';
    UI.handleKeyboard({ key: 'k', metaKey: true, preventDefault() {}, stopPropagation() {} });
    assert.equal(shortcutFired, true, 'Fired when idle');

    // E. 0.0% idle GPU CSS check
    assert.ok(styleCssCode.includes('.ext-toolbar-slot'));
    assert.ok(styleCssCode.includes('.ext-panel-host'));
    assert.ok(styleCssCode.includes('.ext-stage-host'));
    const extCssSection = styleCssCode.slice(styleCssCode.indexOf('Extension Host Styling'));
    assert.equal(extCssSection.includes('@keyframes'), false, 'Zero continuous keyframes');
  });

  await t.test('8. Electron Main loadMainExtensions prefixes IPC and isolates child windows', async () => {
    clearLoadedMainExtensions();
    const mockMainWindow = { isDestroyed: () => false };
    const mockChildWindow = { isDestroyed: () => false };
    setMainWindow(mockMainWindow);

    const mainExtDir = path.join(extensionsDir, 'main-ext');
    fs.mkdirSync(mainExtDir, { recursive: true });
    fs.writeFileSync(path.join(mainExtDir, 'manifest.json'), JSON.stringify({
      id: 'main-ext',
      name: 'Main Ext',
      version: '1.0.0',
      mainEntry: 'main.js'
    }));
    fs.writeFileSync(path.join(mainExtDir, 'main.js'), `
      module.exports = {
        registerMainFeature: (api) => {
          api.registerIpc('ping', async (event, data) => ({ pong: true, data }));
          api.addMenuTemplate([{ id: 'menu-ext', label: 'Extension Tool' }]);
        }
      };
    `);

    const handlers = new Map();
    const mockIpcMain = { handle: (ch, fn) => handlers.set(ch, fn) };
    let currentSenderWin = mockMainWindow;
    const mockBrowserWindow = { fromWebContents: () => currentSenderWin };

    loadMainExtensions({
      searchDirs: [extensionsDir],
      ipcMain: mockIpcMain,
      mainWindow: mockMainWindow,
      serverPort: testPort,
      BrowserWindow: mockBrowserWindow
    });

    assert.equal(extensionMenuItems.length, 1, 'Add-ons menu item registered');
    assert.ok(handlers.has('ext:main-ext:ping'), 'IPC registered with prefix ext:main-ext:ping');

    const handler = handlers.get('ext:main-ext:ping');

    // Untrusted sender rejected
    const resUntrusted = await handler({ senderFrame: { url: 'http://malicious.com' }, sender: {} });
    assert.deepEqual(resUntrusted, { error: 'Unauthorized IPC sender' });

    // Child window rejected
    currentSenderWin = mockChildWindow;
    const resChild = await handler({ senderFrame: { url: `http://127.0.0.1:${testPort}` }, sender: {} });
    assert.deepEqual(resChild, { error: 'Unauthorized: main window only' });

    // Primary main window accepted
    currentSenderWin = mockMainWindow;
    const resAllowed = await handler({ senderFrame: { url: `http://127.0.0.1:${testPort}` }, sender: {} }, { val: 42 });
    assert.deepEqual(resAllowed, { pong: true, data: { val: 42 } });

    clearLoadedMainExtensions();
    setMainWindow(null);
  });
});
