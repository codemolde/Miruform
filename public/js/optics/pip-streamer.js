// ==================== NATIVE CANVAS PIP STREAMER (SAFARI / MACOS) ====================
const PiPCanvasStreamer = {
  canvas: null,
  ctx: null,
  video: null,
  isActive: false,
  _animId: null,

  init() {
    this.canvas = document.getElementById('safari-pip-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    this.video = document.getElementById('safari-pip-video');
  },

  async start() {
    this.init();
    if (!this.canvas || !this.video) return false;

    this.isActive = true;
    this.render();

    // Start render loop so WebKit's captureStream gets continuous frames
    const loop = () => {
      if (!this.isActive) return;
      this.render();
      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);

    try {
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.defaultMuted = true;

      const stream = this.canvas.captureStream ? this.canvas.captureStream(30) : null;
      if (!stream) {
        throw new Error('captureStream is not supported on this browser');
      }
      this.video.srcObject = stream;
      await this.video.play();

      if (document.pictureInPictureEnabled && this.video !== document.pictureInPictureElement) {
        await this.video.requestPictureInPicture();
      }

      this.video.addEventListener('leavepictureinpicture', () => {
        this.stop();
        UI.closePiP(false);
      }, { once: true });

      // MediaSession controls on macOS native floating PiP window
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: SessionManager.currentImage ? SessionManager.currentImage.name : 'Drawing Reference',
          artist: 'Miruform • macOS Always-on-Top PiP',
          album: 'Miruform Spaced Repetition'
        });
        try {
          navigator.mediaSession.setActionHandler('nexttrack', () => UI.showNextImage());
          navigator.mediaSession.setActionHandler('play', () => UI.toggleTimerPause());
          navigator.mediaSession.setActionHandler('pause', () => UI.toggleTimerPause());
        } catch (e) { }
      }

      return true;
    } catch (err) {
      console.error('Failed to start Video Picture-in-Picture:', err);
      this.stop();
      return false;
    }
  },

  stop() {
    this.isActive = false;
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    if (document.pictureInPictureElement && document.exitPictureInPicture) {
      try { document.exitPictureInPicture().catch(() => { }); } catch (e) { }
    }
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
  },

  render() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark atelier background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    const img = document.getElementById('session-image');
    if (img && img.naturalWidth > 0 && img.complete) {
      const topMargin = 38;
      const bottomMargin = 42;
      const stageW = w - 16;
      const stageH = h - topMargin - bottomMargin;
      const stageX = 8;
      const stageY = topMargin;

      renderFilteredCanvas(ctx, img, {
        zoom: ArtistToolbox.zoom,
        panX: ArtistToolbox.panX,
        panY: ArtistToolbox.panY,
        flipX: ArtistToolbox.flipX,
        rotate: ArtistToolbox.rotate,
        rotateTotal: ArtistToolbox.rotateTotal,
        squint: ArtistToolbox.squint,
        squintRadius: ArtistToolbox.squintRadius,
        grayscale: ArtistToolbox.grayscale,
        notan: ArtistToolbox.notan,
        silhouette: ArtistToolbox.silhouette,
        silhouetteThreshold: ArtistToolbox.silhouetteThreshold,
        silhouetteInverted: ArtistToolbox.silhouetteInverted,
        posterize: ArtistToolbox.posterize,
        posterizeSteps: ArtistToolbox.posterizeSteps,
        invert: ArtistToolbox.invert,
        backgroundColor: '#0f1420',
        onDrawTransformed: (tCtx, nw, nh, drawW, drawH) => {
          // Render Sketch Overlay on canvas stream if active
          if (typeof SketchOverlay !== 'undefined' && SketchOverlay.active && SketchOverlay.visible && SketchOverlay.imgEl && SketchOverlay.imgEl.complete && SketchOverlay.imgEl.naturalWidth > 0) {
            tCtx.save();
            tCtx.globalAlpha = SketchOverlay.opacity;
            if (SketchOverlay.blendMode === 'difference') {
              tCtx.globalCompositeOperation = 'difference';
            } else if (SketchOverlay.blendMode === 'multiply') {
              tCtx.globalCompositeOperation = 'multiply';
            } else {
              tCtx.globalCompositeOperation = 'source-over';
            }

            // Apply independent Pan, Rotate, and Scale alignment
            tCtx.translate(SketchOverlay.sketchOffsetX || 0, SketchOverlay.sketchOffsetY || 0);
            if (SketchOverlay.sketchRotate) {
              tCtx.rotate((SketchOverlay.sketchRotate * Math.PI) / 180);
            }
            if (SketchOverlay.sketchScale && SketchOverlay.sketchScale !== 1) {
              tCtx.scale(SketchOverlay.sketchScale, SketchOverlay.sketchScale);
            }

            tCtx.drawImage(SketchOverlay.imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
            tCtx.restore();
          }

          // Render Plumb-Line & Angle Measurement Overlay on canvas stream if active
          if (typeof PlumbTool !== 'undefined' && (PlumbTool.lines.length > 0 || PlumbTool.currentLine)) {
            PlumbTool.renderToCanvas(tCtx, nw, nh, drawW, drawH);
          }
        }
      }, { x: stageX, y: stageY, width: stageW, height: stageH });

      // Apply CIELAB L* Value Map overlay to canvas streamer if active
      if (typeof ColorPaletteManager !== 'undefined' && ColorPaletteManager.valueMapOverlayActive) {
        ColorPaletteManager.applyValueMapToContext(ctx, stageX, stageY, stageW, stageH, ColorPaletteManager.valueMapBands);
      }

      // Draw Proportion Grid
      if (ArtistToolbox.grid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        const mode = ArtistToolbox.GRID_MODES[ArtistToolbox.gridMode] || ArtistToolbox.GRID_MODES[0];
        const cols = mode.cols || 3;
        const rows = mode.rows || 3;

        for (let c = 1; c < cols; c++) {
          const gx = stageX + (stageW * c) / cols;
          ctx.beginPath();
          ctx.moveTo(gx, stageY);
          ctx.lineTo(gx, stageY + stageH);
          ctx.stroke();
        }
        for (let r = 1; r < rows; r++) {
          const gy = stageY + (stageH * r) / rows;
          ctx.beginPath();
          ctx.moveTo(stageX, gy);
          ctx.lineTo(stageX + stageW, gy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Top Header: Timer Bar & Time Display
    const timerDuration = UI.getTimerDuration ? UI.getTimerDuration() : 0;
    if (timerDuration > 0 && TimerManager.isRunning()) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(8, 12, w - 16, 5);

      const progress = Math.max(0, Math.min(1, TimerManager.remaining / timerDuration));
      ctx.fillStyle = progress <= 0.15 ? '#ef4444' : '#58a6ff';
      ctx.fillRect(8, 12, (w - 16) * progress, 5);
    }

    const timerTextEl = document.getElementById('timer-text');
    const timerStr = timerTextEl ? timerTextEl.textContent : '0:00';
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.beginPath();
    ctx.rect(w - 78, 6, 70, 22);
    ctx.fill();

    ctx.fillStyle = '#f0f6fc';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timerStr, w - 43, 17);

    // Left title badge: Deck progress
    const progressEl = document.getElementById('session-progress');
    const progText = progressEl ? progressEl.textContent : '#1';
    ctx.fillStyle = '#8b949e';
    ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(progText, 12, 17);

    // Active filter badge if any filter is active
    let filterTag = '';
    if (ArtistToolbox.silhouette) filterTag = `SIL ${Math.round(ArtistToolbox.silhouetteThreshold * 100)}%`;
    else if (ArtistToolbox.posterize) filterTag = `POST ${ArtistToolbox.posterizeSteps}`;
    else if (ArtistToolbox.notan) filterTag = 'NOTAN';
    else if (ArtistToolbox.grayscale) filterTag = 'VALUE';
    if (filterTag) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(48, 6, 72, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10.5px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(filterTag, 84, 17);
    }

    // Active card tags (e.g. #hands #foreshortening)
    if (SessionManager.currentImage && UI.currentDeckId) {
      const cardTags = CardManager.getTagsForCard(UI.currentDeckId, SessionManager.currentImage.id);
      if (cardTags && cardTags.length > 0) {
        const tagText = cardTags.map(t => `#${t}`).join(' ');
        const startX = filterTag ? 128 : 52;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, startX, 17);
      }
    }

    // Bottom Dock: Spaced Repetition Hotkey Guide Pill
    const pillY = h - 34;
    const pillH = 26;
    const pillW = 320;
    const pillX = (w - pillW) / 2;

    ctx.fillStyle = 'rgba(12, 16, 25, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11.5px monospace, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('1 Again', pillX + 16, pillY + pillH / 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('2 Hard', pillX + 92, pillY + pillH / 2);
    ctx.fillStyle = '#10b981';
    ctx.fillText('3 Good', pillX + 168, pillY + pillH / 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('4 Easy', pillX + 244, pillY + pillH / 2);
  }
};

if (typeof window !== 'undefined') {
  window.PiPCanvasStreamer = PiPCanvasStreamer;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PiPCanvasStreamer = PiPCanvasStreamer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PiPCanvasStreamer
  };
}
