// ==================== ONION-SKIN SKETCH OVERLAY (SELF-CRITIQUE TOOL) ====================
const SketchOverlay = {
  active: false,
  visible: true,
  dockVisible: true,
  isMinimized: false,
  dockPos: null,
  imageSrc: null,
  imgEl: null,
  blendMode: 'difference', // 'difference' | 'normal' | 'multiply'
  opacity: 1.0,
  fitMode: 'fill', // 'fill' | 'contain'
  sketchOffsetX: 0,
  sketchOffsetY: 0,
  sketchScale: 1.0,
  sketchRotate: 0,
  isAlignMode: false,
  isDragging: false,
  lastPointerX: 0,
  lastPointerY: 0,

  init() {
    this.imgEl = document.getElementById('sketch-overlay-img');
    this.setupDraggable();
    this.bindEvents();
  },

  setupDraggable() {
    const dock = document.getElementById('sketch-critique-dock');
    if (!dock) return;
    const header = dock.querySelector('.sketch-dock-header') || dock.querySelector('.sketch-dock-row');
    if (!header) return;

    FloatingWindowManager.makeDraggable(dock, header, {
      onEnd: (pos) => {
        this.dockPos = pos;
      }
    });
  },

  toggleDock(forceState = null) {
    if (!this.active) {
      this.promptPasteOrUpload();
      return;
    }
    const next = forceState !== null ? forceState : !this.dockVisible;
    this.dockVisible = next;
    this.syncUI();
    SoundFX.click();
    if (this.dockVisible) {
      const dock = document.getElementById('sketch-critique-dock');
      if (dock) FloatingWindowManager.bringToFront(dock);
    }
  },

  toggleMinimize(forceState = null) {
    const next = forceState !== null ? forceState : !this.isMinimized;
    this.isMinimized = next;
    const dock = document.getElementById('sketch-critique-dock');
    const btnMin = document.getElementById('btn-sketch-min-dock');
    if (dock) dock.classList.toggle('minimized', this.isMinimized);
    if (btnMin) {
      btnMin.title = this.isMinimized ? 'Expand Controls' : 'Minimize Controls';
      btnMin.innerHTML = this.isMinimized
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }
    SoundFX.click();
  },

  loadFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      UI.showToast('Please provide an image file (PNG, JPG, WebP)', 'alert');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.loadFromDataUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  },

  loadFromDataUrl(dataUrl) {
    this.imageSrc = dataUrl;
    this.active = true;
    this.visible = true;
    this.dockVisible = true;

    // Default to Difference mode on new import as requested
    this.blendMode = 'difference';
    this.opacity = 1.0;
    this.isAlignMode = false;
    this.sketchOffsetX = 0;
    this.sketchOffsetY = 0;
    this.sketchScale = 1.0;
    this.sketchRotate = 0;

    const img = document.getElementById('sketch-overlay-img');
    if (img) {
      this.imgEl = img;
      img.src = dataUrl;
    }

    const wrap = document.getElementById('sketch-overlay-wrap');
    if (wrap) wrap.classList.remove('hidden');

    const dock = document.getElementById('sketch-critique-dock');
    if (dock) {
      dock.classList.remove('hidden');
      FloatingWindowManager.bringToFront(dock);
    }

    // If timer ended and blur overlay is active, unblur so artist can critique proportions!
    if (UI.imageBlurred) {
      UI.clearBlurOverlay();
    }

    this.applyStyles();
    this.syncUI();

    if (typeof SketchComparison !== 'undefined') {
      SketchComparison.currentSketchDataUrl = dataUrl;
      SketchComparison.selectedAttemptIndex = -1;
      SketchComparison.syncUI();
    }

    if (typeof ColorPaletteManager !== 'undefined' && ColorPaletteManager.onSketchChanged) {
      ColorPaletteManager.onSketchChanged();
    }

    SoundFX.click();

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  setBlendMode(mode) {
    this.blendMode = mode;
    // Set intuitive default opacity per mode
    if (mode === 'difference') {
      this.opacity = 1.0;
    } else if (mode === 'normal') {
      this.opacity = 0.65;
    } else if (mode === 'multiply') {
      this.opacity = 0.90;
    }
    this.applyStyles();
    this.syncUI();
    SoundFX.click();

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  setOpacity(val) {
    this.opacity = Math.max(0, Math.min(1, val));
    this.applyStyles();
    const valBadge = document.getElementById('sketch-opacity-val');
    if (valBadge) valBadge.textContent = `${Math.round(this.opacity * 100)}%`;

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  toggleVisibility() {
    if (!this.active) {
      this.promptPasteOrUpload();
      return;
    }
    this.visible = !this.visible;
    const wrap = document.getElementById('sketch-overlay-wrap');
    if (wrap) wrap.style.display = this.visible ? 'flex' : 'none';

    const icon = document.getElementById('sketch-vis-icon');
    if (icon) icon.innerHTML = UI.getIconSvg(this.visible ? 'eye' : 'eye-off', 14);

    SoundFX.hover();

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  toggleFitMode() {
    this.fitMode = this.fitMode === 'fill' ? 'contain' : 'fill';
    this.applyStyles();
    this.syncUI();
  },

  toggleAlignMode(forceState) {
    if (!this.active) {
      this.promptPasteOrUpload();
      return;
    }
    this.isAlignMode = typeof forceState === 'boolean' ? forceState : !this.isAlignMode;
    this.syncUI();
    SoundFX.hover();
  },

  adjustScale(delta) {
    this.sketchScale = Math.max(0.1, Math.min(5.0, +(this.sketchScale + delta).toFixed(4)));
    this.applyStyles();
    this.syncUI();
    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  adjustRotate(delta) {
    this.sketchRotate = +((this.sketchRotate + delta) % 360).toFixed(1);
    this.applyStyles();
    this.syncUI();
    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  resetAlign() {
    this.sketchOffsetX = 0;
    this.sketchOffsetY = 0;
    this.sketchScale = 1.0;
    this.sketchRotate = 0;
    this.applyStyles();
    this.syncUI();
    SoundFX.click();

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  clear() {
    this.active = false;
    this.visible = false;
    this.dockVisible = false;
    this.isAlignMode = false;
    this.sketchOffsetX = 0;
    this.sketchOffsetY = 0;
    this.sketchScale = 1.0;
    this.sketchRotate = 0;
    this.imageSrc = null;

    const stage = document.getElementById('image-stage');
    if (stage) stage.classList.remove('sketch-align-active');

    const img = document.getElementById('sketch-overlay-img');
    if (img) img.src = '';

    const wrap = document.getElementById('sketch-overlay-wrap');
    if (wrap) wrap.classList.add('hidden');

    const dock = document.getElementById('sketch-critique-dock');
    if (dock) dock.classList.add('hidden');

    const toolbarBtn = document.getElementById('btn-art-sketch');
    if (toolbarBtn) toolbarBtn.classList.remove('active');

    SoundFX.click();
    UI.showToast('Sketch overlay removed', 'info');

    if (typeof ColorPaletteManager !== 'undefined' && ColorPaletteManager.onSketchChanged) {
      ColorPaletteManager.onSketchChanged();
    }

    if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  applyStyles() {
    const wrap = document.getElementById('sketch-overlay-wrap');
    const img = document.getElementById('sketch-overlay-img');
    if (!wrap || !img) return;

    img.style.mixBlendMode = this.blendMode;
    img.style.objectFit = this.fitMode;
    img.style.transform = `translate(${this.sketchOffsetX}px, ${this.sketchOffsetY}px) rotate(${this.sketchRotate}deg) scale(${this.sketchScale})`;
    img.style.transformOrigin = 'center center';
    wrap.style.opacity = this.opacity;
    wrap.style.display = this.visible ? 'flex' : 'none';
  },

  syncUI() {
    const dock = document.getElementById('sketch-critique-dock');
    if (!dock) return;

    dock.classList.toggle('hidden', !this.active || !this.dockVisible);
    dock.classList.toggle('minimized', this.isMinimized);

    const toolbarBtn = document.getElementById('btn-art-sketch');
    if (toolbarBtn) toolbarBtn.classList.toggle('active', this.active);

    if (this.dockPos && this.active && this.dockVisible) {
      dock.classList.add('is-positioned');
      dock.style.left = `${this.dockPos.left}px`;
      dock.style.top = `${this.dockPos.top}px`;
      dock.style.transform = 'none';
    }

    // Update blend mode pills
    dock.querySelectorAll('.btn-blend-mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.blend === this.blendMode);
    });

    // Update slider and badge
    const slider = document.getElementById('slider-sketch-opacity');
    const valBadge = document.getElementById('sketch-opacity-val');
    if (slider) slider.value = Math.round(this.opacity * 100);
    if (valBadge) valBadge.textContent = `${Math.round(this.opacity * 100)}%`;

    // Update fit button
    const fitBtn = document.getElementById('btn-sketch-fit-toggle');
    if (fitBtn) {
      fitBtn.textContent = this.fitMode === 'fill' ? 'Fill 1:1' : 'Contain';
    }

    // Update align button & metrics
    const alignBtn = document.getElementById('btn-sketch-align-toggle');
    const alignLabel = document.getElementById('sketch-align-label');
    const alignMetrics = document.getElementById('sketch-align-metrics');
    const stage = document.getElementById('image-stage');

    if (alignBtn) {
      alignBtn.classList.toggle('active', this.isAlignMode);
    }
    if (alignLabel) {
      alignLabel.textContent = this.isAlignMode ? 'Aligning [A]' : 'Align [A]';
    }
    if (stage) {
      stage.classList.toggle('sketch-align-active', this.isAlignMode && this.active);
    }
    if (alignMetrics) {
      const hasTransform = this.sketchOffsetX !== 0 || this.sketchOffsetY !== 0 || this.sketchScale !== 1 || this.sketchRotate !== 0;
      if (this.isAlignMode || hasTransform) {
        alignMetrics.classList.remove('hidden');
        const ox = Math.round(this.sketchOffsetX);
        const oy = Math.round(this.sketchOffsetY);
        const sc = Math.round(this.sketchScale * 100);
        const rot = this.sketchRotate.toFixed(1);
        alignMetrics.textContent = `${ox > 0 ? '+' : ''}${ox},${oy > 0 ? '+' : ''}${oy}px · ${sc}% · ${rot}°`;
      } else {
        alignMetrics.classList.add('hidden');
      }
    }

    // Update eye icon
    const icon = document.getElementById('sketch-vis-icon');
    if (icon) icon.innerHTML = UI.getIconSvg(this.visible ? 'eye' : 'eye-off', 14);
  },

  bindEvents() {
    // Window-level Paste listener (Cmd+V / Ctrl+V)
    window.addEventListener('paste', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName) && activeEl.id !== 'sketch-file-input') {
        return;
      }
      const sessionView = document.getElementById('view-session');
      if (!sessionView || !sessionView.classList.contains('active')) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            this.loadFromFile(file);
            return;
          }
        }
      }
    });

    // Drag and Drop listeners
    const stage = document.getElementById('image-stage');
    if (stage) {
      const dropTarget = document.getElementById('sketch-drop-target');

      ['dragenter', 'dragover'].forEach(ev => {
        stage.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropTarget) dropTarget.classList.remove('hidden');
        });
      });

      ['dragleave', 'drop'].forEach(ev => {
        stage.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropTarget && (e.type === 'drop' || e.relatedTarget === null || !stage.contains(e.relatedTarget))) {
            dropTarget.classList.add('hidden');
          }
        });
      });

      stage.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropTarget) dropTarget.classList.add('hidden');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            if (files[i].type && files[i].type.startsWith('image/')) {
              this.loadFromFile(files[i]);
              return;
            }
          }
        }
      });
    }

    // Blend mode button clicks
    const dock = document.getElementById('sketch-critique-dock');
    if (dock) {
      dock.querySelectorAll('.btn-blend-mode').forEach(btn => {
        btn.addEventListener('click', () => {
          this.setBlendMode(btn.dataset.blend);
        });
      });
    }

    // Opacity slider
    const slider = document.getElementById('slider-sketch-opacity');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.setOpacity(parseInt(e.target.value, 10) / 100);
      });
    }

    // Visibility toggle (eye button)
    const visBtn = document.getElementById('btn-sketch-toggle-vis');
    if (visBtn) {
      visBtn.addEventListener('click', () => this.toggleVisibility());
    }

    // Fit toggle button
    const fitBtn = document.getElementById('btn-sketch-fit-toggle');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => this.toggleFitMode());
    }

    // Align toggle button
    const alignToggleBtn = document.getElementById('btn-sketch-align-toggle');
    if (alignToggleBtn) {
      alignToggleBtn.addEventListener('click', () => this.toggleAlignMode());
    }

    // Align reset button
    const alignResetBtn = document.getElementById('btn-sketch-align-reset');
    if (alignResetBtn) {
      alignResetBtn.addEventListener('click', () => this.resetAlign());
    }

    // Hide dock button (hides floating dock window, keeps sketch attempt active)
    const hideDockBtn = document.getElementById('btn-sketch-hide-dock');
    if (hideDockBtn) {
      hideDockBtn.addEventListener('click', () => this.toggleDock(false));
    }

    // Minimize dock button
    const minDockBtn = document.getElementById('btn-sketch-min-dock');
    if (minDockBtn) {
      minDockBtn.addEventListener('click', () => this.toggleMinimize());
    }

    // Clear button (removes sketch overlay)
    const clearBtn = document.getElementById('btn-sketch-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }

    // Paste button in dock
    const pasteBtn = document.getElementById('btn-sketch-paste-new');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => this.promptPasteOrUpload());
    }

    // Hidden file input change
    const fileInput = document.getElementById('sketch-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.loadFromFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Side toolbar Overlay button
    const artBtn = document.getElementById('btn-art-sketch');
    if (artBtn) {
      artBtn.addEventListener('click', () => {
        if (this.active) {
          if (!this.dockVisible) {
            this.toggleDock(true);
          } else {
            this.toggleVisibility();
          }
        } else {
          this.promptPasteOrUpload();
        }
      });
    }

    // Blur overlay "Paste Finished Sketch" button
    const blurPasteBtn = document.getElementById('btn-blur-paste-sketch');
    if (blurPasteBtn) {
      blurPasteBtn.addEventListener('click', () => this.promptPasteOrUpload());
    }

    // Blur overlay "Unblur Reference" button
    const blurUnblurBtn = document.getElementById('btn-blur-unblur-peek');
    if (blurUnblurBtn) {
      blurUnblurBtn.addEventListener('click', () => {
        UI.clearBlurOverlay();
      });
    }
  },

  async promptPasteOrUpload() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            this.loadFromFile(blob);
            return;
          }
        }
      }
    } catch (err) { }

    // Fallback: trigger file picker
    const fileInput = document.getElementById('sketch-file-input');
    if (fileInput) fileInput.click();
  }
};

// ==================== SKETCH COMPARISON & VISUAL HISTORY CONTROLLER ====================
const SketchComparison = {
  currentSketchDataUrl: null,
  activeMode: 'single', // 'single' | 'split' | 'overlay'
  selectedAttemptIndex: -1, // -1 means today's sketch; >= 0 means past attempt index

  init() {
    this.bindEvents();
  },

  // Called whenever a new card is loaded into the session
  onCardLoaded(deckId, imageId) {
    this.currentSketchDataUrl = null;
    this.selectedAttemptIndex = -1;
    this.activeMode = 'single';
    this.syncUI();
    this.updateHistoryBadge(deckId, imageId);
  },

  updateHistoryBadge(deckId, imageId) {
    const attempts = CardManager.getAttempts(deckId, imageId);
    const count = attempts.length;

    const toolbarBadge = document.getElementById('history-attempts-badge');
    if (toolbarBadge) {
      toolbarBadge.textContent = count;
      toolbarBadge.classList.toggle('hidden', count === 0);
    }

    const pill = document.getElementById('session-history-pill');
    const pillText = document.getElementById('history-pill-text');
    if (pill && pillText) {
      if (count > 0) {
        pillText.textContent = `${count} Past Attempt${count === 1 ? '' : 's'}`;
        pill.classList.remove('hidden');
      } else {
        pill.classList.add('hidden');
      }
    }
  },

  // Loads a sketch file (from clipboard paste, drag & drop, or file input)
  async loadSketch(fileOrDataUrl) {
    if (typeof fileOrDataUrl === 'string') {
      this._setSketch(fileOrDataUrl);
      return;
    }

    if (!fileOrDataUrl || !fileOrDataUrl.type.startsWith('image/')) {
      UI.showToast('Please provide an image file (PNG, JPG, WebP)', 'alert');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this._setSketch(e.target.result);
    };
    reader.readAsDataURL(fileOrDataUrl);
  },

  _setSketch(dataUrl) {
    this.currentSketchDataUrl = dataUrl;
    this.selectedAttemptIndex = -1; // Viewing today's sketch

    // Also mirror to SketchOverlay for onion-skin difference blend mode
    if (typeof SketchOverlay !== 'undefined') {
      SketchOverlay.loadFromDataUrl(dataUrl);
    }

    // Always unblur reference so artist can see both side-by-side
    if (UI.imageBlurred) {
      UI.clearBlurOverlay();
    }

    // Switch to Side-by-Side comparison mode automatically
    this.setMode('split');
    this.syncUI();

    SoundFX.click();
  },

  removeCurrentSketch() {
    this.currentSketchDataUrl = null;
    this.selectedAttemptIndex = -1;
    if (typeof SketchOverlay !== 'undefined') {
      SketchOverlay.clear();
    }
    this.setMode('single');
    this.syncUI();
    SoundFX.click();
  },

  setMode(mode) {
    this.activeMode = mode;
    const stage = document.getElementById('image-stage');
    const splitView = document.getElementById('sketch-split-view');

    if (mode === 'split') {
      if (stage) stage.classList.add('hidden');
      if (splitView) splitView.classList.remove('hidden');
      this.renderSplitView();
    } else {
      if (stage) stage.classList.remove('hidden');
      if (splitView) splitView.classList.add('hidden');
      ArtistToolbox.fitImage(false);
    }

    this.syncUI();
  },

  toggleSplitView() {
    if (this.activeMode === 'split') {
      this.setMode('single');
    } else {
      this.setMode('split');
    }
  },

  renderSplitView() {
    const splitRefImg = document.getElementById('split-ref-image');
    const splitSketchImg = document.getElementById('split-sketch-image');
    const splitSketchEmpty = document.getElementById('split-sketch-empty');
    const splitRefName = document.getElementById('split-ref-name');
    const splitDateBadge = document.getElementById('split-sketch-date');
    const splitTag = document.getElementById('split-sketch-tag');
    const tabsContainer = document.getElementById('split-history-tabs');

    if (!SessionManager.currentImage) return;

    // 1. Render Reference Photo
    if (splitRefImg) {
      splitRefImg.src = SessionManager.getImageUrl(SessionManager.currentImage);
    }
    if (splitRefName) {
      splitRefName.textContent = SessionManager.currentImage.name || 'Reference';
    }

    const deckId = SessionManager.deckId;
    const imageId = SessionManager.currentImage.id;
    const attempts = CardManager.getAttempts(deckId, imageId);

    // 2. Build History Tabs
    if (tabsContainer) {
      let tabsHtml = '';
      if (attempts.length > 0) {
        attempts.forEach((att, idx) => {
          const isSelected = this.selectedAttemptIndex === idx;
          const ratingDot = `<span class="rating-dot dot-${UI._esc(att.rating || 'medium')}"></span>`;
          tabsHtml += `
            <button type="button" class="btn-history-tab ${isSelected ? 'active' : ''}" data-idx="${idx}" title="${UI._esc(`${att.date} • ${att.rating}`)}">
              ${ratingDot} #${idx + 1} (${UI._esc(att.rating)})
            </button>
          `;
        });
      }

      const isTodaySelected = this.selectedAttemptIndex === -1;
      const starIcon = UI.getIconSvg ? UI.getIconSvg('star', 12, 'history-tab-star') : '';
      tabsHtml += `
        <button type="button" class="btn-history-tab ${isTodaySelected ? 'active' : ''}" data-idx="-1" title="Today's Sketch">
          ${starIcon} Today
        </button>
      `;

      tabsContainer.innerHTML = tabsHtml;

      tabsContainer.querySelectorAll('.btn-history-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectedAttemptIndex = parseInt(btn.dataset.idx, 10);
          this.renderSplitView();
          SoundFX.click();
        });
      });
    }

    // 3. Render Right Sketch Pane
    if (this.selectedAttemptIndex >= 0 && attempts[this.selectedAttemptIndex]) {
      // Viewing past attempt
      const att = attempts[this.selectedAttemptIndex];
      if (splitSketchImg) {
        if (att && isValidSketchUrl(att.sketchUrl)) {
          splitSketchImg.src = att.sketchUrl;
          splitSketchImg.classList.remove('hidden');
        } else {
          splitSketchImg.src = '';
          splitSketchImg.classList.add('hidden');
        }
      }
      if (splitSketchEmpty) splitSketchEmpty.classList.add('hidden');
      if (splitTag) splitTag.textContent = `Attempt #${this.selectedAttemptIndex + 1}`;
      if (splitDateBadge) splitDateBadge.textContent = `${att.date} • ${att.rating.toUpperCase()}`;
    } else if (this.currentSketchDataUrl) {
      // Viewing today's sketch
      if (splitSketchImg) {
        splitSketchImg.src = this.currentSketchDataUrl;
        splitSketchImg.classList.remove('hidden');
      }
      if (splitSketchEmpty) splitSketchEmpty.classList.add('hidden');
      if (splitTag) splitTag.innerHTML = `${UI.getIconSvg('pencil', 12)} Your Sketch`;
      if (splitDateBadge) splitDateBadge.textContent = 'Today (Rating...)';
    } else {
      // No sketch attached yet for today
      if (splitSketchImg) {
        splitSketchImg.src = '';
        splitSketchImg.classList.add('hidden');
      }
      if (splitSketchEmpty) splitSketchEmpty.classList.remove('hidden');
      if (splitTag) splitTag.innerHTML = `${UI.getIconSvg('pencil', 12)} Your Sketch`;
      if (splitDateBadge) splitDateBadge.textContent = 'Awaiting Sketch';
    }
  },

  syncUI() {
    const hasSketch = !!this.currentSketchDataUrl;
    const emptyBar = document.getElementById('rating-sketch-empty');
    const activeBar = document.getElementById('rating-sketch-active');
    const thumb = document.getElementById('rating-sketch-thumb');
    const splitBtn = document.getElementById('btn-toggle-split-view');
    const overlayBtn = document.getElementById('btn-toggle-overlay-view');
    const historyBtn = document.getElementById('btn-art-history');

    if (emptyBar && activeBar) {
      emptyBar.classList.toggle('hidden', hasSketch);
      activeBar.classList.toggle('hidden', !hasSketch);
    }

    if (thumb && hasSketch) {
      thumb.src = this.currentSketchDataUrl;
    }

    if (splitBtn) splitBtn.classList.toggle('active', this.activeMode === 'split');
    if (overlayBtn) overlayBtn.classList.toggle('active', this.activeMode === 'overlay');
    if (historyBtn) historyBtn.classList.toggle('active', this.activeMode === 'split');
  },

  async saveAttempt(deckId, imageId, imageName, rating, dataUrl) {
    if (!dataUrl || !imageId) return null;
    try {
      const card = CardManager.getCard(deckId, imageId) || { imageId };
      let sketchUrl = dataUrl;
      if (typeof sketchUrl === 'string' && sketchUrl.startsWith('data:image/')) {
        try {
          const res = await fetch('/api/sketch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId: card.imageId, dataUrl: sketchUrl })
          });
          if (res.ok) {
            const json = await res.json();
            if (json && json.sketchUrl) {
              sketchUrl = json.sketchUrl;
            }
          }
        } catch (err) {
          console.warn('[SketchComparison] Could not upload sketch to /api/sketch:', err.message);
        }
      }

      if (!isValidSketchUrl(sketchUrl)) {
        sketchUrl = '';
      }

      const attempt = {
        id: 'att_' + Date.now(),
        date: localDateStr(),
        rating,
        sketchUrl,
        timestamp: Date.now()
      };
      await CardManager.addAttempt(deckId, imageId, attempt);
      console.log(`[SketchComparison] Saved visual attempt to disk for ${imageId}:`, sketchUrl);
      return attempt;
    } catch (err) {
      console.warn('[SketchComparison] Could not save sketch to disk:', err.message);
    }
    return null;
  },

  bindEvents() {
    // Rating bar drop/paste handlers
    const ratingBar = document.getElementById('rating-sketch-bar');
    if (ratingBar) {
      ['dragenter', 'dragover'].forEach(ev => {
        ratingBar.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          ratingBar.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        ratingBar.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          ratingBar.classList.remove('dragover');
        });
      });
      ratingBar.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ratingBar.classList.remove('dragover');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('image/')) {
              this.loadSketch(files[i]);
              return;
            }
          }
        }
      });
    }

    // Attach sketch buttons (trigger file picker)
    const attachBtn = document.getElementById('btn-rating-attach-sketch');
    const splitUploadBtn = document.getElementById('btn-split-upload-sketch');
    const fileInput = document.getElementById('sketch-file-input');
    const triggerFile = () => { if (fileInput) fileInput.click(); };
    if (attachBtn) attachBtn.addEventListener('click', triggerFile);
    if (splitUploadBtn) splitUploadBtn.addEventListener('click', triggerFile);

    // Remove sketch button
    const removeBtn = document.getElementById('btn-remove-rating-sketch');
    if (removeBtn) removeBtn.addEventListener('click', () => this.removeCurrentSketch());

    // Mode toggles
    const toggleSplitBtn = document.getElementById('btn-toggle-split-view');
    if (toggleSplitBtn) toggleSplitBtn.addEventListener('click', () => this.setMode('split'));

    const toggleOverlayBtn = document.getElementById('btn-toggle-overlay-view');
    if (toggleOverlayBtn) toggleOverlayBtn.addEventListener('click', () => {
      this.setMode('single');
      if (typeof SketchOverlay !== 'undefined' && this.currentSketchDataUrl) {
        SketchOverlay.loadFromDataUrl(this.currentSketchDataUrl);
      }
    });

    const closeSplitBtn = document.getElementById('btn-close-split-view');
    if (closeSplitBtn) closeSplitBtn.addEventListener('click', () => this.setMode('single'));

    // History button in toolbar and session history pill
    const historyToolbarBtn = document.getElementById('btn-art-history');
    if (historyToolbarBtn) historyToolbarBtn.addEventListener('click', () => this.toggleSplitView());

    const historyPill = document.getElementById('session-history-pill');
    if (historyPill) historyPill.addEventListener('click', () => this.setMode('split'));
  }
};

if (typeof window !== 'undefined') {
  window.SketchOverlay = SketchOverlay;
  window.SketchComparison = SketchComparison;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SketchOverlay = SketchOverlay;
  globalThis.SketchComparison = SketchComparison;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SketchOverlay,
    SketchComparison
  };
}
