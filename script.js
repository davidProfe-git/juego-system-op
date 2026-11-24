/* Tarjeta Tanque: tarjeta giratoria + juego de tanques en canvas, sin librerías. */
(() => {
  'use strict';

  /* ================= Utilidades ================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Constantes del juego ================= */
  const CELL = 8;                 // una celda de terreno = 8 px
  const GRID = 26;                // 26 x 26 celdas
  const SIZE = CELL * GRID;       // 208 px lógicos
  const TILE = 16;                // un tanque = 2 x 2 celdas
  const ENEMY_TOTAL = 20;
  const START_LIVES = 3;
  const DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // arriba, derecha, abajo, izquierda
  const EMPTY = 0, BRICK = 1, STEEL = 2;

  // Mapa de 13 x 13 bloques: . vacío, B ladrillo, S acero, E base
  const MAP = [
    '.............',
    '.B.B.B.B.B.B.',
    '.B.B.B.B.B.B.',
    '.B.B.BSB.B.B.',
    '.B.B.B.B.B.B.',
    '.B.B.B.B.B.B.',
    '.............',
    'SS.BBB.BBB.SS',
    '.............',
    '.B.B.B.B.B.B.',
    '.B.B.B.B.B.B.',
    '.B.B.BBB.B.B.',
    '.B.B.BEB.B.B.'
  ];

  const BASE = { x: 96, y: 192 };
  const PLAYER_SPAWNS = [{ x: 64, y: 192 }, { x: 128, y: 192 }];
  const ENEMY_SPAWNS = [{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 192, y: 0 }];

  const SPECS = {
    player: { speed: 46, bulletSpeed: 130, hp: 1 },
    A: { speed: 32, bulletSpeed: 90, hp: 1, points: 100 },   // básico
    B: { speed: 54, bulletSpeed: 90, hp: 1, points: 200 },   // rápido
    C: { speed: 36, bulletSpeed: 150, hp: 1, points: 300 },  // bala veloz
    D: { speed: 32, bulletSpeed: 100, hp: 4, points: 400 }   // blindado
  };

  const pal = (body, track, tread, light, dark) => ({ body, track, tread, light, dark });
  const PAL = {
    p1: pal('#e6b43a', '#8c6b17', '#3d2d06', '#fbe7a0', '#7a5a10'),
    p2: pal('#43b05f', '#1f6b34', '#0c2e16', '#a6e8b6', '#17572a'),
    A: pal('#b7bdc3', '#6a7178', '#2a2e32', '#e9ecef', '#4c5359'),
    B: pal('#7cc3d6', '#3b7a8b', '#13323b', '#c9eef7', '#27606f'),
    C: pal('#b58bd6', '#6b4a8a', '#2a1a3a', '#e4cff5', '#4d3068'),
    D4: pal('#5aa86b', '#2f6a3d', '#10301a', '#b5e6c0', '#25552f'),
    D3: pal('#d1b43f', '#85721c', '#3a3008', '#f3e49a', '#6a5a12'),
    D2: pal('#d98a3b', '#8a5418', '#3d2308', '#f6c997', '#6e400f'),
    D1: pal('#d6503f', '#8a2a1f', '#3d0f0a', '#f4a79d', '#6e1d14'),
    flash: pal('#ffffff', '#d0d0d0', '#808080', '#ffffff', '#b0b0b0')
  };

  /* ================= Sprites (dibujados por código) ================= */
  function makeTankSprite(c, frame) {
    const s = document.createElement('canvas');
    s.width = s.height = 16;
    const g = s.getContext('2d');
    g.fillStyle = c.track; g.fillRect(0, 1, 4, 15); g.fillRect(12, 1, 4, 15);
    g.fillStyle = c.tread;
    for (let y = frame ? 1 : 3; y < 16; y += 3) { g.fillRect(0, y, 4, 1); g.fillRect(12, y, 4, 1); }
    g.fillStyle = c.body; g.fillRect(4, 4, 8, 11);
    g.fillStyle = c.light; g.fillRect(4, 4, 8, 1); g.fillRect(4, 5, 1, 9);
    g.fillStyle = c.dark; g.fillRect(11, 5, 1, 10); g.fillRect(4, 14, 8, 1);
    g.fillStyle = c.dark; g.fillRect(5, 7, 6, 6);
    g.fillStyle = c.body; g.fillRect(6, 8, 4, 4);
    g.fillStyle = c.light; g.fillRect(6, 8, 4, 1);
    g.fillStyle = c.body; g.fillRect(7, 0, 2, 8);
    g.fillStyle = c.dark; g.fillRect(7, 0, 2, 1);
    return s;
  }

  const spriteCache = new Map();
  function sprite(key, frame) {
    const k = key + ':' + frame;
    let s = spriteCache.get(k);
    if (!s) { s = makeTankSprite(PAL[key], frame); spriteCache.set(k, s); }
    return s;
  }

  function makeCell(type) {
    const s = document.createElement('canvas');
    s.width = s.height = CELL;
    const g = s.getContext('2d');
    if (type === BRICK) {
      g.fillStyle = '#c0462c'; g.fillRect(0, 0, 8, 8);
      g.fillStyle = '#e8734a'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 4, 8, 1);
      g.fillStyle = '#3d120a';
      g.fillRect(0, 3, 8, 1); g.fillRect(0, 7, 8, 1); g.fillRect(3, 0, 1, 3); g.fillRect(7, 4, 1, 3);
    } else {
      g.fillStyle = '#9aa1a8'; g.fillRect(0, 0, 8, 8);
      g.fillStyle = '#e8ecef'; g.fillRect(0, 0, 8, 1); g.fillRect(0, 0, 1, 8);
      g.fillStyle = '#555c62'; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8);
      g.fillStyle = '#c8cdd1'; g.fillRect(2, 2, 4, 4);
      g.fillStyle = '#7b838a'; g.fillRect(5, 2, 1, 4); g.fillRect(2, 5, 4, 1);
    }
    return s;
  }
  const brickImg = makeCell(BRICK);
  const steelImg = makeCell(STEEL);

  /* ================= DOM ================= */
  const card = $('#card');
  const front = $('#front');
  const back = $('#back');
  const board = $('#board');
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const screenEl = $('#screen');
  const screenTitle = $('#screenTitle');
  const screenSub = $('#screenSub');
  const screenBtn = $('#screenBtn');
  const playBtn = $('#playBtn');
  const backBtn = $('#backBtn');
  const pauseBtn = $('#pauseBtn');
  const modeBtn = $('#modeBtn');
  const soundBtn = $('#soundBtn');
  const keysHelp = $('#keysHelp');
  const enemiesEl = $('#enemies');
  const pl2 = $('#pl2');
  const lives1 = $('#lives1'), lives2 = $('#lives2');
  const score1 = $('#score1'), score2 = $('#score2');
  const stageNum = $('#stageNum'), hiNum = $('#hiNum');

  // Sprites en la interfaz
  $('#logo').getContext('2d').drawImage(sprite('p1', 0), 0, 0);
  $$('[data-sprite]').forEach((img) => { img.src = sprite(img.dataset.sprite, 0).toDataURL(); });
  const enemyIconURL = sprite('A', 0).toDataURL();
  const icons = Array.from({ length: ENEMY_TOTAL }, () => {
    const img = document.createElement('img');
    img.src = enemyIconURL;
    img.alt = '';
    enemiesEl.appendChild(img);
    return img;
  });

  /* ================= Récord ================= */
  const HI_KEY = 'tarjeta-tanque-record';
  function loadHi() {
    try { return parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0; } catch (_) { return 0; }
  }
  function saveHi(v) {
    try { localStorage.setItem(HI_KEY, String(v)); } catch (_) { /* sin almacenamiento */ }
  }

  /* ================= Sonido (apagado por defecto) ================= */
  let soundOn = false;
  let audioCtx = null;
  function beep(freq, dur, type, vol, slide) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + dur);
    } catch (_) { /* audio no disponible */ }
  }
  function sfx(name) {
    switch (name) {
      case 'shoot': beep(520, 0.07, 'square', 0.03, -300); break;
      case 'brick': beep(170, 0.05, 'square', 0.03, -60); break;
      case 'steel': beep(900, 0.04, 'triangle', 0.03, 0); break;
      case 'wall': beep(240, 0.03, 'square', 0.02, 0); break;
      case 'boom': beep(160, 0.35, 'sawtooth', 0.05, -120); break;
      case 'playerDie': beep(260, 0.55, 'sawtooth', 0.05, -220); break;
      case 'clear': beep(520, 0.12, 'square', 0.04, 260); break;
      case 'over': beep(200, 0.7, 'sawtooth', 0.05, -160); break;
      default: break;
    }
  }

  /* ================= Estado ================= */
  const terrain = new Uint8Array(GRID * GRID);
  const G = {
    state: 'idle',        // idle | intro | play | paused | clear | over
    prev: 'play',
    stage: 1,
    count: 1,             // jugadores
    timer: 0,
    overAt: 0,
    players: [],
    tanks: [],
    bullets: [],
    effects: [],
    queue: [],
    spawnCd: 0,
    spawnIdx: 0,
    spawned: 0,
    baseAlive: true,
    endTimer: 0,
    hi: loadHi()
  };

  function loadTerrain() {
    terrain.fill(EMPTY);
    MAP.forEach((row, ty) => {
      Array.from(row).forEach((ch, tx) => {
        const v = ch === 'B' ? BRICK : ch === 'S' ? STEEL : EMPTY;
        if (!v) return;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) terrain[(ty * 2 + dy) * GRID + tx * 2 + dx] = v;
        }
      });
    });
  }

  function buildQueue(stage) {
    const rows = [[14, 4, 2, 0], [10, 5, 3, 2], [6, 6, 4, 4], [4, 6, 5, 5]];
    const [a, b, c, d] = rows[Math.min(stage, 4) - 1];
    const q = [].concat(Array(a).fill('A'), Array(b).fill('B'), Array(c).fill('C'), Array(d).fill('D'));
    for (let i = q.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const tmp = q[i]; q[i] = q[j]; q[j] = tmp;
    }
    return q;
  }

  /* ================= Tanques ================= */
  function makeTankObj(o) {
    const spec = o.side === 'player' ? SPECS.player : SPECS[o.kind];
    return {
      x: o.x, y: o.y, dir: o.dir,
      side: o.side, kind: o.kind || null, player: o.player,
      speed: spec.speed, bulletSpeed: spec.bulletSpeed,
      hp: spec.hp, points: spec.points || 0,
      spawn: 1.0, active: false, dead: false,
      bullet: null, anim: 0, flash: 0, shield: 0, want: undefined,
      ai: { think: rand(0.4, 1.2), fire: rand(0.8, 2), stuck: 0 }
    };
  }

  function blockedRect(x, y, w, h, self) {
    if (x < 0 || y < 0 || x + w > SIZE || y + h > SIZE) return true;
    const x0 = Math.floor(x / CELL), x1 = Math.floor((x + w - 0.001) / CELL);
    const y0 = Math.floor(y / CELL), y1 = Math.floor((y + h - 0.001) / CELL);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (terrain[cy * GRID + cx] !== EMPTY) return true;
      }
    }
    if (overlap(x, y, w, h, BASE.x, BASE.y, TILE, TILE)) return true;
    for (const t of G.tanks) {
      if (t !== self && t.active && !t.dead && overlap(x, y, w, h, t.x, t.y, TILE, TILE)) return true;
    }
    return false;
  }

  function snapAxis(t, dir) {
    if (dir % 2 === 1) {
      const ny = Math.round(t.y / CELL) * CELL;
      if (!blockedRect(t.x, ny, TILE, TILE, t)) t.y = ny;
    } else {
      const nx = Math.round(t.x / CELL) * CELL;
      if (!blockedRect(nx, t.y, TILE, TILE, t)) t.x = nx;
    }
  }

  function moveTank(t, dir, dist) {
    if (t.dir !== dir) {
      if ((t.dir % 2 === 1) !== (dir % 2 === 1)) snapAxis(t, dir);
      t.dir = dir;
    }
    const d = DIRS[dir];
    let remaining = dist;
    let moved = false;
    while (remaining > 0) {
      const step = Math.min(1, remaining);
      remaining -= step;
      const nx = t.x + d.x * step;
      const ny = t.y + d.y * step;
      if (blockedRect(nx, ny, TILE, TILE, t)) break;
      t.x = nx; t.y = ny; moved = true;
    }
    return moved;
  }

  function fire(t) {
    if (t.bullet && !t.bullet.dead) return false;
    const d = DIRS[t.dir];
    const b = {
      x: t.x + 8 + d.x * 7,
      y: t.y + 8 + d.y * 7,
      dir: t.dir,
      speed: t.bulletSpeed,
      friendly: t.side === 'player',
      owner: t.player,
      power: false,
      dead: false
    };
    G.bullets.push(b);
    t.bullet = b;
    if (t.side === 'player') sfx('shoot');
    return true;
  }

  function spawnPlayer(p, i) {
    const s = PLAYER_SPAWNS[i];
    const t = makeTankObj({ x: s.x, y: s.y, dir: 0, side: 'player', player: i });
    t.spawn = 0.9;
    p.tank = t;
    G.tanks.push(t);
  }

  function pickDir(t) {
    const r = Math.random();
    if (r < 0.42) return 2;
    if (r < 0.62) return BASE.x < t.x ? 3 : 1;
    return randInt(0, 3);
  }

  function aiStep(t, dt) {
    const ai = t.ai;
    ai.think -= dt;
    const moved = moveTank(t, t.want === undefined ? t.dir : t.want, t.speed * dt);
    if (moved) {
      t.anim += dt;
      ai.stuck = 0;
    } else {
      ai.stuck += dt;
      ai.fire = Math.min(ai.fire, 0.12);
    }
    if (ai.think <= 0 || ai.stuck > 0.25) {
      t.want = pickDir(t);
      ai.think = rand(0.8, 2.6);
      ai.stuck = 0;
    }
    ai.fire -= dt;
    if (ai.fire <= 0) {
      fire(t);
      ai.fire = rand(0.5, 1.7);
    }
  }

  /* ================= Efectos ================= */
  function spark(x, y) { G.effects.push({ x, y, t: 0, dur: 0.18, r: 3 }); }
  function explode(x, y, big) { G.effects.push({ x, y, t: 0, dur: big ? 0.45 : 0.2, r: big ? 14 : 6 }); }
  function updateEffects(dt) {
    for (const e of G.effects) e.t += dt;
    G.effects = G.effects.filter((e) => e.t < e.dur);
  }

  /* ================= Balas ================= */
  function destroyBase() {
    G.baseAlive = false;
    explode(BASE.x + 8, BASE.y + 8, true);
    explode(BASE.x + 4, BASE.y + 10, true);
    sfx('boom');
  }

  function killTank(t, by) {
    t.dead = true;
    explode(t.x + 8, t.y + 8, true);
    if (t.side === 'player') {
      const p = G.players[t.player];
      p.tank = null;
      p.lives -= 1;
      p.respawn = 1.2;
      sfx('playerDie');
    } else {
      sfx('boom');
      if (by !== undefined && by !== null && G.players[by]) {
        const p = G.players[by];
        p.score += t.points;
        if (p.score > G.hi) { G.hi = p.score; saveHi(G.hi); }
      }
    }
  }

  function hitTank(t, b) {
    if (t.side === 'player') {
      if (t.shield > 0) { sfx('steel'); spark(b.x, b.y); return; }
      killTank(t);
    } else {
      t.hp -= 1;
      if (t.hp <= 0) killTank(t, b.owner);
      else { t.flash = 0.12; sfx('steel'); spark(b.x, b.y); }
    }
  }

  function bulletVsBase(b) {
    if (!G.baseAlive) return false;
    if (overlap(b.x - 2, b.y - 2, 4, 4, BASE.x, BASE.y, TILE, TILE)) {
      b.dead = true;
      destroyBase();
      return true;
    }
    return false;
  }

  function bulletVsTerrain(b) {
    const d = DIRS[b.dir];
    const horiz = d.x !== 0;
    const tx = b.x + d.x * 2;
    const ty = b.y + d.y * 2;
    const hits = [];
    for (const o of [-2, 1.5]) {
      const px = horiz ? tx : tx + o;
      const py = horiz ? ty + o : ty;
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) continue;
      const v = terrain[cy * GRID + cx];
      if (v !== EMPTY) hits.push([cx, cy, v]);
    }
    if (!hits.length) return false;
    let steel = false;
    for (const [cx, cy, v] of hits) {
      if (v === STEEL) steel = true;
      const pair = horiz ? [[cx, cy], [cx, cy ^ 1]] : [[cx, cy], [cx ^ 1, cy]];
      for (const [px, py] of pair) {
        const i = py * GRID + px;
        if (terrain[i] === BRICK || (terrain[i] === STEEL && b.power)) terrain[i] = EMPTY;
      }
    }
    b.dead = true;
    spark(tx, ty);
    sfx(steel ? 'steel' : 'brick');
    return true;
  }

  function bulletVsTanks(b) {
    for (const t of G.tanks) {
      if (t.dead || !t.active) continue;
      if (b.friendly === (t.side === 'player')) continue;
      if (!overlap(b.x - 2, b.y - 2, 4, 4, t.x + 1, t.y + 1, 14, 14)) continue;
      b.dead = true;
      hitTank(t, b);
      return true;
    }
    return false;
  }

  function stepBullet(b, dt) {
    const d = DIRS[b.dir];
    let rem = b.speed * dt;
    while (rem > 0 && !b.dead) {
      const s = Math.min(2, rem);
      rem -= s;
      b.x += d.x * s;
      b.y += d.y * s;
      if (b.x < 0 || b.y < 0 || b.x >= SIZE || b.y >= SIZE) {
        b.dead = true;
        spark(clamp(b.x, 1, SIZE - 1), clamp(b.y, 1, SIZE - 1));
        sfx('wall');
        break;
      }
      if (bulletVsBase(b)) break;
      if (bulletVsTerrain(b)) break;
      if (bulletVsTanks(b)) break;
    }
  }

  /* ================= Actualización ================= */
  function stepWorld(dt, checkEnd) {
    // Animación de aparición
    for (const t of G.tanks) {
      if (t.active || t.dead) continue;
      t.spawn -= dt;
      if (t.spawn <= 0) {
        t.spawn = 0;
        if (!blockedRect(t.x, t.y, TILE, TILE, t)) {
          t.active = true;
          if (t.side === 'player') t.shield = 3.5;
        }
      }
    }

    // Jugadores
    G.players.forEach((p, i) => {
      const t = p.tank;
      if (t && !t.dead) {
        if (!t.active) return;
        t.shield = Math.max(0, t.shield - dt);
        t.flash = Math.max(0, t.flash - dt);
        if (p.dirStack.length) {
          const moved = moveTank(t, p.dirStack[p.dirStack.length - 1], t.speed * dt);
          if (moved) t.anim += dt;
        }
        p.fireCd -= dt;
        if (p.fire && p.fireCd <= 0 && fire(t)) p.fireCd = 0.18;
      } else if (!t && p.lives > 0) {
        p.respawn -= dt;
        if (p.respawn <= 0) spawnPlayer(p, i);
      }
    });

    // Aparición de enemigos
    G.spawnCd -= dt;
    const maxOn = G.count === 2 ? 6 : 4;
    const onField = G.tanks.filter((t) => t.side === 'enemy' && !t.dead).length;
    if (G.queue.length && onField < maxOn && G.spawnCd <= 0) {
      const sp = ENEMY_SPAWNS[G.spawnIdx % ENEMY_SPAWNS.length];
      G.spawnIdx += 1;
      const busy = G.tanks.some((t) => !t.dead && overlap(t.x, t.y, TILE, TILE, sp.x, sp.y, TILE, TILE));
      if (busy) {
        G.spawnCd = 0.3;
      } else {
        const kind = G.queue.shift();
        G.tanks.push(makeTankObj({ x: sp.x, y: sp.y, dir: 2, side: 'enemy', kind }));
        G.spawned += 1;
        G.spawnCd = Math.max(1.2, 3 - G.stage * 0.25);
      }
    }

    // IA
    for (const t of G.tanks) {
      if (t.side !== 'enemy' || t.dead || !t.active) continue;
      t.flash = Math.max(0, t.flash - dt);
      aiStep(t, dt);
    }

    // Balas
    for (const b of G.bullets) if (!b.dead) stepBullet(b, dt);
    for (let i = 0; i < G.bullets.length; i++) {
      const a = G.bullets[i];
      if (a.dead) continue;
      for (let j = i + 1; j < G.bullets.length; j++) {
        const c = G.bullets[j];
        if (c.dead || a.friendly === c.friendly) continue;
        if (overlap(a.x - 2, a.y - 2, 4, 4, c.x - 2, c.y - 2, 4, 4)) {
          a.dead = true; c.dead = true;
          spark(a.x, a.y);
          sfx('wall');
          break;
        }
      }
    }
    G.bullets = G.bullets.filter((b) => !b.dead);
    G.tanks = G.tanks.filter((t) => !t.dead);
    updateEffects(dt);

    if (!checkEnd) return;

    // Fin de partida o de nivel
    if (G.endTimer > 0) {
      G.endTimer -= dt;
      if (G.endTimer <= 0) gameOver();
    } else if (!G.baseAlive) {
      G.endTimer = 1.5;
    } else if (G.players.every((p) => p.lives <= 0 && !p.tank)) {
      G.endTimer = 1.5;
    } else if (!G.queue.length && !G.tanks.some((t) => t.side === 'enemy')) {
      G.state = 'clear';
      G.timer = 2.2;
      sfx('clear');
      showScreen('NIVEL SUPERADO');
    }
  }

  function update(dt) {
    switch (G.state) {
      case 'intro':
        G.timer -= dt;
        if (G.timer <= 0) { G.state = 'play'; hideScreen(); }
        break;
      case 'play':
        stepWorld(dt, true);
        break;
      case 'clear':
        stepWorld(dt, false);
        G.timer -= dt;
        if (G.timer <= 0) { G.stage += 1; loadStage(); enterIntro(); }
        break;
      case 'over':
        updateEffects(dt);
        break;
      default:
        break;
    }
  }

  /* ================= Dibujo ================= */
  function burst(g, x, y, r, color) {
    const t = Math.max(1, Math.round(r / 2));
    const c = Math.round(r * 0.7);
    g.fillStyle = color;
    g.fillRect(x - r, y - t, 2 * r, 2 * t);
    g.fillRect(x - t, y - r, 2 * t, 2 * r);
    g.fillRect(x - c, y - c, 2 * c, 2 * c);
  }

  function drawEffect(g, e) {
    const p = e.t / e.dur;
    const x = Math.round(e.x), y = Math.round(e.y);
    const r = Math.max(1, Math.round(e.r * (0.35 + 0.65 * Math.min(1, p * 1.6))));
    g.save();
    g.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
    burst(g, x, y, r, '#e0603c');
    burst(g, x, y, Math.max(1, Math.round(r * 0.66)), '#f6c83c');
    burst(g, x, y, Math.max(1, Math.round(r * 0.33)), '#ffffff');
    g.restore();
  }

  function drawStar(g, cx, cy, spawnT) {
    const phase = Math.floor((1 - spawnT) * 10) % 4;
    const r = [3, 6, 8, 5][phase];
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 1, cy - r, 2, 2 * r);
    g.fillRect(cx - r, cy - 1, 2 * r, 2);
    g.fillRect(cx - 2, cy - 2, 4, 4);
  }

  function drawTank(g, t) {
    const cx = Math.round(t.x) + 8;
    const cy = Math.round(t.y) + 8;
    if (!t.active) { drawStar(g, cx, cy, t.spawn); return; }
    let key = t.side === 'player' ? (t.player === 0 ? 'p1' : 'p2') : (t.kind === 'D' ? 'D' + t.hp : t.kind);
    if (t.flash > 0) key = 'flash';
    const img = sprite(key, Math.floor(t.anim * 12) % 2);
    g.save();
    g.translate(cx, cy);
    g.rotate(t.dir * Math.PI / 2);
    g.drawImage(img, -8, -8);
    g.restore();
    if (t.shield > 0 && Math.floor(t.shield * 10) % 2 === 0) {
      g.strokeStyle = '#cfefff';
      g.lineWidth = 1;
      g.strokeRect(Math.round(t.x) - 0.5, Math.round(t.y) - 0.5, 17, 17);
    }
  }

  function drawBase(g) {
    const { x, y } = BASE;
    if (G.baseAlive) {
      g.fillStyle = '#59616a'; g.fillRect(x + 1, y + 5, 14, 10);
      g.fillStyle = '#8d959d'; g.fillRect(x + 1, y + 5, 14, 2);
      g.fillStyle = '#3c424a'; g.fillRect(x + 1, y + 13, 14, 2);
      g.fillStyle = '#e6b43a'; g.fillRect(x + 7, y + 8, 2, 4); g.fillRect(x + 6, y + 9, 4, 2);
      g.fillStyle = '#cfd3d7'; g.fillRect(x + 8, y, 1, 5);
      g.fillStyle = '#c8452c'; g.fillRect(x + 9, y, 5, 3);
    } else {
      g.fillStyle = '#2c2f33';
      g.fillRect(x + 2, y + 10, 5, 4);
      g.fillRect(x + 8, y + 11, 6, 3);
      g.fillRect(x + 5, y + 8, 3, 2);
      g.fillStyle = '#464b51';
      g.fillRect(x + 3, y + 11, 2, 1);
      g.fillRect(x + 10, y + 12, 3, 1);
    }
  }

  function render() {
    const g = ctx;
    g.fillStyle = '#000';
    g.fillRect(0, 0, SIZE, SIZE);
    for (let cy = 0; cy < GRID; cy++) {
      for (let cx = 0; cx < GRID; cx++) {
        const v = terrain[cy * GRID + cx];
        if (v === BRICK) g.drawImage(brickImg, cx * CELL, cy * CELL);
        else if (v === STEEL) g.drawImage(steelImg, cx * CELL, cy * CELL);
      }
    }
    drawBase(g);
    for (const t of G.tanks) drawTank(g, t);
    g.fillStyle = '#f4efe0';
    for (const b of G.bullets) g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
    for (const e of G.effects) drawEffect(g, e);
  }

  /* ================= Marcador ================= */
  const hudCache = {};
  function setText(key, el, value) {
    if (hudCache[key] !== value) { hudCache[key] = value; el.textContent = value; }
  }
  function updateHUD() {
    G.players.forEach((p, i) => {
      setText('l' + i, i ? lives2 : lives1, Math.max(0, p.lives));
      setText('s' + i, i ? score2 : score1, p.score);
    });
    setText('stage', stageNum, G.stage);
    setText('hi', hiNum, G.hi);
    if (hudCache.spawned !== G.spawned) {
      hudCache.spawned = G.spawned;
      icons.forEach((el, i) => el.classList.toggle('gone', i >= ENEMY_TOTAL - G.spawned));
    }
  }

  function syncKeysHelp() {
    keysHelp.textContent = G.count === 1
      ? 'Mover: flechas o WASD. Disparar: Espacio. Pausa: P.'
      : '1P: WASD y Espacio. 2P: flechas y Enter. Pausa: P.';
  }

  function syncPauseBtn() {
    pauseBtn.textContent = G.state === 'paused' ? 'Seguir' : 'Pausa';
  }

  /* ================= Pantallas superpuestas ================= */
  function showScreen(title, sub, btn) {
    screenTitle.textContent = title;
    screenSub.textContent = sub || '';
    screenSub.hidden = !sub;
    screenBtn.textContent = btn || '';
    screenBtn.hidden = !btn;
    screenEl.hidden = false;
    if (btn) screenBtn.focus({ preventScroll: true });
  }
  function hideScreen() { screenEl.hidden = true; }
  function focusBoard() { board.focus({ preventScroll: true }); }

  /* ================= Flujo del juego ================= */
  function loadStage() {
    loadTerrain();
    G.tanks = [];
    G.bullets = [];
    G.effects = [];
    G.baseAlive = true;
    G.endTimer = 0;
    G.queue = buildQueue(G.stage);
    G.spawned = 0;
    G.spawnCd = 0.8;
    G.spawnIdx = 0;
    G.players.forEach((p, i) => {
      p.tank = null;
      p.dirStack = [];
      p.fire = false;
      p.fireCd = 0;
      if (p.lives > 0) spawnPlayer(p, i);
    });
  }

  function enterIntro() {
    G.state = 'intro';
    G.timer = 1.7;
    showScreen('NIVEL ' + G.stage);
    syncPauseBtn();
  }

  function newGame() {
    clearInputs();
    buildKeymap();
    pl2.hidden = G.count !== 2;
    modeBtn.textContent = G.count === 1 ? '1 jugador' : '2 jugadores';
    syncKeysHelp();
    G.players = Array.from({ length: G.count }, () => ({
      lives: START_LIVES, score: 0, tank: null, respawn: 0, dirStack: [], fire: false, fireCd: 0
    }));
    G.stage = 1;
    loadStage();
    enterIntro();
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    updateHUD();
    startLoop();
  }

  function gameOver() {
    G.state = 'over';
    G.overAt = performance.now();
    sfx('over');
    const sub = G.players.map((p, i) => (G.count > 1 ? (i + 1) + 'P ' : 'Puntos ') + p.score).join('  ');
    showScreen('FIN DEL JUEGO', sub, 'Jugar de nuevo');
    syncPauseBtn();
  }

  function pause() {
    if (G.state !== 'play' && G.state !== 'intro') return;
    G.prev = G.state;
    G.state = 'paused';
    clearInputs();
    showScreen('PAUSA', '', 'Continuar');
    syncPauseBtn();
  }

  function resume() {
    if (G.state !== 'paused') return;
    G.state = G.prev;
    if (G.state === 'intro') showScreen('NIVEL ' + G.stage); else hideScreen();
    syncPauseBtn();
    focusBoard();
  }

  function togglePause() {
    if (G.state === 'paused') resume(); else pause();
  }

  function stopGame() {
    stopLoop();
    G.state = 'idle';
    clearInputs();
    hideScreen();
    syncPauseBtn();
  }

  /* ================= Bucle ================= */
  let raf = 0;
  let last = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    update(dt);
    updateHUD();
    render();
  }
  function startLoop() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ================= Entrada ================= */
  let keymap = {};
  function buildKeymap() {
    keymap = G.count === 1
      ? {
        ArrowUp: [0, 'up'], ArrowRight: [0, 'right'], ArrowDown: [0, 'down'], ArrowLeft: [0, 'left'],
        KeyW: [0, 'up'], KeyD: [0, 'right'], KeyS: [0, 'down'], KeyA: [0, 'left'],
        Space: [0, 'fire'], KeyJ: [0, 'fire'], KeyZ: [0, 'fire'], Enter: [0, 'fire'], NumpadEnter: [0, 'fire']
      }
      : {
        KeyW: [0, 'up'], KeyD: [0, 'right'], KeyS: [0, 'down'], KeyA: [0, 'left'], Space: [0, 'fire'], KeyF: [0, 'fire'],
        ArrowUp: [1, 'up'], ArrowRight: [1, 'right'], ArrowDown: [1, 'down'], ArrowLeft: [1, 'left'],
        Enter: [1, 'fire'], NumpadEnter: [1, 'fire'], KeyL: [1, 'fire']
      };
  }

  function setInput(pi, act, down) {
    const p = G.players[pi];
    if (!p) return;
    if (act === 'fire') { p.fire = down; return; }
    const d = ['up', 'right', 'down', 'left'].indexOf(act);
    p.dirStack = p.dirStack.filter((x) => x !== d);
    if (down) p.dirStack.push(d);
  }

  function clearInputs() {
    G.players.forEach((p) => { p.dirStack = []; p.fire = false; });
    $$('.tbtn.is-down').forEach((b) => b.classList.remove('is-down'));
  }

  buildKeymap();

  window.addEventListener('keydown', (e) => {
    if (!flipped || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (e.repeat) return;
      e.preventDefault();
      togglePause();
      return;
    }
    const onButton = e.target instanceof Element && e.target.closest('button');
    if (onButton && (e.code === 'Enter' || e.code === 'Space')) return;
    const m = keymap[e.code];
    if (!m) return;
    e.preventDefault();
    if (G.state === 'over') {
      if (!e.repeat && m[1] === 'fire' && performance.now() - G.overAt > 800) newGame();
      return;
    }
    if (!e.repeat) setInput(m[0], m[1], true);
  });

  window.addEventListener('keyup', (e) => {
    if (!flipped) return;
    const m = keymap[e.code];
    if (!m) return;
    const onButton = e.target instanceof Element && e.target.closest('button');
    if (!(onButton && (e.code === 'Enter' || e.code === 'Space'))) e.preventDefault();
    setInput(m[0], m[1], false);
  });

  // Controles táctiles (jugador 1)
  $$('#touch [data-act]').forEach((btn) => {
    const act = btn.dataset.act;
    const on = (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ } }
      btn.classList.add('is-down');
      setInput(0, act, true);
    };
    const off = () => {
      btn.classList.remove('is-down');
      setInput(0, act, false);
    };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, off));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ================= Giro de la tarjeta ================= */
  let flipped = false;
  let flipTimer = 0;

  function flipTo(next) {
    if (next === flipped) return;
    flipped = next;
    card.classList.toggle('is-flipped', next);
    document.body.classList.toggle('game-on', next);
    front.inert = next;
    back.inert = !next;
    clearTimeout(flipTimer);
    if (next) {
      flipTimer = setTimeout(() => { newGame(); focusBoard(); }, reduceMotion ? 60 : 700);
    } else {
      stopGame();
      playBtn.focus({ preventScroll: true });
    }
  }

  playBtn.addEventListener('click', () => flipTo(true));
  backBtn.addEventListener('click', () => flipTo(false));

  screenBtn.addEventListener('click', () => {
    if (G.state === 'paused') resume();
    else if (G.state === 'over') { newGame(); focusBoard(); }
  });

  pauseBtn.addEventListener('click', () => { togglePause(); if (G.state !== 'paused') focusBoard(); });

  modeBtn.addEventListener('click', () => {
    G.count = G.count === 1 ? 2 : 1;
    newGame();
    focusBoard();
  });

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = 'Sonido: ' + (soundOn ? 'sí' : 'no');
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) beep(660, 0.08, 'square', 0.03, 0);
    focusBoard();
  });

  /* ================= Copiar correo ================= */
  const copyBtn = $('#copyBtn');
  copyBtn.addEventListener('click', async () => {
    const emailEl = $('#email');
    const text = emailEl.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copiado';
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(emailEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copyBtn.textContent = 'Selecciona y copia';
    }
    setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1800);
  });

  syncKeysHelp();
  updateHUD();
})();
