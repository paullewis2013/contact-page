/**
 * pretext.js — ASCII art renderer for canvas/WebGL animations.
 *
 * Usage (canvas target):
 *   const pt = new Pretext({ font: '13px Georgia', cols: 120, rows: 45 });
 *   pt.frame(webglCanvas, targetCanvas);
 *
 * Usage (pre/DOM target — monospace fonts align best):
 *   pt.framePre(webglCanvas, preElement);
 */
class Pretext {
  // Character ramps ordered light → dark
  static CHARS_SIMPLE = ' .:-=+*#%@';
  static CHARS_WILD   = " `'^,.:;~-_=+<>!?|/\\(){}[]r1ilIJft7jzxcvunseoawkqpbdghZYUXVCOQ203456L$T#&%S89FENMWKGRA@DB";
  static CHARS_DENSE  = " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
  static CHARS_BLOCKS = ' ░▒▓█';

  constructor({
    cols          = 120,
    rows          = 45,
    chars         = Pretext.CHARS_SIMPLE,
    color         = true,
    satBoost      = 1.0,
    lumBoost      = 1.0,
    font          = '13px Georgia, serif',
    fontSize      = 13,
    bg            = '#ffffff',
    jitter        = 0,
    sizeRange     = [1, 1],
    edgeThreshold = 0,    // normalised Sobel magnitude threshold (0 = off, try 0.08–0.25)
    edgeColor     = null, // null = use pixel colour; CSS string to force a colour on edges
  } = {}) {
    this.cols          = cols;
    this.rows          = rows;
    this.chars         = Array.from(chars);
    this.color         = color;
    this.satBoost      = satBoost;
    this.lumBoost      = lumBoost;
    this.font          = font;
    this.fontSize      = fontSize;
    this.bg            = bg;
    this.jitter        = jitter;
    this.sizeRange     = sizeRange;
    this.edgeThreshold = edgeThreshold;
    this.edgeColor     = edgeColor;

    // Downsampling canvas (cols × rows)
    this._sampleCanvas = document.createElement('canvas');
    this._sampleCanvas.width  = cols;
    this._sampleCanvas.height = rows;
    this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });

    // Full-resolution canvas for Sobel (sized lazily on first use)
    this._sobelCanvas = document.createElement('canvas');
    this._sobelCtx    = this._sobelCanvas.getContext('2d', { willReadFrequently: true });

    // Per-cell cache for dirty-checking in framePre
    this._prevChar  = null;
    this._prevColor = null;
  }

  // ── Public render methods ──────────────────────────────────────────────────

  /** Render into a <canvas> target — works with any font. */
  frame(sourceCanvas, targetCanvas) {
    const { cols, rows, chars, satBoost, lumBoost, font, fontSize,
            bg, jitter, sizeRange, edgeThreshold, edgeColor } = this;
    const ctx = targetCanvas.getContext('2d');

    const cellW    = targetCanvas.width  / cols;
    const cellH    = targetCanvas.height / rows;
    const varySize = sizeRange[0] !== 1 || sizeRange[1] !== 1;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (!varySize) ctx.font = font;

    this._sampleCtx.drawImage(sourceCanvas, 0, 0, cols, rows);
    const px   = this._sampleCtx.getImageData(0, 0, cols, rows).data;
    const lums = this._buildLums(px, cols, rows, lumBoost);

    const edgeGrid = edgeThreshold > 0
      ? this._buildEdgeGrid(sourceCanvas)
      : null;

    const fontRest = font.replace(/[\d.]+px/, '').trim();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const n = y * cols + x;
        const i = n * 4;
        let r = px[i], g = px[i + 1], b = px[i + 2];
        if (satBoost !== 1.0) [r, g, b] = Pretext._saturate(r, g, b, satBoost);

        let charStr = chars[Math.round(lums[n] * (chars.length - 1))];
        let colorStr = `rgb(${r},${g},${b})`;

        if (edgeGrid) {
          const ec = this._edgeCharFromGrid(edgeGrid, n, edgeThreshold);
          if (ec) { charStr = ec; if (edgeColor) colorStr = edgeColor; }
        }

        if (charStr === ' ') continue;

        const px_ = (x + 0.5) * cellW + (jitter ? (Math.random() - 0.5) * jitter : 0);
        const py_ = (y + 0.5) * cellH + (jitter ? (Math.random() - 0.5) * jitter : 0);

        if (varySize) {
          const scale = sizeRange[0] + lums[n] * (sizeRange[1] - sizeRange[0]);
          ctx.font = `${Math.round(fontSize * scale)}px ${fontRest}`;
        }

        ctx.fillStyle = colorStr;
        ctx.fillText(charStr, px_, py_);
      }
    }
  }

  /** Render into a <pre> target — monospace fonts align best. */
  framePre(sourceCanvas, targetEl) {
    const { cols, rows, chars, satBoost, lumBoost, edgeThreshold, edgeColor } = this;
    const total = cols * rows;

    // Allocate / reallocate span grid when needed
    if (this._preEl !== targetEl || this._spans?.length !== total) {
      this._preEl = targetEl;
      this._spans = new Array(total);
      this._prevChar  = new Array(total).fill('');
      this._prevColor = new Array(total).fill('');
      targetEl.textContent = '';
      for (let y = 0; y < rows; y++) {
        if (y > 0) targetEl.appendChild(document.createTextNode('\n'));
        for (let x = 0; x < cols; x++) {
          const span = document.createElement('span');
          targetEl.appendChild(span);
          this._spans[y * cols + x] = span;
        }
      }
    }

    this._sampleCtx.drawImage(sourceCanvas, 0, 0, cols, rows);
    const px   = this._sampleCtx.getImageData(0, 0, cols, rows).data;
    const lums = this._buildLums(px, cols, rows, lumBoost);

    // Full-res Sobel pass → max-pooled edge grid
    const edgeGrid = edgeThreshold > 0
      ? this._buildEdgeGrid(sourceCanvas)
      : null;

    const prevChar  = this._prevChar;
    const prevColor = this._prevColor;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const n = y * cols + x;
        const i = n * 4;
        let r = px[i], g = px[i + 1], b = px[i + 2];
        if (satBoost !== 1.0) [r, g, b] = Pretext._saturate(r, g, b, satBoost);

        let ch, color;

        if (edgeGrid) {
          const ec = this._edgeCharFromGrid(edgeGrid, n, edgeThreshold);
          if (ec) {
            ch    = ec;
            color = edgeColor || `rgb(${r},${g},${b})`;
          }
        }

        if (!ch) {
          ch    = chars[Math.round(lums[n] * (chars.length - 1))];
          color = `rgb(${r},${g},${b})`;
        }

        if (ch !== prevChar[n] || color !== prevColor[n]) {
          const span = this._spans[n];
          span.style.color = color;
          span.textContent  = ch === ' ' ? '\u00a0' : ch;
          prevChar[n]  = ch;
          prevColor[n] = color;
        }
      }
    }
  }

  // ── Edge detection ─────────────────────────────────────────────────────────

  /**
   * Run a full-resolution Sobel pass on sourceCanvas, then max-pool the
   * gradient magnitude (and track direction) down to the char grid.
   * Returns a Float32Array[cols * rows * 3]: [mag, gx, gy] per cell.
   */
  _buildEdgeGrid(sourceCanvas) {
    const { cols, rows } = this;
    const W = sourceCanvas.width, H = sourceCanvas.height;

    // Resize the Sobel offscreen canvas if needed
    if (this._sobelCanvas.width !== W || this._sobelCanvas.height !== H) {
      this._sobelCanvas.width  = W;
      this._sobelCanvas.height = H;
    }

    this._sobelCtx.drawImage(sourceCanvas, 0, 0);
    const raw = this._sobelCtx.getImageData(0, 0, W, H).data;

    // Luminance at full resolution
    const lum = new Float32Array(W * H);
    for (let n = 0; n < W * H; n++) {
      const i = n * 4;
      lum[n] = 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];
    }

    // Sobel — store magnitude, gx, gy per full-res pixel
    const mag = new Float32Array(W * H);
    const gxA = new Float32Array(W * H);
    const gyA = new Float32Array(W * H);

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const n  = y * W + x;
        const tl = lum[n - W - 1], tc = lum[n - W], tr = lum[n - W + 1];
        const ml = lum[n - 1],                       mr = lum[n + 1];
        const bl = lum[n + W - 1], bc = lum[n + W], br = lum[n + W + 1];
        const gx = (-tl - 2 * ml - bl + tr + 2 * mr + br) / 255;
        const gy = (-tl - 2 * tc - tr + bl + 2 * bc + br) / 255;
        mag[n] = Math.sqrt(gx * gx + gy * gy);
        gxA[n] = gx;
        gyA[n] = gy;
      }
    }

    // Max-pool magnitude to char grid; track direction at max-mag pixel per cell
    const cellW = W / cols, cellH = H / rows;
    const grid  = new Float32Array(cols * rows * 3); // [mag, gx, gy]

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const x0 = Math.floor(cx * cellW), x1 = Math.min(Math.ceil((cx + 1) * cellW), W - 1);
        const y0 = Math.floor(cy * cellH), y1 = Math.min(Math.ceil((cy + 1) * cellH), H - 1);
        let maxMag = 0, bestGx = 0, bestGy = 0;
        for (let fy = y0; fy < y1; fy++) {
          for (let fx = x0; fx < x1; fx++) {
            const n = fy * W + fx;
            if (mag[n] > maxMag) { maxMag = mag[n]; bestGx = gxA[n]; bestGy = gyA[n]; }
          }
        }
        const gn = (cy * cols + cx) * 3;
        grid[gn]     = maxMag;
        grid[gn + 1] = bestGx;
        grid[gn + 2] = bestGy;
      }
    }

    return grid;
  }

  /** Pick a thin directional character from an edge grid cell, or null if not an edge. */
  _edgeCharFromGrid(grid, cellIdx, threshold) {
    const gn  = cellIdx * 3;
    const mag = grid[gn];
    if (mag <= threshold) return null;
    const gx = grid[gn + 1], gy = grid[gn + 2];
    const ax = Math.abs(gx),  ay = Math.abs(gy);
    if (ax > ay * 2) return '|';
    if (ay > ax * 2) return '-';
    return (gx * gy >= 0) ? '\\' : '/';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _buildLums(px, cols, rows, lumBoost) {
    const lums = new Float32Array(cols * rows);
    for (let n = 0; n < cols * rows; n++) {
      const i = n * 4;
      lums[n] = Math.min(1, (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255 * lumBoost);
    }
    return lums;
  }

  /** Boost HSL saturation of an RGB triplet (values 0–255). */
  static _saturate(r, g, b, boost) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    const sNew = Math.min(1, s * boost);
    if (sNew === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + sNew) : l + sNew - l * sNew;
    const p = 2 * l - q;
    const hue = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return [Math.round(hue(h + 1/3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1/3) * 255)];
  }

  /** Resize the character grid (call on window resize). */
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this._sampleCanvas.width  = cols;
    this._sampleCanvas.height = rows;
    this._prevChar  = null;
    this._prevColor = null;
  }
}
