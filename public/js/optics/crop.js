// ==================== SMART CROP / FOCAL POINT ZOOM CARDS ====================
const SmartCropManager = {
  isCropping: false,
  isFocalMode: false,
  cropState: {
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    box: { left: 0, top: 0, width: 0, height: 0 }
  },
  selectedTags: ['hands'],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Toolbar button
    const btnCrop = document.getElementById('btn-art-crop');
    if (btnCrop) {
      btnCrop.addEventListener('click', () => this.startCrop());
    }

    // Cancel buttons
    const btnCancel = document.getElementById('btn-cancel-crop');
    const btnCancelPop = document.getElementById('btn-cancel-crop-popover');
    if (btnCancel) btnCancel.addEventListener('click', () => this.cancelCrop());
    if (btnCancelPop) btnCancelPop.addEventListener('click', () => this.cancelCrop());

    // Confirm button
    const btnConfirm = document.getElementById('btn-confirm-crop');
    if (btnConfirm) btnConfirm.addEventListener('click', () => this.confirmCrop());

    // Focal pill context toggle (Shift+C / click)
    const focalPill = document.getElementById('session-focal-pill');
    if (focalPill) {
      focalPill.addEventListener('click', (e) => {
        if (e.target.closest('#btn-remove-crop')) return;
        this.toggleFocalContext();
      });
    }

    const btnToggle = document.getElementById('btn-toggle-crop-context');
    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFocalContext();
      });
    }

    const btnRemove = document.getElementById('btn-remove-crop');
    if (btnRemove) {
      btnRemove.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeCrop();
      });
    }

    // Topic tag preset pills inside popover
    const tagBtns = document.querySelectorAll('.btn-crop-tag');
    tagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        this.selectedTags = Array.from(document.querySelectorAll('.btn-crop-tag.active')).map(b => b.dataset.tag);
      });
    });

    // Enter key inside crop label input
    const input = document.getElementById('crop-label-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmCrop();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelCrop();
        }
      });
    }

    // Interactive Drag Selection on Overlay Backdrop
    const overlay = document.getElementById('smart-crop-overlay');
    if (overlay) {
      overlay.addEventListener('pointerdown', (e) => this.onOverlayPointerDown(e));
      window.addEventListener('pointermove', (e) => this.onOverlayPointerMove(e));
      window.addEventListener('pointerup', (e) => this.onOverlayPointerUp(e));
    }
  },

  startCrop() {
    const sessionView = document.getElementById('view-session');
    if (!sessionView || !sessionView.classList.contains('active') || !SessionManager.currentImage) {
      UI.showToast('Start a study session to create crop cards', 'info');
      return;
    }

    if (this.isCropping) {
      this.cancelCrop();
      return;
    }

    this.isCropping = true;
    SoundFX.toolToggle();

    // Reset zoom and pan so artist can frame from the full image
    ArtistToolbox.resetZoomPan();

    const overlay = document.getElementById('smart-crop-overlay');
    const cropBox = document.getElementById('crop-box');
    const popover = document.getElementById('crop-popover');
    const btn = document.getElementById('btn-art-crop');

    if (overlay) overlay.classList.remove('hidden');
    if (btn) btn.classList.add('active');

    // Default crop box in center of stage
    const stage = document.getElementById('image-stage');
    if (stage && cropBox) {
      const rect = stage.getBoundingClientRect();
      const defaultW = Math.min(rect.width * 0.45, 260);
      const defaultH = Math.min(rect.height * 0.45, 260);
      const defaultL = (rect.width - defaultW) / 2;
      const defaultT = (rect.height - defaultH) / 2;

      this.cropState.box = { left: defaultL, top: defaultT, width: defaultW, height: defaultH };
      this.updateCropBoxDOM();
      cropBox.classList.remove('hidden');
      if (popover) popover.classList.remove('hidden');

      const input = document.getElementById('crop-label-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
      }
    }
  },

  cancelCrop() {
    this.isCropping = false;
    this.cropState.isDragging = false;
    const overlay = document.getElementById('smart-crop-overlay');
    const btn = document.getElementById('btn-art-crop');
    if (overlay) overlay.classList.add('hidden');
    if (btn) btn.classList.remove('active');
  },

  onOverlayPointerDown(e) {
    if (!this.isCropping) return;
    if (e.target.closest('#crop-popover')) return;

    e.preventDefault();
    const stage = document.getElementById('image-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    this.cropState.isDragging = true;
    this.cropState.startX = e.clientX - rect.left;
    this.cropState.startY = e.clientY - rect.top;
    this.cropState.currentX = this.cropState.startX;
    this.cropState.currentY = this.cropState.startY;

    const popover = document.getElementById('crop-popover');
    if (popover) popover.classList.add('hidden');

    this.updateCropFromDrag();
  },

  onOverlayPointerMove(e) {
    if (!this.isCropping || !this.cropState.isDragging) return;

    const stage = document.getElementById('image-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    this.cropState.currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    this.cropState.currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    this.updateCropFromDrag();
  },

  onOverlayPointerUp() {
    if (!this.isCropping || !this.cropState.isDragging) return;
    this.cropState.isDragging = false;

    // Minimum size check: if drawn too small, ensure at least 60x60
    if (this.cropState.box.width < 35 || this.cropState.box.height < 35) {
      this.cropState.box.width = Math.max(120, this.cropState.box.width);
      this.cropState.box.height = Math.max(120, this.cropState.box.height);
      this.updateCropBoxDOM();
    }

    const popover = document.getElementById('crop-popover');
    if (popover) popover.classList.remove('hidden');

    const input = document.getElementById('crop-label-input');
    if (input) input.focus();
  },

  updateCropFromDrag() {
    const left = Math.min(this.cropState.startX, this.cropState.currentX);
    const top = Math.min(this.cropState.startY, this.cropState.currentY);
    const width = Math.max(10, Math.abs(this.cropState.currentX - this.cropState.startX));
    const height = Math.max(10, Math.abs(this.cropState.currentY - this.cropState.startY));

    this.cropState.box = { left, top, width, height };
    this.updateCropBoxDOM();
  },

  updateCropBoxDOM() {
    const cropBox = document.getElementById('crop-box');
    if (!cropBox) return;

    const { left, top, width, height } = this.cropState.box;
    cropBox.style.left = `${left}px`;
    cropBox.style.top = `${top}px`;
    cropBox.style.width = `${width}px`;
    cropBox.style.height = `${height}px`;
    cropBox.classList.remove('hidden');
  },

  async confirmCrop() {
    if (!SessionManager.currentImage || !UI.currentDeckId) return;

    const img = document.getElementById('session-image') || document.getElementById('reference-image');
    const stage = document.getElementById('image-stage');
    if (!img || !stage || !img.naturalWidth || !img.naturalHeight) return;

    const imgRect = img.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    // Box coordinates relative to viewport
    const boxScreenLeft = stageRect.left + this.cropState.box.left;
    const boxScreenTop = stageRect.top + this.cropState.box.top;
    const boxScreenRight = boxScreenLeft + this.cropState.box.width;
    const boxScreenBottom = boxScreenTop + this.cropState.box.height;

    // Normalize relative to image element bounds (0 to 1)
    const normX = Math.max(0, Math.min(1, (boxScreenLeft - imgRect.left) / imgRect.width));
    const normY = Math.max(0, Math.min(1, (boxScreenTop - imgRect.top) / imgRect.height));
    const normW = Math.max(0.01, Math.min(1 - normX, (boxScreenRight - boxScreenLeft) / imgRect.width));
    const normH = Math.max(0.01, Math.min(1 - normY, (boxScreenBottom - boxScreenTop) / imgRect.height));

    const sourceX = Math.round(normX * img.naturalWidth);
    const sourceY = Math.round(normY * img.naturalHeight);
    const sourceW = Math.max(1, Math.round(normW * img.naturalWidth));
    const sourceH = Math.max(1, Math.round(normH * img.naturalHeight));

    // Slice pixel region onto offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = sourceW;
    canvas.height = sourceH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
    const dataUrl = canvas.toDataURL('image/png');
    // Immediately free canvas memory per specification
    canvas.width = 1;
    canvas.height = 1;

    // Determine selected tag
    const input = document.getElementById('crop-label-input');
    const customTag = (input && typeof input.value === 'string' && input.value.trim()) ? input.value.trim().toLowerCase().replace(/^#/, '') : '';
    const activeTagBtn = document.querySelector('.btn-crop-tag.active');
    const defaultTag = activeTagBtn ? activeTagBtn.dataset.tag : (this.selectedTags[0] || 'hands');
    const selectedTag = customTag || defaultTag || 'hands';

    const currentDeck = DeckManager.getById(UI.currentDeckId || SessionManager.deckId);
    const folderPath = currentDeck ? (currentDeck.folderPath || currentDeck.folder) : '';
    const currentImage = SessionManager.currentImage;
    const deckId = UI.currentDeckId || SessionManager.deckId;

    try {
      const res = await fetch('/api/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath,
          dataUrl,
          cardId: currentImage.id,
          tag: selectedTag
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save crop');
      }

      const cropData = await res.json();

      // On existing card: store cropImage and add tags (without creating a child card)
      const card = CardManager.getOrCreateCard(deckId, currentImage.id, currentImage.name);
      card.cropImage = {
        cropPath: cropData.cropPath,
        cropUrl: cropData.cropUrl,
        tag: selectedTag,
        bounds: {
          x: parseFloat(normX.toFixed(4)),
          y: parseFloat(normY.toFixed(4)),
          w: parseFloat(normW.toFixed(4)),
          h: parseFloat(normH.toFixed(4))
        }
      };

      if (!Array.isArray(card.tags)) card.tags = [];
      if (!card.tags.includes('crop')) card.tags.push('crop');
      if (selectedTag && !card.tags.includes(selectedTag)) card.tags.push(selectedTag);

      CardManager.save();
      if (typeof Storage !== 'undefined') {
        if (typeof Storage.syncToServer === 'function') {
          Storage.syncToServer(false).catch(() => { });
        } else if (typeof Storage.syncToDisk === 'function') {
          Storage.syncToDisk(false).catch(() => { });
        }
      }

      try {
        SoundFX.cardAdd();
      } catch (e) { }

      UI.showToast(`Saved crop: #${selectedTag}`, 'scissors');

      // Immediately display cropped image at normal 100% stage fit (no camera zoom/pan offset)
      ArtistToolbox.resetZoomPan();
      img.src = cropData.cropUrl;

      this.isFocalMode = true;
      this.updateFocalPillUI(card);
      UI.renderSessionCardTags();
    } catch (err) {
      console.error('[SmartCropManager] Failed to save crop:', err);
      UI.showToast(`Crop save failed: ${err.message}`, 'alert');
    }

    this.cancelCrop();
  },

  onImageLoaded(image) {
    const focalPill = document.getElementById('session-focal-pill');
    if (!image) {
      if (focalPill) focalPill.classList.add('hidden');
      this.isFocalMode = false;
      return;
    }

    const deckId = UI.currentDeckId || SessionManager.deckId;
    const card = CardManager.getCard(deckId, image.id);
    if (card && card.cropImage && card.cropImage.cropUrl) {
      this.isFocalMode = true;
      if (focalPill) {
        focalPill.classList.remove('hidden');
        this.updateFocalPillUI(card);
      }
      return;
    }

    // Legacy child card fallback
    if (image.isChild && image.crop) {
      this.isFocalMode = true;
      if (focalPill) {
        focalPill.classList.remove('hidden');
        this.updateFocalPillUI(null, image);
      }
      this.applyFocalCrop(image.crop);
      return;
    }

    if (focalPill) focalPill.classList.add('hidden');
    this.isFocalMode = false;
  },

  applyFocalCrop(crop) {
    if (!crop) return;
    const stage = document.getElementById('image-stage');
    const img = document.getElementById('session-image');
    if (!stage || !img || !img.naturalWidth) return;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const fitScale = ArtistToolbox.fitScale || 1;

    // Center of crop in normalized coordinates (0 to 1)
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;

    // Offset from image center (0.5, 0.5)
    const dx = cx - 0.5;
    const dy = cy - 0.5;

    // Zoom level required to fill frame with the cropped box
    const maxSpan = Math.max(crop.w, crop.h);
    const targetZoom = Math.min(ArtistToolbox.MAX_ZOOM, Math.max(1.15, (0.88 / maxSpan)));

    // Calculate required pan in pixels
    const frameW = nw * fitScale;
    const frameH = nh * fitScale;
    const panX = - (dx * frameW) * targetZoom;
    const panY = - (dy * frameH) * targetZoom;

    ArtistToolbox.zoom = targetZoom;
    ArtistToolbox.panX = panX;
    ArtistToolbox.panY = panY;
    ArtistToolbox.applyTransform();
  },

  toggleFocalContext() {
    if (!SessionManager.currentImage) return;
    const deckId = UI.currentDeckId || SessionManager.deckId;
    const card = CardManager.getCard(deckId, SessionManager.currentImage.id);
    const imgEl = document.getElementById('session-image') || document.getElementById('reference-image');
    if (!imgEl) return;

    if (card && card.cropImage && card.cropImage.cropUrl) {
      this.isFocalMode = !this.isFocalMode;
      SoundFX.toolToggle();
      ArtistToolbox.resetZoomPan();

      if (this.isFocalMode) {
        imgEl.src = card.cropImage.cropUrl;
      } else {
        const fullUrl = SessionManager.currentImage.url || SessionManager.getImageUrl(SessionManager.currentImage);
        imgEl.src = fullUrl;
      }

      this.updateFocalPillUI(card);
      return;
    }

    if (SessionManager.currentImage.isChild && SessionManager.currentImage.crop) {
      this.isFocalMode = !this.isFocalMode;
      SoundFX.toolToggle();
      if (this.isFocalMode) {
        this.applyFocalCrop(SessionManager.currentImage.crop);
      } else {
        ArtistToolbox.resetZoomPan();
      }
      this.updateFocalPillUI(null, SessionManager.currentImage);
    }
  },

  async removeCrop() {
    if (!SessionManager.currentImage) return;
    const deckId = UI.currentDeckId || SessionManager.deckId;
    const card = CardManager.getCard(deckId, SessionManager.currentImage.id);
    if (!card) return;

    const cropPath = card.cropImage && card.cropImage.cropPath;
    const cropTag = card.cropImage && card.cropImage.tag;

    // 1. Call DELETE /api/crop to remove cropped image file from _crops/
    if (cropPath) {
      try {
        await fetch('/api/crop', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cropPath })
        });
      } catch (err) {
        console.warn('[SmartCropManager] Failed to delete crop file from disk:', err);
      }
    }

    // 2. Delete card.cropImage (and legacy card.crop bounds if present)
    delete card.cropImage;
    if ('crop' in card) {
      delete card.crop;
    }

    // 3. Remove 'crop' and cropTag from card.tags
    if (Array.isArray(card.tags)) {
      card.tags = card.tags.filter(t => t !== 'crop' && (!cropTag || t.toLowerCase() !== cropTag.toLowerCase()));
    }

    // 4. Save card state (card itself & all SRS review history kept intact)
    CardManager.save();

    // 5. Switch #reference-image.src immediately back to full uncropped parent reference image
    const imgEl = document.getElementById('session-image') || document.getElementById('reference-image');
    if (imgEl) {
      ArtistToolbox.resetZoomPan();
      const fullUrl = SessionManager.currentImage.url || SessionManager.getImageUrl(SessionManager.currentImage);
      imgEl.src = fullUrl;
    }

    // 6. Reset focal mode & hide #session-focal-pill
    this.isFocalMode = false;
    const focalPill = document.getElementById('session-focal-pill');
    if (focalPill) {
      focalPill.classList.add('hidden');
      focalPill.classList.remove('active');
    }

    // 7. Sync state
    if (typeof Storage !== 'undefined') {
      if (typeof Storage.syncToServer === 'function') {
        Storage.syncToServer(false).catch(() => { });
      } else if (typeof Storage.syncToDisk === 'function') {
        Storage.syncToDisk(false).catch(() => { });
      }
    }

    UI.showToast('Crop removed from reference', 'check');
    UI.renderSessionCardTags();
  },

  updateFocalPillUI(card, legacyImage = null) {
    const focalPill = document.getElementById('session-focal-pill');
    if (!focalPill) return;

    const titleEl = document.getElementById('focal-pill-title');
    const toggleBtnText = document.getElementById('focal-context-btn-text');

    const rawTag = (card && card.cropImage && card.cropImage.tag) ||
      (card && card.crop && card.crop.label) ||
      (legacyImage && legacyImage.crop && legacyImage.crop.label) ||
      'crop';
    const tag = (typeof UI !== 'undefined' && UI._esc) ? UI._esc(rawTag) : rawTag;

    if (titleEl) {
      titleEl.innerHTML = `Crop: #${tag}`;
    }

    if (toggleBtnText) {
      toggleBtnText.textContent = this.isFocalMode ? 'Full Image' : 'Cropped View';
    }

    focalPill.classList.toggle('active', this.isFocalMode);
    focalPill.classList.remove('hidden');
  }
};

if (typeof window !== 'undefined') {
  window.SmartCropManager = SmartCropManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SmartCropManager = SmartCropManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SmartCropManager
  };
}
