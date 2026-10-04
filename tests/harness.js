'use strict';
// Sanaseikkailu - testiharness: ajaa index.html:n inline-skriptin vm-kontekstissa
// feikatulla selainympäristöllä (DOM, localStorage, IndexedDB, puhesynteesi).
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function escapeHtml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makeCanvasContext() {
  const noop = () => {};
  return {
    clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
    scale: noop, setTransform: noop, fill: noop, arc: noop,
    lineWidth: 1, lineCap: '', lineJoin: '', strokeStyle: ''
  };
}

function makeElement(tag, id) {
  const classes = new Set();
  const attrs = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: id || '',
    dataset: {},
    style: {
      _vars: {},
      setProperty(k, v) { this._vars[k] = v; },
      getPropertyValue(k) { return this._vars[k] || ''; }
    },
    hidden: false,
    checked: false,
    disabled: false,
    type: '', title: '', href: '', download: '', width: 0, height: 0,
    files: [],
    _children: [],
    _listeners: {},
    _text: '',
    _html: '',
    _lastSet: 'text', // 'text' | 'html'
    _value: '',
    _focused: false,
    _removed: false,
    classList: {
      add(...c) { c.forEach(x => classes.add(x)); },
      remove(...c) { c.forEach(x => classes.delete(x)); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        const want = force === undefined ? !classes.has(c) : !!force;
        if (want) classes.add(c); else classes.delete(c);
        return want;
      }
    },
    get className() { return Array.from(classes).join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => classes.add(x)); },
    get children() { return this._children; },
    get textContent() {
      if (this._lastSet === 'html') return stripTags(this._html);
      if (this._lastSet === 'text') {
        if (this._text === '' && this._children.length) return this._children.map(c => c.textContent).join('');
        return this._text;
      }
      return '';
    },
    set textContent(v) { this._text = String(v); this._lastSet = 'text'; this._children = []; },
    get innerHTML() {
      if (this._lastSet === 'html') return this._html;
      return escapeHtml(this._text);
    },
    set innerHTML(v) {
      this._html = String(v); this._lastSet = 'html';
      if (this._html === '') { this._children = []; this._text = ''; }
    },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    addEventListener(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
    removeEventListener(evt, fn) {
      this._listeners[evt] = (this._listeners[evt] || []).filter(f => f !== fn);
    },
    dispatch(evt, evtObj) {
      const e = Object.assign({
        type: evt, target: this, preventDefault() {}, stopPropagation() {}
      }, evtObj || {});
      const results = (this._listeners[evt] || []).slice().map(fn => fn(e));
      return Promise.all(results);
    },
    click() { return this.dispatch('click', {}); },
    appendChild(c) { this._children.push(c); c._parent = this; return c; },
    querySelector(sel) {
      const m = /\[data-index="([^"]*)"\]/.exec(sel);
      if (!m) return null;
      const find = (node) => {
        for (const c of node._children) {
          if (c.dataset && c.dataset.index === m[1]) return c;
          const r = find(c); if (r) return r;
        }
        return null;
      };
      return find(this);
    },
    querySelectorAll() { return []; },
    focus() { this._focused = true; },
    blur() { this._focused = false; },
    remove() {
      this._removed = true;
      if (this._parent) this._parent._children = this._parent._children.filter(c => c !== this);
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 }; },
    getContext() { return this._ctx2d || (this._ctx2d = makeCanvasContext()); },
    setPointerCapture() {}
  };
  return el;
}

function makeFakeIndexedDB(seedStats) {
  const data = new Map();
  (seedStats || []).forEach(s => data.set(s.statId, JSON.parse(JSON.stringify(s))));
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const fakeDb = {
    data,
    putCount: 0,
    objectStoreNames: { contains: () => false },
    createObjectStore() {},
    transaction() {
      const tx = {
        oncomplete: null, onerror: null,
        objectStore() {
          return {
            get(key) {
              const req = { result: undefined, onsuccess: null, onerror: null };
              realSetTimeout(() => { req.result = clone(data.get(key)); req.onsuccess && req.onsuccess({ target: req }); }, 0);
              return req;
            },
            getAll() {
              const req = { result: undefined, onsuccess: null, onerror: null };
              realSetTimeout(() => {
                req.result = Array.from(data.values()).map(clone);
                req.onsuccess && req.onsuccess({ target: req });
              }, 0);
              return req;
            },
            put(obj) {
              data.set(obj.statId, clone(obj));
              fakeDb.putCount++;
              realSetTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 0);
              return { onsuccess: null, onerror: null };
            }
          };
        }
      };
      return tx;
    }
  };
  const indexedDB = {
    open() {
      const req = { result: fakeDb, onupgradeneeded: null, onsuccess: null, onerror: null };
      realSetTimeout(() => {
        req.onupgradeneeded && req.onupgradeneeded({ target: req });
        req.onsuccess && req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  };
  return { indexedDB, fakeDb };
}

/**
 * loadApp(options)
 *  options.localStorage   : { key: value } esitäyttö
 *  options.stats          : tilastoalkiot IndexedDB:hen
 *  options.random         : () => number  TAI options.seed (oletus 12345)
 *  options.speechRecognition : konstruktori (oletuksena ei tukea)
 *  options.htmlPath       : oletus ../index.html
 */
function loadApp(options) {
  options = options || {};
  const htmlPath = options.htmlPath || process.env.SANA_HTML || path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!m) throw new Error('inline <script> ei löytynyt: ' + htmlPath);
  const code = m[1];

  const elements = {};
  const timers = new Set();
  const logs = [];
  const asyncErrors = [];
  const cssVars = {};
  const spoken = [];

  // --- localStorage ---
  const lsMap = new Map(Object.entries(options.localStorage || {}).map(([k, v]) => [k, String(v)]));
  const storage = {
    _map: lsMap,
    getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
    setItem: (k, v) => { lsMap.set(k, String(v)); },
    removeItem: (k) => { lsMap.delete(k); }
  };

  // --- IndexedDB ---
  const { indexedDB, fakeDb } = makeFakeIndexedDB(options.stats);

  // --- DOM ---
  const selectorEls = {};
  function getEl(id) {
    if (!elements[id]) elements[id] = makeElement('div', id);
    return elements[id];
  }
  const mkButtons = (key, vals) => vals.map(v => { const b = makeElement('button'); b.dataset[key] = v; return b; });
  const langButtons = mkButtons('lang', ['en', 'de']);
  const modeButtons = mkButtons('mode', ['pen', 'keyboard', 'mic']);
  const practiceButtons = mkButtons('practice', ['words', 'sentences']);
  const docListeners = makeElement('document');
  const documentElement = makeElement('html');
  documentElement.style.setProperty = (k, v) => { cssVars[k] = v; documentElement.style._vars[k] = v; };
  const body = makeElement('body');
  const document = {
    getElementById: getEl,
    querySelector(sel) {
      if (!selectorEls[sel]) { selectorEls[sel] = makeElement('div'); elements['sel:' + sel] = selectorEls[sel]; }
      return selectorEls[sel];
    },
    querySelectorAll(sel) {
      if (sel === '.lang-switch-btn') return langButtons;
      if (sel === '.mode-btn') return modeButtons;
      if (sel === '.practice-switch-btn') return practiceButtons;
      return [];
    },
    createElement: (tag) => makeElement(tag),
    addEventListener: (e, f) => docListeners.addEventListener(e, f),
    dispatch: (e, o) => docListeners.dispatch(e, o),
    documentElement,
    body
  };

  // --- Math.random ---
  const rand = options.random || mulberry32(options.seed === undefined ? 12345 : options.seed);

  // --- puhesynteesi ---
  const speechSynthesis = {
    cancelCount: 0,
    cancel() { this.cancelCount++; },
    speak(u) { spoken.push({ text: u.text, lang: u.lang }); }
  };
  function SpeechSynthesisUtterance(text) { this.text = text; this.lang = ''; }

  const sandbox = {
    document,
    localStorage: storage,
    indexedDB,
    navigator: { mediaDevices: null, language: 'fi-FI', userAgent: 'node-test' },
    speechSynthesis,
    SpeechSynthesisUtterance,
    isSecureContext: true,
    devicePixelRatio: 1,
    performance: { now: () => Date.now() },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    Blob: function Blob(parts, opts) { this.parts = parts; this.type = opts && opts.type; },
    console: {
      log: (...a) => logs.push(['log', a]), info: (...a) => logs.push(['info', a]),
      warn: (...a) => logs.push(['warn', a]), error: (...a) => logs.push(['error', a])
    },
    setTimeout: (fn, ms, ...args) => {
      const h = realSetTimeout(() => {
        timers.delete(h);
        try { fn(...args); } catch (e) { asyncErrors.push(e); }
      }, ms);
      timers.add(h);
      return h;
    },
    clearTimeout: (h) => { timers.delete(h); realClearTimeout(h); }
  };
  if (options.speechRecognition) sandbox.SpeechRecognition = options.speechRecognition;
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  const ctx = vm.createContext(sandbox);
  vm.runInContext('Math.random = __rand;', Object.assign(ctx, { __rand: rand }));

  const run = (c) => vm.runInContext(c, ctx);
  vm.runInContext(code, ctx, { filename: 'index.html<script>' });

  return {
    ctx, run, elements, db: fakeDb, storage, logs, spoken, cssVars, asyncErrors,
    langButtons, modeButtons, practiceButtons,
    flush: (ms) => new Promise(r => realSetTimeout(r, ms || 50)),
    // Siivous: pysäyttää sovelluksen jäljellä olevat ajastimet
    dispose() { timers.forEach(h => realClearTimeout(h)); timers.clear(); }
  };
}

module.exports = { loadApp, mulberry32 };
