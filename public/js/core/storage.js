// ==================== STORAGE (DISK-BACKED WITH LOCALSTORAGE MIGRATION) ====================
const Storage = {
  DECKS_KEY: 'artpractice_decks',
  CARDS_KEY: 'artpractice_cards',
  HISTORY_KEY: 'artpractice_history',
  WALLPAPER_SETTINGS_KEY: 'artpractice_wallpaper_settings',

  // In-memory state cache (loaded directly from userdata/srs_state.json on disk)
  _decks: null,
  _cards: null,
  _history: null,
  _wallpaperSettings: null,
  _syncTimeout: null,
  _isSyncing: false,
  _lastSyncedTime: null,
  _isDiskLoaded: false,
  _consecutiveFailures: 0,
  _unloadListenersBound: false,

  /**
   * Initializes storage on app boot.
   * Loads userdata/srs_state.json from disk via GET /api/sync.
   * If GET /api/sync fails at startup, show a blocking banner "Could not read your saved progress" with Retry;
   * do NOT fall back to localStorage for writing.
   */
  async init() {
    this._loadFromLocalStorage();

    try {
      const res = await fetch('/api/sync');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json && json.exists && json.data) {
        const d = json.data;
        this._decks = Array.isArray(d.decks) ? d.decks : [];
        this._cards = d.cards && typeof d.cards === 'object' ? d.cards : {};
        this._history = d.history && typeof d.history === 'object' ? d.history : {};
        this._wallpaperSettings = d.wallpaperSettings || this._wallpaperSettings;
        this._lastSyncedTime = json.lastSaved;
        this._isDiskLoaded = true;
        this._mirrorToLocalStorage();
      } else {
        // Disk state file does not exist yet (brand new install)
        this._decks = this._decks || [];
        this._cards = this._cards || {};
        this._history = this._history || {};
        this._isDiskLoaded = true;
      }

      this.hideBlockingBanner();
      this._bindUnloadListeners();
    } catch (err) {
      console.error('[Storage] Could not reach /api/sync on startup:', err.message);
      this._isDiskLoaded = false;
      this.showBlockingBanner(err.message, () => {
        return this.init().then(() => {
          if (typeof DeckManager !== 'undefined' && DeckManager.init) DeckManager.init();
          if (typeof CardManager !== 'undefined' && CardManager.init) CardManager.init();
          if (typeof ReviewHistory !== 'undefined' && ReviewHistory.init) ReviewHistory.init();
        }).catch(() => { });
      });
      // Do NOT fall back to localStorage for writing!
    }
  },

  _bindUnloadListeners() {
    if (this._unloadListenersBound) return;
    this._unloadListenersBound = true;

    // keepalive: true only inside the visibilitychange/beforeunload handlers
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.syncToDisk({ keepalive: true }).catch(() => { });
      }
    });
    window.addEventListener('beforeunload', () => {
      this.syncToDisk({ keepalive: true }).catch(() => { });
    });

    if (window.electronAPI && typeof window.electronAPI.onBeforeQuit === 'function') {
      window.electronAPI.onBeforeQuit(async () => {
        console.log('[Storage] Flushing state to disk before Electron quit...');
        try {
          await this.syncToDisk({ keepalive: true });
        } catch (e) {
          console.warn('[Storage] Flush on quit warning:', e.message);
        }
      });
    }
  },

  _loadFromLocalStorage() {
    try {
      const rawDecks = localStorage.getItem(this.DECKS_KEY);
      this._decks = rawDecks ? JSON.parse(rawDecks) : [];
    } catch (e) { this._decks = []; }

    try {
      const rawCards = localStorage.getItem(this.CARDS_KEY);
      this._cards = rawCards ? JSON.parse(rawCards) : {};
    } catch (e) { this._cards = {}; }

    try {
      const rawHistory = localStorage.getItem(this.HISTORY_KEY);
      this._history = rawHistory ? JSON.parse(rawHistory) : {};
    } catch (e) { this._history = {}; }

    try {
      const rawWall = localStorage.getItem(this.WALLPAPER_SETTINGS_KEY);
      this._wallpaperSettings = rawWall ? JSON.parse(rawWall) : { blur: 8, dim: 50, hasCustom: false };
    } catch (e) { this._wallpaperSettings = { blur: 8, dim: 50, hasCustom: false }; }
  },

  _mirrorToLocalStorage() {
    try {
      if (this._decks) localStorage.setItem(this.DECKS_KEY, JSON.stringify(this._decks));
    } catch (e) { }
    try {
      if (this._cards) localStorage.setItem(this.CARDS_KEY, JSON.stringify(this._cards));
    } catch (e) { }
    try {
      if (this._history) localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this._history));
    } catch (e) { }
    try {
      if (this._wallpaperSettings) localStorage.setItem(this.WALLPAPER_SETTINGS_KEY, JSON.stringify(this._wallpaperSettings));
    } catch (e) { }
  },

  getDecks() {
    if (this._decks === null) this._loadFromLocalStorage();
    return this._decks || [];
  },

  saveDecks(decks) {
    this._decks = decks;
    try {
      localStorage.setItem(this.DECKS_KEY, JSON.stringify(decks));
    } catch (e) {
      console.warn('[Storage] localStorage quota reached or unavailable; relying on disk sync.');
    }
    this.scheduleDiskSync();
  },

  getCards() {
    if (this._cards === null) this._loadFromLocalStorage();
    return this._cards || {};
  },

  saveCards(cards) {
    this._cards = cards;
    try {
      localStorage.setItem(this.CARDS_KEY, JSON.stringify(cards));
    } catch (e) {
      console.warn('[Storage] localStorage quota reached or unavailable; relying on disk sync.');
    }
    this.scheduleDiskSync();
  },

  getHistory() {
    if (this._history === null) this._loadFromLocalStorage();
    return this._history || {};
  },

  saveHistory(history) {
    this._history = history;
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[Storage] localStorage quota reached or unavailable; relying on disk sync.');
    }
    this.scheduleDiskSync();
  },

  getWallpaperSettings() {
    if (this._wallpaperSettings === null) this._loadFromLocalStorage();
    return this._wallpaperSettings || { blur: 8, dim: 50, hasCustom: false };
  },

  saveWallpaperSettings(settings) {
    this._wallpaperSettings = settings;
    try {
      localStorage.setItem(this.WALLPAPER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { }
    this.scheduleDiskSync();
  },

  /**
   * Debounced sync scheduler (batches frequent rating / tagging updates)
   */
  scheduleDiskSync(delayMs = 1500) {
    clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      this.syncToDisk(false).catch(() => { });
    }, delayMs);
  },

  /**
   * Writes the entire SRS database directly to userdata/srs_state.json on disk.
   * Can be awaited immediately after every practice session!
   * - Refuses to run until _isDiskLoaded is true, unless user has no data.
   * - keepalive: true only inside visibilitychange/beforeunload handlers. Normal syncs use plain fetch.
   * - Stop swallowing sync errors: after 3 consecutive failures show a persistent warning chip.
   */
  async syncToDisk(options = false) {
    const isOpts = typeof options === 'object' && options !== null;
    const showToastNotice = isOpts ? Boolean(options.showToast) : Boolean(options);
    const keepalive = isOpts ? Boolean(options.keepalive) : false;
    const confirmReplace = isOpts ? Boolean(options.confirmReplace) : false;

    // Refuse to run until _isDiskLoaded is true, unless user has no data
    const hasData = (this._decks && this._decks.length > 0) || (this._cards && Object.keys(this._cards).length > 0);
    if (!this._isDiskLoaded && hasData) {
      console.warn('[Storage] Refusing syncToDisk: disk state has not finished loading yet.');
      return;
    }

    clearTimeout(this._syncTimeout);
    const payload = {
      decks: this._decks || this.getDecks(),
      cards: this._cards || this.getCards(),
      history: this._history || this.getHistory(),
      wallpaperSettings: this._wallpaperSettings || this.getWallpaperSettings(),
      clientTimestamp: new Date().toISOString()
    };

    if (confirmReplace || this._confirmReplaceNextSync) {
      payload.confirmReplace = true;
      this._confirmReplaceNextSync = false;
    }

    try {
      this._isSyncing = true;
      const fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      };
      if (keepalive) {
        fetchOpts.keepalive = true;
      }

      const res = await fetch('/api/sync', fetchOpts);

      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.error || 'Conflict: Overwrite requires confirmation.';
        console.error('[Storage] Sync conflict (409):', errMsg);

        // Visible error on any 409, never a silent failure
        if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
          UI.showToast(`Sync rejected (409): ${errMsg}`, 'alert');
        }
        this.showSyncWarningChip(errMsg);

        const error = new Error(errMsg);
        error.status = 409;
        throw error;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      this._lastSyncedTime = result.lastSaved;
      this._isDiskLoaded = true;
      this._consecutiveFailures = 0;
      this.hideSyncWarningChip();

      if (showToastNotice && typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Session synced to disk (userdata/srs_state.json)', 'save');
      }

      return result;
    } catch (err) {
      this._consecutiveFailures = (this._consecutiveFailures || 0) + 1;
      console.error(`[Storage] Error syncing to disk (failure ${this._consecutiveFailures}):`, err);

      if (this._consecutiveFailures >= 3 || err.status === 409) {
        this.showSyncWarningChip(err.status === 409 ? err.message : undefined);
      }

      if ((showToastNotice || err.status === 409) && typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(`Disk sync issue: ${err.message}`, 'alert');
      }
      throw err;
    } finally {
      this._isSyncing = false;
    }
  },

  async syncToServer(options = false) {
    return this.syncToDisk(options);
  },

  _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  showBlockingBanner(message, onRetry) {
    if (typeof document === 'undefined') return;
    let banner = document.getElementById('storage-blocking-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'storage-blocking-banner';
      banner.className = 'storage-blocking-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(18,18,18,0.94);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;color:#fff;padding:24px;text-align:center;';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <div style="background:#222;border:1px solid #444;border-radius:10px;padding:32px 36px;max-width:480px;box-shadow:0 16px 40px rgba(0,0,0,0.6);">
        <div style="display:flex;justify-content:center;margin-bottom:12px;color:var(--accent,#d97706);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <h2 style="font-size:18px;margin:0 0 10px 0;font-weight:600;">Could not read your saved progress</h2>
        <p style="color:#aaa;font-size:14px;margin:0 0 24px 0;line-height:1.5;">${this._esc(message) || 'The server could not read userdata/srs_state.json.'}</p>
        <button id="btn-storage-retry" class="btn btn-primary" style="padding:10px 28px;font-size:14px;cursor:pointer;border-radius:6px;">Retry</button>
      </div>
    `;
    banner.style.display = 'flex';
    const retryBtn = document.getElementById('btn-storage-retry');
    if (retryBtn) {
      const handler = () => {
        if (typeof onRetry === 'function') return onRetry();
      };
      retryBtn.onclick = handler;
      retryBtn.addEventListener('click', handler);
    }
  },

  hideBlockingBanner() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('storage-blocking-banner');
    if (banner) {
      banner.style.display = 'none';
      banner.remove();
    }
  },

  showSyncWarningChip(customText) {
    if (typeof document === 'undefined') return;
    let chip = document.getElementById('sync-warning-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'sync-warning-chip';
      chip.className = 'sync-warning-chip';
      chip.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#ef4444;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;gap:8px;cursor:pointer;';
      chip.title = 'Disk synchronization failed. Click to retry syncing immediately.';
      chip.addEventListener('click', () => {
        this.syncToDisk(true).catch(() => { });
      });
      document.body.appendChild(chip);
    }
    chip.innerHTML = `<span><svg style="vertical-align:-2px;margin-right:6px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${this._esc(customText) || 'Sync failing (click to retry)'}</span>`;
    chip.style.display = 'flex';
  },

  hideSyncWarningChip() {
    if (typeof document === 'undefined') return;
    const chip = document.getElementById('sync-warning-chip');
    if (chip) {
      chip.style.display = 'none';
      chip.remove();
    }
  }
};

// ==================== WALLPAPER MANAGER (IndexedDB) ====================
// Uses IndexedDB for large custom wallpaper images so users can set 4K/high-res images without 5MB localStorage limits
const WallpaperManager = {
  db: null,
  currentWallpaperDataUrl: null,
  settings: { blur: 8, dim: 50, hasCustom: false },

  async init() {
    this.settings = Storage.getWallpaperSettings();
    await this._initDB();
    await this.loadSavedWallpaper();
    this.applyStyles();
  },

  _initDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('ArtPracticeWallpaperDB', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('wallpapers')) {
            db.createObjectStore('wallpapers');
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => {
          console.warn('IndexedDB unavailable for wallpapers, fallback to session');
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  },

  async loadSavedWallpaper() {
    if (!this.settings.hasCustom) return;

    // Check fast localStorage cache first for zero-flicker immediate render
    try {
      const cached = localStorage.getItem('artpractice_wallpaper_data');
      if (cached) {
        this.currentWallpaperDataUrl = cached;
        this.applyStyles();
      }
    } catch (e) { }

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['wallpapers'], 'readonly');
        const store = tx.objectStore('wallpapers');
        const req = store.get('user_wallpaper');
        req.onsuccess = () => {
          if (req.result) {
            this.currentWallpaperDataUrl = req.result;
            this.applyStyles();
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },

  async setCustomWallpaper(dataUrl) {
    this.currentWallpaperDataUrl = dataUrl;
    this.settings.hasCustom = true;
    Storage.saveWallpaperSettings(this.settings);

    // Save to localStorage cache if under 2.5MB
    try {
      if (dataUrl.length < 2500000) {
        localStorage.setItem('artpractice_wallpaper_data', dataUrl);
      } else {
        localStorage.removeItem('artpractice_wallpaper_data');
      }
    } catch (e) { }

    if (this.db) {
      try {
        const tx = this.db.transaction(['wallpapers'], 'readwrite');
        const store = tx.objectStore('wallpapers');
        store.put(dataUrl, 'user_wallpaper');
      } catch (e) {
        console.error('Error storing wallpaper in IndexedDB', e);
      }
    }

    this.applyStyles();
    UI.updateWallpaperModalUI();
    UI.showToast('Custom wallpaper applied', 'palette');
  },

  async removeWallpaper() {
    this.currentWallpaperDataUrl = null;
    this.settings.hasCustom = false;
    Storage.saveWallpaperSettings(this.settings);
    try {
      localStorage.removeItem('artpractice_wallpaper_data');
    } catch (e) { }

    if (this.db) {
      try {
        const tx = this.db.transaction(['wallpapers'], 'readwrite');
        const store = tx.objectStore('wallpapers');
        store.delete('user_wallpaper');
      } catch (e) {
        console.error('Error removing wallpaper from IndexedDB', e);
      }
    }

    this.applyStyles();
    UI.updateWallpaperModalUI();
    UI.showToast('Wallpaper reset to default', 'broom');
  },

  setBlur(val) {
    this.settings.blur = parseInt(val, 10) || 0;
    Storage.saveWallpaperSettings(this.settings);
    this.applyStyles();
  },

  setDim(val) {
    this.settings.dim = parseInt(val, 10) || 50;
    Storage.saveWallpaperSettings(this.settings);
    this.applyStyles();
  },

  applyStyles() {
    const bgEl = document.getElementById('wallpaper-bg');
    const overlayEl = document.getElementById('wallpaper-overlay');
    if (!bgEl || !overlayEl) return;

    const hasCustom = Boolean(this.currentWallpaperDataUrl && this.settings.hasCustom);
    document.body.classList.toggle('has-wallpaper', hasCustom);

    if (hasCustom) {
      bgEl.style.backgroundImage = `url("${this.currentWallpaperDataUrl.replace(/"/g, '\\"')}")`;
      bgEl.style.opacity = '1';
      overlayEl.style.opacity = '1';
    } else {
      bgEl.style.backgroundImage = 'none';
      bgEl.style.opacity = '0';
      overlayEl.style.opacity = '0';
    }

    document.documentElement.style.setProperty('--wallpaper-blur', `${this.settings.blur}px`);
    const dimAlpha = (this.settings.dim / 100).toFixed(2);
    document.documentElement.style.setProperty('--wallpaper-overlay-dim', `rgba(13, 17, 23, ${dimAlpha})`);
  }
};

if (typeof window !== 'undefined') {
  window.Storage = Storage;
  window.WallpaperManager = WallpaperManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Storage = Storage;
  globalThis.WallpaperManager = WallpaperManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Storage,
    WallpaperManager
  };
}
