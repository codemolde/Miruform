// ==================== EXTENSION HOST SUBSYSTEM ====================
const ExtensionHost = {
  toolbarActions: new Map(),
  panels: new Map(),
  stageModes: new Map(),
  shortcuts: [],
  activeStageModeId: null,

  async loadClientExtensions() {
    if (typeof fetch !== 'function') return;
    try {
      const res = await fetch('/api/extensions');
      if (!res.ok) return;
      const extensions = await res.json();
      if (!Array.isArray(extensions)) return;

      for (const ext of extensions) {
        if (!ext || !ext.hasClient || !ext.id || typeof ext.id !== 'string') continue;
        if (!/^[a-z0-9-]+$/.test(ext.id)) continue;

        try {
          const script = document.createElement('script');
          script.src = `/api/ext/${encodeURIComponent(ext.id)}/client.js`;
          script.defer = true;
          script.dataset.extensionId = ext.id;
          script.addEventListener('error', (e) => {
            console.warn(`[Extensions] Failed to load client script for '${ext.id}':`, e);
          });
          const targetHead = document.head || (document.getElementsByTagName ? document.getElementsByTagName('head')[0] : null) || document.body;
          if (targetHead && typeof targetHead.appendChild === 'function') {
            targetHead.appendChild(script);
          }
        } catch (scriptErr) {
          console.warn(`[Extensions] Error attaching script for '${ext.id}':`, scriptErr);
        }
      }
    } catch (err) {
      console.warn('[Extensions] Error fetching /api/extensions:', err);
    }
  },

  registerFeature(initFn) {
    if (typeof initFn !== 'function') {
      console.warn('[Extensions] registerFeature argument must be a function');
      return;
    }
    try {
      const api = this.createScopedApi();
      initFn(api);
    } catch (err) {
      console.warn('[Extensions] Error executing extension initFn:', err);
    }
  },

  createScopedApi() {
    return {
      registerToolbarAction: (action) => this.registerToolbarAction(action),
      registerPanel: (panel) => this.registerPanel(panel),
      registerStageMode: (mode) => this.registerStageMode(mode),
      registerShortcut: (shortcut) => this.registerShortcut(shortcut),
      esc: (str) => (typeof UI !== 'undefined' && UI._esc ? UI._esc(str) : _escapeHtml(str)),
      getActiveDeck: () => (typeof DeckManager !== 'undefined' && DeckManager.getActiveDeck ? DeckManager.getActiveDeck() : null)
    };
  },

  registerToolbarAction(action) {
    if (!action || typeof action !== 'object') {
      console.warn('[Extensions] registerToolbarAction: invalid action configuration');
      return;
    }
    const { id, label, iconSvg, shortcutHint, onClick } = action;
    if (!id || typeof id !== 'string') {
      console.warn('[Extensions] registerToolbarAction: missing action id');
      return;
    }
    this.toolbarActions.set(id, {
      id,
      label: label || id,
      iconSvg: iconSvg || '',
      shortcutHint: shortcutHint || '',
      onClick: typeof onClick === 'function' ? onClick : null
    });

    this.renderToolbarAction(this.toolbarActions.get(id));
  },

  ensureToolbarSlot() {
    if (typeof document === 'undefined') return null;
    let slot = document.querySelector('.ext-toolbar-slot');
    if (slot) return slot;

    const toolsContainer = document.getElementById('dock-tools-container');
    if (!toolsContainer) return null;

    slot = document.createElement('div');
    slot.className = 'dock-tool-group ext-toolbar-slot';
    slot.id = 'group-cat-extensions';
    slot.dataset.cat = 'all';

    const heading = document.createElement('div');
    heading.className = 'dock-group-heading';
    const span = document.createElement('span');
    span.textContent = 'Add-ons';
    heading.appendChild(span);
    slot.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'dock-group-grid';
    grid.id = 'ext-toolbar-grid';
    slot.appendChild(grid);

    toolsContainer.appendChild(slot);
    return slot;
  },

  renderToolbarAction(action) {
    if (!action || typeof document === 'undefined') return;
    const slot = this.ensureToolbarSlot();
    if (!slot) return;

    const grid = (typeof slot.querySelector === 'function' && (slot.querySelector('#ext-toolbar-grid') || slot.querySelector('.dock-group-grid'))) || slot;

    const existingBtn = document.getElementById(`btn-ext-${action.id}`);
    if (existingBtn && existingBtn.parentNode && typeof existingBtn.parentNode.removeChild === 'function') {
      existingBtn.parentNode.removeChild(existingBtn);
    }

    const escFn = (typeof UI !== 'undefined' && UI._esc) ? UI._esc : _escapeHtml;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `btn-ext-${escFn(action.id)}`;
    btn.className = 'btn btn-hud ext-toolbar-action';
    btn.title = `${escFn(action.label)}${action.shortcutHint ? ' [' + escFn(action.shortcutHint) + ']' : ''}`;

    let iconHtml = '';
    if (action.iconSvg && typeof action.iconSvg === 'string') {
      iconHtml = `<span class="hud-icon">${action.iconSvg}</span>`;
    } else {
      iconHtml = `<span class="hud-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/></svg></span>`;
    }

    btn.innerHTML = `${iconHtml} <span class="hud-label">${escFn(action.label)}</span>`;

    btn.addEventListener('click', (ev) => {
      if (typeof UI !== 'undefined' && UI.triggerHotkeyFeedback) {
        UI.triggerHotkeyFeedback(btn.id);
      }
      if (typeof action.onClick === 'function') {
        try {
          action.onClick(ev);
        } catch (err) {
          console.warn(`[Extensions] Error executing toolbar action '${action.id}':`, err);
        }
      }
    });

    if (typeof grid.appendChild === 'function') {
      grid.appendChild(btn);
    }
  },

  renderAllToolbarActions() {
    for (const action of this.toolbarActions.values()) {
      this.renderToolbarAction(action);
    }
  },

  registerPanel(panel) {
    if (!panel || typeof panel !== 'object') {
      console.warn('[Extensions] registerPanel: invalid panel configuration');
      return null;
    }
    const { id, title, mount } = panel;
    if (!id || typeof id !== 'string') {
      console.warn('[Extensions] registerPanel: missing panel id');
      return null;
    }

    const escFn = (typeof UI !== 'undefined' && UI._esc) ? UI._esc : _escapeHtml;
    let hostEl = document.getElementById(`ext-panel-${id}`);
    let bodyEl = null;

    if (!hostEl && typeof document !== 'undefined' && document.body) {
      hostEl = document.createElement('div');
      hostEl.id = `ext-panel-${escFn(id)}`;
      hostEl.className = 'modal-overlay ext-panel-host hidden';

      const surfaceEl = document.createElement('div');
      surfaceEl.className = 'ext-panel-surface';

      const headerEl = document.createElement('div');
      headerEl.className = 'ext-panel-header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'ext-panel-title';
      titleEl.textContent = title || id;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-icon ext-panel-close';
      closeBtn.title = 'Close Panel';
      closeBtn.innerHTML = (typeof UI !== 'undefined' && UI.getIconSvg) ? UI.getIconSvg('✕', 14) : '✕';
      closeBtn.addEventListener('click', () => {
        hostEl.classList.add('hidden');
      });

      headerEl.appendChild(titleEl);
      headerEl.appendChild(closeBtn);

      bodyEl = document.createElement('div');
      bodyEl.className = 'ext-panel-body';

      surfaceEl.appendChild(headerEl);
      surfaceEl.appendChild(bodyEl);
      hostEl.appendChild(surfaceEl);

      hostEl.addEventListener('click', (e) => {
        if (e.target === hostEl) {
          hostEl.classList.add('hidden');
        }
      });

      if (typeof document.body.appendChild === 'function') {
        document.body.appendChild(hostEl);
      }
    } else if (hostEl) {
      bodyEl = (typeof hostEl.querySelector === 'function') ? hostEl.querySelector('.ext-panel-body') : null;
    }

    if (bodyEl && typeof mount === 'function') {
      try {
        mount(bodyEl);
      } catch (err) {
        console.warn(`[Extensions] Error mounting panel '${id}':`, err);
      }
    }

    const panelEntry = {
      id,
      title: title || id,
      hostEl,
      containerEl: bodyEl,
      open: () => hostEl && hostEl.classList && hostEl.classList.remove('hidden'),
      close: () => hostEl && hostEl.classList && hostEl.classList.add('hidden'),
      toggle: () => hostEl && hostEl.classList && hostEl.classList.toggle('hidden')
    };
    this.panels.set(id, panelEntry);
    return panelEntry;
  },

  registerStageMode(stageMode) {
    if (!stageMode || typeof stageMode !== 'object') {
      console.warn('[Extensions] registerStageMode: invalid stage mode configuration');
      return;
    }
    const { id, label, onEnter, onExit } = stageMode;
    if (!id || typeof id !== 'string') {
      console.warn('[Extensions] registerStageMode: missing stage mode id');
      return;
    }

    this.stageModes.set(id, {
      id,
      label: label || id,
      onEnter: typeof onEnter === 'function' ? onEnter : null,
      onExit: typeof onExit === 'function' ? onExit : null
    });
  },

  enterStageMode(id, context = {}) {
    const mode = this.stageModes.get(id);
    if (!mode) return false;

    if (this.activeStageModeId && this.activeStageModeId !== id) {
      this.exitStageMode();
    }

    let stageHost = document.querySelector('.ext-stage-host');
    const imageStage = document.getElementById('image-stage') || document.getElementById('session-image-container');
    if (!stageHost && imageStage) {
      stageHost = document.createElement('div');
      stageHost.className = 'ext-stage-host';
      stageHost.id = 'ext-stage-host';
      if (typeof imageStage.appendChild === 'function') {
        imageStage.appendChild(stageHost);
      }
    }

    const imageFrame = document.getElementById('image-frame');
    if (imageFrame && imageFrame.classList) {
      imageFrame.classList.add('ext-dormant');
    }

    if (stageHost) {
      if (stageHost.classList) stageHost.classList.remove('hidden');
      stageHost.innerHTML = '';
    }

    this.activeStageModeId = id;
    if (mode.onEnter && stageHost) {
      try {
        mode.onEnter(stageHost, context);
      } catch (err) {
        console.warn(`[Extensions] Error in stage mode '${id}' onEnter:`, err);
      }
    }
    return true;
  },

  exitStageMode() {
    if (!this.activeStageModeId) return;
    const mode = this.stageModes.get(this.activeStageModeId);
    if (mode && mode.onExit) {
      try {
        mode.onExit();
      } catch (err) {
        console.warn(`[Extensions] Error in stage mode '${this.activeStageModeId}' onExit:`, err);
      }
    }

    const stageHost = document.querySelector('.ext-stage-host');
    if (stageHost) {
      if (stageHost.classList) stageHost.classList.add('hidden');
      stageHost.innerHTML = '';
    }

    const imageFrame = document.getElementById('image-frame');
    if (imageFrame && imageFrame.classList) {
      imageFrame.classList.remove('ext-dormant');
    }

    this.activeStageModeId = null;
  },

  registerShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== 'object') {
      console.warn('[Extensions] registerShortcut: invalid shortcut configuration');
      return;
    }
    const { key, shift, ctrlOrCmd, description, handler } = shortcut;
    if (!key || typeof key !== 'string') {
      console.warn('[Extensions] registerShortcut: missing key');
      return;
    }
    if (typeof handler !== 'function') {
      console.warn('[Extensions] registerShortcut: handler must be a function');
      return;
    }

    this.shortcuts.push({
      key: key.toLowerCase(),
      shift: Boolean(shift),
      ctrlOrCmd: Boolean(ctrlOrCmd),
      description: description || '',
      handler
    });
  },

  handleKeyboard(e) {
    if (!e || !e.key || this.shortcuts.length === 0) return false;

    const isCtrlOrCmd = Boolean(e.metaKey || e.ctrlKey);
    const isShift = Boolean(e.shiftKey);
    const eventKey = e.key.toLowerCase();

    for (const sc of this.shortcuts) {
      if (sc.key === eventKey && sc.ctrlOrCmd === isCtrlOrCmd && sc.shift === isShift) {
        try {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          sc.handler(e);
          return true;
        } catch (err) {
          console.warn(`[Extensions] Error handling shortcut '${sc.key}':`, err);
          return true;
        }
      }
    }
    return false;
  }
};

const StudioExtensions = Object.freeze({
  registerFeature: (initFn) => ExtensionHost.registerFeature(initFn)
});

if (typeof window !== 'undefined') {
  window.ExtensionHost = ExtensionHost;
  window.StudioExtensions = StudioExtensions;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ExtensionHost = ExtensionHost;
  globalThis.StudioExtensions = StudioExtensions;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtensionHost,
    StudioExtensions
  };
}
