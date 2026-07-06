/**
 * pretext.js — ASCII art renderer for canvas/WebGL animations.
 *
 * Renders a source canvas (e.g. a WebGL scene) into a target 2D canvas as
 * coloured characters, using a glyph-atlas pipeline built for Chrome:
 *
 *   1. Each character is rasterised ONCE into a white glyph atlas.
 *   2. Every frame, cells are stamped from the atlas with drawImage —
 *      no per-cell fillText, no text shaping.
 *   3. All glyphs are colourised in a single 'source-in' composite of the
 *      low-res colour buffer scaled up — no per-cell fillStyle changes.
 *
 * At a 300×100 grid this replaces ~30,000 fillText + fillStyle calls per
 * frame with ~30,000 cheap sprite blits + 3 full-surface operations.
 *
 * Usage:
 *   const pt = new Pretext({ font: '10px Consolas, monospace', cols: 120, rows: 45 });
 *   pt.frame(webglCanvas, targetCanvas);
 */
class Pretext {
  // Character ramp ordered light → dark
  static CHARS_WILD = " `'^,.:;~-_=+<>!?|/\\(){}[]r1ilIJft7jzxcvunseoawkqpbdghZYUXVCOQ203456L$T#&%S89FENMWKGRA@DB";

  constructor({
    cols          = 120,
    rows          = 45,
    chars         = Pretext.CHARS_WILD,
    satBoost      = 1.0,
    lumBoost      = 1.0,
    font          = '13px monospace',
    fontSize      = 13,
    bg            = '#ffffff',
  } = {}) {
    this.cols          = cols;
    this.rows          = rows;
    this.chars         = Array.from(chars);
    this.satBoost      = satBoost;
    this.lumBoost      = lumBoost;
    this.font          = font;
    this.fontSize      = fontSize;
    this.bg            = bg;

    // Downsampling canvas (cols × rows) — also the colour source for the
    // colourise pass, so processed colours are written back into it.
    this._sampleCanvas        = document.createElement('canvas');
    this._sampleCanvas.width  = cols;
    this._sampleCanvas.height = rows;
    this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });

    // Glyph atlas state
    this._atlas      = document.createElement('canvas');
    this._atlasKey   = '';           // font + cell size + charset fingerprint
    this._atlasIndex = new Map();    // char → column in atlas
    this._glyphW     = 0;
    this._glyphH     = 0;

    // Scratch buffers reused across frames
    this._cellChar = null;           // Uint16Array: atlas column + 1, 0 = skip

  }

  /** Render one frame of sourceCanvas into targetCanvas as characters. */
  frame(sourceCanvas, targetCanvas) {
    const { cols, rows, chars, satBoost, lumBoost, bg } = this;
    const ctx = targetCanvas.getContext('2d');
    const W = targetCanvas.width, H = targetCanvas.height;
    const cellW = W / cols;
    const cellH = H / rows;

    this._ensureAtlas(cellW, cellH);

    // ── Sample the scene down to one pixel per cell ──────────────────────────
    this._sampleCtx.drawImage(sourceCanvas, 0, 0, cols, rows);
    const img = this._sampleCtx.getImageData(0, 0, cols, rows);
    const px  = img.data;

    const total = cols * rows;
    if (!this._cellChar || this._cellChar.length !== total) {
      this._cellChar = new Uint16Array(total);
    }
    const cellChar = this._cellChar;

    // Map ramp index → atlas column once per frame (not per cell)
    const lastChar   = chars.length - 1;
    const atlasIndex = this._atlasIndex;
    const rampToAtlas = new Int32Array(chars.length);
    for (let c = 0; c < chars.length; c++) {
      rampToAtlas[c] = chars[c] === ' ' ? -1 : atlasIndex.get(chars[c]);
    }

    // ── CPU pass: pick a glyph per cell, write processed colours back ────────
    for (let n = 0; n < total; n++) {
      const i = n * 4;
      let r = px[i], g = px[i + 1], b = px[i + 2];
      const lum = Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255 * lumBoost);
      if (satBoost !== 1.0) [r, g, b] = Pretext._saturate(r, g, b, satBoost);
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      const a = rampToAtlas[Math.round(lum * lastChar)];
      cellChar[n] = a < 0 ? 0 : a + 1;
    }
    this._sampleCtx.putImageData(img, 0, 0);

    // ── GPU pass 1: stamp white glyphs from the atlas ────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    const atlas = this._atlas, gw = this._glyphW, gh = this._glyphH;
    for (let y = 0; y < rows; y++) {
      const dy   = y * cellH;
      const base = y * cols;
      for (let x = 0; x < cols; x++) {
        const idx = cellChar[base + x];
        if (!idx) continue;
        ctx.drawImage(atlas, (idx - 1) * gw, 0, gw, gh, x * cellW, dy, cellW, cellH);
      }
    }

    // ── GPU pass 2: colourise every glyph at once ────────────────────────────
    ctx.globalCompositeOperation = 'source-in';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._sampleCanvas, 0, 0, W, H);

    // ── GPU pass 3: background behind the glyphs ─────────────────────────────
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
  }

  // ── Glyph atlas ────────────────────────────────────────────────────────────

  /** (Re)build the atlas if the font, cell size, or character set changed. */
  _ensureAtlas(cellW, cellH) {
    const charset = [...new Set(this.chars.filter(c => c !== ' '))];
    const gw = Math.max(1, Math.ceil(cellW));
    const gh = Math.max(1, Math.ceil(cellH));
    const key = `${this.font}|${gw}x${gh}|${charset.join('')}`;
    if (key === this._atlasKey) return;

    this._atlasKey    = key;
    this._glyphW      = gw;
    this._glyphH      = gh;
    this._atlas.width  = Math.max(1, gw * charset.length);
    this._atlas.height = gh;

    const actx = this._atlas.getContext('2d');
    actx.clearRect(0, 0, this._atlas.width, gh);
    actx.font         = this.font;
    actx.textAlign    = 'center';
    actx.textBaseline = 'middle';
    actx.fillStyle    = '#ffffff';

    this._atlasIndex.clear();
    charset.forEach((ch, i) => {
      this._atlasIndex.set(ch, i);
      actx.fillText(ch, (i + 0.5) * gw, gh * 0.5);
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

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
    this._cellChar = null;
  }
}
