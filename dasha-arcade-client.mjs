import { createArcadeEngine } from './dasha-arcade-engine.mjs';

/** Serialized unchanged for the Worker; game rules are shared with the tests. */
function mountArcade(makeEngine) {
  'use strict';
  const engine = makeEngine();
  const $ = id => document.getElementById(id);
  const root = $('arcade');
  const canvas = $('playfield');
  let context;
  try { context = canvas.getContext && canvas.getContext('2d'); } catch (_) {}
  const portrait = $('dasha-portrait');
  const titles = { 'after-hours': 'Dasha After Hours', 'do-not-disturb': 'Do Not Disturb', 'carry-on': 'Dasha’s Carry-On' };
  const instructions = {
    'after-hours': 'Keep Dasha floating through the gaps. Tap the game or press Space. One collision ends the run.',
    'do-not-disturb': 'Give Dasha 45 seconds of peace. Collect the ✦, dodge the !. Use ← →, A / D, or tap a lane. Three pings end the round.',
    'carry-on': 'Pack only what is on Dasha’s list. Choose Pack or Leave for each item. 18 items, no timer. ← leaves; → packs.',
  };
  const descriptions = {
    'after-hours': 'Out of office. Slightly airborne.',
    'do-not-disturb': 'Her time. Her notifications. Your problem.',
    'carry-on': 'One bag. A very specific list.',
  };
  let selected = engine.games.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'after-hours';
  let state, mode = 'ready', lastFrame = 0, accumulator = 0, frame = 0;
  let hudSignature = '', best = {}, packLockedUntil = 0;
  try { best = JSON.parse(localStorage.getItem('dasha-arcade-best-v1') || '{}') || {}; } catch (_) {}
  function bestScore(id) {
    const value = best[id];
    return Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : 0;
  }
  function announce(message) { $('announcement').textContent = message; }
  function controlsEnabled(enabled) {
    for (const button of document.querySelectorAll('[data-action]')) button.disabled = !enabled;
  }
  function currentItem() {
    return `Item ${state.index + 1} of 18: ${state.deck[state.index].name}. Pack it or leave it?`;
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; accumulator = 0; }
  function overlay(title, text, button) {
    $('overlay-title').textContent = title;
    $('overlay-copy').textContent = text;
    $('start').textContent = button;
    $('overlay').hidden = false;
  }
  function updateHud() {
    const detail = selected === 'after-hours' ? `${state.passed} gaps` : selected === 'do-not-disturb'
      ? `${Math.max(0, Math.ceil(45 - state.elapsed))}s · ${state.lives} chances`
      : `${Math.min(18, state.index + 1)} / 18 items`;
    const signature = `${state.score}|${detail}|${bestScore(selected)}`;
    if (signature === hudSignature) return;
    hudSignature = signature;
    $('score').textContent = String(state.score).padStart(3, '0');
    $('round-detail').textContent = detail;
    $('best').textContent = String(bestScore(selected)).padStart(3, '0');
  }
  function avatar(x, y, size) {
    context.save();
    context.beginPath(); context.arc(x, y, size / 2, 0, Math.PI * 2); context.clip();
    context.fillStyle = '#dfff00'; context.fillRect(x - size / 2, y - size / 2, size, size);
    if (portrait.complete && portrait.naturalWidth) context.drawImage(portrait, x - size / 2, y - size / 2, size, size);
    else { context.fillStyle = '#111'; context.font = 'bold 28px Arial'; context.textAlign = 'center'; context.fillText('D', x, y + 10); }
    context.restore(); context.strokeStyle = '#dfff00'; context.lineWidth = 3;
    context.beginPath(); context.arc(x, y, size / 2 + 2, 0, Math.PI * 2); context.stroke();
  }
  function paint() {
    if (selected === 'carry-on') {
      const card = state.deck[Math.min(state.index, state.deck.length - 1)];
      $('item-icon').textContent = card.icon;
      $('item-name').textContent = card.name;
      $('packing-progress').value = state.index;
      $('packing-progress').setAttribute('aria-label', `${state.index} of 18 items sorted`);
      $('streak').textContent = state.streak > 1 ? `${state.streak} in a row` : 'Pack light.';
      return;
    }
    if (!context) return;
    const w = engine.width, h = engine.height;
    context.fillStyle = '#181916'; context.fillRect(0, 0, w, h);
    context.strokeStyle = '#30322b'; context.lineWidth = 1;
    for (let x = 0; x < w; x += 60) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, h); context.stroke(); }
    for (let y = 0; y < h; y += 60) { context.beginPath(); context.moveTo(0, y); context.lineTo(w, y); context.stroke(); }
    if (selected === 'after-hours') {
      const gates = state.gates.length ? state.gates : [{ x: 465, center: 210, gap: 195 }];
      for (const gate of gates) {
        context.fillStyle = '#dfff00';
        context.fillRect(gate.x, 0, 62, gate.center - gate.gap / 2);
        context.fillRect(gate.x, gate.center + gate.gap / 2, 62, h);
        context.fillStyle = '#171811'; context.font = 'bold 26px monospace'; context.textAlign = 'center';
        context.fillText('!', gate.x + 31, 42);
      }
      avatar(145, state.y, 49);
      context.fillStyle = '#f4eddb'; context.font = 'bold 18px monospace'; context.textAlign = 'left';
      context.fillText('AFTER HOURS', 24, h - 24);
    } else {
      context.strokeStyle = '#5a5d4a'; context.setLineDash([6, 10]);
      for (const x of [w / 3, w * 2 / 3]) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, h); context.stroke(); }
      context.setLineDash([]);
      context.fillStyle = '#252c17'; context.fillRect(state.lane * w / 3 + 2, h - 115, w / 3 - 4, 115);
      const items = state.items.length || mode === 'playing' ? state.items : [{ lane: 0, y: 110, good: true }, { lane: 2, y: 165, good: false }];
      for (const item of items) {
        const x = (item.lane + 0.5) * w / 3;
        context.fillStyle = item.good ? '#dfff00' : '#ff927e'; context.fillRect(x - 26, item.y - 26, 52, 52);
        context.fillStyle = '#111'; context.font = 'bold 32px Arial'; context.textAlign = 'center';
        context.fillText(item.good ? '✦' : '!', x, item.y + 11);
      }
      avatar((state.lane + 0.5) * w / 3, 356, 58);
    }
  }
  function finish() {
    mode = 'over'; stop();
    const record = state.score > bestScore(selected);
    if (record) {
      // Scores are device-local, optional, and never interpreted as token rewards.
      try { best = { ...best, [selected]: state.score }; localStorage.setItem('dasha-arcade-best-v1', JSON.stringify(best)); } catch (_) {}
    }
    $('pause').disabled = true; controlsEnabled(false);
    let summary = selected === 'carry-on' ? `${state.correct} of 18 items sorted correctly. ${state.score} points.`
      : selected === 'after-hours' ? `${state.passed} gaps cleared. ${state.score} points.`
      : `${state.collected} quiet moments collected. ${state.score} points.`;
    if (record) summary += ' A new best on this device.';
    overlay(selected === 'carry-on' ? 'That’s the bag.' : selected === 'do-not-disturb' && state.lives > 0 ? 'Peace, achieved.' : 'One more?', summary, 'Play again');
    updateHud(); announce(summary);
    // The active play surface disappears behind the result. Keep keyboard continuation obvious.
    if (root.contains(document.activeElement)) $('start').focus({ preventScroll: true });
  }
  function loop(time) {
    frame = 0;
    if (mode !== 'playing') return;
    if (lastFrame && time - lastFrame > 500) { pause(); return; }
    if (lastFrame) accumulator += Math.min(0.1, (time - lastFrame) / 1000);
    lastFrame = time;
    while (accumulator >= 1 / 60 && !state.over) { engine.step(state, 1 / 60); accumulator -= 1 / 60; }
    paint(); updateHud();
    if (state.over) finish(); else frame = requestAnimationFrame(loop);
  }
  function start() {
    if (!context && selected !== 'carry-on') { announce('This browser cannot draw the game. Try Dasha’s Carry-On.'); return; }
    if (mode !== 'paused') state = engine.create(selected);
    mode = 'playing'; stop(); packLockedUntil = 0; hudSignature = '';
    $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'Pause'; controlsEnabled(true);
    $('sort-feedback').textContent = ''; announce(selected === 'carry-on' ? currentItem() : 'Game started.');
    $('play-surface').focus({ preventScroll: true });
    paint(); updateHud();
    if (selected !== 'carry-on') frame = requestAnimationFrame(loop);
  }
  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused'; stop(); $('pause').disabled = true; controlsEnabled(false);
    overlay('On a break.', 'Dasha can wait.', 'Resume'); announce('Game paused.');
    if (!document.hidden && document.hasFocus() && root.contains(document.activeElement)) $('start').focus({ preventScroll: true });
  }
  function action(value) {
    if (mode !== 'playing') return;
    if (selected === 'carry-on') {
      if (performance.now() < packLockedUntil) return;
      packLockedUntil = performance.now() + 240;
    }
    engine.act(state, value); paint(); updateHud();
    if (selected === 'carry-on') {
      $('sort-feedback').textContent = state.feedback;
      if (!state.over) announce(`${state.feedback} ${currentItem()}`);
    }
    if (state.over) finish();
  }
  function select(id, writeHash = true) {
    if (!engine.games.includes(id)) return;
    stop(); selected = id; mode = 'ready'; state = engine.create(id); hudSignature = '';
    root.dataset.game = id;
    $('game-title').textContent = titles[id]; $('instructions').textContent = instructions[id];
    $('dasha-line').textContent = descriptions[id];
    $('playfield').hidden = id === 'carry-on'; $('packing').hidden = id !== 'carry-on';
    for (const button of document.querySelectorAll('[data-game]')) {
      if (button === root) continue;
      button.setAttribute('aria-pressed', String(button.dataset.game === id));
    }
    $('flight-controls').hidden = id !== 'after-hours';
    $('lane-controls').hidden = id !== 'do-not-disturb';
    $('sort-controls').hidden = id !== 'carry-on';
    $('sort-feedback').textContent = '';
    $('pause').disabled = true; $('pause').textContent = 'Pause'; controlsEnabled(false);
    overlay('Ready, Dasha?', id === 'carry-on' ? '18 items. No rush.' : id === 'do-not-disturb' ? '45 seconds. Protect her peace.' : 'A little lift goes a long way.', 'Play');
    if (!context && id !== 'carry-on') overlay('A small browser problem.', 'Try Dasha’s Carry-On; it works without canvas.', 'Try again');
    if (writeHash) { try { history.replaceState(null, '', '#' + id); } catch (_) {} }
    paint(); updateHud();
  }
  for (const button of document.querySelectorAll('button[data-game]')) button.addEventListener('click', () => select(button.dataset.game));
  for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => action(button.dataset.action));
  $('start').addEventListener('click', start);
  $('pause').addEventListener('click', pause);
  $('restart').addEventListener('click', () => { select(selected, false); $('start').focus({ preventScroll: true }); });
  canvas.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    event.preventDefault(); $('play-surface').focus({ preventScroll: true });
    if (selected === 'after-hours') action('flap');
    else { const box = canvas.getBoundingClientRect(); action(Math.floor((event.clientX - box.left) / box.width * 3)); }
  });
  $('play-surface').addEventListener('keydown', event => {
    if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    // Native controls retain Enter/Space; gameplay shortcuts belong to the focusable surface.
    if (event.target !== $('play-surface')) return;
    if (event.key === 'Escape') { event.preventDefault(); pause(); return; }
    if (mode !== 'playing') return;
    let value;
    if (selected === 'after-hours' && (event.code === 'Space' || event.key === 'ArrowUp')) value = 'flap';
    if (selected !== 'after-hours' && (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a')) value = selected === 'carry-on' ? 'leave' : 'left';
    if (selected !== 'after-hours' && (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd')) value = selected === 'carry-on' ? 'pack' : 'right';
    if (value) { event.preventDefault(); action(value); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', () => { pause(); stop(); });
  window.addEventListener('hashchange', () => { if (engine.games.includes(location.hash.slice(1))) select(location.hash.slice(1), false); });
  portrait.addEventListener('load', paint);
  select(selected, false);
  $('loading-note').hidden = true;
  $('arcade-player').hidden = false;
}

export const ARCADE_CLIENT_JS = `(${mountArcade.toString()})(${createArcadeEngine.toString()});`;
