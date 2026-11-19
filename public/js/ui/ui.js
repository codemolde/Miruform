// ==================== UI CONTROLLER ====================
const UI = {
  currentDeckId: null,
  cachedImages: null,
  imageBlurred: false,
  folderBrowserCurrentPath: null,
  deckSearchQuery: '',
  deckSortOrder: 'due-desc',
  isZenMode: false,
  isPiPActive: false,
  isSafariVideoPiP: false,
  isElectron: /Electron/i.test(navigator.userAgent) || Boolean(typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('electron=1')),
  isMac: /Macintosh|Mac OS X/i.test(navigator.userAgent),
  isElectronFloating: false,
  pipWindow: null,
  deckMeta: {},
  _hudTimer: null,
  _overHud: false,
  _wasNativeFs: false,
  autoAdvance: false,
  _autoAdvanceTimer: null,
  selectedTagFilter: null,
  activeDeckTab: 'study',
  cachedImagesDeckId: null,
  isBoardStageOpen: false,
  sessionSource: null,
  boardState: BoardManager,
  drillManager: MemoryDrillManager,
  _boardSearchDebounce: null,
  isTagDockOpen: false,

  async init() {
    if (this.isElectron) {
      document.body.classList.add('is-electron');
      if (this.isMac) document.body.classList.add('is-mac');
      this.checkElectronFloatStatus();
    }

    await Storage.init();
    SoundFX.init();
    DeckManager.init();
    CardManager.init();
    ReviewHistory.init();
    MemoryDrillManager.init();
    await WallpaperManager.init();
    SketchOverlay.init();
    SketchComparison.init();
    if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.init();
    SmartCropManager.init();
    PlumbTool.init();
    ArtistToolbox.setupDragAndWheel();

    this.initDueIcons();
    this.bindEvents();
    this.updateFlashRecallUI();
    this.showDeckList();

    // Fetch and dynamically load client extensions under CSP (script-src 'self')
    try {
      if (typeof ExtensionHost !== 'undefined' && typeof ExtensionHost.loadClientExtensions === 'function') {
        ExtensionHost.loadClientExtensions();
      }
    } catch (extErr) {
      console.warn('[Extensions] Error initializing client extensions:', extErr);
    }
  },

  getIconSvg(name, size = 14, className = '') {
    const EMOJI_MAP = {
      '💾': 'save',
      '⚠️': 'alert',
      '🔊': 'volume',
      '🔇': 'volume-x',
      '🎨': 'palette',
      '🧹': 'broom',
      '✋': 'hand',
      '📐': 'perspective',
      '💡': 'lightbulb',
      '🦴': 'bone',
      '🏃': 'gesture',
      '🩸': 'leech',
      '👁️': 'eye',
      '🕶️': 'eye-off',
      '✏️': 'pencil',
      '✓': 'check',
      '✂️': 'scissors',
      '⚖️': 'scale',
      '❌': 'x-circle',
      '⛶': 'fullscreen',
      '✕': 'close',
      '📁': 'folder',
      '🏷️': 'tag',
      '🗑️': 'trash',
      '✨': 'sparkles',
      'ℹ️': 'info',
      '★': 'star',
      '⇄': 'refresh',
      '⏱': 'timer',
      '👻': 'ghost'
    };
    const key = EMOJI_MAP[name] || name;
    const cls = className ? ` class="${className}"` : '';

    const ICONS = {
      'ghost': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>`,
      'volume': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
      'volume-x': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`,
      'save': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
      'alert': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      'palette': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2Z"/></svg>`,
      'broom': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 10 5.5-5.5a1.5 1.5 0 0 1 2.1 2.1L16 12"/><path d="M14 10 9 15"/><path d="m3 21 3.5-3.5a2 2 0 0 1 2.8 0L11 19l4-4-5-5-1.5 1.5a2 2 0 0 1-2.8 0L3 21Z"/></svg>`,
      'hand': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
      'perspective': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 8-8"/><path d="m22 22-8-8"/><path d="M10 14h4"/><path d="m2 2 8 8"/><path d="m22 2-8 8"/><path d="M10 10h4"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
      'lightbulb': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>`,
      'bone': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 10c.7-.7 1.69-1 2.5-1a2.5 2.5 0 1 1 0 5c-.81 0-1.8-.3-2.5-1L7 17c-.7.7-1 1.69-1 2.5a2.5 2.5 0 1 1-5 0c0-.81.3-1.8 1-2.5l10-10c.7-.7 1-1.69 1-2.5a2.5 2.5 0 1 1 5 0c0 .81-.3 1.8-1 2.5Z"/></svg>`,
      'gesture': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="17" cy="4" r="2"/><path d="m15 8-4 4-3-2-5 3"/><path d="m13 13 2 4 4 1"/><path d="m9 16-2 5"/></svg>`,
      'leech': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
      'tag': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
      'folder': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
      'eye': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      'eye-off': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
      'pencil': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
      'check': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
      'scissors': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
      'crop': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
      'info': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
      'scale': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
      'x-circle': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      'fullscreen': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
      'fullscreen-exit': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`,
      'close': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      'trash': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
      'sparkles': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
      'star': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      'refresh': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>`,
      'timer': `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="8"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="2" x2="12" y2="6"/></svg>`
    };

    return ICONS[key] || ICONS['sparkles'];
  },

  getFlameSvgHTML(width = 16, height = 20) {
    return `<svg class="atelier-flame-icon" viewBox="0 0 100 125" width="${width}" height="${height}" aria-hidden="true" style="vertical-align: middle; flex-shrink: 0;"><path d="M26 98 C10 80 12 52 32 28 C28 18 28 10 29 4 C36 14 42 25 44 36 C30 55 22 76 26 98 Z" fill="#27272A"/><path d="M24 96 C15 72 28 42 62 2 C58 28 64 46 74 60 C55 82 40 96 24 96 Z" fill="url(#flame-core-grad)"/><path d="M24 96 C18 76 24 54 38 34 C34 52 34 66 36 78 C46 58 60 46 76 38 C82 28 84 18 83 8 C92 26 94 50 86 72 C72 88 48 102 24 96 Z" fill="#3F3F46"/><circle cx="48" cy="70" r="26" fill="url(#flame-inner-glow)" style="mix-blend-mode: screen;"/><path d="M32 104 C20 94 22 76 30 68 C29 78 36 86 46 84 C58 82 60 66 54 52 C68 62 76 80 68 98 C60 112 44 112 32 104 Z" fill="#F4F4F0"/></svg>`;
  },

  getDueSvgHTML(size = 12) {
    return `<svg class="stat-svg stat-svg-due atelier-due-icon" viewBox="48 72 48 140" width="${size}" height="${size}" fill="none" aria-hidden="true" style="vertical-align: middle; flex-shrink: 0;"><g><path style="fill:#ff0000;fill-opacity:1;stroke-width:0.281001" d="m 69.879012,182.04874 c -4.030391,-6.8687 -12.77236,-22.76319 -16.405374,-31.84578 -3.633015,-9.08259 -2.157124,-11.35319 2.497769,-16.12161 4.654894,-4.76842 12.488453,-12.03433 12.545142,-22.25236 0.05669,-10.21802 -7.663339,-23.387477 -11.693732,-30.199408 -4.030393,-6.81193 -4.370983,-7.26605 3.406125,-0.964888 7.777109,6.301163 23.671288,19.357096 27.815133,30.029196 4.143844,10.6721 -3.462655,18.95978 -9.309598,25.60145 -5.846943,6.64168 -9.934021,11.637 -10.671952,19.41405 -0.737931,7.77706 1.873254,18.33533 3.519476,24.69315 1.646222,6.35782 2.327401,8.51489 -1.702989,1.6462 z" transform="rotate(4.9450556,70.333789,142.50045)"></path><path style="fill:#1a1a1a;fill-opacity:1;stroke-width:0.281001" d="m 69.879012,182.04874 c -4.030391,-6.8687 -12.77236,-22.76319 -16.405374,-31.84578 -3.633015,-9.08259 -2.157124,-11.35319 2.497769,-16.12161 4.654894,-4.76842 12.488453,-12.03433 12.545142,-22.25236 0.05669,-10.21802 -7.663339,-23.387477 -11.693732,-30.199408 -4.030393,-6.81193 -4.370983,-7.26605 3.406125,-0.964888 7.777109,6.301163 23.671288,19.357096 27.815133,30.029196 4.143844,10.6721 -3.462655,18.95978 -9.309598,25.60145 -5.846943,6.64168 -9.934021,11.637 -10.671952,19.41405 -0.737931,7.77706 1.873254,18.33533 3.519476,24.69315 1.646222,6.35782 2.327401,8.51489 -1.702989,1.6462 z" transform="matrix(0.63709831,0.0551233,-0.07473089,0.86371681,34.212727,13.611625)"></path><ellipse style="fill:#ff0000;fill-opacity:1;stroke-width:0.281001" cx="85.079712" cy="193.16653" rx="8.6852064" ry="9.0258026" transform="rotate(4.9450556)"></ellipse><ellipse style="fill:#1a1a1a;fill-opacity:1;stroke-width:0.197259" cx="84.133904" cy="194.31033" rx="6.3010321" ry="6.130734" transform="rotate(4.9450556)"></ellipse></g></svg>`;
  },

  formatShortPath(p) {
    if (!p) return '';
    const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 3) {
      return '~/' + parts.slice(-3).join('/');
    }
    return p;
  },

  initDueIcons() {
    const dueSvgMarkup = `<svg class="stat-svg stat-svg-due atelier-due-icon" viewBox="48 72 48 140" width="14" height="14" fill="none" aria-hidden="true"><g id="layer1"><path style="fill:#ff0000;fill-opacity:1;stroke-width:0.281001" d="m 69.879012,182.04874 c -4.030391,-6.8687 -12.77236,-22.76319 -16.405374,-31.84578 -3.633015,-9.08259 -2.157124,-11.35319 2.497769,-16.12161 4.654894,-4.76842 12.488453,-12.03433 12.545142,-22.25236 0.05669,-10.21802 -7.663339,-23.387477 -11.693732,-30.199408 -4.030393,-6.81193 -4.370983,-7.26605 3.406125,-0.964888 7.777109,6.301163 23.671288,19.357096 27.815133,30.029196 4.143844,10.6721 -3.462655,18.95978 -9.309598,25.60145 -5.846943,6.64168 -9.934021,11.637 -10.671952,19.41405 -0.737931,7.77706 1.873254,18.33533 3.519476,24.69315 1.646222,6.35782 2.327401,8.51489 -1.702989,1.6462 z" id="path1" transform="rotate(4.9450556,70.333789,142.50045)"></path><path style="fill:#1a1a1a;fill-opacity:1;stroke-width:0.281001" d="m 69.879012,182.04874 c -4.030391,-6.8687 -12.77236,-22.76319 -16.405374,-31.84578 -3.633015,-9.08259 -2.157124,-11.35319 2.497769,-16.12161 4.654894,-4.76842 12.488453,-12.03433 12.545142,-22.25236 0.05669,-10.21802 -7.663339,-23.387477 -11.693732,-30.199408 -4.030393,-6.81193 -4.370983,-7.26605 3.406125,-0.964888 7.777109,6.301163 23.671288,19.357096 27.815133,30.029196 4.143844,10.6721 -3.462655,18.95978 -9.309598,25.60145 -5.846943,6.64168 -9.934021,11.637 -10.671952,19.41405 -0.737931,7.77706 1.873254,18.33533 3.519476,24.69315 1.646222,6.35782 2.327401,8.51489 -1.702989,1.6462 z" id="path1-1" transform="matrix(0.63709831,0.0551233,-0.07473089,0.86371681,34.212727,13.611625)"></path><ellipse style="fill:#ff0000;fill-opacity:1;stroke-width:0.281001" id="path2" cx="85.079712" cy="193.16653" rx="8.6852064" ry="9.0258026" transform="rotate(4.9450556)"></ellipse><ellipse style="fill:#1a1a1a;fill-opacity:1;stroke-width:0.197259" id="path2-0" cx="84.133904" cy="194.31033" rx="6.3010321" ry="6.130734" transform="rotate(4.9450556)"></ellipse></g></svg>`;
    document.querySelectorAll('.stat-svg-due').forEach(el => {
      if (!el.querySelector('#layer1')) {
        el.outerHTML = dueSvgMarkup;
      }
    });
  },

  // ---- Toast HUD ----
  showToast(message, icon = 'sparkles') {
    // When inside active study session, float mode, or zen mode, never pop notifications over artwork
    const inSession = document.body.classList.contains('in-session') ||
      document.body.classList.contains('pip-mode') ||
      document.body.classList.contains('zen-active') ||
      this.isPiPActive ||
      (document.getElementById('view-session')?.classList.contains('active'));
    if (inSession) {
      return;
    }

    const container = document.getElementById('toast-container');
    if (!container) return;

    // Immediately clear any existing toasts so they never stack into a pile
    container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'toast';
    const iconSvg = this.getIconSvg ? this.getIconSvg(icon, 16, 'toast-svg') : '';
    toast.innerHTML = `<span class="toast-icon">${iconSvg}</span> <span>${this._esc(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    }, 1800);
  },

  // ---- Event Binding ----
  bindEvents() {
    // Sound Toggles
    const toggleSoundHandler = () => {
      SoundFX.toggle();
    };
    const btnSound1 = document.getElementById('btn-toggle-sound');
    if (btnSound1) btnSound1.addEventListener('click', toggleSoundHandler);
    const btnSound2 = document.getElementById('btn-detail-sound');
    if (btnSound2) btnSound2.addEventListener('click', toggleSoundHandler);
    const btnSound3 = document.getElementById('btn-session-sound');
    if (btnSound3) btnSound3.addEventListener('click', toggleSoundHandler);

    // Global tactile click sound on interactive elements & background
    document.addEventListener('click', (e) => {
      const interactiveEl = e.target.closest('button, .btn, .folder-item, .btn-rate, .deck-card, .tool-btn, .badge, .tab-btn, a, .stat-pill, .control-btn, .shortcut-row');
      if (interactiveEl) {
        SoundFX.click();
      } else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        SoundFX.click();
      }
    });

    // Soft fluid droplet hover sound on interactive elements
    document.addEventListener('mouseover', (e) => {
      const interactive = e.target.closest('button, .btn, .folder-item, .btn-rate, .tool-btn, .tab-btn');
      if (interactive && !interactive.dataset.hovered) {
        interactive.dataset.hovered = '1';
        SoundFX.hover();
      }
    });
    document.addEventListener('mouseout', (e) => {
      const interactive = e.target.closest('button, .btn, .folder-item, .btn-rate, .tool-btn, .tab-btn');
      if (interactive) {
        delete interactive.dataset.hovered;
      }
    });

    // Header & Deck List
    document.getElementById('btn-new-deck').addEventListener('click', () => this.openDeckModal());
    document.getElementById('btn-empty-new-deck').addEventListener('click', () => this.openDeckModal());
    document.getElementById('btn-open-wallpaper').addEventListener('click', () => this.openWallpaperModal());
    document.getElementById('btn-detail-wallpaper').addEventListener('click', () => this.openWallpaperModal());
    document.getElementById('btn-open-shortcuts').addEventListener('click', () => this.openShortcutsModal());
    document.getElementById('btn-open-backup').addEventListener('click', () => this.openBackupModal());

    // Search and Sort
    const searchInput = document.getElementById('deck-search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    const sortSelect = document.getElementById('deck-sort-select');

    searchInput.addEventListener('input', (e) => {
      this.deckSearchQuery = e.target.value.toLowerCase().trim();
      clearSearchBtn.classList.toggle('hidden', !this.deckSearchQuery);
      this.renderDeckList();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.deckSearchQuery = '';
      clearSearchBtn.classList.add('hidden');
      this.renderDeckList();
      searchInput.focus();
    });

    sortSelect.addEventListener('change', (e) => {
      this.deckSortOrder = e.target.value;
      this.renderDeckList();
    });

    // Deck Detail View
    document.getElementById('btn-back-to-list').addEventListener('click', () => this.showDeckList());

    // Deck Detail Tabs
    const tabStudy = document.getElementById('tab-btn-study');
    const tabBoard = document.getElementById('tab-btn-board');
    if (tabStudy) tabStudy.addEventListener('click', () => this.switchDeckTab('study'));
    if (tabBoard) tabBoard.addEventListener('click', () => this.switchDeckTab('board'));

    // Board Filter Controls
    const boardSearchInput = document.getElementById('input-board-search');
    const boardSearchClear = document.getElementById('btn-board-search-clear');
    const boardClearFilters = document.getElementById('btn-board-clear-filters');
    const boardTagsBar = document.getElementById('board-tags-bar');

    if (boardSearchInput) {
      boardSearchInput.addEventListener('input', (e) => {
        clearTimeout(this._boardSearchDebounce);
        const val = e.target.value;
        this._boardSearchDebounce = setTimeout(() => {
          this.setBoardSearchQuery(val);
        }, 120);
      });
    }

    if (boardSearchClear) {
      boardSearchClear.addEventListener('click', () => {
        const input = document.getElementById('input-board-search');
        if (input) {
          input.value = '';
          input.focus();
        }
        this.setBoardSearchQuery('');
      });
    }

    if (boardClearFilters) {
      boardClearFilters.addEventListener('click', () => {
        this.clearBoardFilters();
      });
    }

    if (boardTagsBar) {
      boardTagsBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.board-tag-chip');
        if (!chip) return;
        const tag = chip.dataset.tag;
        this.setBoardTagFilter(tag);
      });
    }

    // Board Sort Dropdown
    const boardSortSelect = document.getElementById('board-sort-select');
    if (boardSortSelect) {
      boardSortSelect.addEventListener('change', (e) => {
        this.setBoardSortOrder(e.target.value);
      });
    }

    // Board Rescan / Refresh Button
    const btnBoardRefresh = document.getElementById('btn-board-refresh');
    if (btnBoardRefresh) {
      btnBoardRefresh.addEventListener('click', () => {
        this.refreshCurrentDeck();
      });
    }

    // Deck Detail Header Rescan / Refresh Button
    const btnDetailRefresh = document.getElementById('btn-detail-refresh');
    if (btnDetailRefresh) {
      btnDetailRefresh.addEventListener('click', () => {
        this.refreshCurrentDeck();
      });
    }

    // Relocate Folder Button on Missing Folder Banner
    const btnRelocateFolder = document.getElementById('btn-relocate-folder');
    if (btnRelocateFolder) {
      btnRelocateFolder.addEventListener('click', () => {
        this.openDeckModal(this.currentDeckId);
      });
    }

    // Board Grid Size (Small, Medium, Large)
    document.querySelectorAll('.btn-board-size').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const size = e.currentTarget.dataset.size;
        this.setBoardGridSize(size);
      });
    });

    const boardGrid = document.getElementById('board-gallery-grid');
    if (boardGrid) {
      boardGrid.addEventListener('click', (e) => {
        const tagPill = e.target.closest('.board-ref-tag-pill');
        if (tagPill) {
          e.stopPropagation();
          const tag = tagPill.textContent.replace(/^#/, '').trim();
          this.setBoardTagFilter(tag);
          return;
        }

        const cardEl = e.target.closest('.board-ref-card');
        if (!cardEl) return;
        const refId = cardEl.dataset.id;
        const refPath = cardEl.dataset.path;
        const ref = (this.boardState.filteredReferences || this.cachedImages || []).find(r => (refPath && r.path && r.path === refPath) || (refId && r.id === refId))
          || { id: refId, path: refPath, name: cardEl.querySelector('.board-ref-title')?.textContent || '' };
        this.selectBoardReference(ref, cardEl);
        this.openBoardStage(ref);
      });

      boardGrid.addEventListener('dblclick', (e) => {
        const cardEl = e.target.closest('.board-ref-card');
        if (!cardEl) return;
        const refId = cardEl.dataset.id;
        const refPath = cardEl.dataset.path;
        const ref = (this.boardState.filteredReferences || this.cachedImages || []).find(r => (refPath && r.path && r.path === refPath) || (refId && r.id === refId))
          || { id: refId, path: refPath, name: cardEl.querySelector('.board-ref-title')?.textContent || '' };
        this.selectBoardReference(ref, cardEl);
        this.openBoardStage(ref);
      });

      boardGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const cardEl = e.target.closest('.board-ref-card');
          if (cardEl) {
            e.preventDefault();
            cardEl.click();
          }
        }
      });

      boardGrid.addEventListener('error', (e) => {
        if (e.target && e.target.tagName === 'IMG' && e.target.classList.contains('board-ref-thumb')) {
          e.target.style.display = 'none';
          const parent = e.target.parentElement;
          if (parent) {
            const fallback = parent.querySelector('.board-card-fallback');
            if (fallback) fallback.classList.remove('hidden');
          }
        }
      }, true);
    }
    document.getElementById('btn-edit-deck').addEventListener('click', () => this.openDeckModal(this.currentDeckId));
    document.getElementById('btn-delete-deck').addEventListener('click', () => this.openDeleteModal());
    document.getElementById('btn-study-new').addEventListener('click', () => this.startSession('new'));
    document.getElementById('btn-review').addEventListener('click', () => this.startSession('review'));
    document.getElementById('btn-free-study').addEventListener('click', () => this.startSession('free'));
    document.getElementById('btn-todays-reviewed').addEventListener('click', () => this.openTodaysReviewedModal());
    document.getElementById('btn-close-todays').addEventListener('click', () => this.closeTodaysReviewedModal());
    const clearFilterBtn = document.getElementById('btn-clear-tag-filter');
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        SoundFX.click();
        this.selectedTagFilter = null;
        this.renderDeckStats();
        this.renderDeckFocusTags();
      });
    }

    // Flash & Recall (Memory Drill) Controls
    const toggleDrill = document.getElementById('toggle-flash-recall');
    if (toggleDrill) {
      toggleDrill.addEventListener('change', (e) => {
        SoundFX.click();
        MemoryDrillManager.setEnabled(e.target.checked);
        this.updateFlashRecallUI();
      });
    }

    document.querySelectorAll('.btn-drill-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SoundFX.click();
        const param = e.currentTarget.dataset.param;
        const val = e.currentTarget.dataset.val;
        if (param === 'observe') MemoryDrillManager.setObserveSec(val);
        else if (param === 'draw') MemoryDrillManager.setDrawSec(val);
        else if (param === 'veil') MemoryDrillManager.setVeilMode(val);
        this.updateFlashRecallUI();
      });
    });

    // Flash & Recall Stage Action Buttons
    const btnDrillAction = document.getElementById('btn-drill-action');
    if (btnDrillAction) {
      btnDrillAction.addEventListener('click', () => {
        SoundFX.click();
        if (FlashRecallManager.phase === 'observe') {
          FlashRecallManager.transitionToDraw();
        } else if (FlashRecallManager.phase === 'draw') {
          FlashRecallManager.transitionToReveal();
        }
      });
    }

    const btnDrillRevealCard = document.getElementById('btn-drill-reveal-card');
    if (btnDrillRevealCard) {
      btnDrillRevealCard.addEventListener('click', () => {
        SoundFX.click();
        if (FlashRecallManager.phase === 'draw') {
          FlashRecallManager.transitionToReveal();
        }
      });
    }

    // Flash & Recall Self-Critique Quick Action Buttons
    const btnDrillPaste = document.getElementById('btn-drill-paste');
    if (btnDrillPaste) {
      btnDrillPaste.addEventListener('click', () => {
        SoundFX.click();
        if (typeof SketchOverlay !== 'undefined') {
          SketchOverlay.promptPasteOrUpload();
        }
      });
    }

    const btnDrillSideBySide = document.getElementById('btn-drill-sidebyside');
    if (btnDrillSideBySide) {
      btnDrillSideBySide.addEventListener('click', () => {
        SoundFX.click();
        if (typeof SketchComparison !== 'undefined') {
          SketchComparison.toggleSplitView();
        }
      });
    }

    const btnDrillFlicker = document.getElementById('btn-drill-flicker');
    if (btnDrillFlicker) {
      btnDrillFlicker.addEventListener('click', () => {
        SoundFX.click();
        if (typeof SketchOverlay !== 'undefined') {
          if (SketchOverlay.active) {
            SketchOverlay.toggleVisibility();
          } else {
            SketchOverlay.promptPasteOrUpload();
          }
        }
      });
    }

    // Web / Pinterest Clipper
    const btnClip = document.getElementById('btn-clip-url');
    const inputClip = document.getElementById('input-clip-url');
    if (btnClip && inputClip) {
      const handleClip = async () => {
        const currentDeck = DeckManager.getById(this.currentDeckId);
        if (!currentDeck) return;
        if (!currentDeck.folder && currentDeck.folderPath) currentDeck.folder = currentDeck.folderPath;

        const url = (inputClip.value || '').trim();
        const statusEl = document.getElementById('clip-status-msg');
        if (!url) return;

        const originalBtnText = btnClip.textContent;
        btnClip.textContent = 'Downloading...';
        btnClip.disabled = true;

        try {
          const res = await fetch('/api/download-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: currentDeck.folder, url })
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to download image');
          }

          inputClip.value = '';
          if (statusEl) {
            statusEl.textContent = '✓ Saved to folder';
            statusEl.className = 'status-success';
            setTimeout(() => {
              if (statusEl.textContent === '✓ Saved to folder') {
                statusEl.textContent = '';
                statusEl.className = '';
              }
            }, 3000);
          }

          // Refresh current Deck Detail stats so Total Images and Unseen increment immediately
          if (this.deckMeta) {
            delete this.deckMeta[currentDeck.folder];
            delete this.deckMeta[currentDeck.folderPath];
          }
          this.cachedImages = await SessionManager.loadImages(currentDeck.folder || currentDeck.folderPath);
          CardManager.migrateLegacyPathCards(this.currentDeckId, this.cachedImages);
          this.renderDeckStats();
          this.renderDeckFocusTags();
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = err.message || 'Download error';
            statusEl.className = 'status-error';
            setTimeout(() => {
              if (statusEl.textContent === (err.message || 'Download error')) {
                statusEl.textContent = '';
                statusEl.className = '';
              }
            }, 3000);
          }
        } finally {
          btnClip.textContent = originalBtnText;
          btnClip.disabled = false;
        }
      };

      btnClip.addEventListener('click', handleClip);
      inputClip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleClip();
        }
      });
    }

    // Overdue Backlog Load-Balancer Button
    const btnReflow = document.getElementById('btn-reflow-backlog');
    if (btnReflow) {
      btnReflow.addEventListener('click', () => {
        if (!this.currentDeckId) return;
        const result = CardManager.reflowOverdueBacklog(this.currentDeckId);
        SoundFX.click();

        const originalHtml = `<span class="btn-icon">${this.getIconSvg('scale', 14)}</span> <span>Reflow Overdue Backlog</span> <span id="reflow-badge" class="reflow-badge hidden">0</span>`;
        if (result.reflowedCount > 0) {
          btnReflow.innerHTML = `<span><span class="btn-icon">${this.getIconSvg('check', 14)}</span> <span>Reflowed ${result.reflowedCount} cards across 5 days!</span></span>`;
          btnReflow.classList.add('reflow-success');
        } else {
          btnReflow.innerHTML = `<span><span class="btn-icon">${this.getIconSvg('check', 14)}</span> <span>Queue within daily limit (${result.totalDue}/${result.limit})</span></span>`;
        }

        this.renderDeckStats();
        this.renderHeatmap();
        this.renderTodayStrip();

        setTimeout(() => {
          btnReflow.innerHTML = originalHtml;
          btnReflow.classList.remove('reflow-success');
          this.renderDeckStats();
        }, 3200);
      });
    }

    // Quick Tagging Dock
    const btnArtTag = document.getElementById('btn-art-tag');
    if (btnArtTag) btnArtTag.addEventListener('click', () => this.toggleTagDock());
    const btnCloseTagDock = document.getElementById('btn-close-tag-dock');
    if (btnCloseTagDock) btnCloseTagDock.addEventListener('click', () => this.toggleTagDock(false));

    const btnSubmitTag = document.getElementById('btn-submit-tag');
    const inputCustomTag = document.getElementById('input-custom-tag');
    if (btnSubmitTag && inputCustomTag) {
      const submitCustom = () => {
        const val = inputCustomTag.value.trim();
        if (val) {
          this.toggleCardTag(val);
          inputCustomTag.value = '';
        }
      };
      btnSubmitTag.addEventListener('click', submitCustom);
      inputCustomTag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitCustom();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.toggleTagDock(false);
        }
      });
    }

    // Session View & Rating
    document.getElementById('btn-end-session').addEventListener('click', () => this.endSession());

    // Reference Board Stage Navigation & Slideshow Dock
    const btnBoardPrev = document.getElementById('btn-board-nav-prev');
    const btnBoardNext = document.getElementById('btn-board-nav-next');
    const selectBoardInterval = document.getElementById('select-board-slide-interval');
    const btnBoardSlideToggle = document.getElementById('btn-board-slideshow-toggle');

    if (btnBoardPrev) btnBoardPrev.addEventListener('click', () => this.stepBoardReference('prev'));
    if (btnBoardNext) btnBoardNext.addEventListener('click', () => this.stepBoardReference('next'));
    if (selectBoardInterval) selectBoardInterval.addEventListener('change', (e) => this.setBoardSlideInterval(e.target.value));
    if (btnBoardSlideToggle) btnBoardSlideToggle.addEventListener('click', () => this.toggleBoardSlideshowPause());
    document.getElementById('btn-session-zen').addEventListener('click', () => this.toggleZenMode());
    document.getElementById('btn-session-pip').addEventListener('click', () => this.togglePiP());
    const btnElectronUnfloat = document.getElementById('btn-electron-unfloat');
    if (btnElectronUnfloat) {
      btnElectronUnfloat.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isGhostMode) return;
        this.exitElectronFloat();
      });
    }
    const btnElectronGhost = document.getElementById('btn-electron-ghost');
    if (btnElectronGhost) {
      btnElectronGhost.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isGhostMode) return;
        this.toggleGhostMode();
      });
    }
    const btnExitGhost = document.getElementById('btn-exit-ghost-mode');
    if (btnExitGhost) {
      btnExitGhost.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleGhostMode(false);
      });
    }
    const ghostInteractiveElements = [
      btnExitGhost
    ].filter(Boolean);
    ghostInteractiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (this.isGhostMode && window.electronAPI && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
          window.electronAPI.setIgnoreMouseEvents(false);
        }
      });
      el.addEventListener('mouseleave', () => {
        if (this.isGhostMode && window.electronAPI && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
          window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
      });
    });
    const returnFromPiPBtn = document.getElementById('btn-return-from-pip');
    if (returnFromPiPBtn) returnFromPiPBtn.addEventListener('click', () => this.closePiP(true));
    const pipSwitchBtn = document.getElementById('btn-pip-mode-switch');
    if (pipSwitchBtn) {
      pipSwitchBtn.addEventListener('click', async () => {
        if (this.isSafariVideoPiP) {
          this.closePiP(false);
          await this.openPiP('popup');
        } else {
          this.closePiP(true);
          await this.openPiP('video');
        }
      });
    }
    const pipEndBtn = document.getElementById('btn-pip-end-session');
    if (pipEndBtn) pipEndBtn.addEventListener('click', () => { this.closePiP(true); this.endSession(); });
    window.addEventListener('beforeunload', () => { if (this.pipWindow) this.pipWindow.close(); });
    const btnAgain = document.getElementById('btn-rate-again');
    if (btnAgain) btnAgain.addEventListener('click', () => this.rateCurrentImage('again'));
    document.getElementById('btn-rate-hard').addEventListener('click', () => this.rateCurrentImage('hard'));
    document.getElementById('btn-rate-medium').addEventListener('click', () => this.rateCurrentImage('medium'));
    document.getElementById('btn-rate-easy').addEventListener('click', () => this.rateCurrentImage('easy'));
    document.getElementById('btn-skip').addEventListener('click', () => this.showNextImage());
    document.getElementById('btn-review-done').addEventListener('click', () => this.endSession());
    document.getElementById('btn-summary-done').addEventListener('click', () => {
      document.getElementById('modal-session-summary').classList.add('hidden');
      this.endSession();
    });

    // Timer Controls
    document.getElementById('btn-timer-pause').addEventListener('click', () => this.toggleTimerPause());
    document.getElementById('btn-timer-reset').addEventListener('click', () => this.resetTimer());

    // Artist Toolbox HUD
    document.getElementById('btn-art-grayscale').addEventListener('click', () => ArtistToolbox.toggleGrayscale());
    document.getElementById('btn-art-notan').addEventListener('click', () => ArtistToolbox.toggleNotan());
    document.getElementById('btn-art-silhouette').addEventListener('click', () => ArtistToolbox.toggleSilhouette());
    document.getElementById('btn-art-posterize').addEventListener('click', () => ArtistToolbox.togglePosterize());
    const squintBtn = document.getElementById('btn-art-squint');
    if (squintBtn) squintBtn.addEventListener('click', () => ArtistToolbox.toggleSquint());
    document.getElementById('btn-art-grid').addEventListener('click', () => ArtistToolbox.toggleGrid());
    document.getElementById('btn-art-invert').addEventListener('click', () => ArtistToolbox.toggleInvert());
    document.getElementById('btn-img-flip').addEventListener('click', () => ArtistToolbox.flipHorizontal());
    document.getElementById('btn-img-rotate').addEventListener('click', () => ArtistToolbox.rotate90());
    document.getElementById('btn-img-zoom-in').addEventListener('click', () => ArtistToolbox.adjustZoom(0.25));
    document.getElementById('btn-img-zoom-out').addEventListener('click', () => ArtistToolbox.adjustZoom(-0.25));
    document.getElementById('btn-img-zoom-reset').addEventListener('click', () => ArtistToolbox.resetZoomPan());

    // Silhouette & Posterize HUD subpanel controls
    const silSlider = document.getElementById('slider-silhouette-threshold');
    if (silSlider) {
      silSlider.addEventListener('input', (e) => ArtistToolbox.setSilhouetteThreshold(e.target.value));
    }
    const silInvertBtn = document.getElementById('btn-silhouette-invert');
    if (silInvertBtn) {
      silInvertBtn.addEventListener('click', () => ArtistToolbox.toggleSilhouetteInvert());
    }
    const silResetBtn = document.getElementById('btn-silhouette-reset');
    if (silResetBtn) {
      silResetBtn.addEventListener('click', () => ArtistToolbox.resetSilhouetteThreshold());
    }

    const postSlider = document.getElementById('slider-posterize-steps');
    if (postSlider) {
      postSlider.addEventListener('input', (e) => ArtistToolbox.setPosterizeSteps(e.target.value));
    }
    const post3Btn = document.getElementById('btn-posterize-preset-3');
    if (post3Btn) {
      post3Btn.addEventListener('click', () => {
        if (!ArtistToolbox.posterize) ArtistToolbox.togglePosterize();
        ArtistToolbox.setPosterizeSteps(3);
      });
    }
    const post4Btn = document.getElementById('btn-posterize-preset-4');
    if (post4Btn) {
      post4Btn.addEventListener('click', () => {
        if (!ArtistToolbox.posterize) ArtistToolbox.togglePosterize();
        ArtistToolbox.setPosterizeSteps(4);
      });
    }

    // Squint Blur HUD subpanel controls
    const squintSlider = document.getElementById('slider-squint-radius');
    if (squintSlider) {
      squintSlider.addEventListener('input', (e) => ArtistToolbox.setSquintRadius(e.target.value));
    }
    const squintLightBtn = document.getElementById('btn-squint-preset-light');
    if (squintLightBtn) {
      squintLightBtn.addEventListener('click', () => {
        if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
        ArtistToolbox.setSquintRadius(3);
      });
    }
    const squintMedBtn = document.getElementById('btn-squint-preset-medium');
    if (squintMedBtn) {
      squintMedBtn.addEventListener('click', () => {
        if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
        ArtistToolbox.setSquintRadius(8);
      });
    }
    const squintHeavyBtn = document.getElementById('btn-squint-preset-heavy');
    if (squintHeavyBtn) {
      squintHeavyBtn.addEventListener('click', () => {
        if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
        ArtistToolbox.setSquintRadius(16);
      });
    }
    const squintResetBtn = document.getElementById('btn-squint-reset');
    if (squintResetBtn) {
      squintResetBtn.addEventListener('click', () => {
        if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
        ArtistToolbox.setSquintRadius(6);
      });
    }

    // Auto-advance toggle
    const autoAdvanceChk = document.getElementById('chk-auto-advance');
    if (autoAdvanceChk) {
      // Restore from localStorage
      const saved = localStorage.getItem('artpractice_auto_advance');
      if (saved === 'true') { autoAdvanceChk.checked = true; this.autoAdvance = true; }
      autoAdvanceChk.addEventListener('change', () => {
        this.autoAdvance = autoAdvanceChk.checked;
        localStorage.setItem('artpractice_auto_advance', String(this.autoAdvance));
      });
    }

    // Wallpaper Modal Events
    this.bindWallpaperEvents();

    // Backup & Restore Events
    this.bindBackupEvents();

    // Shortcuts Modal
    document.getElementById('btn-close-shortcuts').addEventListener('click', () => this.closeShortcutsModal());
    document.getElementById('btn-close-shortcuts-x').addEventListener('click', () => this.closeShortcutsModal());

    // Deck Modal
    document.getElementById('form-deck').addEventListener('submit', (e) => this.handleDeckSubmit(e));
    document.getElementById('btn-cancel-deck').addEventListener('click', () => this.closeDeckModal());

    // Folder Browser
    document.getElementById('btn-browse-folder').addEventListener('click', () => this.openFolderBrowser());
    document.getElementById('btn-cancel-browse').addEventListener('click', () => this.closeFolderBrowser());
    document.getElementById('btn-select-folder').addEventListener('click', () => this.selectBrowsedFolder());
    document.getElementById('folder-browser-up').addEventListener('click', () => this.browseFolderUp());

    // Delete Modal
    document.getElementById('btn-cancel-delete').addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('btn-confirm-delete').addEventListener('click', () => this.confirmDelete());

    // Overlay click to close modals
    const modalIds = [
      'modal-deck', 'modal-delete', 'modal-folder-browser',
      'modal-todays-reviewed', 'modal-wallpaper', 'modal-shortcuts',
      'modal-backup', 'modal-session-summary'
    ];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          if (e.target === el) el.classList.add('hidden');
        });
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Setup Electron Global Shortcut IPC listener (cleanup existing if re-initialized)
    this.setupGlobalShortcuts();

    // True fullscreen sync + auto-hiding session HUD
    this.bindFullscreenEvents();

    // Side tool dock auto-hide proximity (Mac dock behavior)
    this.bindSideDockEdgeAutoReveal(document);
  },

  _globalShortcutUnsubscribe: null,

  setupGlobalShortcuts() {
    if (this._globalShortcutUnsubscribe) {
      try {
        this._globalShortcutUnsubscribe();
      } catch (err) {
        console.warn('[UI] Error cleaning up previous global shortcut subscription:', err);
      }
      this._globalShortcutUnsubscribe = null;
    }

    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.onGlobalShortcut === 'function') {
      try {
        this._globalShortcutUnsubscribe = window.electronAPI.onGlobalShortcut((action, data) => {
          this.handleGlobalShortcutAction(action, data);
        });
      } catch (err) {
        console.warn('[UI] Failed to register global shortcut listener:', err);
      }
    }
  },

  handleGlobalShortcutAction(action, data) {
    if (!action) return;
    if (action === 'toggle-ghost-mode') {
      this.toggleGhostMode();
      return;
    }
    if (action === 'ghost-mode-enabled') {
      this.setGhostModeState(true);
      return;
    }
    if (action === 'ghost-mode-disabled') {
      this.setGhostModeState(false);
      return;
    }
    if (action === 'opacity-changed' && data && typeof data.opacity === 'number') {
      this.showOpacityHUD(data.opacity, data.isGhostMode);
      return;
    }
    if (typeof action === 'string') {
      const lower = action.toLowerCase();
      if (lower.length === 1 || ['space', 'escape', '+', '-', '=', '_', '[', ']'].includes(lower)) {
        const key = lower === 'space' ? ' ' : lower;
        this.handleKeyboard({ key, preventDefault() { }, stopPropagation() { } });
        return;
      }
      switch (lower) {
        case 'pause':
        case 'toggle-pause':
        case 'timer-pause':
          this.triggerHotkeyFeedback('btn-timer-pause');
          this.toggleTimerPause();
          break;
        case 'next':
        case 'skip':
          this.triggerHotkeyFeedback('btn-skip');
          this.showNextImage();
          break;
        case 'rate-again':
          this.triggerHotkeyFeedback('btn-rate-again');
          this.rateCurrentImage('again');
          break;
        case 'rate-hard':
          if (!this.isPiPActive) {
            this.triggerHotkeyFeedback('btn-rate-hard');
            this.rateCurrentImage('hard');
          }
          break;
        case 'rate-medium':
          if (!this.isPiPActive) {
            this.triggerHotkeyFeedback('btn-rate-medium');
            this.rateCurrentImage('medium');
          }
          break;
        case 'rate-easy':
          if (!this.isPiPActive) {
            this.triggerHotkeyFeedback('btn-rate-easy');
            this.rateCurrentImage('easy');
          }
          break;
        case 'toggle-float':
        case 'toggle-pip':
          this.triggerHotkeyFeedback('btn-session-pip');
          this.togglePiP();
          break;
        case 'toggle-zen':
          this.triggerHotkeyFeedback('btn-session-zen');
          this.toggleZenMode();
          break;
        case 'grayscale':
          this.triggerHotkeyFeedback('btn-art-grayscale');
          ArtistToolbox.toggleGrayscale();
          break;
        case 'notan':
          this.triggerHotkeyFeedback('btn-art-notan');
          ArtistToolbox.toggleNotan();
          break;
        case 'flip':
          this.triggerHotkeyFeedback('btn-img-flip');
          ArtistToolbox.flipHorizontal();
          break;
        case 'rotate':
          this.triggerHotkeyFeedback('btn-img-rotate');
          ArtistToolbox.rotate90();
          break;
        default:
          this.handleKeyboard({ key: action, preventDefault() { }, stopPropagation() { } });
          break;
      }
    } else if (typeof action === 'object' && action.key) {
      this.handleKeyboard({
        key: action.key,
        shiftKey: !!action.shiftKey,
        ctrlKey: !!action.ctrlKey,
        metaKey: !!action.metaKey,
        preventDefault() { },
        stopPropagation() { }
      });
    }
  },

  // ---- Wallpaper Modal Events ----
  bindWallpaperEvents() {
    const modal = document.getElementById('modal-wallpaper');
    const dropzone = document.getElementById('wallpaper-dropzone');
    const fileInput = document.getElementById('wallpaper-file-input');
    const blurSlider = document.getElementById('wallpaper-blur-slider');
    const dimSlider = document.getElementById('wallpaper-dim-slider');
    const blurVal = document.getElementById('wallpaper-blur-val');
    const dimVal = document.getElementById('wallpaper-dim-val');
    const removeBtn = document.getElementById('btn-remove-wallpaper');

    document.getElementById('btn-close-wallpaper').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('btn-close-wallpaper-x').addEventListener('click', () => modal.classList.add('hidden'));

    // File Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleWallpaperFileUpload(files[0]);
      }
    });

    // Choose file button
    const browseFileBtn = document.getElementById('btn-browse-wallpaper-file');
    if (browseFileBtn) {
      browseFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    // Paste image from clipboard
    modal.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              this.handleWallpaperFileUpload(file);
              return;
            }
          }
        }
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleWallpaperFileUpload(e.target.files[0]);
      }
    });


    // Sliders
    blurSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      blurVal.textContent = `${val}px`;
      WallpaperManager.setBlur(val);
    });

    dimSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      dimVal.textContent = `${val}%`;
      WallpaperManager.setDim(val);
    });

    removeBtn.addEventListener('click', () => {
      WallpaperManager.removeWallpaper();
    });
  },

  handleWallpaperFileUpload(file) {
    if (!file) return;
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg|bmp)$/i.test(file.name);
    if (!isImage) {
      this.showToast('Please select an image file (PNG, JPG, WEBP, etc.)', 'alert');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      WallpaperManager.setCustomWallpaper(e.target.result);
    };
    reader.onerror = () => {
      this.showToast('Failed to load image file', 'x-circle');
    };
    reader.readAsDataURL(file);
  },

  openWallpaperModal() {
    this.updateWallpaperModalUI();
    document.getElementById('modal-wallpaper').classList.remove('hidden');
  },

  updateWallpaperModalUI() {
    const settings = WallpaperManager.settings;
    const blurSlider = document.getElementById('wallpaper-blur-slider');
    const dimSlider = document.getElementById('wallpaper-dim-slider');
    const blurVal = document.getElementById('wallpaper-blur-val');
    const dimVal = document.getElementById('wallpaper-dim-val');
    const statusText = document.getElementById('wallpaper-status-text');
    const thumb = document.getElementById('wallpaper-preview-thumb');
    const removeBtn = document.getElementById('btn-remove-wallpaper');

    blurSlider.value = settings.blur;
    blurVal.textContent = `${settings.blur}px`;
    dimSlider.value = settings.dim;
    dimVal.textContent = `${settings.dim}%`;

    if (WallpaperManager.currentWallpaperDataUrl && settings.hasCustom) {
      statusText.textContent = 'Custom Wallpaper Active';
      thumb.style.backgroundImage = `url("${WallpaperManager.currentWallpaperDataUrl}")`;
      removeBtn.classList.remove('hidden');
    } else {
      statusText.textContent = 'No custom wallpaper set (Default Studio Dark)';
      thumb.style.backgroundImage = 'none';
      removeBtn.classList.add('hidden');
    }
  },

  // ---- Backup & Restore ----
  bindBackupEvents() {
    const modal = document.getElementById('modal-backup');
    const exportBtn = document.getElementById('btn-export-data');
    const importBtn = document.getElementById('btn-import-data');
    const fileInput = document.getElementById('backup-file-input');
    const statusEl = document.getElementById('backup-status');

    document.getElementById('btn-close-backup').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('btn-close-backup-x').addEventListener('click', () => modal.classList.add('hidden'));

    exportBtn.addEventListener('click', () => {
      const backupData = {
        version: 1,
        timestamp: new Date().toISOString(),
        decks: DeckManager.getAll(),
        cards: CardManager.cards,
        history: ReviewHistory.history,
        wallpaperSettings: Storage.getWallpaperSettings()
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `art-practice-backup-${localDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      statusEl.textContent = 'Backup file downloaded successfully!';
    });

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = JSON.parse(evt.target.result);

          // 1. Validate shape: decks must be array, cards must be object
          if (!data || !Array.isArray(data.decks) || typeof data.cards !== 'object' || data.cards === null) {
            throw new Error('Invalid backup file shape: must contain a "decks" array and a "cards" object.');
          }

          // Validate sketch URLs in backup: reject malicious schemes like javascript:, and drop invalid sketch URLs
          for (const deckId of Object.keys(data.cards)) {
            const deckCards = data.cards[deckId];
            if (deckCards && typeof deckCards === 'object') {
              for (const cardId of Object.keys(deckCards)) {
                const card = deckCards[cardId];
                if (card && Array.isArray(card.attempts)) {
                  for (const att of card.attempts) {
                    if (att && att.sketchUrl) {
                      const sUrl = String(att.sketchUrl).trim().toLowerCase();
                      if (sUrl.startsWith('javascript:') || sUrl.startsWith('vbscript:') || sUrl.startsWith('data:text/html')) {
                        throw new Error('Rejected: backup contains disallowed sketchUrl scheme.');
                      }
                      if (!isValidSketchUrl(att.sketchUrl)) {
                        delete att.sketchUrl;
                      }
                    }
                  }
                }
              }
            }
          }

          // 2. Count current vs incoming decks/cards and prompt confirmation
          const currentDecks = Storage.getDecks();
          const currentCards = Storage.getCards();
          const currentDeckCount = currentDecks.length;
          const currentCardCount = Object.values(currentCards).reduce((acc, d) => acc + Object.keys(d || {}).length, 0);

          const incomingDeckCount = data.decks.length;
          const incomingCardCount = Object.values(data.cards).reduce((acc, d) => acc + Object.keys(d || {}).length, 0);

          const confirmMsg = `Restore backup?\n\nThis will replace your current ${currentDeckCount} deck(s) and ${currentCardCount} card(s) with ${incomingDeckCount} deck(s) and ${incomingCardCount} card(s).\n\nAre you sure you want to proceed?`;
          const confirmed = (typeof window.confirm === 'function') ? window.confirm(confirmMsg) : true;
          if (!confirmed) {
            statusEl.textContent = 'Import canceled.';
            return;
          }

          // 3. Call POST /api/sync with confirmReplace: true
          const payload = {
            decks: data.decks,
            cards: data.cards,
            history: data.history && typeof data.history === 'object' ? data.history : {},
            wallpaperSettings: data.wallpaperSettings || null,
            confirmReplace: true
          };

          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          }

          const syncResult = await res.json();
          Storage._decks = data.decks;
          Storage._cards = data.cards;
          Storage._history = payload.history;
          if (data.wallpaperSettings) Storage._wallpaperSettings = data.wallpaperSettings;
          Storage._lastSyncedTime = syncResult.lastSaved;
          Storage._isDiskLoaded = true;
          Storage._mirrorToLocalStorage();

          DeckManager.init();
          CardManager.init();
          ReviewHistory.init();

          statusEl.textContent = 'Progress restored successfully!';
          this.showToast('Data restored successfully', 'save');
          setTimeout(() => {
            modal.classList.add('hidden');
            this.showDeckList();
          }, 1000);
        } catch (err) {
          statusEl.textContent = `Error restoring file: ${err.message}`;
          this.showToast(`Import error: ${err.message}`, 'alert');
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  },

  openBackupModal() {
    document.getElementById('backup-status').textContent = '';
    document.getElementById('modal-backup').classList.remove('hidden');
  },

  // ---- Shortcuts Modal ----
  openShortcutsModal() {
    document.getElementById('modal-shortcuts').classList.remove('hidden');
  },

  closeShortcutsModal() {
    document.getElementById('modal-shortcuts').classList.add('hidden');
  },

  triggerHotkeyFeedback(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('btn-hotkey-press');
    setTimeout(() => el.classList.remove('btn-hotkey-press'), 180);
  },

  // ---- Keyboard Shortcuts ----
  handleKeyboard(e) {
    // 1. Focus guard: If typing in an input/textarea/select, ignore hotkeys
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    // 2. Active FlashRecallManager BLIND_DRAW veil protections & phase routing
    const drillMgr = (typeof FlashRecallManager !== 'undefined') ? FlashRecallManager : ((typeof MemoryDrillManager !== 'undefined') ? MemoryDrillManager : null);
    const isBlindDrawVeilActive = Boolean(drillMgr && (drillMgr.phase === 'draw' || drillMgr.phase === 'blind_draw' || drillMgr.isVeiled));
    if (isBlindDrawVeilActive) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof drillMgr.transitionToReveal === 'function') drillMgr.transitionToReveal();
        return;
      }
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHotkeyFeedback('btn-skip');
        this.showNextImage();
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (drillMgr && drillMgr.enabled && drillMgr.phase === 'observe') {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof drillMgr.transitionToDraw === 'function') drillMgr.transitionToDraw();
        return;
      }
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHotkeyFeedback('btn-skip');
        this.showNextImage();
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 3. Extension shortcuts routed through central keydown listener
    if (typeof ExtensionHost !== 'undefined' && ExtensionHost.handleKeyboard && ExtensionHost.handleKeyboard(e)) {
      return;
    }

    // 4. Core single-key hotkey modifier guard (ignore Cmd/Ctrl/Alt combinations for standard atelier shortcuts)
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // Session view check for context-sensitive hotkeys
    const sessionView = document.getElementById('view-session');
    const inSession = sessionView && sessionView.classList.contains('active');

    // Plumb Tool hotkey (U) during session; Sound toggle (U) outside session
    if (e.key.toLowerCase() === 'u') {
      if (inSession) {
        if (typeof PlumbTool !== 'undefined') {
          this.triggerHotkeyFeedback('btn-art-plumb');
          PlumbTool.handleHotkey();
          return;
        }
      } else {
        SoundFX.toggle();
        return;
      }
    }

    // Help modal toggle (?)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      const modal = document.getElementById('modal-shortcuts');
      modal.classList.toggle('hidden');
      return;
    }

    // Escape closes open modals first, otherwise crop overlay, plumb lines, sketch align mode, palette hud, tag dock, fullscreen zen or PiP
    if (e.key === 'Escape') {
      const opacityHud = document.getElementById('opacity-hud');
      if (opacityHud && !opacityHud.classList.contains('hidden')) {
        this.hideOpacityHUD();
        return;
      }
      if (typeof SmartCropManager !== 'undefined' && SmartCropManager.isCropping) {
        SmartCropManager.cancelCrop();
        return;
      }
      if (typeof PlumbTool !== 'undefined' && (PlumbTool.isActive || PlumbTool.lines.length > 0)) {
        PlumbTool.clearLines();
        PlumbTool.toggleMode(false);
        return;
      }
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.isAlignMode) {
        SketchOverlay.toggleAlignMode(false);
        return;
      }
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.dockVisible) {
        SketchOverlay.toggleDock(false);
        return;
      }
      if (typeof ColorPaletteManager !== 'undefined' && ColorPaletteManager.hudOpen) {
        ColorPaletteManager.toggleHUD(false);
        return;
      }
      if (this.isTagDockOpen) {
        this.toggleTagDock(false);
        return;
      }
      const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
      if (openModals.length > 0) {
        openModals.forEach(m => m.classList.add('hidden'));
        return;
      }
      if (this.isPiPActive) {
        this.closePiP(true);
        return;
      }
      if (this.isZenMode) {
        this.toggleZenMode(false);
        return;
      }
      if (inSession && (this.sessionSource === 'board' || this.isBoardStageOpen)) {
        this.closeBoardStage();
        return;
      }
      return;
    }

    // Hotkeys active inside session view
    if (!inSession) return;

    // Board Stage Mode Navigation: ArrowLeft / ArrowRight / J
    if (this.sessionSource === 'board' || this.isBoardStageOpen) {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        this.stepBoardReference('prev');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepBoardReference('next');
        return;
      }
    }

    // Quick Tagging Mode: when dock is open, 1-6 toggle presets, T closes dock
    if (this.isTagDockOpen) {
      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        e.preventDefault();
        const preset = TAG_PRESETS.find(p => p.key === e.key);
        if (preset) {
          this.toggleCardTag(preset.id);
        }
        return;
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.toggleTagDock(false);
        return;
      }
    }

    // Hotkey T: open Tag Dock
    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      this.toggleTagDock(true);
      return;
    }

    switch (e.key.toLowerCase()) {
      case '1':
        if (this.sessionSource === 'board' || this.isBoardStageOpen) break;
        this.triggerHotkeyFeedback('btn-rate-again');
        this.rateCurrentImage('again');
        break;
      case '2':
        if (this.sessionSource === 'board' || this.isBoardStageOpen) break;
        if (this.isPiPActive) break;
        this.triggerHotkeyFeedback('btn-rate-hard');
        this.rateCurrentImage('hard');
        break;
      case '3':
        if (this.sessionSource === 'board' || this.isBoardStageOpen) break;
        if (this.isPiPActive) break;
        this.triggerHotkeyFeedback('btn-rate-medium');
        this.rateCurrentImage('medium');
        break;
      case '4':
        if (this.sessionSource === 'board' || this.isBoardStageOpen) break;
        if (this.isPiPActive) break;
        this.triggerHotkeyFeedback('btn-rate-easy');
        this.rateCurrentImage('easy');
        break;
      case 's':
        if (e.shiftKey || this.imageBlurred) {
          if (this.sessionSource === 'board' || this.isBoardStageOpen) {
            this.stepBoardReference('next');
            break;
          }
          this.triggerHotkeyFeedback('btn-skip');
          this.showNextImage();
        } else {
          this.triggerHotkeyFeedback('btn-art-squint');
          ArtistToolbox.toggleSquint();
        }
        break;
      case ' ':
        e.preventDefault();
        if (this.sessionSource === 'board' || this.isBoardStageOpen) {
          this.toggleBoardSlideshowPause();
          break;
        }
        this.triggerHotkeyFeedback('btn-timer-pause');
        this.toggleTimerPause();
        break;
      case 'g':
        this.triggerHotkeyFeedback('btn-art-grayscale');
        ArtistToolbox.toggleGrayscale();
        break;
      case 'n':
        this.triggerHotkeyFeedback('btn-art-notan');
        ArtistToolbox.toggleNotan();
        break;
      case 'l':
      case 'h':
        this.triggerHotkeyFeedback('btn-art-silhouette');
        ArtistToolbox.toggleSilhouette();
        break;
      case 'p':
        this.triggerHotkeyFeedback('btn-art-posterize');
        ArtistToolbox.togglePosterize();
        break;
      case '[':
        if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.isAlignMode) {
          SketchOverlay.adjustRotate(-0.5);
        } else if (ArtistToolbox.squint) {
          ArtistToolbox.adjustSquintRadius(-1);
        } else if (ArtistToolbox.silhouette) {
          ArtistToolbox.adjustSilhouetteThreshold(-0.05);
        } else if (ArtistToolbox.posterize) {
          ArtistToolbox.adjustPosterizeSteps(-1);
        }
        break;
      case ']':
        if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.isAlignMode) {
          SketchOverlay.adjustRotate(0.5);
        } else if (ArtistToolbox.squint) {
          ArtistToolbox.adjustSquintRadius(1);
        } else if (ArtistToolbox.silhouette) {
          ArtistToolbox.adjustSilhouetteThreshold(0.05);
        } else if (ArtistToolbox.posterize) {
          ArtistToolbox.adjustPosterizeSteps(1);
        }
        break;
      case 'o':
        this.triggerHotkeyFeedback('btn-art-grid');
        ArtistToolbox.toggleGrid();
        break;
      case 'i':
        this.triggerHotkeyFeedback('btn-art-invert');
        ArtistToolbox.toggleInvert();
        break;
      case 'm':
        this.triggerHotkeyFeedback('btn-img-flip');
        ArtistToolbox.flipHorizontal();
        break;
      case 'r':
        this.triggerHotkeyFeedback('btn-img-rotate');
        ArtistToolbox.rotate90();
        break;
      case '+':
      case '=':
        this.triggerHotkeyFeedback('btn-img-zoom-in');
        ArtistToolbox.adjustZoom(0.25);
        break;
      case '-':
      case '_':
        this.triggerHotkeyFeedback('btn-img-zoom-out');
        ArtistToolbox.adjustZoom(-0.25);
        break;
      case '0':
        this.triggerHotkeyFeedback('btn-img-zoom-reset');
        ArtistToolbox.resetZoomPan();
        break;
      case 'f':
        this.triggerHotkeyFeedback('btn-session-zen');
        this.toggleZenMode();
        break;
      case 'v':
      case 'w':
        this.triggerHotkeyFeedback('btn-session-pip');
        this.togglePiP();
        break;
      case 'u':
        if (typeof PlumbTool !== 'undefined') {
          this.triggerHotkeyFeedback('btn-art-plumb');
          PlumbTool.handleHotkey();
        }
        break;
      case 'a':
        if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active) {
          this.triggerHotkeyFeedback('btn-sketch-align-toggle');
          SketchOverlay.toggleAlignMode();
        }
        break;
      case 'k':
        if (typeof SketchOverlay !== 'undefined') {
          this.triggerHotkeyFeedback('btn-art-sketch');
          if (e.shiftKey) {
            SketchOverlay.toggleDock();
          } else if (SketchOverlay.active) {
            SketchOverlay.toggleVisibility();
          } else {
            SketchOverlay.promptPasteOrUpload();
          }
        }
        break;
      case 'y':
        if (typeof SketchComparison !== 'undefined') {
          this.triggerHotkeyFeedback('btn-art-history');
          SketchComparison.toggleSplitView();
        }
        break;
      case 'e':
        if (typeof ColorPaletteManager !== 'undefined') {
          this.triggerHotkeyFeedback('btn-art-palette');
          if (e.shiftKey) {
            ColorPaletteManager.toggleMinimize();
          } else {
            ColorPaletteManager.toggleHUD();
          }
        }
        break;
      case 'c':
        if (e.shiftKey) {
          if (typeof SmartCropManager !== 'undefined') {
            SmartCropManager.toggleFocalContext();
          }
        } else {
          if (typeof SmartCropManager !== 'undefined') {
            this.triggerHotkeyFeedback('btn-art-crop');
            SmartCropManager.startCrop();
          }
        }
        break;
    }
  },

  // ---- Zen / True Fullscreen Mode ----
  // Zen = edge-to-edge reference with controls that fade away while you draw.
  // Where the browser allows it we also request real fullscreen so the OS chrome disappears too.
  toggleZenMode(forceState = null) {
    const next = forceState !== null ? forceState : !this.isZenMode;
    if (next === this.isZenMode) return;
    this.setZenMode(next);
  },

  setZenMode(on, fromBrowser = false) {
    // Zen mode is strictly for study sessions. Never activate Zen mode outside of an active session.
    const inSession = document.body.classList.contains('in-session') ||
      (document.getElementById('view-session') && document.getElementById('view-session').classList.contains('active'));
    if (on && !inSession) {
      return;
    }

    this.isZenMode = on;
    document.body.classList.toggle('zen-active', on);
    document.body.classList.remove('hud-idle');

    const zenIcon = document.getElementById('session-zen-icon');
    const zenText = document.getElementById('session-zen-text');
    const hudIcon = document.getElementById('hud-fs-icon');
    if (zenIcon) zenIcon.innerHTML = this.getIconSvg(on ? 'fullscreen-exit' : 'fullscreen', 14);
    if (zenText) zenText.textContent = on ? 'Exit' : 'Fullscreen';
    if (hudIcon) hudIcon.innerHTML = this.getIconSvg(on ? 'fullscreen-exit' : 'fullscreen', 14);

    if (!fromBrowser) {
      if (on) this._enterNativeFullscreen();
      else this._exitNativeFullscreen();
    }

    this.wakeHud();

    // The stage just changed size — refit now and again once the browser finishes resizing
    ArtistToolbox.fitImage(false);
    requestAnimationFrame(() => ArtistToolbox.fitImage(false));
    setTimeout(() => ArtistToolbox.fitImage(false), 200);
    setTimeout(() => ArtistToolbox.fitImage(false), 500);
  },

  _enterNativeFullscreen() {
    if (window.electronAPI && typeof window.electronAPI.setFullScreen === 'function') {
      window.electronAPI.setFullScreen(true).catch(() => { });
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return; // unsupported: the CSS zen layout still gives an edge-to-edge view
    try {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch (err) { }
  },

  _exitNativeFullscreen() {
    if (window.electronAPI && typeof window.electronAPI.setFullScreen === 'function') {
      window.electronAPI.setFullScreen(false).catch(() => { });
    }
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit) return;
    try {
      const p = exit.call(document);
      if (p && typeof p.catch === 'function') p.catch(() => { });
    } catch (err) { }
  },

  bindFullscreenEvents() {
    // Esc (or the browser UI) can leave fullscreen without our keydown handler ever firing
    const onFullscreenChange = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!inFs && this.isZenMode && this._wasNativeFs) {
        this.setZenMode(false, true);
      }
      this._wasNativeFs = inFs;
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // Sync native Electron fullscreen changes (e.g. macOS green button, Cmd+Ctrl+F, Esc)
    if (window.electronAPI && typeof window.electronAPI.onFullscreenChange === 'function') {
      window.electronAPI.onFullscreenChange((inFs) => {
        if (!inFs && this.isZenMode) {
          this.setZenMode(false, true);
        }
        if (typeof ArtistToolbox !== 'undefined' && typeof ArtistToolbox.fitImage === 'function') {
          ArtistToolbox.fitImage(false);
        }
      });
    }

    // Controls reappear on any movement/keypress and fade after a short idle
    document.addEventListener('mousemove', (e) => {
      this._overHud = !!(e.target.closest && e.target.closest('.session-header, .rating-area, .image-toolbar, .timer-controls, .image-hud-dock, .filter-controls-dock'));
      if (this.isZenMode) this.wakeHud();
    }, { passive: true });
    document.addEventListener('keydown', () => {
      if (this.isZenMode) this.wakeHud();
    });
  },

  wakeHud() {
    document.body.classList.remove('hud-idle');
    clearTimeout(this._hudTimer);
    if (!this.isZenMode) return;
    this._hudTimer = setTimeout(() => this._maybeHideHud(), 2400);
  },

  _maybeHideHud() {
    if (!this.isZenMode) return;
    const modalOpen = document.querySelector('.modal-overlay:not(.hidden)');
    if (this._overHud || modalOpen) {
      this._hudTimer = setTimeout(() => this._maybeHideHud(), 1200);
      return;
    }
    document.body.classList.add('hud-idle');
  },

  toggleToolDock(force) {
    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }

    docs.forEach(d => {
      const dock = d.getElementById('image-hud-dock');
      const toggleBtn = d.getElementById('btn-dock-toggle');
      if (!dock) return;

      const isOpen = typeof force === 'boolean' ? force : !dock.classList.contains('dock-open');
      dock.classList.toggle('dock-open', isOpen);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        toggleBtn.title = isOpen ? 'Hide Artist Tools' : 'Open Artist Tools';
      }
    });
  },

  toggleRatingDock(force) {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    if (this.isElectronFloating || this.isPiPActive || document.body.classList.contains('pip-mode') || document.body.classList.contains('electron-float-active')) {
      return;
    }
    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }

    docs.forEach(d => {
      const ratingArea = d.getElementById('session-rating-area');
      const toggleBtn = d.getElementById('btn-rating-toggle');
      if (!ratingArea) return;

      const isOpen = typeof force === 'boolean' ? force : !ratingArea.classList.contains('rating-open');
      ratingArea.classList.toggle('rating-open', isOpen);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        const label = toggleBtn.querySelector('.rating-toggle-label');
        if (label) label.textContent = isOpen ? 'Hide' : 'Rate';
        toggleBtn.title = isOpen ? 'Hide Rating Dock' : 'Open Rating Dock [1-4]';
      }
    });
  },

  setToolCategory(cat) {
    if (!cat) return;
    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }

    docs.forEach(d => {
      const toolbar = d.getElementById('session-image-toolbar');
      if (toolbar) {
        toolbar.dataset.activeCat = cat;
      }
      d.querySelectorAll('.dock-cat-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === cat);
      });
    });

    try {
      localStorage.setItem('art_practice_tool_cat', cat);
    } catch (e) { }

    this.updateCategoryIndicators();
  },

  updateCategoryIndicators() {
    const tonalActive = Boolean(
      (window.ArtistToolbox && (ArtistToolbox.grayscale || ArtistToolbox.notan || ArtistToolbox.silhouette || ArtistToolbox.posterize || ArtistToolbox.squint || ArtistToolbox.invert))
    );
    const critiqueActive = Boolean(
      (window.SketchOverlay && SketchOverlay.active) ||
      (window.SmartCropManager && SmartCropManager.isCropping) ||
      (window.ColorPaletteManager && ColorPaletteManager.isOpen)
    );
    const canvasActive = Boolean(
      (window.ArtistToolbox && (ArtistToolbox.grid || ArtistToolbox.flipX !== 1 || ArtistToolbox.rotate !== 0 || ArtistToolbox.zoom !== 1)) ||
      (window.PlumbTool && PlumbTool.isActive)
    );

    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }

    docs.forEach(d => {
      const tonalTab = d.querySelector('.dock-cat-tab[data-cat="tonal"] .cat-indicator-dot');
      if (tonalTab) tonalTab.classList.toggle('hidden', !tonalActive);

      const critiqueTab = d.querySelector('.dock-cat-tab[data-cat="critique"] .cat-indicator-dot');
      if (critiqueTab) critiqueTab.classList.toggle('hidden', !critiqueActive);

      const canvasTab = d.querySelector('.dock-cat-tab[data-cat="canvas"] .cat-indicator-dot');
      if (canvasTab) canvasTab.classList.toggle('hidden', !canvasActive);
    });
  },

  // macOS Studio Dock: click arrow tab to bring up tools/rating; click outside or toggle tab to close
  bindSideDockEdgeAutoReveal(doc = document) {
    const dock = doc.getElementById('image-hud-dock');
    const toggleBtn = doc.getElementById('btn-dock-toggle');
    const ratingToggleBtn = doc.getElementById('btn-rating-toggle');

    // Tool Dock Arrow toggle tab click
    if (toggleBtn && !toggleBtn._hasDockClickListener) {
      toggleBtn._hasDockClickListener = true;
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleToolDock();
      });
    }

    // Rating Dock Arrow toggle tab click
    if (ratingToggleBtn && !ratingToggleBtn._hasRatingClickListener) {
      ratingToggleBtn._hasRatingClickListener = true;
      ratingToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleRatingDock();
      });
    }

    // Category switcher tabs click
    doc.querySelectorAll('.dock-cat-tab').forEach(tab => {
      if (!tab._hasCatClickListener) {
        tab._hasCatClickListener = true;
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setToolCategory(tab.dataset.cat);
        });
      }
    });

    // Restore saved category preference
    try {
      const savedCat = localStorage.getItem('art_practice_tool_cat') || 'all';
      this.setToolCategory(savedCat);
    } catch (e) { }

    // Click outside to collapse tool dock or rating dock if open
    doc.addEventListener('click', (e) => {
      // 1. Tool dock outside click
      const currentDock = doc.getElementById('image-hud-dock');
      if (currentDock && currentDock.classList.contains('dock-open')) {
        if (!currentDock.contains(e.target) &&
          !e.target.closest('.modal-overlay') &&
          !e.target.closest('.session-header') &&
          !e.target.closest('.crop-popover') &&
          !(window.ArtistToolbox && ArtistToolbox.isDragging)) {
          this.toggleToolDock(false);
        }
      }

      // 2. Rating dock outside click
      const currentRating = doc.getElementById('session-rating-area');
      if (currentRating && currentRating.classList.contains('rating-open')) {
        if (!currentRating.contains(e.target) &&
          !e.target.closest('.modal-overlay') &&
          !e.target.closest('.session-header') &&
          !document.body.classList.contains('rating-required')) {
          this.toggleRatingDock(false);
        }
      }
    });

    // Close on Escape if dock or rating area is open and no modal is active
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modalOpen = doc.querySelector('.modal-overlay:not(.hidden)');
        if (!modalOpen) {
          const currentDock = doc.getElementById('image-hud-dock');
          if (currentDock && currentDock.classList.contains('dock-open')) {
            this.toggleToolDock(false);
          }
          const currentRating = doc.getElementById('session-rating-area');
          if (currentRating && currentRating.classList.contains('rating-open') && !document.body.classList.contains('rating-required')) {
            this.toggleRatingDock(false);
          }
        }
      }
    });
  },

  // ---- Always-on-Top Document Picture-in-Picture (PiP), Ghost Mode & Native Electron Float Mode ----
  isAlwaysOnTop: false,
  isGhostMode: false,

  setGhostModeState(active) {
    this.isGhostMode = !!active;
    document.body.classList.toggle('ghost-mode-active', this.isGhostMode);

    const banner = document.getElementById('ghost-mode-banner');
    if (banner) {
      banner.classList.toggle('hidden', !this.isGhostMode);
    }

    const ghostBtn = document.getElementById('btn-electron-ghost');
    if (ghostBtn) {
      ghostBtn.classList.toggle('active', this.isGhostMode);
    }

    if (this.isGhostMode) {
      this.showToast('Ghost Mode Active (Click-Through) [Cmd+Shift+G]', 'ghost');
    } else {
      this.showToast('Normal Interaction Restored', 'check');
    }
  },

  opacityHUDTimer: null,

  showOpacityHUD(opacity, isGhostMode) {
    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }

    const pct = Math.round((opacity || 1.0) * 100);

    docs.forEach(doc => {
      const hud = doc.getElementById('opacity-hud');
      const percentEl = doc.getElementById('opacity-hud-percent');
      const fillEl = doc.getElementById('opacity-hud-fill');
      if (!hud) return;

      if (percentEl) percentEl.textContent = `${pct}%`;
      if (fillEl) fillEl.style.width = `${pct}%`;

      hud.classList.remove('hidden', 'hud-fadeout');
    });

    if (this.opacityHUDTimer) {
      clearTimeout(this.opacityHUDTimer);
    }

    // Auto-hides after 1.2 seconds with no persistent buttons
    this.opacityHUDTimer = setTimeout(() => {
      this.hideOpacityHUD();
    }, 1200);
  },

  hideOpacityHUD() {
    if (this.opacityHUDTimer) {
      clearTimeout(this.opacityHUDTimer);
      this.opacityHUDTimer = null;
    }
    const docs = [document];
    if (this.pipWindow && !this.pipWindow.closed && this.pipWindow.document) {
      docs.push(this.pipWindow.document);
    }
    docs.forEach(doc => {
      const hud = doc.getElementById('opacity-hud');
      if (!hud || hud.classList.contains('hidden')) return;
      hud.classList.add('hud-fadeout');
      setTimeout(() => {
        if (hud.classList.contains('hud-fadeout')) {
          hud.classList.add('hidden');
          hud.classList.remove('hud-fadeout');
        }
      }, 220);
    });
  },

  async toggleGhostMode(targetState) {
    if (window.electronAPI && typeof window.electronAPI.toggleGhostMode === 'function') {
      try {
        const flag = typeof targetState === 'boolean' ? targetState : !this.isGhostMode;
        const res = await window.electronAPI.toggleGhostMode(flag);
        if (res && res.error) {
          this.showToast(typeof res.error === 'string' ? res.error : 'Could not toggle Ghost Mode', 'alert');
          return res;
        }
        if (res && typeof res.isGhostMode === 'boolean') {
          this.setGhostModeState(res.isGhostMode);
        }
        return res;
      } catch (err) {
        console.warn('Failed to toggle ghost mode via electronAPI:', err);
        this.showToast('Could not toggle Ghost Mode', 'alert');
      }
    }
  },

  setAlwaysOnTopState(active) {
    this.isAlwaysOnTop = !!active;
    const aotBtn = document.getElementById('btn-session-always-on-top');
    if (aotBtn) {
      aotBtn.classList.toggle('active', this.isAlwaysOnTop);
      aotBtn.title = this.isAlwaysOnTop ? 'Disable Always-on-Top' : 'Enable Always-on-Top';
    }
  },

  async toggleAlwaysOnTop(targetState) {
    if (window.electronAPI && typeof window.electronAPI.setAlwaysOnTop === 'function') {
      try {
        const flag = typeof targetState === 'boolean' ? targetState : !this.isAlwaysOnTop;
        const res = await window.electronAPI.setAlwaysOnTop(flag);
        if (res && res.error) {
          this.showToast(typeof res.error === 'string' ? res.error : 'Could not toggle Always-on-Top', 'alert');
          return res;
        }
        if (res && typeof res.isAlwaysOnTop === 'boolean') {
          this.setAlwaysOnTopState(res.isAlwaysOnTop);
        } else if (res && typeof res.alwaysOnTop === 'boolean') {
          this.setAlwaysOnTopState(res.alwaysOnTop);
        }
        return res;
      } catch (err) {
        console.warn('Failed to toggle always-on-top via electronAPI:', err);
        this.showToast('Could not toggle Always-on-Top', 'alert');
      }
    }
  },

  async checkElectronFloatStatus() {
    if (window.electronAPI && typeof window.electronAPI.getWindowState === 'function') {
      try {
        const data = await window.electronAPI.getWindowState();
        if (data && data.isElectron) {
          this.isElectron = true;
          document.body.classList.add('is-electron');
          if (this.isMac) document.body.classList.add('is-mac');
          if (data.floating) {
            this.setElectronFloatState(true);
          }
          if (typeof data.isAlwaysOnTop === 'boolean') {
            this.setAlwaysOnTopState(data.isAlwaysOnTop);
          }
          if (typeof data.isGhostMode === 'boolean') {
            this.setGhostModeState(data.isGhostMode);
          }
        }
      } catch (e) { }
    }
  },

  async enterElectronFloat() {
    if (window.electronAPI && typeof window.electronAPI.toggleFloatMode === 'function') {
      try {
        const res = await window.electronAPI.toggleFloatMode(true);
        if (!res || res.error) {
          this.showToast('Could not activate Always-on-Top float mode', 'alert');
          return;
        }
        const floating = typeof res.floating === 'boolean' ? res.floating : false;
        this.setElectronFloatState(floating);
        if (floating) {
          this.showToast('Always-on-Top Float Mode Active', 'pin');
        }
        return;
      } catch (err) {
        console.warn('Failed to enter float mode via electronAPI:', err);
        this.showToast('Could not activate Always-on-Top float mode', 'alert');
      }
    }
  },

  async exitElectronFloat() {
    if (this.isGhostMode) {
      await this.toggleGhostMode(false);
    }
    if (window.electronAPI && typeof window.electronAPI.toggleFloatMode === 'function') {
      try {
        const res = await window.electronAPI.toggleFloatMode(false);
        this.setElectronFloatState(res ? (res.floating || false) : false);
        return;
      } catch (err) {
        console.warn('Failed to exit float mode via electronAPI:', err);
        this.setElectronFloatState(false);
      }
    }
  },

  setElectronFloatState(active) {
    this.isElectronFloating = !!active;
    this.isPiPActive = !!active;

    const pipBtn = document.getElementById('btn-session-pip');
    const pipText = document.getElementById('session-pip-text');

    if (active) {
      document.body.classList.add('pip-mode', 'electron-float-active');
      const ratingArea = document.getElementById('session-rating-area');
      if (ratingArea) ratingArea.classList.remove('rating-open');
      if (pipBtn) {
        pipBtn.classList.add('active');
        pipBtn.title = 'Restore Full Studio Window [V]';
      }
      if (pipText) pipText.textContent = 'Full Window';

      setTimeout(() => {
        ArtistToolbox.fitImage(false);
      }, 100);
    } else {
      document.body.classList.remove('pip-mode', 'electron-float-active');
      if (pipBtn) {
        pipBtn.classList.remove('active');
        pipBtn.title = 'Always-on-Top Floating PiP Window (Draw over Photoshop / Blender) [V]';
      }
      if (pipText) pipText.textContent = 'Float PiP';

      setTimeout(() => {
        ArtistToolbox.fitImage(false);
      }, 100);
    }
  },

  async togglePiP() {
    if (this.isElectron) {
      if (this.isElectronFloating) {
        await this.exitElectronFloat();
      } else {
        await this.enterElectronFloat();
      }
      return;
    }

    if (this.isPiPActive) {
      this.closePiP(true);
    } else {
      await this.openPiP('auto');
    }
  },

  async openPiP(preferMode = 'auto') {
    const sessionView = document.getElementById('view-session');
    if (!sessionView || !sessionView.classList.contains('active')) {
      this.showToast('PiP mode is only available during an active study session', 'lightbulb');
      return;
    }

    if (this.isElectron) {
      await this.enterElectronFloat();
      return;
    }

    if (this.isPiPActive) return;

    // Feature detection: Document Picture-in-Picture API (Chromium browsers)
    const hasDocPiP = 'documentPictureInPicture' in window && typeof window.documentPictureInPicture.requestWindow === 'function';

    if (hasDocPiP && preferMode !== 'video' && preferMode !== 'popup') {
      // Chromium: Chrome / Edge / Arc / Brave (true OS floating + interactive DOM)
      await this._openDocumentPiP();
    } else if (preferMode === 'popup') {
      // User explicitly requested detachable popup window
      await this._openPopupPiP();
    } else {
      // Apple Safari / Firefox / default on non-DocPiP:
      // Use Native macOS Video PiP for 100% True Always-on-Top!
      const started = await PiPCanvasStreamer.start();
      if (started) {
        this.isPiPActive = true;
        this.isSafariVideoPiP = true;

        const workspace = document.getElementById('session-workspace');
        if (workspace) workspace.classList.add('hidden');
        const placeholder = document.getElementById('session-pip-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        this._updatePiPPlaceholder('video');

        const pipBtn = document.getElementById('btn-session-pip');
        if (pipBtn) pipBtn.classList.add('active');
      } else {
        // Fallback to popup window if video PiP was denied or unavailable
        await this._openPopupPiP();
      }
    }
  },

  async _openDocumentPiP() {
    try {
      const initialWidth = 540;
      const initialHeight = 640;
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: initialWidth,
        height: initialHeight
      });

      this._setupPiPWindow(pipWin, 'document');
      this._updatePiPPlaceholder('document');
    } catch (err) {
      console.error('Failed to open Document Picture-in-Picture:', err);
      // Fallback to video PiP or popup
      const started = await PiPCanvasStreamer.start();
      if (started) {
        this.isPiPActive = true;
        this.isSafariVideoPiP = true;
        const workspace = document.getElementById('session-workspace');
        if (workspace) workspace.classList.add('hidden');
        const placeholder = document.getElementById('session-pip-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
        this._updatePiPPlaceholder('video');
        const pipBtn = document.getElementById('btn-session-pip');
        if (pipBtn) pipBtn.classList.add('active');
      } else {
        await this._openPopupPiP();
      }
    }
  },

  async _openPopupPiP() {
    try {
      const initialWidth = 540;
      const initialHeight = 640;
      const left = Math.max(0, window.screen.availWidth - initialWidth - 30);
      const top = 60;
      const pipWin = window.open('', 'ArtistPracticePiP', `width=${initialWidth},height=${initialHeight},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`);
      if (!pipWin) {
        this.showToast('Popup blocked. Please allow popups for localhost.', 'alert');
        return;
      }

      this._setupPiPWindow(pipWin, 'popup');
      this._updatePiPPlaceholder('popup');
    } catch (err) {
      console.error('Failed to open popup window:', err);
      this.showToast('Could not open floating window', 'alert');
    }
  },

  _updatePiPPlaceholder(mode) {
    const title = document.getElementById('pip-placeholder-title');
    const desc = document.getElementById('pip-placeholder-desc');
    const switchBtn = document.getElementById('btn-pip-mode-switch');
    const tip = document.getElementById('pip-browser-tip');

    if (mode === 'video') {
      if (title) title.textContent = 'macOS Always-on-Top PiP Active';
      if (desc) desc.textContent = 'Your reference is pinned at the macOS system level — guaranteed to stay on top of Photoshop, Blender, and all apps.';
      if (switchBtn) {
        switchBtn.classList.remove('hidden');
        switchBtn.innerHTML = `<span>${this.getIconSvg('refresh', 13)}</span> Switch to Detached Window (Clickable Buttons)`;
      }
      if (tip) {
        tip.classList.remove('hidden');
        tip.innerHTML = `${this.getIconSvg('lightbulb', 14)} <strong>Pro Tip:</strong> For clickable buttons directly inside the floating window while staying always-on-top, open this in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Arc</strong> (which support Document PiP).`;
      }
    } else if (mode === 'document') {
      if (title) title.textContent = 'Interactive Always-on-Top PiP Active';
      if (desc) desc.textContent = 'Reference and tools are floating above your drawing canvas / Blender viewport.';
      if (switchBtn) switchBtn.classList.add('hidden');
      if (tip) {
        tip.classList.add('hidden');
        tip.textContent = '';
      }
    } else { // popup
      if (title) title.textContent = 'Detached Practice Window Active';
      if (desc) desc.textContent = 'Reference window is detached. (Note: standard Safari popup windows can be covered by other apps).';
      if (switchBtn) {
        switchBtn.classList.remove('hidden');
        switchBtn.innerHTML = `<span>${this.getIconSvg('refresh', 13)}</span> Switch to macOS Always-on-Top PiP`;
      }
      if (tip) {
        tip.classList.remove('hidden');
        tip.innerHTML = `${this.getIconSvg('sparkles', 14)} Click above to switch to <strong>macOS Always-on-Top PiP</strong> to keep the reference floating above Photoshop/Blender.`;
      }
    }
  },

  _setupPiPWindow(pipWin, mode) {
    this.pipWindow = pipWin;
    const pipDoc = pipWin.document;
    pipDoc.title = 'Floating Reference • ArtPractice';

    // Copy all stylesheets and style elements to the PiP window head
    try {
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pipDoc.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type || 'text/css';
          link.media = styleSheet.media?.mediaText || 'all';
          link.href = styleSheet.href;
          pipDoc.head.appendChild(link);
        }
      });
    } catch (err) {
      // Fallback clone all link/style nodes directly
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        pipDoc.head.appendChild(node.cloneNode(true));
      });
    }

    // Copy SVG filters so that GPU Notan, Silhouette, Posterize, and Tonal filters work
    const svgFilters = document.getElementById('svg-filters');
    if (svgFilters) {
      pipDoc.body.appendChild(svgFilters.cloneNode(true));
    }

    // Add pip-mode class to body
    pipDoc.body.classList.add('pip-mode');

    const ratingArea = pipDoc.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.remove('rating-open');

    // Get workspace BEFORE setting isPiPActive = true
    const workspace = document.getElementById('session-workspace');
    if (workspace) {
      pipDoc.body.appendChild(workspace);
    }

    // Activate PiP state
    PiPState.isActive = true;
    PiPState.window = pipWin;
    this.isPiPActive = true;

    // Show placeholder in the main session view
    const placeholder = document.getElementById('session-pip-placeholder');
    if (placeholder) {
      placeholder.classList.remove('hidden');
    }

    // Update button state in main header
    const pipBtn = document.getElementById('btn-session-pip');
    if (pipBtn) pipBtn.classList.add('active');

    // Re-fit image when PiP window is resized
    pipWin.addEventListener('resize', () => {
      ArtistToolbox.fitImage(false);
    });

    // Side tool dock auto-hide proximity (Mac dock behavior) inside PiP window
    this.bindSideDockEdgeAutoReveal(pipDoc);

    // Keyboard event forwarding inside the PiP window
    pipDoc.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // AudioContext unlock on interaction inside PiP window
    ['pointerdown', 'mousedown', 'keydown', 'click'].forEach(ev => {
      pipWin.addEventListener(ev, () => {
        const ctx = SoundFX._getCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume();
      }, { passive: true });
    });

    // Delegated Capture Click Handler for all PiP toolbar & rating actions
    pipDoc.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .btn, .btn-hud, .btn-rate');
      if (!btn) return;
      const id = btn.id;

      switch (id) {
        case 'btn-rate-again':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-rate-again');
          this.rateCurrentImage('again');
          break;
        case 'btn-rate-hard':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-rate-hard');
          this.rateCurrentImage('hard');
          break;
        case 'btn-rate-medium':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-rate-medium');
          this.rateCurrentImage('medium');
          break;
        case 'btn-rate-easy':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-rate-easy');
          this.rateCurrentImage('easy');
          break;
        case 'btn-skip':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-skip');
          this.showNextImage();
          break;
        case 'btn-timer-pause':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-timer-pause');
          this.toggleTimerPause();
          break;
        case 'btn-timer-reset':
          e.preventDefault();
          e.stopPropagation();
          this.resetTimer();
          break;
        case 'btn-art-grayscale':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-grayscale');
          ArtistToolbox.toggleGrayscale();
          break;
        case 'btn-art-notan':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-notan');
          ArtistToolbox.toggleNotan();
          break;
        case 'btn-art-silhouette':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-silhouette');
          ArtistToolbox.toggleSilhouette();
          break;
        case 'btn-art-posterize':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-posterize');
          ArtistToolbox.togglePosterize();
          break;
        case 'btn-art-squint':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-squint');
          ArtistToolbox.toggleSquint();
          break;
        case 'btn-art-grid':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-grid');
          ArtistToolbox.toggleGrid();
          break;
        case 'btn-art-invert':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-art-invert');
          ArtistToolbox.toggleInvert();
          break;
        case 'btn-img-flip':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-img-flip');
          ArtistToolbox.flipHorizontal();
          break;
        case 'btn-img-rotate':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-img-rotate');
          ArtistToolbox.rotate90();
          break;
        case 'btn-img-zoom-in':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-img-zoom-in');
          ArtistToolbox.adjustZoom(0.25);
          break;
        case 'btn-img-zoom-out':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-img-zoom-out');
          ArtistToolbox.adjustZoom(-0.25);
          break;
        case 'btn-img-zoom-reset':
          e.preventDefault();
          e.stopPropagation();
          this.triggerHotkeyFeedback('btn-img-zoom-reset');
          ArtistToolbox.resetZoomPan();
          break;
        case 'btn-silhouette-invert':
          e.preventDefault();
          e.stopPropagation();
          ArtistToolbox.toggleSilhouetteInvert();
          break;
        case 'btn-silhouette-reset':
          e.preventDefault();
          e.stopPropagation();
          ArtistToolbox.resetSilhouetteThreshold();
          break;
        case 'btn-posterize-preset-3':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.posterize) ArtistToolbox.togglePosterize();
          ArtistToolbox.setPosterizeSteps(3);
          break;
        case 'btn-posterize-preset-4':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.posterize) ArtistToolbox.togglePosterize();
          ArtistToolbox.setPosterizeSteps(4);
          break;
        case 'btn-squint-preset-light':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
          ArtistToolbox.setSquintRadius(3);
          break;
        case 'btn-squint-preset-medium':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
          ArtistToolbox.setSquintRadius(8);
          break;
        case 'btn-squint-preset-heavy':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
          ArtistToolbox.setSquintRadius(16);
          break;
        case 'btn-squint-reset':
          e.preventDefault();
          e.stopPropagation();
          if (!ArtistToolbox.squint) ArtistToolbox.toggleSquint();
          ArtistToolbox.setSquintRadius(6);
          break;
        case 'btn-art-sketch':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') {
            if (SketchOverlay.active) {
              if (!SketchOverlay.dockVisible) {
                SketchOverlay.toggleDock(true);
              } else {
                SketchOverlay.toggleVisibility();
              }
            } else {
              SketchOverlay.promptPasteOrUpload();
            }
          }
          break;
        case 'btn-sketch-hide-dock':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.toggleDock(false);
          break;
        case 'btn-sketch-min-dock':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.toggleMinimize();
          break;
        case 'btn-sketch-toggle-vis':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.toggleVisibility();
          break;
        case 'btn-sketch-clear':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.clear();
          break;
        case 'btn-sketch-fit-toggle':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.toggleFitMode();
          break;
        case 'btn-sketch-align-toggle':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.toggleAlignMode();
          break;
        case 'btn-sketch-align-reset':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.resetAlign();
          break;
        case 'btn-sketch-paste-new':
        case 'btn-blur-paste-sketch':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchOverlay !== 'undefined') SketchOverlay.promptPasteOrUpload();
          break;
        case 'btn-blur-unblur-peek':
          e.preventDefault();
          e.stopPropagation();
          this.clearBlurOverlay();
          break;
        case 'btn-art-history':
        case 'session-history-pill':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchComparison !== 'undefined') SketchComparison.toggleSplitView();
          break;
        case 'btn-toggle-split-view':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchComparison !== 'undefined') SketchComparison.setMode('split');
          break;
        case 'btn-toggle-overlay-view':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchComparison !== 'undefined') {
            SketchComparison.setMode('single');
            if (typeof SketchOverlay !== 'undefined' && SketchComparison.currentSketchDataUrl) {
              SketchOverlay.loadFromDataUrl(SketchComparison.currentSketchDataUrl);
            }
          }
          break;
        case 'btn-remove-rating-sketch':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchComparison !== 'undefined') SketchComparison.removeCurrentSketch();
          break;
        case 'btn-close-split-view':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SketchComparison !== 'undefined') SketchComparison.setMode('single');
          break;
        case 'btn-rating-attach-sketch':
        case 'btn-split-upload-sketch':
          e.preventDefault();
          e.stopPropagation();
          const fi = document.getElementById('sketch-file-input');
          if (fi) fi.click();
          break;
        case 'btn-art-palette':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.toggleHUD();
          break;
        case 'btn-close-palette-hud':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.toggleHUD(false);
          break;
        case 'btn-min-palette-hud':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.toggleMinimize();
          break;
        case 'btn-toggle-eyedropper':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.toggleEyedropper();
          break;
        case 'btn-copy-inspector-hex':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.copyActiveHex();
          break;
        case 'btn-clear-sampled-colors':
          e.preventDefault();
          e.stopPropagation();
          if (typeof ColorPaletteManager !== 'undefined') ColorPaletteManager.clearSampled();
          break;
        case 'btn-art-crop':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SmartCropManager !== 'undefined') SmartCropManager.startCrop();
          break;
        case 'btn-art-plumb':
          e.preventDefault();
          e.stopPropagation();
          if (typeof PlumbTool !== 'undefined') PlumbTool.handleHotkey();
          break;
        case 'btn-cancel-crop':
        case 'btn-cancel-crop-popover':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SmartCropManager !== 'undefined') SmartCropManager.cancelCrop();
          break;
        case 'btn-confirm-crop':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SmartCropManager !== 'undefined') SmartCropManager.confirmCrop();
          break;
        case 'session-focal-pill':
        case 'btn-toggle-crop-context':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SmartCropManager !== 'undefined') SmartCropManager.toggleFocalContext();
          break;
        case 'btn-remove-crop':
          e.preventDefault();
          e.stopPropagation();
          if (typeof SmartCropManager !== 'undefined') SmartCropManager.removeCrop();
          break;
      }

      if (btn.classList.contains('btn-blend-mode') && btn.dataset.blend) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof SketchOverlay !== 'undefined') SketchOverlay.setBlendMode(btn.dataset.blend);
      }
    }, true);

    // Slider input events inside PiP window
    pipDoc.addEventListener('input', (e) => {
      if (!e.target) return;
      if (e.target.id === 'slider-silhouette-threshold') {
        ArtistToolbox.setSilhouetteThreshold(e.target.value);
      } else if (e.target.id === 'slider-posterize-steps') {
        ArtistToolbox.setPosterizeSteps(e.target.value);
      } else if (e.target.id === 'slider-squint-radius') {
        ArtistToolbox.setSquintRadius(e.target.value);
      } else if (e.target.id === 'slider-sketch-opacity') {
        if (typeof SketchOverlay !== 'undefined') SketchOverlay.setOpacity(parseInt(e.target.value, 10) / 100);
      }
    }, true);

    // Paste event forwarding inside PiP window
    pipWin.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && typeof SketchOverlay !== 'undefined') {
            SketchOverlay.loadFromFile(file);
            return;
          }
        }
      }
    });

    // Setup Drag and Wheel inside PiP stage
    const pipStage = pipDoc.getElementById('image-stage');
    const pipFrame = pipDoc.getElementById('image-frame');
    if (pipStage) {
      pipStage._hasDragAndWheel = false;
      ArtistToolbox.setupDragAndWheel(pipStage, pipFrame);
    }

    // Handle close event when user closes the PiP window via native OS window controls
    pipWin.addEventListener('pagehide', () => {
      this.closePiP(false);
    });
    pipWin.addEventListener('unload', () => {
      this.closePiP(false);
    });

    // Refit image inside PiP stage once DOM settles
    setTimeout(() => {
      ArtistToolbox.fitImage(false);
    }, 60);
  },

  closePiP(closeWindow = true) {
    if (this.isElectronFloating) {
      this.exitElectronFloat();
      return;
    }

    if (!this.isPiPActive) return;

    // Handle macOS Video PiP
    if (this.isSafariVideoPiP) {
      this.isSafariVideoPiP = false;
      PiPCanvasStreamer.stop();
      const ws = document.getElementById('session-workspace');
      if (ws) ws.classList.remove('hidden');
      const placeholder = document.getElementById('session-pip-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      const pipBtn = document.getElementById('btn-session-pip');
      if (pipBtn) pipBtn.classList.remove('active');
      this.isPiPActive = false;
      return;
    }

    // Handle Document PiP or Popup PiP
    PiPState.isActive = false;
    PiPState.window = null;
    this.isPiPActive = false;

    const mainSessionView = document.getElementById('view-session');
    const placeholder = document.getElementById('session-pip-placeholder');
    const pipWin = this.pipWindow;

    if (pipWin) {
      try {
        const workspace = pipWin.document.getElementById('session-workspace');
        if (workspace && mainSessionView) {
          if (placeholder && placeholder.parentNode === mainSessionView) {
            mainSessionView.insertBefore(workspace, placeholder);
          } else {
            mainSessionView.appendChild(workspace);
          }
        }
      } catch (err) {
        console.warn('Error returning session workspace from PiP:', err);
      }
    }

    if (placeholder) {
      placeholder.classList.add('hidden');
    }

    const pipBtn = document.getElementById('btn-session-pip');
    if (pipBtn) pipBtn.classList.remove('active');

    if (closeWindow && pipWin && !pipWin.closed) {
      try {
        pipWin.close();
      } catch (e) { }
    }
    this.pipWindow = null;

    // Refit image in main container
    setTimeout(() => {
      ArtistToolbox.fitImage(false);
    }, 60);
  },

  // ---- View Switching ----
  showView(viewId) {
    if (viewId !== 'view-session' && this.isPiPActive) {
      this.closePiP(true);
    }
    if (viewId !== 'view-session' && this.isZenMode) {
      this.setZenMode(false);
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    document.body.classList.toggle('in-session', viewId === 'view-session');
  },

  // ---- Deck List View ----
  showDeckList() {
    if (this.boardState) {
      this.boardState.stopSlideshow();
      const select = document.getElementById('select-board-slide-interval');
      if (select) select.value = '0';
    }
    this.showView('view-deck-list');
    this.renderDeckList();
  },

  // ---- Home screen: daily overview strip ----
  _currentStreak() {
    const history = ReviewHistory.getGlobalHistory();
    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const ds = localDateStr(checkDate);
      if (history[ds] && history[ds] > 0) streak++;
      else if (i !== 0) break;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  },

  renderTodayStrip() {
    const allDecks = DeckManager.getAll();
    const todayStr = localDateStr();
    let totalDue = 0;
    allDecks.forEach(d => {
      const cards = CardManager.getCardsForDeck(d.id);
      totalDue += Object.values(cards).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;
    });
    const practiced = ReviewHistory.getGlobalHistory()[todayStr] || 0;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('today-due', totalDue);
    set('today-practiced', practiced);
    set('today-streak', this._currentStreak());
    set('today-decks', allDecks.length);

    const strip = document.getElementById('today-strip');
    if (strip) strip.classList.toggle('hidden', allDecks.length === 0);
  },

  // ---- Home screen: deck cover art & progress ----
  _deckCoverHTML(meta) {
    if (!meta || meta.loading) {
      return '<div class="deck-cover-empty shimmer"></div>';
    }
    if (meta.error || !meta.covers || meta.covers.length === 0) {
      return `<div class="deck-cover-empty"><span>${this.getIconSvg('palette', 28)}</span></div>`;
    }
    const imgs = meta.covers.map(id =>
      `<img src="${this._esc(`/api/image?path=${encodeURIComponent(id)}`)}" alt="" loading="lazy" decoding="async" draggable="false">`
    ).join('');
    return `<div class="cover-mosaic count-${meta.covers.length}">${imgs}</div>` +
      `<span class="deck-cover-chip">${meta.total} ${meta.total === 1 ? 'reference' : 'references'}</span>`;
  },

  _deckProgressHTML(reviewed, meta) {
    if (!meta || meta.loading || meta.error) {
      return `<div class="deck-progress-bar${meta && meta.error ? '' : ' loading'}"><span></span></div>` +
        `<div class="deck-progress-label"><span>${reviewed} studied</span></div>`;
    }
    const pct = meta.total > 0 ? Math.min(100, (reviewed / meta.total) * 100) : 0;
    return `<div class="deck-progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div>` +
      `<div class="deck-progress-label"><span>${reviewed} / ${meta.total} studied</span><span>${Math.round(pct)}%</span></div>`;
  },

  _patchDeckCard(deck) {
    const card = document.querySelector(`.deck-card[data-deck-id="${deck.id}"]`);
    if (!card) return;
    const meta = this.deckMeta[deck.folderPath];
    const reviewed = Object.values(CardManager.getCardsForDeck(deck.id)).filter(c => c && c.difficulty).length;
    const cover = card.querySelector('.deck-cover');
    const progress = card.querySelector('.deck-progress');
    if (cover) cover.innerHTML = this._deckCoverHTML(meta);
    if (progress) progress.innerHTML = this._deckProgressHTML(reviewed, meta);
  },

  async _loadDeckMeta(decks) {
    const pending = decks.filter(d => !this.deckMeta[d.folderPath]);
    await Promise.all(pending.map(async (d) => {
      this.deckMeta[d.folderPath] = { loading: true };
      try {
        const res = await fetch(`/api/deck-meta?folder=${encodeURIComponent(d.folderPath)}`);
        if (!res.ok) throw new Error('meta unavailable');
        this.deckMeta[d.folderPath] = await res.json();
      } catch (err) {
        this.deckMeta[d.folderPath] = { error: true };
      }
      this._patchDeckCard(d);
    }));
  },

  renderDeckList() {
    this.renderTodayStrip();
    let decks = DeckManager.getAll();
    const listEl = document.getElementById('deck-list');
    const emptyEl = document.getElementById('empty-state');

    // Filter by search query
    if (this.deckSearchQuery) {
      decks = decks.filter(d =>
        d.name.toLowerCase().includes(this.deckSearchQuery) ||
        d.folderPath.toLowerCase().includes(this.deckSearchQuery)
      );
    }

    // Sort decks
    const todayStr = localDateStr();
    decks.sort((a, b) => {
      const cardsA = CardManager.getCardsForDeck(a.id);
      const cardsB = CardManager.getCardsForDeck(b.id);
      const dueA = Object.values(cardsA).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;
      const dueB = Object.values(cardsB).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;

      switch (this.deckSortOrder) {
        case 'due-desc':
          return dueB - dueA;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'total-desc':
          return Object.values(cardsB).filter(c => c && c.difficulty).length - Object.values(cardsA).filter(c => c && c.difficulty).length;
        case 'newest':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        default:
          return 0;
      }
    });

    if (decks.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    listEl.innerHTML = decks.map(deck => {
      const deckCards = CardManager.getCardsForDeck(deck.id);
      const reviewed = Object.values(deckCards).filter(c => c && c.difficulty).length;
      const due = Object.values(deckCards).filter(c => c && c.difficulty && c.dueDate && localDateStr(c.dueDate) <= todayStr).length;
      const meta = this.deckMeta[deck.folderPath];

      return `
        <div class="deck-card${due > 0 ? ' has-due' : ''}" data-deck-id="${this._esc(deck.id)}">
          <div class="deck-cover">${this._deckCoverHTML(meta)}</div>
          <div class="deck-card-body">
            <div class="deck-card-name">${this._esc(deck.name)}</div>
            <div class="deck-card-path deck-path" title="${this._esc(deck.folderPath)}">${this._esc(this.formatShortPath(deck.folderPath))}</div>
            <div class="deck-progress">${this._deckProgressHTML(reviewed, meta)}</div>
            <div class="deck-card-stats">
              <span class="stat-pill reviewed-badge">${reviewed} mastered</span>
              ${due > 0 ? `<span class="stat-pill due-badge">${this.getDueSvgHTML(12)} ${due} due</span>` : '<span class="stat-pill">0 due</span>'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.deck-card').forEach(card => {
      this.applyCardTilt(card);
      card.addEventListener('click', () => {
        this.openDeckDetail(card.dataset.deckId);
      });
    });

    // Fetch cover art + totals for any deck we haven't seen yet (cached afterwards)
    this._loadDeckMeta(decks);
  },

  applyCardTilt(card) {
    let ticking = false;
    let rect = null;
    let mouseX = 0;
    let mouseY = 0;

    card.addEventListener('mouseenter', () => {
      SoundFX.hover();
      rect = card.getBoundingClientRect();
      card.style.transition = 'transform 0.1s ease-out, box-shadow 0.2s ease, border-color 0.2s ease';
    });

    card.addEventListener('mousemove', (e) => {
      if (!rect) rect = card.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;

      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          if (!rect) { ticking = false; return; }
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((mouseY - centerY) / centerY) * -6.5;
          const rotateY = ((mouseX - centerX) / centerX) * 6.5;

          card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px) scale3d(1.02, 1.02, 1.02)`;
          card.style.setProperty('--mouse-x', `${mouseX}px`);
          card.style.setProperty('--mouse-y', `${mouseY}px`);
          ticking = false;
        });
      }
    });

    card.addEventListener('mouseleave', () => {
      rect = null;
      card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease';
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)';
    });
  },

  // ---- Deck Detail View ----
  async openDeckDetail(deckId) {
    this.currentDeckId = deckId;
    this.selectedTagFilter = null; // Reset focus filter to All Cards
    const deck = DeckManager.getById(deckId);
    if (!deck) return;

    document.getElementById('deck-detail-name').textContent = deck.name;
    const clipInput = document.getElementById('input-clip-url');
    if (clipInput) clipInput.value = '';
    const clipStatus = document.getElementById('clip-status-msg');
    if (clipStatus) clipStatus.textContent = '';
    const detailPath = document.getElementById('deck-detail-path');
    if (detailPath) {
      detailPath.textContent = this.formatShortPath(deck.folderPath);
      detailPath.title = deck.folderPath;
    }
    const detailFolder = document.getElementById('deck-detail-folder');
    if (detailFolder) {
      detailFolder.textContent = this.formatShortPath(deck.folderPath);
      detailFolder.title = deck.folderPath;
    }

    this.showView('view-deck-detail');

    // Reset board state on deck change
    if (this.cachedImagesDeckId !== deckId) {
      if (typeof BoardManager !== 'undefined') {
        BoardManager.reset();
        this.boardState = BoardManager;
      } else {
        this.boardState = {
          activeDeckId: null,
          allReferences: [],
          searchQuery: '',
          selectedTag: null,
          selectedRef: null,
          currentIndex: -1,
          filteredReferences: [],
          gridScrollTop: 0
        };
      }
      const searchInput = document.getElementById('input-board-search');
      if (searchInput) searchInput.value = '';
    }

    // Load folder images
    try {
      this.cachedImages = await SessionManager.loadImages(deck.folderPath);
      this.cachedImagesDeckId = deckId;
      if (this.boardState) {
        this.boardState.activeDeckId = deckId;
        this.boardState.allReferences = this.cachedImages || [];
        if (!this.boardState.filteredReferences || this.boardState.filteredReferences.length === 0) {
          this.boardState.filteredReferences = [...(this.cachedImages || [])];
        }
      }
      // Automatically migrate legacy path cards to content-hash IDs
      CardManager.migrateLegacyPathCards(deckId, this.cachedImages);
    } catch (err) {
      this.cachedImages = [];
      this.cachedImagesDeckId = deckId;
      if (this.boardState) {
        this.boardState.activeDeckId = deckId;
        this.boardState.allReferences = [];
        this.boardState.filteredReferences = [];
      }
      this.showToast(`Folder load issue: ${err.message}`, 'alert');
    }

    this.renderDeckStats();
    this.renderDeckFocusTags();
    this.renderHeatmap();
    this.renderActivityStats();
    this.renderTodaysReviewedCount();
    this.updateFlashRecallUI();
    this.switchDeckTab(this.activeDeckTab || 'study');
  },

  // ---- Deck Detail Tab Switching (Study SRS vs. Reference Board) ----
  async switchDeckTab(tab) {
    // If leaving Reference Board tab, capture scroll position
    if (this.activeDeckTab === 'board' && tab !== 'board' && this.boardState) {
      const boardView = document.getElementById('deck-view-board');
      const grid = document.getElementById('board-gallery-grid');
      let currentScroll = 0;
      if (boardView && typeof boardView.scrollTop === 'number' && boardView.scrollTop > 0) {
        currentScroll = boardView.scrollTop;
      } else if (grid && typeof grid.scrollTop === 'number' && grid.scrollTop > 0) {
        currentScroll = grid.scrollTop;
      } else if (typeof window !== 'undefined' && typeof window.scrollY === 'number' && window.scrollY > 0) {
        currentScroll = window.scrollY;
      }
      if (currentScroll > 0 || typeof this.boardState.gridScrollTop !== 'number') {
        this.boardState.gridScrollTop = currentScroll;
      }
    }

    this.activeDeckTab = tab === 'board' ? 'board' : 'study';
    const isStudy = this.activeDeckTab === 'study';

    if (isStudy && this.boardState) {
      this.boardState.stopSlideshow();
      const select = document.getElementById('select-board-slide-interval');
      if (select) select.value = '0';
    }

    const btnStudy = document.getElementById('tab-btn-study');
    const btnBoard = document.getElementById('tab-btn-board');
    const viewStudy = document.getElementById('deck-view-study');
    const viewBoard = document.getElementById('deck-view-board');

    if (btnStudy) {
      btnStudy.classList.toggle('active', isStudy);
      btnStudy.setAttribute('aria-selected', String(isStudy));
    }
    if (btnBoard) {
      btnBoard.classList.toggle('active', !isStudy);
      btnBoard.setAttribute('aria-selected', String(!isStudy));
    }
    if (viewStudy) {
      viewStudy.classList.toggle('hidden', !isStudy);
    }
    if (viewBoard) {
      viewBoard.classList.toggle('hidden', isStudy);
    }

    if (!isStudy) {
      if (typeof FlashRecallManager !== 'undefined') {
        FlashRecallManager.reset();
      }
      this.clearBlurOverlay(true);
      TimerManager.stop();
      await this.loadBoardImagesIfNeeded();

      // Synchronize search input from boardState.searchQuery
      const searchInput = document.getElementById('input-board-search');
      if (searchInput && this.boardState) {
        searchInput.value = this.boardState.searchQuery || '';
      }

      this.applyBoardFilters();
      this.renderBoardTags();
      this.renderBoardGrid();

      // Apply saved grid size (small, medium, large)
      const savedGridSize = (this.boardState && this.boardState.gridSize)
        || (() => { try { return localStorage.getItem('board_grid_size'); } catch (e) { return null; } })()
        || 'medium';
      this.setBoardGridSize(savedGridSize);

      // Restore scroll position
      const savedTop = (this.boardState && typeof this.boardState.gridScrollTop === 'number')
        ? this.boardState.gridScrollTop
        : 0;
      if (viewBoard && typeof viewBoard.scrollTop === 'number') {
        viewBoard.scrollTop = savedTop;
      }
      const grid = document.getElementById('board-gallery-grid');
      if (grid && typeof grid.scrollTop === 'number') {
        grid.scrollTop = savedTop;
      }
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function' && savedTop > 0) {
        try { window.scrollTo(0, savedTop); } catch (e) { }
      }
    } else {
      this.updateFlashRecallUI();
    }
  },

  async loadBoardImagesIfNeeded() {
    if (this.cachedImages && this.cachedImagesDeckId === this.currentDeckId) {
      if (this.boardState) {
        this.boardState.activeDeckId = this.currentDeckId;
        this.boardState.allReferences = this.cachedImages || [];
      }
      return this.cachedImages;
    }
    const deck = DeckManager.getById(this.currentDeckId);
    if (!deck || !deck.folderPath) {
      this.cachedImages = [];
      this.cachedImagesDeckId = this.currentDeckId;
      if (this.boardState) {
        this.boardState.activeDeckId = this.currentDeckId;
        this.boardState.allReferences = [];
      }
      return [];
    }
    try {
      this.cachedImages = await SessionManager.loadImages(deck.folderPath);
      this.cachedImagesDeckId = this.currentDeckId;
      if (this.boardState) {
        this.boardState.activeDeckId = this.currentDeckId;
        this.boardState.allReferences = this.cachedImages || [];
      }
      CardManager.migrateLegacyPathCards(this.currentDeckId, this.cachedImages);
    } catch (err) {
      this.cachedImages = [];
      this.cachedImagesDeckId = this.currentDeckId;
      if (this.boardState) {
        this.boardState.activeDeckId = this.currentDeckId;
        this.boardState.allReferences = [];
      }
    }
    return this.cachedImages;
  },

  applyBoardFilters() {
    const images = this.cachedImages || [];
    const deckCards = (typeof CardManager !== 'undefined' && this.currentDeckId)
      ? CardManager.getCardsForDeck(this.currentDeckId)
      : {};

    const query = (this.boardState.searchQuery || '').trim().toLowerCase();
    const activeTag = this.boardState.selectedTag ? this.boardState.selectedTag.toLowerCase() : null;

    const filtered = images.filter(img => {
      const card = deckCards[img.id] || (img.path && deckCards[img.path]);
      const tags = (card && Array.isArray(card.tags)) ? card.tags : [];

      // 1. Tag filter match
      if (activeTag && activeTag !== 'all') {
        const hasTag = tags.some(t => t.toLowerCase().replace(/^#/, '') === activeTag);
        if (!hasTag) return false;
      }

      // 2. Search query match (filename, path, or tag partial match)
      if (query) {
        const nameMatch = (img.name || '').toLowerCase().includes(query);
        const pathMatch = (img.path || '').toLowerCase().includes(query);
        const tagMatch = tags.some(t => t.toLowerCase().includes(query));
        if (!nameMatch && !pathMatch && !tagMatch) return false;
      }

      return true;
    });

    this.boardState.filteredReferences = filtered;

    // Requirement 4: Predictable selection behavior
    if (this.boardState.selectedRef) {
      const foundIdx = filtered.findIndex(r => r.id === this.boardState.selectedRef.id || (r.path && r.path === this.boardState.selectedRef.path));
      if (foundIdx !== -1) {
        this.boardState.currentIndex = foundIdx;
      } else {
        this.boardState.selectedRef = null;
        this.boardState.currentIndex = -1;
      }
    } else {
      this.boardState.currentIndex = -1;
    }

    return filtered;
  },

  renderBoardTags() {
    const tagsBar = document.getElementById('board-tags-bar');
    if (!tagsBar) return;

    const images = this.cachedImages || [];
    const deckCards = (typeof CardManager !== 'undefined' && this.currentDeckId)
      ? CardManager.getCardsForDeck(this.currentDeckId)
      : {};

    const tagCounts = new Map();
    images.forEach(img => {
      const card = deckCards[img.id] || (img.path && deckCards[img.path]);
      if (card && Array.isArray(card.tags)) {
        card.tags.forEach(t => {
          const clean = (t || '').trim().toLowerCase().replace(/^#/, '');
          if (clean) {
            tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
          }
        });
      }
    });

    const isAllActive = !this.boardState.selectedTag || this.boardState.selectedTag === 'all';
    let html = `
      <button type="button" class="board-tag-chip${isAllActive ? ' active' : ''}" data-tag="all" role="tab" aria-selected="${isAllActive}">
        All Tags <span class="chip-count">(${images.length})</span>
      </button>
    `;

    const sortedTags = Array.from(tagCounts.keys()).sort();
    sortedTags.forEach(tag => {
      const active = this.boardState.selectedTag === tag;
      const count = tagCounts.get(tag);
      html += `
        <button type="button" class="board-tag-chip${active ? ' active' : ''}" data-tag="${this._esc(tag)}" role="tab" aria-selected="${active}">
          #${this._esc(tag)} <span class="chip-count">(${count})</span>
        </button>
      `;
    });

    tagsBar.innerHTML = html;
  },

  setBoardTagFilter(tag) {
    const clean = (tag || '').trim().toLowerCase().replace(/^#/, '');
    if (!clean || clean === 'all') {
      this.boardState.selectedTag = null;
    } else {
      this.boardState.selectedTag = clean;
    }
    this.applyBoardFilters();
    this.renderBoardTags();
    this.renderBoardGrid();
    this.updateBoardFilterStatus();
  },

  setBoardSearchQuery(query) {
    this.boardState.searchQuery = (query || '').trim();
    this.applyBoardFilters();
    this.renderBoardGrid();
    this.updateBoardFilterStatus();
  },

  clearBoardFilters() {
    this.boardState.searchQuery = '';
    this.boardState.selectedTag = null;
    const searchInput = document.getElementById('input-board-search');
    if (searchInput) searchInput.value = '';
    this.applyBoardFilters();
    this.renderBoardTags();
    this.renderBoardGrid();
    this.updateBoardFilterStatus();
  },

  updateBoardFilterStatus() {
    const totalCount = (this.cachedImages || []).length;
    const filteredCount = (this.boardState.filteredReferences || []).length;

    const countBadge = document.getElementById('board-ref-count');
    if (countBadge) {
      countBadge.textContent = `Showing ${filteredCount} of ${totalCount} reference${totalCount === 1 ? '' : 's'}`;
    }

    const clearBtn = document.getElementById('btn-board-clear-filters');
    const hasFilter = Boolean(this.boardState.searchQuery || this.boardState.selectedTag);
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !hasFilter);
    }

    const searchClearBtn = document.getElementById('btn-board-search-clear');
    if (searchClearBtn) {
      searchClearBtn.classList.toggle('hidden', !this.boardState.searchQuery);
    }
  },

  renderBoardGrid() {
    const grid = document.getElementById('board-gallery-grid');
    const emptyState = document.getElementById('board-empty-state');
    const emptyTitle = document.getElementById('board-empty-title');
    const emptyDesc = document.getElementById('board-empty-desc');
    if (!grid) return;

    const totalImages = this.cachedImages || [];
    const images = this.boardState.filteredReferences || [];

    if (images.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (totalImages.length === 0) {
          if (emptyTitle) emptyTitle.textContent = 'No references found in this deck';
          if (emptyDesc) emptyDesc.textContent = "Add image files to the deck's folder or paste Pinterest/image URLs above.";
        } else {
          if (emptyTitle) emptyTitle.textContent = 'No references match your filter';
          if (emptyDesc) emptyDesc.textContent = 'Try clearing the search query or selecting a different tag.';
        }
      }
      this.updateBoardFilterStatus();
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.classList.remove('hidden');

    const deckCards = (typeof CardManager !== 'undefined' && this.currentDeckId)
      ? CardManager.getCardsForDeck(this.currentDeckId)
      : {};

    const selectedRef = this.boardState ? this.boardState.selectedRef : null;

    grid.innerHTML = images.map(img => {
      const card = deckCards[img.id] || (img.path && deckCards[img.path]);
      const tags = (card && Array.isArray(card.tags)) ? card.tags : [];
      const hasCrop = Boolean(card && card.cropImage && card.cropImage.cropUrl);
      const isSelected = Boolean(selectedRef && (selectedRef.id === img.id || (img.path && selectedRef.path === img.path)));

      const imgUrl = (typeof SessionManager !== 'undefined' && SessionManager.getImageUrl)
        ? SessionManager.getImageUrl(img)
        : `/api/image?path=${encodeURIComponent(img.path || img.id)}`;

      const tagsHtml = tags.length > 0
        ? `<div class="board-ref-tags">${tags.map(t => `<span class="board-ref-tag-pill">#${this._esc(t)}</span>`).join('')}</div>`
        : '';

      const cropBadge = hasCrop
        ? `<span class="board-ref-focal-badge">Crop</span>`
        : '';

      return `
        <div class="board-ref-card${isSelected ? ' selected' : ''}" data-id="${this._esc(img.id)}" data-path="${this._esc(img.path || '')}" tabindex="0" role="button" aria-label="${this._esc(img.name || '')}">
          <div class="board-ref-thumb-wrap">
            <img class="board-ref-thumb" src="${this._esc(imgUrl)}" alt="${this._esc(img.name || '')}" loading="lazy" decoding="async" draggable="false">
            <div class="board-card-fallback hidden" aria-hidden="true">
              <span class="fallback-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
              <span class="fallback-text">Unavailable</span>
            </div>
            ${cropBadge}
            <div class="board-card-open-hint" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <span>Open</span>
            </div>
          </div>
          <div class="board-ref-info">
            <span class="board-ref-title" title="${this._esc(img.name || '')}">${this._esc(img.name || '')}</span>
            ${tagsHtml}
          </div>
        </div>
      `;
    }).join('');

    this.updateBoardFilterStatus();
  },

  setBoardGridSize(size) {
    if (!['small', 'medium', 'large'].includes(size)) size = 'medium';
    if (this.boardState) {
      this.boardState.gridSize = size;
      if (typeof BoardManager !== 'undefined' && BoardManager.setGridSize) {
        BoardManager.setGridSize(size);
      }
    }
    try {
      localStorage.setItem('board_grid_size', size);
    } catch (e) {}

    const grid = document.getElementById('board-gallery-grid');
    if (grid) {
      grid.classList.remove('size-small', 'size-medium', 'size-large');
      grid.classList.add(`size-${size}`);
    }

    document.querySelectorAll('.btn-board-size').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  },

  updateFlashRecallUI() {
    const mgr = (typeof MemoryDrillManager !== 'undefined') ? MemoryDrillManager : null;
    if (!mgr) return;

    const toggle = document.getElementById('toggle-flash-recall');
    const statusText = document.getElementById('flash-recall-status-text');
    const optionsBody = document.getElementById('flash-recall-options-body');

    if (toggle) {
      toggle.checked = mgr.enabled;
    }
    if (statusText) {
      statusText.textContent = mgr.enabled ? 'On' : 'Off';
      statusText.classList.toggle('active', mgr.enabled);
    }
    if (optionsBody) {
      optionsBody.classList.toggle('drill-disabled', !mgr.enabled);
    }

    document.querySelectorAll('.btn-drill-pill').forEach(btn => {
      const param = btn.dataset.param;
      const val = btn.dataset.val;
      let isActive = false;
      if (param === 'observe') {
        isActive = String(mgr.observeSec) === String(val);
      } else if (param === 'draw') {
        isActive = String(mgr.drawSec) === String(val);
      } else if (param === 'veil') {
        isActive = String(mgr.veilMode) === String(val);
      }
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  },

  selectBoardReference(ref, cardEl) {
    if (!this.boardState) this.boardState = { selectedRef: null };
    this.boardState.selectedRef = ref;

    if (ref && this.boardState.filteredReferences) {
      const foundIdx = this.boardState.filteredReferences.findIndex(r => r.id === ref.id || (r.path && r.path === ref.path));
      this.boardState.currentIndex = foundIdx;
    }

    const grid = document.getElementById('board-gallery-grid');
    if (grid) {
      grid.querySelectorAll('.board-ref-card.selected').forEach(c => c.classList.remove('selected'));
    }
    if (cardEl) {
      cardEl.classList.add('selected');
    } else if (grid && ref) {
      const el = grid.querySelector(`.board-ref-card[data-id="${ref.id}"]`);
      if (el) el.classList.add('selected');
    }
  },

  openBoardStage(ref) {
    if (!ref && this.boardState && this.boardState.selectedRef) {
      ref = this.boardState.selectedRef;
    }
    if (!ref && this.boardState && this.boardState.filteredReferences && this.boardState.filteredReferences.length > 0) {
      ref = this.boardState.filteredReferences[0];
    }
    if (!ref) return;

    this.selectBoardReference(ref);

    const boardView = document.getElementById('deck-view-board');
    const grid = document.getElementById('board-gallery-grid');
    if (this.boardState) {
      let currentScroll = 0;
      if (boardView && typeof boardView.scrollTop === 'number' && boardView.scrollTop > 0) {
        currentScroll = boardView.scrollTop;
      } else if (grid && typeof grid.scrollTop === 'number' && grid.scrollTop > 0) {
        currentScroll = grid.scrollTop;
      } else if (typeof window !== 'undefined' && typeof window.scrollY === 'number' && window.scrollY > 0) {
        currentScroll = window.scrollY;
      }
      if (currentScroll > 0 || typeof this.boardState.gridScrollTop !== 'number') {
        this.boardState.gridScrollTop = currentScroll;
      }
    }

    this.isBoardStageOpen = true;
    this.sessionSource = 'board';
    if (this.boardState) {
      this.boardState.isStageOpen = true;
    }
    if (typeof BoardManager !== 'undefined') {
      BoardManager.openStage(ref);
    }

    document.body.classList.add('board-stage-active');
    const sessionView = document.getElementById('view-session');
    if (sessionView) sessionView.classList.add('board-stage-active');

    // Disarm timer and stop if running
    TimerManager.stop();
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.classList.add('hidden');

    // Immediate cleanup of Flash & Recall when entering Board Stage
    if (typeof FlashRecallManager !== 'undefined') {
      FlashRecallManager.reset();
    }

    // Hide SRS rating area and clear blur overlay
    const ratingArea = document.getElementById('session-rating-area');
    if (ratingArea) ratingArea.classList.remove('rating-open');
    this.clearBlurOverlay(true);

    // Configure stage header for Board inspection
    const deck = DeckManager.getById(this.currentDeckId);
    const deckNameEl = document.getElementById('session-deck-name');
    if (deckNameEl) {
      deckNameEl.textContent = (deck ? deck.name : '') + ' • Reference Board';
    }

    const modeBadge = document.getElementById('session-mode-label');
    if (modeBadge) {
      modeBadge.textContent = 'Reference Stage';
      modeBadge.className = 'session-mode-badge board-mode';
      modeBadge.classList.add('board-mode');
      modeBadge.dataset.mode = 'board';
    }

    const endBtn = document.getElementById('btn-end-session');
    if (endBtn) {
      endBtn.innerHTML = '<span>←</span> Back to Board';
      endBtn.title = 'Return to Reference Board [Esc]';
    }

    this.showView('view-session');
    const reviewEmpty = document.getElementById('review-empty');
    if (reviewEmpty) reviewEmpty.classList.add('hidden');
    this.showSessionContent(true);

    this.renderBoardStageImage(ref);
    this.updateBoardNavUI();
  },

  renderBoardStageImage(ref) {
    if (!ref) return;

    ArtistToolbox.reset();

    // Reset sketch overlay when advancing to new reference
    if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active) {
      SketchOverlay.clear();
    }
    if (typeof SmartCropManager !== 'undefined' && SmartCropManager.isCropping) {
      SmartCropManager.cancelCrop();
    }

    // Set SessionManager context pointers (without starting session or queue)
    SessionManager.currentImage = ref;
    SessionManager.deckId = this.currentDeckId;

    const frame = document.getElementById('image-frame');
    const imgEl = document.getElementById('session-image');

    if (frame) {
      frame.classList.remove('is-loaded', 'image-entering', 'is-loading');
      frame.classList.add('is-loading');
    }

    const handleImageLoad = () => {
      ArtistToolbox.fitImage(false);
      if (frame) {
        frame.classList.remove('is-loading');
        frame.classList.add('is-loaded', 'image-entering');
        setTimeout(() => frame.classList.remove('image-entering'), 420);
      }

      if (typeof ColorPaletteManager !== 'undefined') {
        ColorPaletteManager.onImageLoaded(imgEl);
      }

      if (typeof SmartCropManager !== 'undefined') {
        SmartCropManager.onImageLoaded(ref);
      }

      if (typeof PlumbTool !== 'undefined') {
        PlumbTool.onImageLoaded(imgEl);
      }
    };

    const handleImageError = () => {
      if (frame) frame.classList.remove('is-loading');
      this.showToast('Could not load this reference', 'alert');
    };

    if (imgEl) {
      imgEl.addEventListener('load', handleImageLoad, { once: true });
      imgEl.addEventListener('error', handleImageError, { once: true });

      const card = CardManager.getCard(this.currentDeckId, ref.id);
      const hasCropImage = Boolean(card && card.cropImage && card.cropImage.cropUrl);

      if (hasCropImage) {
        imgEl.src = card.cropImage.cropUrl;
        if (typeof SmartCropManager !== 'undefined') {
          SmartCropManager.isFocalMode = true;
        }
      } else {
        imgEl.src = (typeof SessionManager !== 'undefined' && SessionManager.getImageUrl)
          ? SessionManager.getImageUrl(ref)
          : `/api/image?path=${encodeURIComponent(ref.path || ref.id)}`;
        if (typeof SmartCropManager !== 'undefined') {
          SmartCropManager.isFocalMode = false;
        }
      }
      if (imgEl.complete && imgEl.naturalWidth > 0) handleImageLoad();
    }

    if (typeof SketchComparison !== 'undefined') {
      SketchComparison.onCardLoaded(this.currentDeckId, ref.id);
    }

    const nameEl = document.getElementById('session-image-name');
    if (nameEl) {
      nameEl.textContent = ref.name || '';
      nameEl.classList.remove('img-name-new');
      void nameEl.offsetWidth;
      nameEl.classList.add('img-name-new');
    }

    if ('mediaSession' in navigator && ref) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: ref.name || 'Reference',
          artist: 'Art Practice • Reference Board',
          album: 'ArtPractice Observational Reference'
        });
      } catch (e) { }
    }

    this.renderSessionCardTags();
  },

  stepBoardReference(direction) {
    if (!this.boardState || !this.isBoardStageOpen) return;
    const ref = direction === 'prev'
      ? this.boardState.prevReference()
      : this.boardState.nextReference();
    if (!ref) return;

    this.renderBoardStageImage(ref);
    this.updateBoardNavUI();
  },

  updateBoardNavUI() {
    if (!this.boardState) return;
    const cur = (this.boardState.currentIndex >= 0 ? this.boardState.currentIndex : 0) + 1;
    const total = (this.boardState.filteredReferences && this.boardState.filteredReferences.length)
      || (this.cachedImages && this.cachedImages.length)
      || 1;

    const posText = `${cur} / ${total}`;

    const navPosEl = document.getElementById('board-nav-pos-text');
    if (navPosEl) navPosEl.textContent = posText;

    const progressEl = document.getElementById('session-progress');
    if (progressEl) progressEl.textContent = posText;

    const select = document.getElementById('select-board-slide-interval');
    if (select && select.value !== String(this.boardState.slideshowIntervalSec)) {
      select.value = String(this.boardState.slideshowIntervalSec);
    }

    const toggleBtn = document.getElementById('btn-board-slideshow-toggle');
    const toggleIcon = document.getElementById('board-slideshow-toggle-icon');
    const toggleText = document.getElementById('board-slideshow-toggle-text');

    if (toggleBtn) {
      if (this.boardState.slideshowIntervalSec > 0) {
        toggleBtn.classList.remove('hidden');
        if (this.boardState.slideshowPaused) {
          toggleBtn.classList.add('paused');
          if (toggleIcon) toggleIcon.textContent = '▶';
          if (toggleText) toggleText.textContent = 'Resume';
        } else {
          toggleBtn.classList.remove('paused');
          if (toggleIcon) toggleIcon.textContent = '⏸';
          if (toggleText) toggleText.textContent = 'Pause';
        }
      } else {
        toggleBtn.classList.add('hidden');
      }
    }

    // Synchronize highlighted card in board gallery grid
    const ref = this.boardState.selectedRef;
    const grid = document.getElementById('board-gallery-grid');
    if (grid && ref) {
      grid.querySelectorAll('.board-ref-card.selected').forEach(c => c.classList.remove('selected'));
      const activeEl = grid.querySelector(`.board-ref-card[data-id="${ref.id}"]`);
      if (activeEl) activeEl.classList.add('selected');
    }
  },

  setBoardSlideInterval(val) {
    const sec = parseInt(val, 10) || 0;
    if (this.boardState) {
      this.boardState.setSlideshowInterval(sec);
    }
    this.updateBoardNavUI();
  },

  toggleBoardSlideshowPause() {
    if (!this.boardState || !this.isBoardStageOpen) return;
    if (this.boardState.slideshowIntervalSec <= 0) return;
    this.boardState.toggleSlideshowPause();
    this.updateBoardNavUI();
  },

  closeBoardStage() {
    this.isBoardStageOpen = false;
    this.sessionSource = null;
    if (this.boardState) {
      this.boardState.isStageOpen = false;
      this.boardState.stopSlideshow();
    }
    if (typeof BoardManager !== 'undefined') {
      BoardManager.closeStage();
    }

    const select = document.getElementById('select-board-slide-interval');
    if (select) select.value = '0';

    document.body.classList.remove('board-stage-active');
    const sessionView = document.getElementById('view-session');
    if (sessionView) sessionView.classList.remove('board-stage-active');

    const endBtn = document.getElementById('btn-end-session');
    if (endBtn) {
      endBtn.innerHTML = '<span>←</span> End Session';
      endBtn.title = 'End Session';
    }

    const modeBadge = document.getElementById('session-mode-label');
    if (modeBadge) {
      modeBadge.classList.remove('board-mode');
    }

    if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active) {
      SketchOverlay.clear();
    }
    if (typeof SketchComparison !== 'undefined') {
      SketchComparison.setMode('single');
      SketchComparison.currentSketchDataUrl = null;
    }
    if (typeof ColorPaletteManager !== 'undefined') {
      ColorPaletteManager.toggleHUD(false);
    }
    if (typeof SmartCropManager !== 'undefined') {
      SmartCropManager.cancelCrop();
    }
    if (this.isPiPActive) this.closePiP(true);
    if (this.isZenMode) this.toggleZenMode(false);
    ArtistToolbox.reset();

    // Clear SessionManager pointer
    SessionManager.currentImage = null;

    // Switch back to Deck Detail on Reference Board tab
    this.showView('view-deck-detail');
    this.activeDeckTab = 'board';
    this.switchDeckTab('board');

    // Restore thumbnail grid scroll position
    const boardView = document.getElementById('deck-view-board');
    const grid = document.getElementById('board-gallery-grid');
    const savedTop = (this.boardState && typeof this.boardState.gridScrollTop === 'number')
      ? this.boardState.gridScrollTop
      : 0;
    if (boardView && typeof boardView.scrollTop === 'number') {
      boardView.scrollTop = savedTop;
    }
    if (grid && typeof grid.scrollTop === 'number') {
      grid.scrollTop = savedTop;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function' && savedTop > 0) {
      try { window.scrollTo(0, savedTop); } catch (e) { }
    }
  },

  renderDeckStats() {
    const totalImages = this.cachedImages ? this.cachedImages.length : 0;
    const stats = CardManager.getStats(this.currentDeckId, totalImages, this.selectedTagFilter);

    const deck = DeckManager.getById(this.currentDeckId);
    const newLimit = deck.newLimit || 20;
    const reviewLimit = deck.reviewLimit || 200;

    const todayStr = localDateStr();
    const historyCounts = ReviewHistory.getCounts(this.currentDeckId, todayStr);

    const remainingNew = Math.max(0, newLimit - historyCounts.new);
    const remainingReview = Math.max(0, reviewLimit - historyCounts.review);

    const availableNew = Math.min(stats.newCards, remainingNew);
    const availableReview = Math.min(stats.due, remainingReview);

    const updateStat = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.textContent !== String(val)) {
          el.textContent = val;
          el.classList.remove('animating');
          void el.offsetWidth; // trigger reflow
          el.classList.add('animating');
        }
      }
    };

    updateStat('stat-total', stats.total);
    updateStat('stat-due', stats.due);
    updateStat('stat-reviewed', stats.reviewed);
    updateStat('stat-new', stats.newCards);

    document.getElementById('btn-new-count').textContent = availableNew;
    document.getElementById('btn-review-count').textContent = availableReview;

    // Sub-Deck label feedback on study buttons
    const btnStudyNew = document.getElementById('btn-study-new');
    const btnReview = document.getElementById('btn-review');
    const btnFree = document.getElementById('btn-free-study');

    const studyTitle = btnStudyNew ? btnStudyNew.querySelector('.action-title') : null;
    const reviewTitle = btnReview ? btnReview.querySelector('.action-title') : null;
    const freeCount = btnFree ? btnFree.querySelector('.action-count') : null;

    if (this.selectedTagFilter) {
      if (studyTitle) studyTitle.textContent = `Study New (#${this.selectedTagFilter})`;
      if (reviewTitle) reviewTitle.textContent = `Review Due (#${this.selectedTagFilter})`;
      if (freeCount) freeCount.textContent = `(#${this.selectedTagFilter} only: ${stats.total})`;
    } else {
      if (studyTitle) studyTitle.textContent = 'Study New';
      if (reviewTitle) reviewTitle.textContent = 'Review Due';
      if (freeCount) freeCount.textContent = '(Endless shuffle)';
    }

    const duePill = document.getElementById('deck-detail-due-pill');
    if (stats.due > 0) {
      duePill.textContent = `${stats.due} Due Today${this.selectedTagFilter ? ` (#${this.selectedTagFilter})` : ''}`;
      duePill.classList.remove('hidden');
    } else {
      duePill.classList.add('hidden');
    }

    // Overdue Backlog Load-Balancer Button State
    const btnReflow = document.getElementById('btn-reflow-backlog');
    const reflowBadge = document.getElementById('reflow-badge');
    if (btnReflow) {
      const excess = Math.max(0, stats.due - reviewLimit);
      if (excess > 0) {
        btnReflow.classList.add('can-reflow');
        btnReflow.title = `Due queue exceeds daily limit by ${excess} cards. Click to spread excess evenly across the next 5 days.`;
        if (reflowBadge) {
          reflowBadge.textContent = `+${excess} excess`;
          reflowBadge.classList.remove('hidden');
        }
      } else {
        btnReflow.classList.remove('can-reflow');
        btnReflow.title = stats.due > 0
          ? `Queue (${stats.due}) is within your daily limit (${reviewLimit}). Click to balance backlog if desired.`
          : 'No cards currently due';
        if (reflowBadge) {
          reflowBadge.classList.add('hidden');
        }
      }
    }

    if (btnStudyNew) btnStudyNew.disabled = availableNew === 0;
    if (btnReview) btnReview.disabled = availableReview === 0;
    if (btnFree) btnFree.disabled = stats.total === 0;
  },

  renderDeckFocusTags() {
    const bar = document.getElementById('deck-focus-tags-bar');
    const clearBtn = document.getElementById('btn-clear-tag-filter');
    if (!bar) return;

    if (clearBtn) {
      if (this.selectedTagFilter) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    const tagCounts = CardManager.getAllTagsForDeck(this.currentDeckId);
    const totalCount = this.cachedImages ? this.cachedImages.length : 0;
    const isAllActive = !this.selectedTagFilter;

    let html = `
      <button type="button" class="btn-focus-tag ${isAllActive ? 'active' : ''}" data-tag="">
        <span>${this.getIconSvg('folder', 13, 'tag-icon-svg')} All Cards</span>
        <span class="focus-count">${totalCount}</span>
      </button>
    `;

    const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    if (tagEntries.length === 0) {
      html += `
        <span class="focus-empty-hint">
          No sub-deck tags yet. Press <kbd>T</kbd> during a session to tag references (e.g. <em>hands</em>, <em>foreshortening</em>, <em>lighting</em>, <em>leech</em>).
        </span>
      `;
    } else {
      tagEntries.forEach(([tag, count]) => {
        const isActive = this.selectedTagFilter === tag;
        const preset = TAG_PRESETS.find(p => p.id === tag);
        const iconName = preset ? (preset.icon || preset.id) : 'tag';
        const iconSvg = this.getIconSvg(iconName, 13, 'tag-icon-svg');
        html += `
          <button type="button" class="btn-focus-tag ${isActive ? 'active' : ''}" data-tag="${this._esc(tag)}">
            <span>${iconSvg} #${this._esc(tag)}</span>
            <span class="focus-count">${count}</span>
          </button>
        `;
      });
    }

    bar.innerHTML = html;

    bar.querySelectorAll('.btn-focus-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundFX.click();
        const tag = btn.dataset.tag || null;
        this.selectedTagFilter = tag;
        this.renderDeckStats();
        this.renderDeckFocusTags();
      });
    });
  },

  // ---- Heatmap ----
  renderHeatmap() {
    const gridEl = document.getElementById('heatmap-grid');
    const monthsEl = document.getElementById('heatmap-months');
    const deckId = this.currentDeckId;

    const pastData = ReviewHistory.getGlobalHistory();
    const futureData = {};
    const deckCards = CardManager.getCardsForDeck(deckId);
    const todayStr = localDateStr();

    Object.values(deckCards).forEach(card => {
      if (card && card.difficulty && card.dueDate && localDateStr(card.dueDate) > todayStr) {
        futureData[localDateStr(card.dueDate)] = (futureData[localDateStr(card.dueDate)] || 0) + 1;
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 330);
    const startDay = startDate.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 60);
    const endDay = endDate.getDay();
    if (endDay !== 0) endDate.setDate(endDate.getDate() + (7 - endDay));

    let maxPast = 0;
    Object.values(pastData).forEach(v => { if (v > maxPast) maxPast = v; });
    let maxFuture = 0;
    Object.values(futureData).forEach(v => { if (v > maxFuture) maxFuture = v; });

    const cells = [];
    const monthLabels = [];
    let currentDate = new Date(startDate);
    let lastMonthLabel = -1;
    let weekIndex = 0;

    while (currentDate <= endDate) {
      const dateStr = localDateStr(currentDate);
      const dayOfWeek = currentDate.getDay();

      if (dayOfWeek === 1) {
        const month = currentDate.getMonth();
        if (month !== lastMonthLabel) {
          monthLabels.push({ weekIndex, label: currentDate.toLocaleString('default', { month: 'short' }) });
          lastMonthLabel = month;
        }
        weekIndex++;
      }

      const isToday = dateStr === todayStr;
      const isPast = dateStr <= todayStr;
      const pastCount = pastData[dateStr] || 0;
      const futureCount = futureData[dateStr] || 0;

      let colorClass = '';
      let tooltipText = '';

      if (isPast && pastCount > 0) {
        colorClass = this._greenLevel(pastCount, maxPast);
        tooltipText = `${dateStr}: ${pastCount} reviewed`;
      } else if (!isPast && futureCount > 0) {
        colorClass = this._greyLevel(futureCount, maxFuture);
        tooltipText = `${dateStr}: ${futureCount} scheduled`;
      } else {
        tooltipText = `${dateStr}: 0`;
      }

      cells.push(
        `<div class="heatmap-cell ${colorClass}${isToday ? ' today' : ''}" data-tooltip="${this._esc(tooltipText)}"></div>`
      );

      currentDate.setDate(currentDate.getDate() + 1);
    }

    gridEl.innerHTML = cells.join('');

    // Floating Unclipped Heatmap Tooltip (escapes overflow boundaries so top rows are never clipped)
    let tooltip = document.getElementById('floating-heatmap-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'floating-heatmap-tooltip';
      tooltip.className = 'floating-heatmap-tooltip';
      document.body.appendChild(tooltip);
    }

    if (!gridEl._hasTooltipListeners) {
      gridEl._hasTooltipListeners = true;

      const positionTooltip = (cell) => {
        const text = cell.getAttribute('data-tooltip');
        if (!text) {
          tooltip.classList.remove('visible');
          return;
        }
        tooltip.textContent = text;
        const rect = cell.getBoundingClientRect();
        // Flip below if cell is too close to top of viewport or container header
        const shouldFlip = rect.top < 70;
        if (shouldFlip) {
          tooltip.classList.add('flipped');
          tooltip.style.top = (rect.bottom + 8) + 'px';
        } else {
          tooltip.classList.remove('flipped');
          tooltip.style.top = (rect.top - 8) + 'px';
        }
        const left = Math.max(75, Math.min(window.innerWidth - 75, rect.left + rect.width / 2));
        tooltip.style.left = left + 'px';
        tooltip.classList.add('visible');
      };

      gridEl.addEventListener('mouseover', (e) => {
        const cell = e.target.closest('.heatmap-cell');
        if (cell) positionTooltip(cell);
      });

      gridEl.addEventListener('mouseout', (e) => {
        const cell = e.target.closest('.heatmap-cell');
        if (cell) tooltip.classList.remove('visible');
      });
    }

    const totalWeeks = weekIndex;
    const cellSize = 16;
    monthsEl.innerHTML = '';
    monthLabels.forEach((m, i) => {
      const nextWeek = (i + 1 < monthLabels.length) ? monthLabels[i + 1].weekIndex : totalWeeks;
      const span = document.createElement('span');
      span.textContent = m.label;
      span.style.width = ((nextWeek - m.weekIndex) * cellSize) + 'px';
      monthsEl.appendChild(span);
    });

    const scrollEl = gridEl.parentElement;
    if (scrollEl && !scrollEl._hasTooltipScrollListener) {
      scrollEl._hasTooltipScrollListener = true;
      scrollEl.addEventListener('scroll', () => {
        if (tooltip) tooltip.classList.remove('visible');
      }, { passive: true });
    }

    const todayCell = gridEl.querySelector('.today');
    if (todayCell && scrollEl) {
      const offset = todayCell.offsetLeft - scrollEl.clientWidth / 2;
      scrollEl.scrollLeft = Math.max(0, offset);
    }
  },

  _greenLevel(count, max) {
    if (max === 0) return '';
    const ratio = count / max;
    if (ratio <= 0.25) return 'g1';
    if (ratio <= 0.5) return 'g2';
    if (ratio <= 0.75) return 'g3';
    return 'g4';
  },

  _greyLevel(count, max) {
    if (max === 0) return '';
    const ratio = count / max;
    if (ratio <= 0.25) return 's1';
    if (ratio <= 0.5) return 's2';
    if (ratio <= 0.75) return 's3';
    return 's4';
  },

  _dateToStr(date) {
    return localDateStr(date);
  },

  renderActivityStats() {
    const history = ReviewHistory.getGlobalHistory();
    const todayStr = localDateStr();

    const dates = Object.keys(history).filter(d => d <= todayStr).sort();
    const totalReviews = dates.reduce((sum, d) => sum + history[d], 0);
    const daysWithReviews = dates.length;

    const dailyAvg = daysWithReviews > 0 ? Math.round(totalReviews / daysWithReviews) : 0;
    document.getElementById('stat-daily-avg').textContent = `${dailyAvg} cards`;

    const last30 = new Set();
    const d30 = new Date();
    d30.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const ds = localDateStr(d30);
      if (history[ds] && history[ds] > 0) last30.add(ds);
      d30.setDate(d30.getDate() - 1);
    }
    const pct = Math.round((last30.size / 30) * 100);
    document.getElementById('stat-days-learned').textContent = `${pct}%`;

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const ds = localDateStr(checkDate);
      if (history[ds] && history[ds] > 0) {
        currentStreak++;
      } else {
        if (i === 0) { /* today might not have reviews yet */ }
        else break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    if (dates.length > 0) {
      tempStreak = 1;
      longestStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1] + 'T00:00:00');
        const curr = new Date(dates[i] + 'T00:00:00');
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          tempStreak = 1;
        }
      }
    }

    document.getElementById('stat-longest-streak').textContent = `${longestStreak} days`;
    document.getElementById('stat-current-streak').innerHTML = `${currentStreak} days ${this.getFlameSvgHTML(14, 18)}`;
  },

  renderTodaysReviewedCount() {
    const todayStr = localDateStr();
    const counts = ReviewHistory.getCounts(this.currentDeckId, todayStr);
    document.getElementById('todays-reviewed-count').textContent = counts.total;
  },

  // ---- Today's Reviewed Modal ----
  openTodaysReviewedModal() {
    const todayStr = localDateStr();
    const deckCards = CardManager.getCardsForDeck(this.currentDeckId);
    const todaysCards = Object.values(deckCards).filter(c => c && c.lastReviewDate && localDateStr(c.lastReviewDate) === todayStr);

    const count = todaysCards.length;
    document.getElementById('todays-reviewed-summary').textContent =
      `You reviewed ${count} card${count !== 1 ? 's' : ''} in this deck today.`;

    const listEl = document.getElementById('todays-reviewed-list');
    if (count === 0) {
      listEl.innerHTML = '<div class="folder-browser-empty">No reviews yet today. Start a practice session!</div>';
    } else {
      listEl.innerHTML = todaysCards.map(card => {
        const lastAttempt = (Array.isArray(card.attempts) && card.attempts.length > 0) ? card.attempts[card.attempts.length - 1] : null;
        const validSketch = (lastAttempt && isValidSketchUrl(lastAttempt.sketchUrl)) ? this._esc(lastAttempt.sketchUrl) : '';
        const thumbHtml = validSketch ? `<img src="${validSketch}" class="due-card-thumb" alt="Sketch">` : '';
        return `
        <div class="due-card-item">
          ${thumbHtml}
          <span class="card-name" title="${this._esc(card.imageName)}">${this._esc(card.imageName)}</span>
          <span class="card-difficulty ${this._esc(card.difficulty || '')}">${this._esc(card.difficulty || '')}</span>
          <span class="card-due-date">Next: ${this._formatFutureDate(card.dueDate)}</span>
        </div>
        `;
      }).join('');
    }

    document.getElementById('modal-todays-reviewed').classList.remove('hidden');
  },

  closeTodaysReviewedModal() {
    document.getElementById('modal-todays-reviewed').classList.add('hidden');
  },

  // ---- Practice Session ----
  async startSession(mode) {
    this.sessionSource = 'srs';
    this.isBoardStageOpen = false;
    document.body.classList.remove('board-stage-active');
    const sessionView = document.getElementById('view-session');
    if (sessionView) sessionView.classList.remove('board-stage-active');
    const endBtn = document.getElementById('btn-end-session');
    if (endBtn) {
      endBtn.innerHTML = '<span>←</span> End Session';
      endBtn.title = 'End Session';
    }

    if (!this.cachedImages || this.cachedImages.length === 0) {
      alert('No images found in this deck folder.');
      return;
    }

    const deck = DeckManager.getById(this.currentDeckId);
    if (!deck) return;

    // Ensure legacy cards are migrated to content-hash IDs before building session queue
    CardManager.migrateLegacyPathCards(this.currentDeckId, this.cachedImages);

    const newLimit = deck.newLimit || 20;
    const reviewLimit = deck.reviewLimit || 200;
    const todayStr = localDateStr();
    const historyCounts = ReviewHistory.getCounts(this.currentDeckId, todayStr);
    const remainingNew = Math.max(0, newLimit - historyCounts.new);
    const remainingReview = Math.max(0, reviewLimit - historyCounts.review);

    SessionManager.startSession(this.currentDeckId, mode, this.cachedImages, remainingNew, remainingReview, this.selectedTagFilter);

    if (SessionManager.queue.length === 0) {
      const filterMsg = this.selectedTagFilter ? `tagged with #${this.selectedTagFilter}` : 'for this study queue';
      this.showToast(`No cards found ${filterMsg}`, 'info');
      return;
    }

    const tagBadge = this.selectedTagFilter ? ` • #${this.selectedTagFilter}` : '';
    document.getElementById('session-deck-name').textContent = deck.name + tagBadge;
    const modeBadge = document.getElementById('session-mode-label');
    const tagSuffix = this.selectedTagFilter ? ` (#${this.selectedTagFilter})` : '';
    if (mode === 'new') { modeBadge.textContent = 'Study New' + tagSuffix; modeBadge.dataset.mode = 'new'; }
    else if (mode === 'review') { modeBadge.textContent = 'Review Due' + tagSuffix; modeBadge.dataset.mode = 'review'; }
    else { modeBadge.textContent = 'Free Study' + tagSuffix; modeBadge.dataset.mode = 'free'; }

    modeBadge.className = 'session-mode-badge' + (mode === 'review' ? ' review' : '');

    this.showView('view-session');
    document.getElementById('review-empty').classList.add('hidden');
    this.showSessionContent(true);

    ArtistToolbox.reset();
    this.startTimerIfNeeded();
    this.showNextImage();
  },

  showNextImage() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    const now = Date.now();
    if (this._lastNextTime && now - this._lastNextTime < 200) return;
    this._lastNextTime = now;

    const image = SessionManager.nextImage();

    if (!image) {
      if (this.isPiPActive) this.closePiP(true);
      this.showSessionContent(false);
      TimerManager.stop();

      // Automatically sync SRS database directly to disk when session completes
      Storage.syncToDisk(true).catch(() => { });

      // Show celebratory summary modal if cards were rated in this session
      if (SessionManager.sessionStats.total > 0) {
        this.openSessionSummaryModal();
      } else {
        document.getElementById('review-empty').classList.remove('hidden');
      }
      return;
    }

    this.clearBlurOverlay();
    ArtistToolbox.reset();

    // Reset sketch overlay when advancing to new reference
    if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active) {
      SketchOverlay.clear();
    }
    if (typeof SmartCropManager !== 'undefined' && SmartCropManager.isCropping) {
      SmartCropManager.cancelCrop();
    }

    const frame = document.getElementById('image-frame');
    const imgEl = document.getElementById('session-image');

    // Crossfade: briefly hide old image content then fade in new
    if (frame) {
      frame.classList.remove('is-loaded', 'image-entering', 'is-loading');
      frame.classList.add('is-loading');
    }

    const handleImageLoad = () => {
      ArtistToolbox.fitImage(false);
      if (frame) {
        frame.classList.remove('is-loading');
        frame.classList.add('is-loaded', 'image-entering');
        setTimeout(() => frame.classList.remove('image-entering'), 420);
      }

      // Extract Dominant Palette Swatches & update inspector
      if (typeof ColorPaletteManager !== 'undefined') {
        ColorPaletteManager.onImageLoaded(imgEl);
      }

      // Auto-frame focal crop if studying a child card
      if (typeof SmartCropManager !== 'undefined') {
        SmartCropManager.onImageLoaded(image);
      }

      // Reset & prepare plumb measurement overlay for new image
      if (typeof PlumbTool !== 'undefined') {
        PlumbTool.onImageLoaded(imgEl);
      }
    };
    const handleImageError = () => {
      if (frame) frame.classList.remove('is-loading');
      this.showToast('Could not load this reference — press S to skip', 'alert');
    };
    imgEl.addEventListener('load', handleImageLoad, { once: true });
    imgEl.addEventListener('error', handleImageError, { once: true });

    const card = CardManager.getCard(SessionManager.deckId, image.id);
    const hasCropImage = Boolean(card && card.cropImage && card.cropImage.cropUrl);

    if (hasCropImage) {
      imgEl.src = card.cropImage.cropUrl;
      if (typeof SmartCropManager !== 'undefined') {
        SmartCropManager.isFocalMode = true;
      }
    } else {
      imgEl.src = SessionManager.getImageUrl(image);
      if (typeof SmartCropManager !== 'undefined') {
        SmartCropManager.isFocalMode = false;
      }
    }
    if (imgEl.complete && imgEl.naturalWidth > 0) handleImageLoad();

    // Notify SketchComparison of newly loaded reference (syncs history badges and resets current sketch)
    if (typeof SketchComparison !== 'undefined') {
      SketchComparison.onCardLoaded(SessionManager.deckId, image.id);
    }

    // Animate image name
    const nameEl = document.getElementById('session-image-name');
    if (nameEl) {
      nameEl.textContent = image.name;
      nameEl.classList.remove('img-name-new');
      void nameEl.offsetWidth;
      nameEl.classList.add('img-name-new');
    }

    document.getElementById('session-progress').textContent = `#${SessionManager.imagesShown}`;

    // Update MediaSession for native macOS Always-on-Top PiP
    if ('mediaSession' in navigator && image) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: image.name || `Reference #${SessionManager.imagesShown}`,
          artist: `Art Practice • #${SessionManager.imagesShown} shown`,
          album: 'ArtPractice Spaced Repetition'
        });
      } catch (e) { }
    }

    this.updateRatingIntervals();
    this.renderSessionCardTags();
    if (this.isTagDockOpen) {
      this.renderTagDock();
    }


    if (typeof FlashRecallManager !== 'undefined' && FlashRecallManager.enabled) {
      TimerManager.stop();
      FlashRecallManager.startCard(SessionManager.deckId, image);
    } else {
      if (typeof FlashRecallManager !== 'undefined') FlashRecallManager.reset();
      document.getElementById('btn-timer-pause').textContent = 'Pause';
      if (this.getTimerDuration() > 0 && TimerManager.isRunning()) {
        TimerManager.reset();
      } else if (this.getTimerDuration() > 0) {
        this.startTimerIfNeeded();
      }
    }
  },

  openSessionSummaryModal() {
    // Automatically flush state to disk
    Storage.syncToDisk(true).catch(() => { });

    const stats = SessionManager.sessionStats;
    const deck = DeckManager.getById(this.currentDeckId);

    document.getElementById('summary-deck-title').textContent = deck ? deck.name : 'Practice Session';
    document.getElementById('summary-total-reviewed').textContent = stats.total;

    // Calculate current streak
    const history = ReviewHistory.getGlobalHistory();
    let currentStreak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const ds = localDateStr(checkDate);
      if (history[ds] && history[ds] > 0) currentStreak++;
      else if (i !== 0) break;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    document.getElementById('summary-streak-val').innerHTML = `${currentStreak} days ${this.getFlameSvgHTML(14, 18)}`;

    document.getElementById('summary-breakdown').innerHTML = `
      <span style="color: var(--again-color)">Again: ${stats.again || 0}</span>
      <span style="color: var(--hard-color)">Hard: ${stats.hard}</span>
      <span style="color: var(--medium-color)">Good: ${stats.medium}</span>
      <span style="color: var(--easy-color)">Easy: ${stats.easy}</span>
    `;

    document.getElementById('modal-session-summary').classList.remove('hidden');
    SoundFX.sessionComplete();
  },

  showBlurOverlay() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    this.imageBlurred = true;
    document.getElementById('image-blur-overlay').classList.remove('hidden');
    document.getElementById('btn-skip').classList.add('hidden');
    document.body.classList.add('rating-required');
    this.toggleRatingDock(true);
    this.wakeHud();
  },

  clearBlurOverlay(force = false) {
    if (!force && typeof FlashRecallManager !== 'undefined' && FlashRecallManager.enabled && FlashRecallManager.phase === 'draw') {
      return; // Veil hardening: cannot clear blur overlay during BLIND_DRAW
    }
    this.imageBlurred = false;
    document.getElementById('image-blur-overlay').classList.add('hidden');
    document.getElementById('btn-skip').classList.remove('hidden');
    document.body.classList.remove('rating-required');
    this.toggleRatingDock(false);
  },

  updateRatingIntervals() {
    if (!SessionManager.currentImage) return;

    const imageId = SessionManager.currentImage.id;
    const deckId = SessionManager.deckId;
    const duration = this.getTimerDuration ? this.getTimerDuration() : (TimerManager.duration || 0);

    ['again', 'hard', 'medium', 'easy'].forEach(diff => {
      const el = document.querySelector(`#btn-rate-${diff} .rate-interval`);
      if (!el) return;
      if (diff === 'again') {
        el.textContent = '<10m';
      } else {
        const days = CardManager.getProjectedInterval(deckId, imageId, diff, duration);
        el.textContent = days === 1 ? '1 day' : `${days} days`;
      }
    });
  },

  rateCurrentImage(difficulty) {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    if (!SessionManager.currentImage) return;

    // Grading Gate: When Flash & Recall is enabled, ratings are strictly gated until REVEAL_CRITIQUE
    if (typeof FlashRecallManager !== 'undefined' && FlashRecallManager.enabled && FlashRecallManager.phase !== 'reveal') {
      return;
    }

    const now = Date.now();
    if (this._lastRateTime && now - this._lastRateTime < 250) return;
    this._lastRateTime = now;

    SoundFX.rate(difficulty);
    const btn = document.getElementById(`btn-rate-${difficulty}`);

    const image = SessionManager.currentImage;

    // Asynchronously save visual sketch attempt to disk if one was attached
    const sketchToSave = (typeof SketchComparison !== 'undefined' && SketchComparison.currentSketchDataUrl)
      || (typeof SketchOverlay !== 'undefined' ? SketchOverlay.imageSrc : null);
    if (sketchToSave && typeof SketchComparison !== 'undefined') {
      SketchComparison.saveAttempt(
        SessionManager.deckId,
        image.id,
        image.name,
        difficulty,
        sketchToSave
      );
    }

    const duration = (typeof FlashRecallManager !== 'undefined' && FlashRecallManager.enabled && typeof FlashRecallManager.getElapsedDrillDuration === 'function')
      ? FlashRecallManager.getElapsedDrillDuration()
      : (this.getTimerDuration ? this.getTimerDuration() : (TimerManager.duration || 0));

    CardManager.rateCard(
      SessionManager.deckId,
      image.id,
      image.name,
      difficulty,
      duration
    );

    SessionManager.sessionStats[difficulty] = (SessionManager.sessionStats[difficulty] || 0) + 1;
    SessionManager.sessionStats.total++;

    if (difficulty === 'again' && SessionManager.mode !== 'free') {
      SessionManager.requeueCard(image.id);
    }

    this.clearBlurOverlay();

    // Auto-advance: show progress bar then auto-proceed
    if (this.autoAdvance) {
      this._showAutoAdvanceIndicator(() => this.showNextImage());
    } else {
      this.showNextImage();
    }
  },

  _showAutoAdvanceIndicator(callback) {
    // Remove any existing indicator
    const existing = document.getElementById('auto-advance-indicator');
    if (existing) existing.remove();
    clearTimeout(this._autoAdvanceTimer);

    const duration = 600; // ms
    const indicator = document.createElement('div');
    indicator.id = 'auto-advance-indicator';
    indicator.className = 'auto-advance-indicator';
    indicator.innerHTML = `
      <span>Next</span>
      <div class="advance-bar">
        <div class="advance-bar-fill" style="--advance-duration: ${duration}ms"></div>
      </div>
    `;
    document.body.appendChild(indicator);

    this._autoAdvanceTimer = setTimeout(() => {
      indicator.remove();
      callback();
    }, duration);
  },

  async endSession() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) {
      this.closeBoardStage();
      return;
    }
    if (typeof FlashRecallManager !== 'undefined') {
      FlashRecallManager.reset();
    }
    this.toggleTagDock(false);
    if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active) {
      SketchOverlay.clear();
    }
    if (typeof SketchComparison !== 'undefined') {
      SketchComparison.setMode('single');
      SketchComparison.currentSketchDataUrl = null;
    }
    if (typeof ColorPaletteManager !== 'undefined') {
      ColorPaletteManager.toggleHUD(false);
    }
    if (typeof SmartCropManager !== 'undefined') {
      SmartCropManager.cancelCrop();
    }
    if (this.isPiPActive) this.closePiP(true);
    TimerManager.stop();
    if (this.isZenMode) this.toggleZenMode(false);

    // Automatically sync SRS database directly to userdata/srs_state.json on disk after every session!
    await Storage.syncToDisk(true).catch(() => { });

    this.openDeckDetail(this.currentDeckId);
  },

  // ---- In-Session Quick Tagging & Sub-Deck Management ----
  toggleTagDock(force) {
    const dock = document.getElementById('session-tag-dock');
    if (!dock) return;
    const shouldOpen = typeof force === 'boolean' ? force : dock.classList.contains('hidden');
    this.isTagDockOpen = shouldOpen;

    if (shouldOpen) {
      dock.classList.remove('hidden');
      this.renderTagDock();
      const input = document.getElementById('input-custom-tag');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
      }
    } else {
      dock.classList.add('hidden');
      const input = document.getElementById('input-custom-tag');
      if (input) input.blur();
    }
  },

  renderTagDock() {
    const dock = document.getElementById('session-tag-dock');
    if (!dock || !SessionManager.currentImage || !this.currentDeckId) return;

    const activeContainer = document.getElementById('tag-dock-active-tags');
    const presetsGrid = document.getElementById('tag-presets-grid');
    const activeTags = CardManager.getTagsForCard(this.currentDeckId, SessionManager.currentImage.id);

    // Active tags chips
    if (activeContainer) {
      if (activeTags.length === 0) {
        activeContainer.innerHTML = '<span class="tag-empty-note">No tags yet — click a preset below or type a tag</span>';
      } else {
        activeContainer.innerHTML = activeTags.map(tag => {
          const isLeech = tag === 'leech';
          return `
            <span class="tag-chip-active ${isLeech ? 'tag-leech' : ''}">
              <span>#${this._esc(tag)}</span>
              <button type="button" class="btn-remove-tag" data-tag="${this._esc(tag)}" title="Remove tag">${this.getIconSvg('close', 10)}</button>
            </span>
          `;
        }).join('');

        activeContainer.querySelectorAll('.btn-remove-tag').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCardTag(btn.dataset.tag);
          });
        });
      }
    }

    // Presets [1-6]
    if (presetsGrid) {
      presetsGrid.innerHTML = TAG_PRESETS.map(preset => {
        const isTagged = activeTags.includes(preset.id);
        const iconSvg = this.getIconSvg(preset.icon || preset.id, 14, 'preset-icon-svg');
        const checkSvg = this.getIconSvg('check', 12);
        return `
          <button type="button" class="btn-tag-preset ${isTagged ? 'active' : ''} ${preset.id === 'leech' ? 'preset-leech' : ''}" data-tag="${this._esc(preset.id)}">
            <span class="preset-key">${preset.key}</span>
            <span class="preset-icon">${iconSvg}</span>
            <span class="preset-label">${preset.label}</span>
            <span class="preset-check">${isTagged ? checkSvg : '+'}</span>
          </button>
        `;
      }).join('');

      presetsGrid.querySelectorAll('.btn-tag-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          this.toggleCardTag(btn.dataset.tag);
        });
      });
    }
  },

  renderSessionCardTags() {
    const container = document.getElementById('session-card-tags');
    if (!container || !SessionManager.currentImage || !this.currentDeckId) {
      if (container) container.innerHTML = '';
      return;
    }

    const tags = CardManager.getTagsForCard(this.currentDeckId, SessionManager.currentImage.id);
    if (!tags || tags.length === 0) {
      container.innerHTML = '';
      container.classList.add('empty');
      return;
    }

    container.classList.remove('empty');
    container.innerHTML = tags.map(tag => {
      const isLeech = tag === 'leech';
      const preset = TAG_PRESETS.find(p => p.id === tag);
      const iconName = preset ? (preset.icon || preset.id) : 'tag';
      const iconSvg = this.getIconSvg(iconName, 12, 'card-tag-svg');
      return `<span class="card-tag-pill ${isLeech ? 'tag-leech' : ''}" data-tag="${this._esc(tag)}" title="Click to remove tag">${iconSvg} #${this._esc(tag)}</span>`;
    }).join('');

    container.querySelectorAll('.card-tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.toggleCardTag(pill.dataset.tag);
      });
    });
  },

  toggleCardTag(tag) {
    if (!SessionManager.currentImage || !this.currentDeckId) return;
    const result = CardManager.toggleTagForCard(
      this.currentDeckId,
      SessionManager.currentImage.id,
      SessionManager.currentImage.name,
      tag
    );

    SoundFX.click();
    this.renderSessionCardTags();
    if (this.isTagDockOpen) {
      this.renderTagDock();
    }

    const cleanTag = (tag || '').trim().toLowerCase().replace(/^#/, '');
    const preset = TAG_PRESETS.find(p => p.id === cleanTag);

    if (this.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  showSessionContent(show) {
    const elements = ['.image-container', '.rating-area', '#timer-display'];
    elements.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        if (show) {
          if (sel === '#timer-display' && this.getTimerDuration() > 0) {
            el.classList.remove('hidden');
          } else if (sel !== '#timer-display') {
            el.classList.remove('hidden');
          }
        } else {
          el.classList.add('hidden');
        }
      }
    });
  },

  // ---- Timer Logic ----
  getTimerDuration() {
    const selected = document.querySelector('input[name="timer"]:checked');
    if (!selected) return 0;

    if (selected.value === 'custom') {
      const customVal = parseInt(document.getElementById('custom-timer-input').value, 10);
      return isNaN(customVal) ? 0 : customVal;
    }
    return parseInt(selected.value, 10);
  },

  startTimerIfNeeded() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    if (typeof FlashRecallManager !== 'undefined' && FlashRecallManager.enabled) return;
    const duration = this.getTimerDuration();
    const timerDisplay = document.getElementById('timer-display');

    if (duration <= 0) {
      timerDisplay.classList.add('hidden');
      return;
    }

    timerDisplay.classList.remove('hidden');

    TimerManager.start(
      duration,
      false,
      (remaining, total) => {
        const pct = (remaining / total) * 100;
        const bar = document.getElementById('timer-bar');
        const text = document.getElementById('timer-text');
        bar.style.width = pct + '%';
        bar.className = 'timer-bar';
        text.className = 'timer-text';

        if (remaining <= 5 || pct < 15) {
          bar.classList.add('danger');
          text.classList.add('danger');
        } else if (remaining <= 10 || pct < 35) {
          bar.classList.add('warning');
        }

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        text.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      },
      () => {
        const text = document.getElementById('timer-text');
        text.className = 'timer-text';
        text.textContent = '0:00';
        document.getElementById('timer-bar').style.width = '0%';
        this.showBlurOverlay();
      }
    );
  },

  toggleTimerPause() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    const paused = TimerManager.togglePause();
    document.getElementById('btn-timer-pause').textContent = paused ? 'Resume' : 'Pause';
  },

  resetTimer() {
    if (this.sessionSource === 'board' || this.isBoardStageOpen) return;
    TimerManager.reset();
    document.getElementById('btn-timer-pause').textContent = 'Pause';
  },

  // ---- Deck Modal ----
  openDeckModal(editDeckId = null) {
    const modal = document.getElementById('modal-deck');
    const title = document.getElementById('modal-deck-title');
    const nameInput = document.getElementById('input-deck-name');
    const folderInput = document.getElementById('input-deck-folder');
    const newLimitInput = document.getElementById('input-deck-new-limit');
    const reviewLimitInput = document.getElementById('input-deck-review-limit');
    const errorEl = document.getElementById('folder-error');

    errorEl.classList.add('hidden');
    if (newLimitInput) newLimitInput.value = '20';
    if (reviewLimitInput) reviewLimitInput.value = '200';

    if (editDeckId) {
      const deck = DeckManager.getById(editDeckId);
      title.textContent = 'Edit Deck';
      nameInput.value = deck.name;
      folderInput.value = deck.folderPath;
      if (newLimitInput && deck.newLimit !== undefined) newLimitInput.value = deck.newLimit;
      if (reviewLimitInput && deck.reviewLimit !== undefined) reviewLimitInput.value = deck.reviewLimit;
      modal.dataset.editId = editDeckId;
    } else {
      title.textContent = 'New Deck';
      nameInput.value = '';
      folderInput.value = '';
      delete modal.dataset.editId;
    }

    modal.classList.remove('hidden');
    nameInput.focus();
  },

  closeDeckModal() {
    document.getElementById('modal-deck').classList.add('hidden');
  },

  async handleDeckSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-deck');
    const name = document.getElementById('input-deck-name').value.trim();
    const folder = document.getElementById('input-deck-folder').value.trim();
    const newLimit = document.getElementById('input-deck-new-limit').value;
    const reviewLimit = document.getElementById('input-deck-review-limit').value;
    const errorEl = document.getElementById('folder-error');

    if (!name || !folder) return;

    try {
      errorEl.classList.add('hidden');
      const res = await fetch(`/api/images?folder=${encodeURIComponent(folder)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (err) {
      errorEl.textContent = `Folder error: ${err.message}`;
      errorEl.classList.remove('hidden');
      return;
    }

    const editId = modal.dataset.editId;
    if (editId) {
      DeckManager.update(editId, name, folder, newLimit, reviewLimit);
      this.showToast('Deck updated', 'pencil');
    } else {
      DeckManager.create(name, folder, newLimit, reviewLimit);
      this.showToast('Deck created', 'sparkles');
    }

    if (typeof Storage !== 'undefined' && typeof Storage.syncToDisk === 'function') {
      try {
        await Storage.syncToDisk();
      } catch (e) {
        console.warn('Storage sync failed:', e);
      }
    }

    this.closeDeckModal();

    if (editId && this.currentDeckId === editId) {
      this.openDeckDetail(editId);
    } else {
      this.showDeckList();
    }
  },

  // ---- Folder Browser ----
  async openFolderBrowser() {
    const folderInput = document.getElementById('input-deck-folder');
    if (window.electronAPI && typeof window.electronAPI.pickDirectory === 'function') {
      try {
        const res = await window.electronAPI.pickDirectory();
        if (!res.canceled && res.path) {
          folderInput.value = res.path;
        }
        return;
      } catch (err) {
        console.warn('Native folder picker failed, falling back to web modal:', err);
      }
    }
    const currentVal = folderInput.value.trim();
    await this.browseTo(currentVal || undefined);
    document.getElementById('modal-folder-browser').classList.remove('hidden');
  },

  closeFolderBrowser() {
    document.getElementById('modal-folder-browser').classList.add('hidden');
  },

  async browseTo(folderPath) {
    try {
      const url = folderPath
        ? `/api/browse?path=${encodeURIComponent(folderPath)}`
        : '/api/browse';
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const data = await res.json();
      this.folderBrowserCurrentPath = data.current;
      this.renderFolderBrowser(data);
    } catch (err) {
      if (folderPath) {
        await this.browseTo(undefined);
      }
    }
  },

  renderFolderBrowser(data) {
    document.getElementById('folder-browser-path').textContent = data.current;
    document.getElementById('folder-browser-img-count').textContent =
      data.imageCount > 0 ? `${data.imageCount} images here` : 'No images here';

    const upBtn = document.getElementById('folder-browser-up');
    if (data.current !== data.parent) {
      upBtn.classList.remove('hidden');
    } else {
      upBtn.classList.add('hidden');
    }

    const listEl = document.getElementById('folder-browser-list');
    const emptyEl = document.getElementById('folder-browser-empty');

    if (data.dirs.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      listEl.innerHTML = data.dirs.map(dir => `
        <div class="folder-item" data-path="${this._esc(data.current + '/' + dir)}">
          ${this.getIconSvg('folder', 14, 'folder-item-icon')} <span>${this._esc(dir)}</span>
        </div>
      `).join('');

      listEl.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', () => {
          this.browseTo(item.dataset.path);
        });
      });
    }
  },

  browseFolderUp() {
    if (!this.folderBrowserCurrentPath) return;
    const parts = this.folderBrowserCurrentPath.split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    this.browseTo(parent);
  },

  selectBrowsedFolder() {
    if (this.folderBrowserCurrentPath) {
      document.getElementById('input-deck-folder').value = this.folderBrowserCurrentPath;
    }
    this.closeFolderBrowser();
  },

  // ---- Delete Modal ----
  openDeleteModal() {
    const deck = DeckManager.getById(this.currentDeckId);
    document.getElementById('delete-deck-name').textContent = deck.name;
    document.getElementById('modal-delete').classList.remove('hidden');
  },

  closeDeleteModal() {
    document.getElementById('modal-delete').classList.add('hidden');
  },

  confirmDelete() {
    const res = DeckManager.delete(this.currentDeckId);
    if (res === false) return;
    this.closeDeleteModal();
    this.showDeckList();
    this.showToast('Deck deleted', 'trash');
  },

  // ---- Helpers ----
  _esc(str) {
    return _escapeHtml(str);
  },

  _formatFutureDate(dateStr) {
    if (!dateStr) return '';
    const normDate = localDateStr(dateStr);
    const todayStr = localDateStr();
    if (normDate === todayStr) return 'Today';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(normDate + 'T00:00:00');
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
    return normDate;
  }
};

if (typeof window !== 'undefined') {
  window.UI = UI;
}
if (typeof globalThis !== 'undefined') {
  globalThis.UI = UI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UI
  };
}
