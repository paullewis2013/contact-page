// smoke.js — executes index.html's inline scripts under a mock browser
// environment: full init, the intro, weather ticks, several rendered frames,
// resize, the font scrubber, and the drawer. Catches missing identifiers and
// runtime errors that syntax checks can't (e.g. a deleted function still
// being called). Run: node smoke.js
'use strict';
const fs = require('fs');

// ── Mock 2D canvas ───────────────────────────────────────────────────────────
function makeCtx(canvas) {
  return {
    canvas,
    font: '', textAlign: '', textBaseline: '', fillStyle: '',
    globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
    fillRect() {}, clearRect() {}, fillText() {}, drawImage() {},
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4).fill(60) }; },
    putImageData() {},
    createRadialGradient() { return { addColorStop() {} }; },
  };
}
function makeCanvas() {
  const c = {
    width: 300, height: 150, _ctx: null, style: {},
    getContext() { this._ctx = this._ctx || makeCtx(this); return this._ctx; },
    addEventListener() {},
  };
  return c;
}

// ── Mock DOM ─────────────────────────────────────────────────────────────────
const listeners = {};
function makeEl(id) {
  const el = {
    id,
    style: {},
    dataset: { copy: 'x@y.z' },
    textContent: '',
    classList: {
      _s: new Set(),
      add(c)      { this._s.add(c); },
      remove(c)   { this._s.delete(c); },
      toggle(c)   { this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(type, fn) { (listeners[id + ':' + type] ||= []).push(fn); },
    removeEventListener() {},
    querySelector()    { return makeEl(id + '>q'); },
    querySelectorAll() { return [makeEl(id + '>a'), makeEl(id + '>b')]; },
    focus() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return this; },
    remove() {},
    setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 150, height: 20 }; },
    appendChild() {},
    select() {},
  };
  return el;
}
const canvases = { ascii: makeCanvas(), glcanvas: makeCanvas() };
const elements = {};
global.document = {
  getElementById(id) {
    if (canvases[id]) return canvases[id];
    return elements[id] ||= makeEl(id);
  },
  createElement(tag) { return tag === 'canvas' ? makeCanvas() : makeEl('created-' + tag); },
  addEventListener(type, fn) { (listeners['document:' + type] ||= []).push(fn); },
  querySelectorAll() { return []; },
  body: { appendChild() {} },
  activeElement: null,
  hidden: false,
};

let rafQueue = [];
global.window = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
  addEventListener(type, fn) { (listeners['window:' + type] ||= []).push(fn); },
  matchMedia() { return { matches: false }; },
  requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
};
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.matchMedia = global.window.matchMedia;
global.performance = { now: () => simeTime };
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
});
global.setInterval = () => 0;
global.setTimeout = (fn) => 0;
global.clearTimeout = () => {};
let simeTime = 0;

// ── Mock THREE (just enough surface for the pond) ────────────────────────────
class V3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  setScalar(v){return this.set(v,v,v);}
  project(){return this;}
  unproject(){return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;} }
class Color { constructor(){this.r=0;this.g=0;this.b=0;}
  setHSL(){return this;} lerp(){return this;} clone(){return new Color();}
  copy(){return this;} getHexString(){return '071c1a';} }
class Obj { constructor(){ this.position=new V3(); this.rotation={x:0,y:0,z:0,order:''};
  this.scale=new V3(1,1,1); this.children=[]; this.visible=true; this.renderOrder=0; }
  add(o){this.children.push(o);return this;} lookAt(){} }
function geo(n) { return {
  attributes: { position: { array: new Float32Array(n * 3) } },
  setAttribute() {},
}; }
global.THREE = {
  Scene: class extends Obj { remove() {} },
  Group: class extends Obj {},
  Mesh:  class extends Obj { constructor(g, m){ super(); this.geometry=g; this.material=m; } },
  LineSegments: class extends Obj { constructor(g,m){ super(); } },
  WebGLRenderer: class { constructor(o){ this.domElement = (o && o.canvas) || makeCanvas(); }
    setSize(){} render(){} setClearColor(){} },
  PerspectiveCamera: class extends Obj { constructor(){ super(); this.aspect=1; }
    updateProjectionMatrix(){} },
  HemisphereLight: class extends Obj {},
  MeshBasicMaterial: class { constructor(o={}){ Object.assign(this,{opacity:1},o); this.color=new Color(); } },
  LineBasicMaterial: class { constructor(o={}){ Object.assign(this,o);} },
  Color, Vector3: V3,
  BufferAttribute: class { constructor(){} },
  BufferGeometry: class { constructor(){ Object.assign(this, geo(0)); } },
  CircleGeometry: class { constructor(r, seg=8){ Object.assign(this, geo(seg + 2)); } },
  RingGeometry: class { constructor(){ Object.assign(this, geo(40)); } },
  BoxGeometry: class { constructor(){ Object.assign(this, geo(8)); } },
  SphereGeometry: class { constructor(){ Object.assign(this, geo(24)); } },
  PlaneGeometry: class { constructor(w,h,ws=1,hs=1){ Object.assign(this, geo((ws+1)*(hs+1))); } },
  ShapeGeometry: class { constructor(){ Object.assign(this, geo(12)); } },
  Shape: class { moveTo(){} quadraticCurveTo(){} },
  CanvasTexture: class { constructor(){} },
  DoubleSide: 2,
};

// ── Load and run the page scripts ────────────────────────────────────────────
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pretext = fs.readFileSync('pretext.js', 'utf8');

let failed = false;
function run(label, fn) {
  try { fn(); console.log('OK  ', label); }
  catch (e) { failed = true; console.log('FAIL', label, '—', e.message); }
}

run('load pretext.js', () => (0, eval)(pretext + '; globalThis.Pretext = Pretext;'));
scripts.forEach((code, i) => run(`execute inline script ${i} (init)`, () => (0, eval)(code)));

// Drive the animation loop: rAF callbacks with advancing time
run('run 30 frames (intro)', () => {
  for (let f = 0; f < 30; f++) {
    simeTime += 16.7;
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => cb(simeTime));
    if (!rafQueue.length && !q.length) throw new Error('animation loop stalled');
  }
});

// Jump past intro + hint/nav appearance and weather ticks
run('run 400 more frames (post-intro, weather era)', () => {
  for (let f = 0; f < 400; f++) {
    simeTime += 16.7;
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => cb(simeTime));
  }
});

run('window resize', () => {
  window.innerWidth = 390; window.innerHeight = 844; // phone portrait
  (listeners['window:resize'] || []).forEach(fn => fn());
});

run('font scrubber drag', () => {
  (listeners['fontBar:pointerdown'] || []).forEach(fn =>
    fn({ clientX: 120, pointerId: 1 }));
  (listeners['fontBar:pointermove'] || []).forEach(fn => fn({ clientX: 40 }));
  (listeners['fontBar:pointerup'] || []).forEach(fn => fn({}));
});

run('open contact, render, copy, close', () => {
  (listeners['title-hit:click'] || []).forEach(fn => fn());        // open
  for (let f = 0; f < 20; f++) {                                    // stagger frames
    simeTime += 16.7;
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => cb(simeTime));
  }
  (listeners['c-copy:click'] || []).forEach(fn => fn());            // copy email
  (listeners['title-hit:mouseenter'] || []).forEach(fn => fn());    // hover stamped UI
  (listeners['document:keydown'] || []).forEach(fn => fn({ key: 'Escape' })); // close
  (listeners['hint-hit:click'] || []).forEach(fn => fn());          // reopen via hint
  (listeners['document:click'] || []).forEach(fn => fn({ target: null })); // click-away
});

run('toggle controls via [?] and keyboard', () => {
  (listeners['ctl-hit:click'] || []).forEach(fn => fn());
  (listeners['document:keydown'] || []).forEach(fn => fn({ key: '?' }));
});

run('tap to ripple', () => {
  (listeners['document:click'] || []).forEach(fn =>
    fn({ target: null, clientX: 200, clientY: 500 }));
  for (let f = 0; f < 30; f++) {
    simeTime += 16.7;
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => cb(simeTime));
  }
});

run('pause and resume', () => {
  (listeners['pauseBtn:click'] || []).forEach(fn => fn()); // pause
  (listeners['pauseBtn:click'] || []).forEach(fn => fn()); // resume
  for (let f = 0; f < 10; f++) {
    simeTime += 16.7;
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => cb(simeTime));
  }
});

console.log(failed ? '\nSMOKE TEST FAILED' : '\nall smoke tests passed');
process.exit(failed ? 1 : 0);
