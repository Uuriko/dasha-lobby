/** Local, deterministic game rules. No accounts, requests, rewards, or room state. */
export function createArcadeEngine() {
  const width = 720, height = 420;
  const games = ['after-hours', 'do-not-disturb', 'carry-on'];
  const packing = [
    { name: 'Sunglasses', icon: '🕶', pack: true },
    { name: 'Headphones', icon: '🎧', pack: true },
    { name: 'Paperback', icon: '📖', pack: true },
    { name: 'Lipstick', icon: '💄', pack: true },
    { name: 'Camera', icon: '📷', pack: true },
    { name: 'Scarf', icon: '🧣', pack: true },
    { name: 'Alarm clock', icon: '⏰', pack: false },
    { name: 'Desk printer', icon: '🖨', pack: false },
    { name: 'Traffic cone', icon: '🚧', pack: false },
    { name: 'Office phone', icon: '☎', pack: false },
    { name: 'Filing cabinet', icon: '🗄', pack: false },
    { name: 'Desktop computer', icon: '🖥', pack: false },
  ];
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  function create(id, random = Math.random) {
    if (!games.includes(id)) throw new Error('Unknown arcade game');
    const s = { id, score: 0, elapsed: 0, over: false, random, feedback: '' };
    if (id === 'after-hours') Object.assign(s, { y: 205, vy: 0, spawn: 0, gates: [], passed: 0 });
    if (id === 'do-not-disturb') Object.assign(s, { lane: 1, lives: 3, spawn: 0.4, items: [], collected: 0 });
    if (id === 'carry-on') {
      const deck = [...packing, ...packing.slice(0, 3), ...packing.slice(6, 9)].map(x => ({ ...x }));
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(clamp(random(), 0, 0.999999) * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      Object.assign(s, { deck, index: 0, correct: 0, streak: 0 });
    }
    return s;
  }
  function act(s, action) {
    if (s.over) return;
    if (s.id === 'after-hours' && action === 'flap') s.vy = -255;
    if (s.id === 'do-not-disturb') {
      if (action === 'left') s.lane = clamp(s.lane - 1, 0, 2);
      if (action === 'right') s.lane = clamp(s.lane + 1, 0, 2);
      if (Number.isInteger(action)) s.lane = clamp(action, 0, 2);
    }
    if (s.id === 'carry-on' && (action === 'pack' || action === 'leave')) {
      const card = s.deck[s.index];
      const correct = (action === 'pack') === card.pack;
      s.streak = correct ? s.streak + 1 : 0;
      if (correct) { s.correct++; s.score += 10 + Math.min(5, s.streak - 1) * 2; }
      s.feedback = correct ? (card.pack ? `${card.name} packed.` : `${card.name} stays home.`)
        : (card.pack ? `${card.name} was on the list.` : `${card.name} is not on the list.`);
      s.index++;
      s.over = s.index === s.deck.length;
    }
  }
  function step(s, seconds) {
    if (s.over || s.id === 'carry-on' || !Number.isFinite(seconds) || seconds <= 0) return;
    // Callers advance at fixed intervals; never jump through a collision after a slow frame.
    const dt = Math.min(seconds, 1 / 30);
    s.elapsed += dt;
    s.spawn -= dt;
    if (s.id === 'after-hours') {
      s.vy += 600 * dt;
      s.y += s.vy * dt;
      const speed = Math.min(230, 155 + s.passed * 4);
      const gap = Math.max(155, 195 - s.passed * 2);
      if (s.spawn <= 0) {
        s.gates.push({ x: width + 45, center: 110 + s.random() * 200, gap, counted: false });
        s.spawn += 1.9;
      }
      for (const gate of s.gates) {
        gate.x -= speed * dt;
        if (!gate.counted && gate.x + 62 < 145 - 19) { gate.counted = true; s.passed++; s.score += 10; }
        if (gate.x < 145 + 19 && gate.x + 62 > 145 - 19 &&
          (s.y - 19 < gate.center - gate.gap / 2 || s.y + 19 > gate.center + gate.gap / 2)) s.over = true;
      }
      s.gates = s.gates.filter(g => g.x > -70);
      if (s.y < 19 || s.y > height - 19) s.over = true;
    } else {
      if (s.spawn <= 0) {
        s.items.push({ lane: Math.floor(clamp(s.random(), 0, 0.999999) * 3), y: -35, good: s.random() > 0.42 });
        s.spawn += Math.max(0.48, 0.85 - s.elapsed * 0.006);
      }
      const speed = 125 + s.elapsed * 1.6;
      for (const item of s.items) {
        item.y += speed * dt;
        if (!item.used && item.lane === s.lane && Math.abs(item.y - 356) < 35) {
          item.used = true;
          if (item.good) { s.score += 10; s.collected++; }
          else { s.lives--; s.feedback = 'A notification got through.'; }
        }
      }
      s.items = s.items.filter(item => !item.used && item.y < height + 40);
      if (s.lives <= 0 || s.elapsed >= 45) s.over = true;
    }
  }
  return { width, height, games, packing, create, act, step };
}
