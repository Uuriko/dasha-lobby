import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { ARCADE_HTML } from './dasha-arcade-page.mjs';
import { ARCADE_CLIENT_JS } from './dasha-arcade-client.mjs';

// Small event surface for testing the shipped script's lifecycle. No browser,
// rendering, network, or accessibility-conformance claims come from this fixture.
function fixture({ storage = '{}', noCanvas = false } = {}) {
  const elements = new Map();
  let clock = 0, nextFrame = 0;
  const frames = new Map(), documentEvents = new Map(), windowEvents = new Map();
  const document = { hidden: false, activeElement: null, hasFocus: () => true };
  function element(id, dataset = {}) {
    const events = new Map();
    const node = {
      id, dataset, textContent: '', hidden: false, disabled: false, attrs: {},
      addEventListener: (name, cb) => events.set(name, cb),
      setAttribute(name, value) { this.attrs[name] = value; },
      focus() { document.activeElement = this; },
      contains: child => !!child && elements.has(child.id),
      emit(name, data = {}) { return events.get(name)?.({ target: this, preventDefault() {}, ...data }); },
    };
    elements.set(id, node);
    return node;
  }
  for (const match of ARCADE_HTML.matchAll(/\bid="([^"]+)"/g)) element(match[1]);
  const games = ['after-hours', 'do-not-disturb', 'carry-on'].map(id => element('choose-' + id, { game: id }));
  const actions = ['flap', 'left', 'right', 'leave', 'pack'].map(id => element('action-' + id, { action: id }));
  document.getElementById = id => elements.get(id);
  document.querySelectorAll = selector => selector.includes('data-action') ? actions : games;
  document.addEventListener = (name, cb) => documentEvents.set(name, cb);
  const drawing = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  elements.get('playfield').getContext = () => { if (noCanvas) throw new Error('Canvas unavailable'); return drawing; };
  elements.get('playfield').getBoundingClientRect = () => ({ left: 0, width: 720 });
  const location = { hash: '' };
  runInNewContext(ARCADE_CLIENT_JS, {
    document, location, history: { replaceState(_state, _unused, hash) { location.hash = hash; } },
    window: { addEventListener: (name, cb) => windowEvents.set(name, cb) },
    localStorage: { getItem() { return storage; }, setItem(_key, value) { storage = value; } },
    performance: { now: () => clock },
    requestAnimationFrame: cb => { frames.set(++nextFrame, cb); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  return {
    get: id => elements.get(id), frames,
    click: id => elements.get(id).emit('click'),
    key: (key, props = {}) => elements.get('play-surface').emit('keydown', { key, code: key === ' ' ? 'Space' : key, ...props }),
    advance(ms) { clock += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(clock)); },
    hide() { document.hidden = true; documentEvents.get('visibilitychange')(); },
    pagehide() { windowEvents.get('pagehide')(); },
    storage: () => storage,
  };
}

test('switching, pause/resume, hidden pages, and back-cache transitions stop old animation loops', () => {
  const f = fixture();
  assert.equal(f.get('arcade-player').hidden, false);
  assert.equal(f.get('action-flap').disabled, true);
  f.click('start');
  assert.equal(f.frames.size, 1);
  assert.equal(f.get('action-flap').disabled, false);
  f.key('Escape');
  assert.equal(f.frames.size, 0);
  assert.equal(f.get('start').textContent, 'Resume');
  assert.equal(f.get('action-flap').disabled, true);
  f.click('start'); f.advance(16); f.advance(16);
  assert.equal(f.frames.size, 1);
  f.click('choose-do-not-disturb');
  assert.equal(f.frames.size, 0);
  f.click('start'); f.hide();
  assert.equal(f.frames.size, 0);
  assert.equal(f.get('start').textContent, 'Resume');
  f.click('start'); f.pagehide();
  assert.equal(f.frames.size, 0);
  assert.equal(f.get('start').textContent, 'Resume');
});

test('packing announces every item, rejects repeated/composing/native-key input, and supports replay', () => {
  const f = fixture({ storage: 'malformed saved scores' });
  f.click('choose-carry-on'); f.click('start');
  assert.match(f.get('announcement').textContent, /Item 1 of 18:/);
  assert.equal(f.frames.size, 0);
  const before = f.get('packing-progress').value;
  f.key('ArrowRight', { repeat: true });
  f.key('ArrowRight', { isComposing: true });
  f.key('ArrowRight', { target: f.get('action-pack') });
  assert.equal(f.get('packing-progress').value, before);
  const packingList = new Set(['Sunglasses', 'Headphones', 'Paperback', 'Lipstick', 'Camera', 'Scarf']);
  for (let i = 0; i < 18; i++) {
    f.advance(250);
    const pack = packingList.has(f.get('item-name').textContent);
    f.click(pack ? 'action-pack' : 'action-leave');
    if (i < 17) assert.match(f.get('announcement').textContent, new RegExp(`Item ${i + 2} of 18:`));
  }
  assert.equal(f.get('score').textContent, '330');
  assert.equal(f.get('start').textContent, 'Play again');
  assert.match(f.get('announcement').textContent, /18 of 18 items sorted correctly/);
  assert.equal(JSON.parse(f.storage())['carry-on'], 330);
  f.click('start');
  assert.equal(f.get('score').textContent, '000');
  assert.equal(f.get('best').textContent, '330');
  assert.equal(f.get('packing-progress').value, 0);
});

test('Carry-On still starts when the canvas API throws', () => {
  const f = fixture({ noCanvas: true });
  f.click('start');
  assert.match(f.get('announcement').textContent, /cannot draw/);
  f.click('choose-carry-on'); f.click('start');
  assert.equal(f.get('overlay').hidden, true);
  assert.match(f.get('announcement').textContent, /Item 1 of 18/);
  assert.equal(f.get('action-pack').disabled, false);
});
