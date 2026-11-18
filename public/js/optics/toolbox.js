// ==================== ARTIST TOOLBOX ====================
const ArtistToolbox = {
  grayscale: false,
  notan: false,
  silhouette: false,
  silhouetteThreshold: 0.50, // 0.05 to 0.95 (default 50%)
  silhouetteInverted: false,
  posterize: false,
  posterizeSteps: 3,          // 2 to 6, default 3 (light, halftone, shadow — atelier foundation)
  posterizeMonochrome: true,
  squint: false,
  squintRadius: 6,            // 1 to 24px, default 6px
  gridMode: -1,        // index into GRID_MODES, -1 = grid off
  invert: false,
  flipX: 1,
  rotate: 0,           // logical rotation (0 / 90 / 180 / 270)
  rotateTotal: 0,      // cumulative rotation so the spin animation never reverses
  zoom: 1,
  panX: 0,
  panY: 0,
  fitScale: 1,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  MIN_ZOOM: 0.3,
  MAX_ZOOM: 8,

  // Proportion grid presets — cycled with [O] / the Grid button
  GRID_MODES: [
    { id: 'thirds', label: '3×3', name: 'Rule of Thirds (3×3)', cols: 3, rows: 3 },
    { id: 'quarters', label: '4×4', name: 'Quarters (4×4)', cols: 4, rows: 4 },
    { id: 'fine', label: '8×8', name: 'Fine Measure Grid (8×8)', cols: 8, rows: 8 },
    { id: 'diagonals', label: 'Diag', name: 'Axes & Diagonals', cols: 2, rows: 2, diagonals: true }
  ],

  get grid() {
    return this.gridMode >= 0;
  },

  _getElement(id) {
    if (typeof UI !== 'undefined' && UI.pipWindow && !UI.pipWindow.closed) {
      const el = UI.pipWindow.document.getElementById(id);
      if (el) return el;
    }
    return document.getElementById(id);
  },

  reset() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.rotate = 0;
    this.rotateTotal = 0;
    this.flipX = 1;
    this.grayscale = false;
    this.notan = false;
    this.silhouette = false;
    this.posterize = false;
    this.squint = false;
    this.squintRadius = 6;
    this.invert = false;
    this.updateSquintFilter();
    this._syncVisualFilters();
    this.fitImage(false);
  },

  _syncVisualFilters() {
    const container = this._getElement('session-image-container');
    if (!container) return;
    container.classList.toggle('filter-grayscale', this.grayscale);
    container.classList.toggle('filter-notan', this.notan);
    container.classList.toggle('filter-silhouette', this.silhouette);
    container.classList.toggle('filter-posterize', this.posterize);
    container.classList.toggle('filter-squint', this.squint);
    container.classList.toggle('filter-invert', this.invert);

    const gBtn = this._getElement('btn-art-grayscale');
    if (gBtn) gBtn.classList.toggle('active', this.grayscale);
    const nBtn = this._getElement('btn-art-notan');
    if (nBtn) nBtn.classList.toggle('active', this.notan);
    const sBtn = this._getElement('btn-art-silhouette');
    if (sBtn) sBtn.classList.toggle('active', this.silhouette);
    const pBtn = this._getElement('btn-art-posterize');
    if (pBtn) pBtn.classList.toggle('active', this.posterize);
    const sqBtn = this._getElement('btn-art-squint');
    if (sqBtn) sqBtn.classList.toggle('active', this.squint);
    const iBtn = this._getElement('btn-art-invert');
    if (iBtn) iBtn.classList.toggle('active', this.invert);

    this._syncFilterPanels();
    if (typeof UI !== 'undefined' && UI.updateCategoryIndicators) {
      UI.updateCategoryIndicators();
    }
  },

  _syncFilterPanels() {
    const dock = this._getElement('filter-controls-dock');
    const silPanel = this._getElement('panel-silhouette-controls');
    const postPanel = this._getElement('panel-posterize-controls');
    const squintPanel = this._getElement('panel-squint-controls');
    if (!dock) return;

    const hasAnyPanel = this.silhouette || this.posterize || this.squint;
    dock.classList.toggle('hidden', !hasAnyPanel);

    if (silPanel) {
      silPanel.classList.toggle('hidden', !this.silhouette);
      if (this.silhouette) {
        const silSlider = this._getElement('slider-silhouette-threshold');
        if (silSlider) silSlider.value = Math.round(this.silhouetteThreshold * 100);
        const silVal = this._getElement('val-silhouette-thresh');
        if (silVal) silVal.textContent = `${Math.round(this.silhouetteThreshold * 100)}%`;
        const silInvertBtn = this._getElement('btn-silhouette-invert');
        if (silInvertBtn) silInvertBtn.classList.toggle('active', this.silhouetteInverted);
      }
    }

    if (postPanel) {
      postPanel.classList.toggle('hidden', !this.posterize);
      if (this.posterize) {
        const postSlider = this._getElement('slider-posterize-steps');
        if (postSlider) postSlider.value = this.posterizeSteps;
        const postVal = this._getElement('val-posterize-steps');
        if (postVal) postVal.textContent = this.posterizeSteps;

        const p3 = this._getElement('btn-posterize-preset-3');
        const p4 = this._getElement('btn-posterize-preset-4');
        if (p3) p3.classList.toggle('active', this.posterizeSteps === 3);
        if (p4) p4.classList.toggle('active', this.posterizeSteps === 4);

        this.renderTonalChips(this.posterizeSteps);
      }
    }

    if (squintPanel) {
      squintPanel.classList.toggle('hidden', !this.squint);
      if (this.squint) {
        const sqSlider = this._getElement('slider-squint-radius');
        if (sqSlider) sqSlider.value = this.squintRadius;
        const sqVal = this._getElement('val-squint-radius');
        if (sqVal) sqVal.textContent = `${this.squintRadius}px`;

        const pLight = this._getElement('btn-squint-preset-light');
        const pMed = this._getElement('btn-squint-preset-medium');
        const pHeavy = this._getElement('btn-squint-preset-heavy');
        if (pLight) pLight.classList.toggle('active', this.squintRadius === 3);
        if (pMed) pMed.classList.toggle('active', this.squintRadius === 8);
        if (pHeavy) pHeavy.classList.toggle('active', this.squintRadius === 16);
      }
    }
  },

  renderTonalChips(steps) {
    const container = document.getElementById('posterize-tonal-chips');
    if (!container) return;

    let html = '';
    if (steps === 4) {
      html = `
        <span class="tonal-chip chip-light" title="Direct form light and specular highlights"><span class="tonal-dot dot-light"></span> Light</span>
        <span class="tonal-chip chip-halftone" title="Midtones & turning plane receiving grazing light"><span class="tonal-dot dot-halftone"></span> Halftone</span>
        <span class="tonal-chip chip-core" title="Form shadow core & terminator line"><span class="tonal-dot dot-core"></span> Core Shadow</span>
        <span class="tonal-chip chip-occlusion" title="Ambient occlusion, crevices & deepest darks"><span class="tonal-dot dot-occlusion"></span> Occlusion</span>
      `;
    } else if (steps === 3) {
      html = `
        <span class="tonal-chip chip-light" title="Direct form light and illuminated planes"><span class="tonal-dot dot-light"></span> Light</span>
        <span class="tonal-chip chip-halftone" title="Midtones & transitional values"><span class="tonal-dot dot-halftone"></span> Halftone</span>
        <span class="tonal-chip chip-shadow" title="Shadow family (core shadow, reflected light, occlusion)"><span class="tonal-dot dot-shadow"></span> Shadow</span>
      `;
    } else if (steps === 2) {
      html = `
        <span class="tonal-chip chip-light" title="Light family"><span class="tonal-dot dot-light"></span> Light</span>
        <span class="tonal-chip chip-shadow" title="Shadow family"><span class="tonal-dot dot-shadow"></span> Shadow (Notan)</span>
      `;
    } else if (steps === 5) {
      html = `
        <span class="tonal-chip chip-highlight" title="Specular highlights"><span class="tonal-dot dot-highlight"></span> Highlight</span>
        <span class="tonal-chip chip-light" title="Direct form light"><span class="tonal-dot dot-light"></span> Light</span>
        <span class="tonal-chip chip-halftone" title="Midtones"><span class="tonal-dot dot-halftone"></span> Halftone</span>
        <span class="tonal-chip chip-core" title="Core shadow"><span class="tonal-dot dot-core"></span> Core Shadow</span>
        <span class="tonal-chip chip-occlusion" title="Ambient occlusion"><span class="tonal-dot dot-occlusion"></span> Occlusion</span>
      `;
    } else {
      html = `
        <span class="tonal-chip chip-highlight"><span class="tonal-dot dot-highlight"></span> Highlight</span>
        <span class="tonal-chip chip-light"><span class="tonal-dot dot-light"></span> Light</span>
        <span class="tonal-chip chip-halftone"><span class="tonal-dot dot-halftone"></span> High Halftone</span>
        <span class="tonal-chip chip-halftone"><span class="tonal-dot dot-halftone"></span> Low Halftone</span>
        <span class="tonal-chip chip-core"><span class="tonal-dot dot-core"></span> Core Shadow</span>
        <span class="tonal-chip chip-occlusion"><span class="tonal-dot dot-occlusion"></span> Occlusion</span>
      `;
    }
    container.innerHTML = html;
  },

  updateSilhouetteFilter() {
    const r = document.getElementById('fe-silhouette-r');
    const g = document.getElementById('fe-silhouette-g');
    const b = document.getElementById('fe-silhouette-b');
    if (!r || !g || !b) return;

    const S = 280;
    const slope = this.silhouetteInverted ? -S : S;
    const intercept = this.silhouetteInverted ? (S * this.silhouetteThreshold) : (-S * this.silhouetteThreshold);

    [r, g, b].forEach(el => {
      el.setAttribute('type', 'linear');
      el.setAttribute('slope', slope.toFixed(2));
      el.setAttribute('intercept', intercept.toFixed(2));
    });

    this._refreshImageFilter();
  },

  setSilhouetteThreshold(val) {
    const parsed = Math.max(5, Math.min(95, parseInt(val, 10) || 50));
    this.silhouetteThreshold = parsed / 100;
    this.updateSilhouetteFilter();
    const silVal = document.getElementById('val-silhouette-thresh');
    if (silVal) silVal.textContent = `${parsed}%`;
  },

  adjustSilhouetteThreshold(delta) {
    SoundFX.toolToggle();
    const current = Math.round(this.silhouetteThreshold * 100);
    const next = Math.max(5, Math.min(95, current + Math.round(delta * 100)));
    this.setSilhouetteThreshold(next);
    const silSlider = document.getElementById('slider-silhouette-threshold');
    if (silSlider) silSlider.value = next;
  },

  toggleSilhouetteInvert() {
    SoundFX.toolToggle();
    this.silhouetteInverted = !this.silhouetteInverted;
    this.updateSilhouetteFilter();
    const btn = document.getElementById('btn-silhouette-invert');
    if (btn) btn.classList.toggle('active', this.silhouetteInverted);
  },

  resetSilhouetteThreshold() {
    SoundFX.toolToggle();
    this.silhouetteThreshold = 0.50;
    this.silhouetteInverted = false;
    this.updateSilhouetteFilter();
    const silSlider = document.getElementById('slider-silhouette-threshold');
    if (silSlider) silSlider.value = 50;
    const silVal = document.getElementById('val-silhouette-thresh');
    if (silVal) silVal.textContent = '50%';
    const btn = document.getElementById('btn-silhouette-invert');
    if (btn) btn.classList.remove('active');
  },

  updatePosterizeFilter() {
    const r = document.getElementById('fe-posterize-r');
    const g = document.getElementById('fe-posterize-g');
    const b = document.getElementById('fe-posterize-b');
    if (!r || !g || !b) return;

    const steps = Math.max(2, Math.min(6, this.posterizeSteps));
    const values = [];
    for (let i = 0; i < steps; i++) {
      values.push((i / (steps - 1)).toFixed(3));
    }
    const tableStr = values.join(' ');

    [r, g, b].forEach(el => {
      el.setAttribute('type', 'discrete');
      el.setAttribute('tableValues', tableStr);
    });

    this._refreshImageFilter();
  },

  setPosterizeSteps(steps) {
    const parsed = Math.max(2, Math.min(6, parseInt(steps, 10) || 4));
    this.posterizeSteps = parsed;
    this.updatePosterizeFilter();

    const postSlider = document.getElementById('slider-posterize-steps');
    if (postSlider) postSlider.value = parsed;
    const postVal = document.getElementById('val-posterize-steps');
    if (postVal) postVal.textContent = parsed;

    const p3 = document.getElementById('btn-posterize-preset-3');
    const p4 = document.getElementById('btn-posterize-preset-4');
    if (p3) p3.classList.toggle('active', parsed === 3);
    if (p4) p4.classList.toggle('active', parsed === 4);

    this.renderTonalChips(parsed);
  },

  adjustPosterizeSteps(delta) {
    SoundFX.toolToggle();
    const next = Math.max(2, Math.min(6, this.posterizeSteps + delta));
    this.setPosterizeSteps(next);
  },

  _refreshImageFilter() {
    const img = document.getElementById('session-image');
    if (img) {
      img.style.transform = img.style.transform;
    }
  },

  toggleGrayscale() {
    SoundFX.toolToggle();
    this.grayscale = !this.grayscale;
    if (this.grayscale) {
      this.notan = false;
      this.silhouette = false;
      this.posterize = false;
    }
    this._syncVisualFilters();
    this._hudPop('btn-art-grayscale');
  },

  toggleNotan() {
    SoundFX.toolToggle();
    this.notan = !this.notan;
    if (this.notan) {
      this.grayscale = false;
      this.silhouette = false;
      this.posterize = false;
    }
    this._syncVisualFilters();
    this._hudPop('btn-art-notan');
  },

  toggleSilhouette() {
    SoundFX.toolToggle();
    this.silhouette = !this.silhouette;
    if (this.silhouette) {
      this.grayscale = false;
      this.notan = false;
      this.posterize = false;
      this.updateSilhouetteFilter();
      if (typeof UI !== 'undefined' && UI.toggleToolDock) UI.toggleToolDock(true);
    }
    this._syncVisualFilters();
    this._hudPop('btn-art-silhouette');
  },

  togglePosterize() {
    SoundFX.toolToggle();
    this.posterize = !this.posterize;
    if (this.posterize) {
      this.grayscale = false;
      this.notan = false;
      this.silhouette = false;
      this.updatePosterizeFilter();
      if (typeof UI !== 'undefined' && UI.toggleToolDock) UI.toggleToolDock(true);
    }
    this._syncVisualFilters();
    this._hudPop('btn-art-posterize');
  },

  toggleSquint() {
    SoundFX.toolToggle();
    this.squint = !this.squint;
    this.updateSquintFilter();
    if (this.squint && typeof UI !== 'undefined' && UI.toggleToolDock) UI.toggleToolDock(true);
    this._syncVisualFilters();
    this._hudPop('btn-art-squint');
  },

  updateSquintFilter() {
    const radius = this.squint ? this.squintRadius : 0;
    const targets = [];
    const mainFe = document.getElementById('fe-squint-blur');
    if (mainFe) targets.push(mainFe);
    if (typeof UI !== 'undefined' && UI.pipWindow && !UI.pipWindow.closed) {
      try {
        const pipFe = UI.pipWindow.document.getElementById('fe-squint-blur');
        if (pipFe) targets.push(pipFe);
      } catch (e) { }
    }

    targets.forEach(el => {
      el.setAttribute('stdDeviation', String(radius));
    });

    this._refreshImageFilter();

    if (typeof UI !== 'undefined' && UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
      PiPCanvasStreamer.render();
    }
  },

  setSquintRadius(val) {
    const parsed = Math.max(1, Math.min(24, parseInt(val, 10) || 6));
    this.squintRadius = parsed;
    if (this.squint) {
      this.updateSquintFilter();
    }
    const sqVal = this._getElement('val-squint-radius');
    if (sqVal) sqVal.textContent = `${parsed}px`;
    const sqSlider = this._getElement('slider-squint-radius');
    if (sqSlider) sqSlider.value = parsed;

    const pLight = this._getElement('btn-squint-preset-light');
    const pMed = this._getElement('btn-squint-preset-medium');
    const pHeavy = this._getElement('btn-squint-preset-heavy');
    if (pLight) pLight.classList.toggle('active', parsed === 3);
    if (pMed) pMed.classList.toggle('active', parsed === 8);
    if (pHeavy) pHeavy.classList.toggle('active', parsed === 16);
  },

  adjustSquintRadius(delta) {
    SoundFX.toolToggle();
    const next = Math.max(1, Math.min(24, this.squintRadius + delta));
    this.setSquintRadius(next);
  },

  /**
   * Software HTML5 Canvas processor fallback for silhouette & posterize
   */
  processImageOnCanvas(imgEl, mode, options = {}) {
    const canvas = document.createElement('canvas');
    const width = imgEl.naturalWidth || imgEl.width || 800;
    const height = imgEl.naturalHeight || imgEl.height || 600;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, width, height);

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const len = data.length;

      if (mode === 'silhouette') {
        const threshold = (options.threshold ?? this.silhouetteThreshold) * 255;
        const inverted = options.inverted ?? this.silhouetteInverted;
        for (let i = 0; i < len; i += 4) {
          const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          const val = inverted ? (lum < threshold ? 255 : 0) : (lum < threshold ? 0 : 255);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      } else if (mode === 'posterize') {
        const steps = Math.max(2, Math.min(8, options.steps ?? this.posterizeSteps));
        for (let i = 0; i < len; i += 4) {
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          const stepIdx = Math.min(steps - 1, Math.floor(lum * steps));
          const val = Math.round((stepIdx / (steps - 1)) * 255);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Canvas pixel processing skipped (CORS/taint):', e);
    }
    return canvas;
  },

  _hudPop(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove('just-toggled');
    void btn.offsetWidth; // reflow to restart animation
    btn.classList.add('just-toggled');
    setTimeout(() => btn.classList.remove('just-toggled'), 350);
  },

  // Cycles: 3×3 → 4×4 → 8×8 → axes & diagonals → off
  toggleGrid() {
    SoundFX.toolToggle();
    this.gridMode++;
    if (this.gridMode >= this.GRID_MODES.length) this.gridMode = -1;
    this._syncGrid();
  },

  _syncGrid() {
    const overlay = document.getElementById('image-grid-overlay');
    const btn = document.getElementById('btn-art-grid');
    const label = document.getElementById('grid-mode-label');
    const mode = this.GRID_MODES[this.gridMode];

    if (!overlay) return;
    if (!mode) {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      if (btn) btn.classList.remove('active');
      if (label) label.classList.add('hidden');
      return;
    }

    const lines = [];
    for (let i = 1; i < mode.cols; i++) {
      const p = ((i / mode.cols) * 100).toFixed(3);
      lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="100"/>`);
    }
    for (let i = 1; i < mode.rows; i++) {
      const p = ((i / mode.rows) * 100).toFixed(3);
      lines.push(`<line x1="0" y1="${p}" x2="100" y2="${p}"/>`);
    }
    if (mode.diagonals) {
      lines.push('<line x1="0" y1="0" x2="100" y2="100"/>');
      lines.push('<line x1="100" y1="0" x2="0" y2="100"/>');
    }

    // Each line is drawn twice (dark underlay + light stroke) so it stays readable on any photo.
    // vector-effect keeps strokes 1px crisp at every zoom level.
    overlay.innerHTML =
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
      `<g class="grid-shadow">${lines.join('')}</g>` +
      `<g class="grid-main">${lines.join('')}</g>` +
      `<rect class="grid-edge" x="0" y="0" width="100" height="100"/>` +
      `</svg>`;
    overlay.classList.remove('hidden');
    if (btn) btn.classList.add('active');
    if (label) {
      label.textContent = mode.label;
      label.classList.remove('hidden');
    }
  },

  toggleInvert() {
    SoundFX.toolToggle();
    this.invert = !this.invert;
    this._syncVisualFilters();
    const btn = document.getElementById('btn-art-invert');
    if (btn) btn.classList.toggle('active', this.invert);
    this._hudPop('btn-art-invert');
  },

  flipHorizontal() {
    SoundFX.toolToggle();
    this.flipX *= -1;
    this.applyTransform();
  },

  rotate90() {
    SoundFX.toolToggle();
    this.rotateTotal += 90;
    this.rotate = ((this.rotateTotal % 360) + 360) % 360;
    // Re-fit so a rotated landscape photo never spills out of the stage
    this.fitImage(true);
  },

  /**
   * Zoom around a point (screen coordinates) so the detail under the cursor stays put.
   * With no point given, zooms around the center of the stage.
   */
  zoomTo(newZoom, clientX = null, clientY = null, snap = false) {
    newZoom = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, newZoom));
    if (snap && Math.abs(newZoom - 1) < 0.04) newZoom = 1;

    const stage = document.getElementById('image-stage');
    let px = 0;
    let py = 0;
    if (stage && clientX !== null && clientY !== null) {
      const r = stage.getBoundingClientRect();
      px = clientX - (r.left + r.width / 2);
      py = clientY - (r.top + r.height / 2);
    }

    const ratio = newZoom / this.zoom;
    this.panX = px - (px - this.panX) * ratio;
    this.panY = py - (py - this.panY) * ratio;
    this.zoom = newZoom;

    if (this.zoom === 1) {
      this.panX = 0;
      this.panY = 0;
    }
    this.clampPan();
    this.applyTransform();
  },

  // Used by the +/- buttons and hotkeys (delta sign picks direction)
  adjustZoom(delta) {
    this.zoomTo(this.zoom * (delta > 0 ? 1.25 : 1 / 1.25), null, null, true);
  },

  resetZoomPan() {
    SoundFX.toolToggle();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  },

  // Never let the picture be dragged completely out of view
  clampPan() {
    const stage = document.getElementById('image-stage');
    const frame = document.getElementById('image-frame');
    if (!stage || !frame) return;

    const quarter = this.rotate % 180 === 90;
    const vw = (quarter ? frame.offsetHeight : frame.offsetWidth) * this.zoom;
    const vh = (quarter ? frame.offsetWidth : frame.offsetHeight) * this.zoom;
    const keep = 80;
    const limX = Math.max(0, vw / 2 + stage.clientWidth / 2 - keep);
    const limY = Math.max(0, vh / 2 + stage.clientHeight / 2 - keep);

    this.panX = Math.min(limX, Math.max(-limX, this.panX));
    this.panY = Math.min(limY, Math.max(-limY, this.panY));
  },

  /**
   * Size the image frame to "contain" inside the stage (accounting for 90° rotation),
   * then re-apply the transform. Runs on image load, window/fullscreen resize and rotate.
   */
  fitImage(animate = false) {
    const stage = document.getElementById('image-stage');
    const frame = document.getElementById('image-frame');
    const img = document.getElementById('session-image');

    if (!stage || !frame || !img || !img.naturalWidth) {
      this.applyTransform();
      return;
    }

    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (sw < 10 || sh < 10) return; // stage hidden (e.g. empty-state)

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const quarter = this.rotate % 180 === 90;
    const ew = quarter ? nh : nw;
    const eh = quarter ? nw : nh;

    this.fitScale = Math.min(sw / ew, sh / eh, 3);

    if (animate) {
      frame.classList.remove('no-anim');
    } else {
      frame.classList.add('no-anim');
    }

    frame.style.width = `${Math.round(nw * this.fitScale)}px`;
    frame.style.height = `${Math.round(nh * this.fitScale)}px`;
    this.clampPan();
    this.applyTransform();

    if (!animate) {
      void frame.offsetWidth; // commit the un-animated size before re-enabling transitions
      requestAnimationFrame(() => frame.classList.remove('no-anim'));
    }
  },

  applyTransform() {
    const frame = document.getElementById('image-frame');
    if (frame) {
      frame.style.transform =
        `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom}) scaleX(${this.flipX}) rotate(${this.rotateTotal}deg)`;
      frame.classList.toggle('is-zoomed', this.zoom > 1.001);
    }
    const zoomBtn = document.getElementById('btn-img-zoom-reset');
    if (zoomBtn) zoomBtn.textContent = `${Math.round(this.zoom * 100)}%`;
  },

  setupDragAndWheel(customStage, customFrame) {
    const stage = customStage || document.getElementById('image-stage');
    const frame = customFrame || document.getElementById('image-frame');
    if (!stage || !frame) return;
    if (stage._hasDragAndWheel) return;
    stage._hasDragAndWheel = true;

    // Pointer-drag to pan (mouse, pen and touch)
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (typeof SmartCropManager !== 'undefined' && SmartCropManager.isCropping) return;
      if (typeof ColorPaletteManager !== 'undefined' && ColorPaletteManager.eyedropperActive) return;

      // When Plumb Tool is active or Shift key is held, measure anatomical tilt & drop-lines
      if (typeof PlumbTool !== 'undefined' && (e.shiftKey || PlumbTool.isActive)) {
        if (PlumbTool.startDrag(e)) {
          try { stage.setPointerCapture(e.pointerId); } catch (err) { }
          return;
        }
      }

      // When Sketch Alignment Mode is active, pan ONLY the sketch overlay
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.isAlignMode) {
        SketchOverlay.isDragging = true;
        SketchOverlay.lastPointerX = e.clientX;
        SketchOverlay.lastPointerY = e.clientY;
        try { stage.setPointerCapture(e.pointerId); } catch (err) { }
        return;
      }

      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      frame.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) { }
    });

    stage.addEventListener('pointermove', (e) => {
      // Plumb-line angle measurement drag
      if (typeof PlumbTool !== 'undefined' && PlumbTool.isMeasuring) {
        PlumbTool.updateDrag(e);
        if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
          PiPCanvasStreamer.render();
        }
        return;
      }

      // Pan ONLY the sketch overlay during Align Mode
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.isDragging) {
        const dx = e.clientX - SketchOverlay.lastPointerX;
        const dy = e.clientY - SketchOverlay.lastPointerY;
        SketchOverlay.lastPointerX = e.clientX;
        SketchOverlay.lastPointerY = e.clientY;

        const zoom = ArtistToolbox.zoom || 1;
        const flipX = ArtistToolbox.flipX || 1;
        const rotRad = -((ArtistToolbox.rotateTotal || 0) * Math.PI) / 180;

        const unrotX = (dx * Math.cos(rotRad) - dy * Math.sin(rotRad)) / zoom * flipX;
        const unrotY = (dx * Math.sin(rotRad) + dy * Math.cos(rotRad)) / zoom;

        SketchOverlay.sketchOffsetX += unrotX;
        SketchOverlay.sketchOffsetY += unrotY;
        SketchOverlay.applyStyles();
        SketchOverlay.syncUI();

        if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
          PiPCanvasStreamer.render();
        }
        return;
      }

      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.clampPan();
      this.applyTransform();
    });

    const endDrag = (e) => {
      if (typeof PlumbTool !== 'undefined' && PlumbTool.isMeasuring) {
        PlumbTool.endDrag(e);
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { }
        if (UI.isSafariVideoPiP && typeof PiPCanvasStreamer !== 'undefined') {
          PiPCanvasStreamer.render();
        }
        return;
      }

      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.isDragging) {
        SketchOverlay.isDragging = false;
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { }
        return;
      }
      if (!this.isDragging) return;
      this.isDragging = false;
      frame.classList.remove('dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) { }
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // Wheel / trackpad-pinch zoom, anchored to the cursor
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Scale or Rotate ONLY the sketch overlay during Align Mode
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.isAlignMode) {
        if (e.shiftKey) {
          // Holding Shift + Scroll: rotate in 0.5deg steps
          const dir = e.deltaY > 0 ? 0.5 : -0.5;
          SketchOverlay.adjustRotate(dir);
        } else {
          // Scrolling wheel: scale in 1% increments (0.01)
          const dir = e.deltaY < 0 ? 0.01 : -0.01;
          SketchOverlay.adjustScale(dir);
        }
        return;
      }

      let dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      dy = Math.max(-150, Math.min(150, dy));
      const sensitivity = e.ctrlKey ? 0.012 : 0.0022; // pinch gestures arrive with ctrlKey
      this.zoomTo(this.zoom * Math.exp(-dy * sensitivity), e.clientX, e.clientY);
    }, { passive: false });

    // Double-click: in Align mode, reset alignment; otherwise jump to 2.5× at cursor or fit
    stage.addEventListener('dblclick', (e) => {
      if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.isAlignMode) {
        SketchOverlay.resetAlign();
        return;
      }
      if (this.zoom !== 1 || this.panX !== 0 || this.panY !== 0) {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
      } else {
        this.zoomTo(2.5, e.clientX, e.clientY);
      }
    });

    // Keep the picture perfectly fitted when the window / fullscreen layout changes
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.fitImage(false)).observe(stage);
    } else {
      window.addEventListener('resize', () => this.fitImage(false));
    }
  }
};

// ==================== FLOATING MOVABLE WINDOW CONTROLLER ====================
const FloatingWindowManager = {
  activeZIndex: 520,

  bringToFront(el) {
    if (!el) return;
    this.activeZIndex += 2;
    el.style.zIndex = this.activeZIndex;
  },

  makeDraggable(panel, header, options = {}) {
    if (!panel || !header) return;
    if (panel._hasDraggable) return;
    panel._hasDraggable = true;

    const getContainer = () => options.getContainer?.() || document.getElementById('session-image-container') || panel.parentElement;

    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startLeft = 0;
    let startTop = 0;
    let currentPointerId = null;

    panel.addEventListener('pointerdown', () => {
      this.bringToFront(panel);
    });

    header.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      // Do not drag if clicked directly on an interactive button, input, or control
      if (e.target.closest('button, input, textarea, select, a, .btn, .btn-hud, .btn-hud-mini, .btn-dock-close, .btn-sketch-vis, .btn-blend-mode, .palette-swatch-chip, .btn-copy-hex, .btn-clear-text, [data-no-drag]')) {
        return;
      }

      const container = getContainer();
      if (!container) return;

      const panelRect = panel.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Convert current rendered layout to explicit left/top px relative to container
      const curLeft = panelRect.left - containerRect.left;
      const curTop = panelRect.top - containerRect.top;

      panel.classList.add('is-positioned');
      panel.style.transform = 'none';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.margin = '0';
      panel.style.left = `${Math.round(curLeft)}px`;
      panel.style.top = `${Math.round(curTop)}px`;

      isDragging = true;
      currentPointerId = e.pointerId;
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      startLeft = curLeft;
      startTop = curTop;

      panel.classList.add('is-dragging');
      document.body.classList.add('window-dragging-active');
      this.bringToFront(panel);

      try {
        header.setPointerCapture(e.pointerId);
      } catch (_) { }

      e.preventDefault();
    });

    header.addEventListener('pointermove', (e) => {
      if (!isDragging || e.pointerId !== currentPointerId) return;

      const container = getContainer();
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;

      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      const pad = 6;
      const maxLeft = Math.max(pad, containerRect.width - panelRect.width - pad);
      const maxTop = Math.max(pad, containerRect.height - panelRect.height - pad);

      newLeft = Math.max(pad, Math.min(maxLeft, newLeft));
      newTop = Math.max(pad, Math.min(maxTop, newTop));

      panel.style.left = `${Math.round(newLeft)}px`;
      panel.style.top = `${Math.round(newTop)}px`;

      if (typeof options.onMove === 'function') {
        options.onMove({ left: newLeft, top: newTop });
      }
    });

    const endDrag = (e) => {
      if (!isDragging) return;
      if (currentPointerId !== null && e.pointerId !== undefined && e.pointerId !== currentPointerId) return;

      isDragging = false;
      currentPointerId = null;
      panel.classList.remove('is-dragging');
      document.body.classList.remove('window-dragging-active');

      try {
        header.releasePointerCapture(e.pointerId);
      } catch (_) { }

      const pos = {
        left: parseFloat(panel.style.left) || 0,
        top: parseFloat(panel.style.top) || 0
      };
      if (typeof options.onEnd === 'function') {
        options.onEnd(pos);
      }
    };

    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);

    // Keep clamped when the studio window or image container resizes
    window.addEventListener('resize', () => {
      if (panel.classList.contains('hidden') || !panel.classList.contains('is-positioned')) return;
      const container = getContainer();
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) return;

      const curLeft = parseFloat(panel.style.left);
      const curTop = parseFloat(panel.style.top);
      if (isNaN(curLeft) || isNaN(curTop)) return;

      const pad = 6;
      const maxLeft = Math.max(pad, containerRect.width - panelRect.width - pad);
      const maxTop = Math.max(pad, containerRect.height - panelRect.height - pad);

      const clampedLeft = Math.max(pad, Math.min(maxLeft, curLeft));
      const clampedTop = Math.max(pad, Math.min(maxTop, curTop));

      if (clampedLeft !== curLeft) panel.style.left = `${Math.round(clampedLeft)}px`;
      if (clampedTop !== curTop) panel.style.top = `${Math.round(clampedTop)}px`;
    });
  }
};

if (typeof window !== 'undefined') {
  window.ArtistToolbox = ArtistToolbox;
  window.FloatingWindowManager = FloatingWindowManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ArtistToolbox = ArtistToolbox;
  globalThis.FloatingWindowManager = FloatingWindowManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ArtistToolbox,
    FloatingWindowManager
  };
}
