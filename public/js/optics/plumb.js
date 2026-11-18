// ==================== PLUMB-LINE & ANGLE MEASUREMENT TOOL ====================
const PlumbTool = {
  isActive: false,       // Measure mode [U] toggle state
  isMeasuring: false,    // Currently dragging a measurement line
  lines: [],             // Up to 3 active measurement lines
  currentLine: null,     // Active line being drawn
  svgEl: null,

  // Atelier studio palette: 1 = Amber, 2 = Sky Cyan, 3 = Coral Rose
  palette: [
    { main: '#f59e0b', faint: 'rgba(245, 158, 11, 0.45)', text: '#fbbf24' },
    { main: '#38bdf8', faint: 'rgba(56, 189, 248, 0.45)', text: '#7dd3fc' },
    { main: '#f43f5e', faint: 'rgba(244, 63, 94, 0.45)', text: '#fda4af' }
  ],

  init() {
    this.svgEl = document.getElementById('plumb-overlay');
    this.bindEvents();
  },

  onImageLoaded(imgEl) {
    if (imgEl && imgEl.naturalWidth && imgEl.naturalHeight) {
      this.svgEl = document.getElementById('plumb-overlay');
      if (this.svgEl) {
        this.svgEl.setAttribute('viewBox', `0 0 ${imgEl.naturalWidth} ${imgEl.naturalHeight}`);
      }
    }
    this.clearLines();
  },

  bindEvents() {
    const btn = document.getElementById('btn-art-plumb');
    if (btn) {
      btn.addEventListener('click', () => {
        this.handleHotkey();
      });
    }
  },

  handleHotkey() {
    // If lines exist on screen, clear them; otherwise toggle Measure Mode
    if (this.lines.length > 0) {
      this.clearLines();
      SoundFX.click();
    } else {
      this.toggleMode();
    }
  },

  toggleMode(forceState = null) {
    this.isActive = forceState !== null ? forceState : !this.isActive;
    this.syncUI();
    SoundFX.toolToggle();
  },

  clearLines() {
    this.lines = [];
    this.currentLine = null;
    this.render();
    this.syncUI();
  },

  getPoint(e) {
    const svg = this.svgEl || document.getElementById('plumb-overlay');
    const img = document.getElementById('session-image');
    if (!svg || !img || !img.naturalWidth || !img.naturalHeight) return null;

    // Ensure viewBox is synced with current image natural dimensions
    if (svg.getAttribute('viewBox') !== `0 0 ${img.naturalWidth} ${img.naturalHeight}`) {
      svg.setAttribute('viewBox', `0 0 ${img.naturalWidth} ${img.naturalHeight}`);
    }

    try {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.max(0, Math.min(img.naturalWidth, local.x)),
        y: Math.max(0, Math.min(img.naturalHeight, local.y))
      };
    } catch (err) {
      return null;
    }
  },

  startDrag(e) {
    const pt = this.getPoint(e);
    if (!pt) return false;

    this.isMeasuring = true;
    const colorIdx = this.lines.length % this.palette.length;
    this.currentLine = {
      x1: pt.x,
      y1: pt.y,
      x2: pt.x,
      y2: pt.y,
      colorIndex: colorIdx
    };

    this.render();
    return true;
  },

  updateDrag(e) {
    if (!this.isMeasuring || !this.currentLine) return;
    const pt = this.getPoint(e);
    if (!pt) return;

    this.currentLine.x2 = pt.x;
    this.currentLine.y2 = pt.y;
    this.render();
  },

  endDrag(e) {
    if (!this.isMeasuring || !this.currentLine) return;
    this.isMeasuring = false;

    const img = document.getElementById('session-image');
    const nh = img && img.naturalHeight ? img.naturalHeight : 1000;

    const dx = this.currentLine.x2 - this.currentLine.x1;
    const dy = this.currentLine.y2 - this.currentLine.y1;
    const dist = Math.hypot(dx, dy);

    // Filter out accidental clicks (minimum 6px drag)
    if (dist > 6) {
      const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
      const lenPct = Math.round((dist / nh) * 100);
      this.currentLine.angle = angle;
      this.currentLine.lenPct = lenPct;

      if (this.lines.length >= 3) {
        this.lines.shift(); // Keep up to 3 lines
      }
      this.lines.push(this.currentLine);
      SoundFX.click();
    }

    this.currentLine = null;
    this.render();
    this.syncUI();
  },

  render() {
    const svg = this.svgEl || document.getElementById('plumb-overlay');
    if (!svg) return;

    const allLines = [...this.lines];
    if (this.currentLine) {
      allLines.push(this.currentLine);
    }

    if (allLines.length === 0) {
      svg.innerHTML = '';
      svg.classList.add('hidden');
      return;
    }

    svg.classList.remove('hidden');

    const img = document.getElementById('session-image');
    const nw = img && img.naturalWidth ? img.naturalWidth : 1000;
    const nh = img && img.naturalHeight ? img.naturalHeight : 1000;
    const flipX = (typeof ArtistToolbox !== 'undefined' && ArtistToolbox.flipX) || 1;
    const rotate = (typeof ArtistToolbox !== 'undefined' && ArtistToolbox.rotateTotal) || 0;

    let html = '';

    allLines.forEach((line) => {
      const dx = line.x2 - line.x1;
      const dy = line.y2 - line.y1;
      const dist = Math.hypot(dx, dy);
      const angle = line.angle !== undefined ? line.angle : Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
      const lenPct = line.lenPct !== undefined ? line.lenPct : Math.round((dist / nh) * 100);
      const col = this.palette[line.colorIndex % this.palette.length];
      const mx = (line.x1 + line.x2) / 2;
      const my = (line.y1 + line.y2) / 2;

      // 1. Faint dashed vertical and horizontal plumb crosshairs spanning the image bounds
      // Start crosshair
      html += `<line x1="${line.x1}" y1="0" x2="${line.x1}" y2="${nh}" stroke="${col.faint}" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />`;
      html += `<line x1="0" y1="${line.y1}" x2="${nw}" y2="${line.y1}" stroke="${col.faint}" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />`;

      // End crosshair
      html += `<line x1="${line.x2}" y1="0" x2="${line.x2}" y2="${nh}" stroke="${col.faint}" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />`;
      html += `<line x1="0" y1="${line.y2}" x2="${nw}" y2="${line.y2}" stroke="${col.faint}" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />`;

      // 2. High-contrast underlay drop-shadow and crisp vector measurement line
      html += `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#000000" stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.65" />`;
      html += `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${col.main}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;

      // 3. Anchor points (dots)
      html += `<circle cx="${line.x1}" cy="${line.y1}" r="4" fill="${col.main}" stroke="#121212" stroke-width="1.5" vector-effect="non-scaling-stroke" />`;
      html += `<circle cx="${line.x2}" cy="${line.y2}" r="4" fill="${col.main}" stroke="#121212" stroke-width="1.5" vector-effect="non-scaling-stroke" />`;

      // 4. Midpoint pill badge showing exact angle and relative length (% of image height)
      if (dist > 12) {
        // Counter-transform so badge text always remains upright and readable
        const badgeWidth = 92;
        const badgeHeight = 22;
        html += `
          <g transform="translate(${mx}, ${my}) rotate(${-rotate}) scale(${flipX}, 1)">
            <rect x="${-badgeWidth / 2}" y="${-badgeHeight / 2}" width="${badgeWidth}" height="${badgeHeight}" rx="4" ry="4" fill="rgba(18, 18, 18, 0.94)" stroke="${col.main}" stroke-width="1" vector-effect="non-scaling-stroke" />
            <text x="0" y="3.5" text-anchor="middle" fill="${col.text}" font-family="'JetBrains Mono', 'SF Mono', monospace" font-size="10.5" font-weight="700">
              ${angle.toFixed(1)}° · ${lenPct}%
            </text>
          </g>
        `;
      }
    });

    svg.innerHTML = html;
  },

  syncUI() {
    const btn = document.getElementById('btn-art-plumb');
    const badge = document.getElementById('plumb-count-badge');
    const stage = document.getElementById('image-stage');

    const hasLines = this.lines.length > 0;
    if (btn) {
      btn.classList.toggle('active', this.isActive || hasLines);
      btn.title = hasLines
        ? `Plumb-Line & Angle Measurement [U] (${this.lines.length}/3 active — click or press U to clear)`
        : 'Plumb-Line & Angle Measurement [U] (or Shift+Drag on stage)';
    }

    if (badge) {
      if (hasLines) {
        badge.textContent = this.lines.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (stage) {
      stage.classList.toggle('plumb-active', this.isActive);
    }
  },

  renderToCanvas(ctx, nw, nh, drawW, drawH) {
    const allLines = [...this.lines];
    if (this.currentLine) allLines.push(this.currentLine);
    if (allLines.length === 0) return;

    allLines.forEach(line => {
      const col = this.palette[line.colorIndex % this.palette.length];
      const sx1 = -drawW / 2 + (line.x1 / nw) * drawW;
      const sy1 = -drawH / 2 + (line.y1 / nh) * drawH;
      const sx2 = -drawW / 2 + (line.x2 / nw) * drawW;
      const sy2 = -drawH / 2 + (line.y2 / nh) * drawH;
      const dx = line.x2 - line.x1;
      const dy = line.y2 - line.y1;
      const dist = Math.hypot(dx, dy);
      const angle = line.angle !== undefined ? line.angle : Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
      const lenPct = line.lenPct !== undefined ? line.lenPct : Math.round((dist / nh) * 100);

      ctx.save();
      // Crosshairs
      ctx.strokeStyle = col.faint;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      // Start crosshair
      ctx.beginPath();
      ctx.moveTo(sx1, -drawH / 2);
      ctx.lineTo(sx1, drawH / 2);
      ctx.moveTo(-drawW / 2, sy1);
      ctx.lineTo(drawW / 2, sy1);
      // End crosshair
      ctx.moveTo(sx2, -drawH / 2);
      ctx.lineTo(sx2, drawH / 2);
      ctx.moveTo(-drawW / 2, sy2);
      ctx.lineTo(drawW / 2, sy2);
      ctx.stroke();

      // Main line
      ctx.setLineDash([]);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      ctx.strokeStyle = col.main;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      // Dots
      ctx.fillStyle = col.main;
      ctx.beginPath();
      ctx.arc(sx1, sy1, 4, 0, Math.PI * 2);
      ctx.arc(sx2, sy2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Badge
      if (dist > 12) {
        const smx = (sx1 + sx2) / 2;
        const smy = (sy1 + sy2) / 2;
        const bw = 92;
        const bh = 22;
        ctx.fillStyle = 'rgba(18, 18, 18, 0.94)';
        ctx.strokeStyle = col.main;
        ctx.lineWidth = 1;
        ctx.fillRect(smx - bw / 2, smy - bh / 2, bw, bh);
        ctx.strokeRect(smx - bw / 2, smy - bh / 2, bw, bh);
        ctx.fillStyle = col.text;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${angle.toFixed(1)}° · ${lenPct}%`, smx, smy);
      }
      ctx.restore();
    });
  }
};

if (typeof window !== 'undefined') {
  window.PlumbTool = PlumbTool;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlumbTool = PlumbTool;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PlumbTool
  };
}
