/**
 * Pure, reusable helper function to draw an image with active crops, transforms,
 * and optical filters onto a 2D canvas context.
 * Used by PiPCanvasStreamer.
 *
 * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context
 * @param {HTMLImageElement|HTMLCanvasElement|Object} sourceImage - Image source
 * @param {Object} [transformAndFilterState={}] - Active filters and transform state
 * @param {Object} [targetRect=null] - Destination rectangle { x, y, width, height }
 */
function renderFilteredCanvas(ctx, sourceImage, transformAndFilterState, targetRect) {
  if (!ctx || !sourceImage) return;

  const nw = sourceImage.naturalWidth || sourceImage.width || 0;
  const nh = sourceImage.naturalHeight || sourceImage.height || 0;
  if (!nw || !nh) return;

  const rect = targetRect || {
    x: 0,
    y: 0,
    width: ctx.canvas ? ctx.canvas.width : 300,
    height: ctx.canvas ? ctx.canvas.height : 150
  };
  const stageX = rect.x !== undefined ? rect.x : (rect.stageX || 0);
  const stageY = rect.y !== undefined ? rect.y : (rect.stageY || 0);
  const stageW = rect.width !== undefined ? rect.width : (rect.stageW || 300);
  const stageH = rect.height !== undefined ? rect.height : (rect.stageH || 150);

  const state = transformAndFilterState || {};
  const zoom = state.zoom !== undefined ? state.zoom : 1;
  const panX = state.panX || 0;
  const panY = state.panY || 0;
  const flipX = state.flipX !== undefined ? state.flipX : 1;
  const rotateDeg = state.rotateTotal !== undefined ? state.rotateTotal : (state.rotate || 0);
  const rotateRad = (rotateDeg * Math.PI) / 180;
  const isQuarter = (Math.abs(Math.round(rotateDeg / 90)) % 2) === 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(stageX, stageY, stageW, stageH);
  ctx.clip();

  if (state.backgroundColor !== null && state.backgroundColor !== undefined) {
    ctx.fillStyle = state.backgroundColor || '#0f1420';
    ctx.fillRect(stageX, stageY, stageW, stageH);
  }

  // Handle crop bounds if specified (Smart Crop normalized { x, y, w, h } or pixel coordinates)
  const crop = state.cropBounds || state.crop;
  let sx = 0, sy = 0, sw = nw, sh = nh;
  if (crop) {
    const rawX = crop.x !== undefined ? crop.x : 0;
    const rawY = crop.y !== undefined ? crop.y : 0;
    const rawW = crop.w !== undefined ? crop.w : (crop.width !== undefined ? crop.width : 1);
    const rawH = crop.h !== undefined ? crop.h : (crop.height !== undefined ? crop.height : 1);
    if (rawW <= 1 && rawH <= 1 && (rawX < 1 || rawY < 1)) {
      // Normalized coordinates (0..1)
      sx = rawX * nw;
      sy = rawY * nh;
      sw = Math.max(1, rawW * nw);
      sh = Math.max(1, rawH * nh);
    } else {
      // Absolute pixel coordinates
      sx = rawX;
      sy = rawY;
      sw = Math.max(1, rawW);
      sh = Math.max(1, rawH);
    }
  }

  const ew = isQuarter ? sh : sw;
  const eh = isQuarter ? sw : sh;
  const scale = (state.fitMode === 'cover'
    ? Math.max(stageW / ew, stageH / eh)
    : Math.min(stageW / ew, stageH / eh)) * zoom;

  const cx = stageX + stageW / 2 + panX;
  const cy = stageY + stageH / 2 + panY;

  ctx.translate(cx, cy);
  ctx.scale(flipX, 1);
  ctx.rotate(rotateRad);

  const drawW = sw * scale;
  const drawH = sh * scale;

  if (state.squint) {
    try { ctx.filter = `blur(${state.squintRadius || 6}px)`; } catch (e) { }
  } else {
    try { ctx.filter = 'none'; } catch (e) { }
  }

  if (crop) {
    ctx.drawImage(sourceImage, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.drawImage(sourceImage, -drawW / 2, -drawH / 2, drawW, drawH);
  }
  try { ctx.filter = 'none'; } catch (e) { }

  // Custom callback overlay inside transformed matrix
  if (typeof state.onDrawTransformed === 'function') {
    try {
      state.onDrawTransformed(ctx, sw, sh, drawW, drawH);
    } catch (e) { }
  }

  ctx.restore();

  // Pixel filters: Grayscale, Invert, Notan, Silhouette, Posterize
  if (state.grayscale || state.invert || state.notan || state.silhouette || state.posterize) {
    try {
      const imgData = ctx.getImageData(stageX, stageY, stageW, stageH);
      if (imgData && imgData.data) {
        const d = imgData.data;
        const isNotan = Boolean(state.notan);
        const isSil = Boolean(state.silhouette);
        const isPost = Boolean(state.posterize);
        const postSteps = Math.max(2, Math.min(6, state.posterizeSteps || 4));
        const thresh = isSil ? ((state.silhouetteThreshold !== undefined ? state.silhouetteThreshold : 0.5) * 255) : 128;
        const silInvert = Boolean(state.silhouetteInverted);
        const isInvert = Boolean(state.invert);
        const isGray = Boolean(state.grayscale);

        for (let i = 0; i < d.length; i += 4) {
          let r = d[i], g = d[i + 1], b = d[i + 2];
          let lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (isNotan || isSil) {
            let v = lum > thresh ? 255 : 0;
            if (silInvert) v = 255 - v;
            d[i] = v; d[i + 1] = v; d[i + 2] = v;
          } else if (isPost) {
            const stepIdx = Math.round((lum / 255) * (postSteps - 1));
            const v = Math.round((stepIdx / (postSteps - 1)) * 255);
            d[i] = v; d[i + 1] = v; d[i + 2] = v;
          } else if (isGray) {
            d[i] = lum; d[i + 1] = lum; d[i + 2] = lum;
          }

          if (isInvert) {
            d[i] = 255 - d[i];
            d[i + 1] = 255 - d[i + 1];
            d[i + 2] = 255 - d[i + 2];
          }
        }
        ctx.putImageData(imgData, stageX, stageY);
      }
    } catch (e) { }
  }
}


if (typeof window !== 'undefined') {
  window.renderFilteredCanvas = renderFilteredCanvas;
}
if (typeof globalThis !== 'undefined') {
  globalThis.renderFilteredCanvas = renderFilteredCanvas;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderFilteredCanvas
  };
}
