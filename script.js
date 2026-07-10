'use strict';

/* ---------------------------------------------------------
   PIXEL CLASH
   Low internal resolution (320x180), scaled up pixelated,
   procedural pixel-art fighters + procedural chiptune audio,
   no external assets needed.
--------------------------------------------------------- */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VW = canvas.width;   // 320
const VH = canvas.height;  // 180
const GROUND_Y = 148;

/* ===========================================================
   CHARACTERS
=========================================================== */

const CHARACTERS = [
  {
    id: 'shadow', name: 'SHADOW', main: '#4deaff', accent: '#dffcff',
    stats: { speed: 62, punchDmg: 6, kickDmg: 9, specialDmg: 22, health: 100 },
  },
  {
    id: 'ronin', name: 'RONIN', main: '#ff5c3d', accent: '#ffd7a8',
    stats: { speed: 46, punchDmg: 8, kickDmg: 11, specialDmg: 26, health: 108 },
  },
  {
    id: 'viper', name: 'VIPER', main: '#7dff6a', accent: '#eaffd9',
    stats: { speed: 72, punchDmg: 5, kickDmg: 8, specialDmg: 19, health: 90 },
  },
  {
    id: 'blaze', name: 'BLAZE', main: '#c86bff', accent: '#f3d9ff',
    stats: { speed: 54, punchDmg: 7, kickDmg: 10, specialDmg: 27, health: 102 },
  },
];

/* ===========================================================
   ARENAS
=========================================================== */

const ARENAS = [
  { id: 'dojo', name: 'MIDNIGHT DOJO', sky1: '#0a0e1f', sky2: '#1c2440', floor: '#131726', grid: 'rgba(77,234,255,0.12)' },
  { id: 'rooftop', name: 'NEON ROOFTOP', sky1: '#170a24', sky2: '#3a1550', floor: '#1a1226', grid: 'rgba(255,63,164,0.14)' },
  { id: 'bamboo', name: 'BAMBOO HOLLOW', sky1: '#0c1a14', sky2: '#1c3628', floor: '#132018', grid: 'rgba(125,255,106,0.12)' },
  { id: 'temple', name: 'THUNDER TEMPLE', sky1: '#12121c', sky2: '#2a2438', floor: '#181620', grid: 'rgba(255,139,61,0.12)' },
];

/* ---------------- audio ---------------- */

const audio = {
  ctx: null,
  master: null,
  musicTimer: null,
  musicOn: true,
  enabled: false,
  player: null,
};

function initAudio() {
  if (audio.ctx) return;
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.22;
  audio.master.connect(audio.ctx.destination);
  audio.enabled = true;
  startMusic();
}

function tone(freq, dur, type, gainPeak, delay = 0, dest = null) {
  if (!audio.enabled) return;
  const t0 = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(dest || audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  return osc;
}

function noiseHit(dur, gainPeak, freq = 1800, delay = 0) {
  if (!audio.enabled) return;
  const t0 = audio.ctx.currentTime + delay;
  const bufferSize = audio.ctx.sampleRate * dur;
  const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, t0);
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  src.connect(filter).connect(gain).connect(audio.master);
  src.start(t0);
}

const sfx = {
  punch: () => { tone(140, 0.08, 'square', 0.18); noiseHit(0.06, 0.25); },
  kick:  () => { tone(90, 0.12, 'square', 0.22); noiseHit(0.09, 0.3); },
  block: () => { tone(320, 0.05, 'triangle', 0.15); },
  jump:  () => { tone(440, 0.08, 'square', 0.1); },
  special: () => {
    tone(220, 0.3, 'sawtooth', 0.2);
    tone(330, 0.3, 'sawtooth', 0.16, 0.05);
    tone(440, 0.3, 'sawtooth', 0.12, 0.1);
    noiseHit(0.25, 0.22, 2600);
  },
  ko: () => {
    tone(200, 0.5, 'square', 0.25);
    tone(140, 0.6, 'square', 0.22, 0.15);
    tone(90, 0.8, 'square', 0.2, 0.3);
  },
  round: () => { tone(523, 0.12, 'square', 0.16); tone(659, 0.12, 'square', 0.16, 0.12); tone(784, 0.2, 'square', 0.18, 0.24); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.18, i * 0.12)); },
  select: () => { tone(660, 0.05, 'square', 0.12); },
};

function createAudioPlayer() {
  if (audio.player) return;

  const player = new Audio('music.webm');
  player.loop = true;
  player.preload = 'auto';
  player.volume = 0.35;
  player.style.display = 'none';
  document.body.appendChild(player);
  audio.player = player;

  if (audio.musicOn) {
    player.play().catch(() => {});
  } else {
    player.pause();
  }
}

function startMusic() {
  clearInterval(audio.musicTimer);
  createAudioPlayer();
}

function toggleMusic() {
  audio.musicOn = !audio.musicOn;
  const btn = document.getElementById('muteBtn');
  btn.classList.toggle('off', !audio.musicOn);
  if (!audio.player) return;

  if (audio.musicOn) {
    audio.player.volume = 0.35;
    audio.player.play().catch(() => {});
  } else {
    audio.player.pause();
  }
}

/* ---------------- input ---------------- */

const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.code));

document.body.addEventListener('click', initAudio, { once: true });
document.body.addEventListener('keydown', initAudio, { once: true });

/* ---------------- fighter factory ---------------- */

function makeFighter(charDef, startX, facing, isPlayer) {
  return {
    name: charDef.name, isPlayer,
    x: startX, y: GROUND_Y, vx: 0, vy: 0,
    facing,
    w: 14, h: 30,
    hp: charDef.stats.health, maxHp: charDef.stats.health,
    special: 0, maxSpecial: 100,
    state: 'idle',
    stateTime: 0,
    grounded: true,
    cooldown: 0,
    comboCount: 0,
    lastHitAt: -999,
    colorMain: charDef.main, colorAccent: charDef.accent,
    walkPhase: 0,
    hitFlash: 0,
    squash: 0,
    stats: charDef.stats,
    trail: [],
  };
}

/* ---------------- global state ---------------- */

const state = {
  mode: 'menu',       // menu, roundIntro, fighting, roundEnd, matchEnd
  difficulty: 'medium',
  playerChar: CHARACTERS[0],
  arena: ARENAS[0],
  round: 1,
  wins: { p1: 0, p2: 0 },
  timeScale: 1,
  shake: 0,
  hitStop: 0,
  specialZoom: 0,
  particles: [],
  rain: [],
  clouds: [],
  lightning: 0,
  lanternPhase: 0,
  last: 0,
};

let player, enemy;

function pickEnemyChar() {
  const others = CHARACTERS.filter(c => c.id !== state.playerChar.id);
  return others[Math.floor(Math.random() * others.length)];
}

function newMatch() {
  state.round = 1;
  state.wins = { p1: 0, p2: 0 };
  updateRoundDots();
  newRound(true);
}

function newRound(freshEnemy) {
  player = makeFighter(state.playerChar, 90, 1, true);
  if (freshEnemy || !state.enemyChar) state.enemyChar = pickEnemyChar();
  enemy = makeFighter(state.enemyChar, VW - 90, -1, false);
  enemy.ai = { timer: 0, decisionEvery: aiReactionTime(), aggression: aiAggression() };

  document.getElementById('p1name').textContent = player.name;
  document.getElementById('p2name').textContent = enemy.name;

  state.mode = 'roundIntro';
  state.introTimer = 0;
  document.getElementById('p1bar').style.width = '100%';
  document.getElementById('p2bar').style.width = '100%';
  document.getElementById('p1special').style.width = '0%';
  document.getElementById('p2special').style.width = '0%';
  document.getElementById('p1bar').classList.remove('low');
  document.getElementById('p2bar').classList.remove('low');

  const label = state.round === 3 ? 'FINAL ROUND' : `ROUND ${state.round}`;
  showCenterText(label, false);
  sfx.round();
}

function aiReactionTime() {
  return { easy: 620, medium: 340, impossible: 130 }[state.difficulty];
}
function aiAggression() {
  return { easy: 0.35, medium: 0.55, impossible: 0.8 }[state.difficulty];
}

/* ===========================================================
   ARENA RENDERING
=========================================================== */

for (let i = 0; i < 60; i++) {
  state.rain.push({ x: Math.random() * VW, y: Math.random() * VH, len: 3 + Math.random() * 5, speed: 90 + Math.random() * 60 });
}
for (let i = 0; i < 4; i++) {
  state.clouds.push({ x: Math.random() * VW, y: 10 + Math.random() * 20, w: 30 + Math.random() * 40, speed: 2 + Math.random() * 3 });
}

function drawSky(a) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, a.sky1);
  sky.addColorStop(1, a.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, GROUND_Y);
}

function drawFloor(a, dt) {
  ctx.fillStyle = a.floor;
  ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
  ctx.strokeStyle = a.grid;
  for (let x = -20; x < VW; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 10, VH);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(VW, GROUND_Y + 1);
  ctx.strokeStyle = a.grid.replace(/[\d.]+\)$/, '0.35)');
  ctx.stroke();
}

function drawRain(color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (const r of state.rain) {
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 2, r.y + r.len);
    ctx.stroke();
  }
}
function stepRain(dt) {
  for (const r of state.rain) {
    r.y += r.speed * dt;
    r.x -= 20 * dt;
    if (r.y > VH) { r.y = -5; r.x = Math.random() * VW; }
  }
}

function drawLantern(x, y, glow) {
  ctx.fillStyle = `rgba(255,140,60,${0.5 + glow * 0.4})`;
  ctx.beginPath();
  ctx.arc(x, y, 8 + glow * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8b3d';
  ctx.fillRect(x - 3, y - 4, 6, 8);
  ctx.fillStyle = '#ffe2b0';
  ctx.fillRect(x - 1, y - 2, 2, 4);
}

const ARENA_DRAW = {
  dojo(dt, a) {
    drawSky(a);
    ctx.fillStyle = '#eef3ff';
    ctx.beginPath(); ctx.arc(260, 32, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(238,243,255,0.15)';
    ctx.beginPath(); ctx.arc(260, 32, 22, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(20,26,48,0.55)';
    for (const c of state.clouds) {
      c.x += c.speed * dt; if (c.x - c.w > VW) c.x = -c.w;
      ctx.fillRect(c.x, c.y, c.w, 5);
      ctx.fillRect(c.x + 6, c.y - 3, c.w * 0.6, 4);
    }

    ctx.fillStyle = '#05060c';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y); ctx.lineTo(0, 100); ctx.lineTo(30, 82); ctx.lineTo(60, 100);
    ctx.lineTo(60, 70); ctx.lineTo(VW / 2, 45); ctx.lineTo(VW - 60, 70); ctx.lineTo(VW - 60, 100);
    ctx.lineTo(VW - 30, 82); ctx.lineTo(VW, 100); ctx.lineTo(VW, GROUND_Y);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = 'rgba(77,234,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 70); ctx.lineTo(VW / 2, 45); ctx.lineTo(VW - 60, 70); ctx.stroke();

    state.lanternPhase += dt;
    const flick = 0.75 + Math.sin(state.lanternPhase * 6) * 0.15 + Math.random() * 0.05;
    drawLantern(30, 96, flick);
    drawLantern(VW - 30, 96, flick * 0.9 + 0.1);

    drawFloor(a, dt);
    stepRain(dt);
    drawRain('rgba(180,200,255,0.25)');
  },

  rooftop(dt, a) {
    drawSky(a);
    // distant city blocks with lit windows
    ctx.fillStyle = '#0e0818';
    for (let i = 0; i < 6; i++) {
      const bw = 22, bx = i * 55 - 10, bh = 40 + (i % 3) * 18;
      ctx.fillRect(bx, GROUND_Y - bh - 20, bw, bh);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,63,164,0.5)' : 'rgba(77,234,255,0.4)';
      for (let wy = 0; wy < bh - 6; wy += 8) {
        for (let wx = 0; wx < bw - 4; wx += 7) {
          if (Math.random() < 0.55) ctx.fillRect(bx + 2 + wx, GROUND_Y - bh - 18 + wy, 2, 3);
        }
      }
      ctx.fillStyle = '#0e0818';
    }
    // neon sign glow
    ctx.fillStyle = 'rgba(255,63,164,0.5)';
    ctx.fillRect(VW / 2 - 22, 40, 44, 3);
    ctx.fillStyle = 'rgba(77,234,255,0.4)';
    ctx.fillRect(VW / 2 - 16, 46, 32, 2);

    // rooftop ledge
    ctx.fillStyle = '#1a1226';
    ctx.fillRect(0, GROUND_Y - 6, VW, 6);
    ctx.fillStyle = '#241633';
    ctx.fillRect(0, GROUND_Y - 8, VW, 2);

    drawFloor(a, dt);
    stepRain(dt);
    drawRain('rgba(255,120,220,0.2)');
  },

  bamboo(dt, a) {
    drawSky(a);
    ctx.fillStyle = 'rgba(230,255,220,0.5)';
    ctx.beginPath(); ctx.arc(70, 30, 12, 0, Math.PI * 2); ctx.fill();

    // fog band
    ctx.fillStyle = 'rgba(180,255,190,0.06)';
    ctx.fillRect(0, GROUND_Y - 50, VW, 30);

    // bamboo stalks
    ctx.strokeStyle = '#0e2018';
    for (let i = 0; i < 10; i++) {
      const x = (i * 34 + (i % 2) * 12) % VW;
      const h = 70 + (i % 3) * 14;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - h); ctx.stroke();
      ctx.strokeStyle = 'rgba(125,255,106,0.15)';
      ctx.lineWidth = 1;
      for (let s = GROUND_Y - 10; s > GROUND_Y - h; s -= 16) {
        ctx.beginPath(); ctx.moveTo(x - 2, s); ctx.lineTo(x + 2, s); ctx.stroke();
      }
      ctx.strokeStyle = '#0e2018';
    }

    drawFloor(a, dt);
    // drifting fireflies instead of rain
    for (const r of state.rain) {
      r.y += Math.sin(r.x * 0.1 + state.lanternPhase) * 4 * dt;
      r.x -= 8 * dt;
      if (r.x < -5) r.x = VW + 5;
    }
    state.lanternPhase += dt;
    ctx.fillStyle = 'rgba(200,255,160,0.6)';
    for (const r of state.rain.slice(0, 20)) ctx.fillRect(r.x, r.y % GROUND_Y, 1, 1);
  },

  temple(dt, a) {
    drawSky(a);
    state.lightning -= dt;
    if (state.lightning <= 0 && Math.random() < 0.004) state.lightning = 0.08 + Math.random() * 0.06;
    if (state.lightning > 0) {
      ctx.fillStyle = `rgba(220,225,255,${0.25 * (state.lightning / 0.14)})`;
      ctx.fillRect(0, 0, VW, GROUND_Y);
    }

    ctx.fillStyle = 'rgba(20,18,30,0.6)';
    for (const c of state.clouds) {
      c.x += c.speed * 1.6 * dt; if (c.x - c.w > VW) c.x = -c.w;
      ctx.fillRect(c.x, c.y, c.w * 1.4, 7);
    }

    // stone pillars
    ctx.fillStyle = '#0c0b12';
    [26, VW - 26 - 16].forEach(px => {
      ctx.fillRect(px, 60, 16, GROUND_Y - 60);
      ctx.fillStyle = 'rgba(255,139,61,0.18)';
      ctx.fillRect(px, 60, 16, 4);
      ctx.fillStyle = '#0c0b12';
    });
    // temple roofline
    ctx.beginPath();
    ctx.moveTo(10, 66); ctx.lineTo(VW / 2, 38); ctx.lineTo(VW - 10, 66); ctx.lineTo(VW - 10, 76);
    ctx.lineTo(VW / 2, 50); ctx.lineTo(10, 76); ctx.closePath();
    ctx.fill();

    drawFloor(a, dt);
    stepRain(dt);
    drawRain('rgba(200,190,255,0.2)');
  },
};

function drawArena(dt) {
  ARENA_DRAW[state.arena.id](dt, state.arena);
}

/* ---------------- particles ---------------- */

function spawnHitSpark(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 60;
    state.particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 20,
      life: 0.25 + Math.random() * 0.15, age: 0, color, size: 1 + Math.random() * 1.5, kind: 'spark',
    });
  }
}
function spawnDust(x, y) {
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x: x + (Math.random() * 8 - 4), y, vx: (Math.random() * 20 - 10), vy: -10 - Math.random() * 10,
      life: 0.3, age: 0, color: 'rgba(200,200,210,0.5)', size: 1.5, kind: 'dust',
    });
  }
}
function spawnRing(x, y, color) {
  state.particles.push({ x, y, life: 0.35, age: 0, color, kind: 'ring', maxR: 26 });
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.age += dt;
    if (p.kind !== 'ring') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
    }
  }
  state.particles = state.particles.filter(p => p.age < p.life);
}

function drawParticles() {
  for (const p of state.particles) {
    const t = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, t);
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.maxR * (1 - t) + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

/* ===========================================================
   FIGHTER DRAWING — with windup/active/recovery pose shaping
=========================================================== */

const ATTACK_TIMING = {
  punch:   { windup: 0.05, active: 0.06, recovery: 0.11 },
  kick:    { windup: 0.09, active: 0.07, recovery: 0.16 },
  special: { windup: 0.14, active: 0.10, recovery: 0.25 },
  hit:     { windup: 0, active: 0.3, recovery: 0 },
};

function attackPhase(f) {
  const t = ATTACK_TIMING[f.state];
  if (!t) return 'none';
  if (f.stateTime < t.windup) return 'windup';
  if (f.stateTime < t.windup + t.active) return 'active';
  return 'recovery';
}
function attackDur(state) {
  const t = ATTACK_TIMING[state];
  return t ? t.windup + t.active + t.recovery : 0;
}

function drawFighter(f) {
  ctx.save();
  const bob = f.state === 'idle' ? Math.sin(performance.now() / 260) * 1 : 0;
  const sq = f.squash;
  const baseX = Math.round(f.x);
  const baseY = Math.round(f.y - bob);

  ctx.translate(baseX, baseY);
  ctx.scale(f.facing * (1 - sq * 0.15), 1 + sq * 0.15);

  const flashed = f.hitFlash > 0;
  ctx.shadowColor = flashed ? '#ffffff' : f.colorMain;
  ctx.shadowBlur = flashed ? 8 : (f.state === 'special' ? 10 : 4);

  const main = flashed ? '#ffffff' : f.colorMain;
  const accent = f.colorAccent;

  if (f.state === 'ko') {
    ctx.fillStyle = main;
    ctx.fillRect(-12, -6, 22, 6);
    ctx.fillStyle = accent;
    ctx.fillRect(8, -8, 6, 6);
    ctx.restore();
    return;
  }

  let legSpread = 3;
  let armFront = 0, armBack = 0;
  let crouch = 0;
  const phase = attackPhase(f);

  if (f.state === 'walk') legSpread = 4 + Math.sin(f.walkPhase) * 3;
  if (f.state === 'jump') { legSpread = 2; crouch = -2; }
  if (f.state === 'block') { crouch = 2; armFront = 3; armBack = -2; }

  if (f.state === 'punch') {
    if (phase === 'windup') armFront = -4;
    else if (phase === 'active') armFront = 10;
    else armFront = 4;
  }
  if (f.state === 'kick') {
    if (phase === 'windup') legSpread = -2;
    else if (phase === 'active') legSpread = 12;
    else legSpread = 5;
  }
  if (f.state === 'special') {
    crouch = phase === 'windup' ? 3 : -1;
    armFront = phase === 'windup' ? -3 : phase === 'active' ? 13 : 6;
    ctx.shadowBlur = phase === 'active' ? 14 : 8;
  }
  if (f.state === 'hit') { crouch = 1; armBack = -3; }
  if (f.state === 'win') { armFront = -6; }

  const hipY = -14 + crouch;

  // motion trail on active special
  if (f.state === 'special' && phase === 'active') {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = main;
    ctx.fillRect(-6 - 4, hipY - 10, 12, 14);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = main;
  ctx.fillRect(-4 - legSpread * 0.4, hipY + 12, 4, 14 - crouch);
  ctx.fillStyle = accent;
  ctx.fillRect(f.state === 'kick' ? legSpread - 2 : -1 + legSpread * 0.4, hipY + 12, 5, 13 - crouch);

  ctx.fillStyle = main;
  ctx.fillRect(-6, hipY - 10, 12, 14 + crouch);

  ctx.fillStyle = main;
  ctx.fillRect(-7 + armBack, hipY - 8, 4, 9);

  ctx.fillStyle = accent;
  ctx.fillRect(4, hipY - 7, 5 + armFront, 4);
  if ((f.state === 'punch' || f.state === 'special') && phase !== 'windup') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7 + armFront, hipY - 8, 3, 6);
  }
  if (f.state === 'special' && phase === 'active') {
    ctx.fillStyle = main;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(9 + armFront, hipY - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = main;
  ctx.fillRect(-4, hipY - 20, 9, 9);
  ctx.fillStyle = accent;
  ctx.fillRect(-4, hipY - 18, 9, 2);

  ctx.restore();
}

/* small standalone renderer used for menu previews */
function drawMiniFighter(c, main, accent, scale) {
  c.save();
  c.translate(c.canvas.width / 2, c.canvas.height - 6);
  c.scale(scale, scale);
  c.fillStyle = main;
  c.fillRect(-4, -12, 4, 14);
  c.fillStyle = accent;
  c.fillRect(1, -12, 5, 13);
  c.fillStyle = main;
  c.fillRect(-6, -24, 12, 14);
  c.fillStyle = main;
  c.fillRect(-7, -22, 4, 9);
  c.fillStyle = accent;
  c.fillRect(4, -21, 5, 4);
  c.fillStyle = main;
  c.fillRect(-4, -34, 9, 9);
  c.fillStyle = accent;
  c.fillRect(-4, -32, 9, 2);
  c.restore();
}

/* ---------------- combat resolution ---------------- */

function attackReach(s) {
  if (s === 'punch') return 16;
  if (s === 'kick') return 19;
  if (s === 'special') return 24;
  return 0;
}
function attackDamage(f) {
  if (f.state === 'punch') return f.stats.punchDmg;
  if (f.state === 'kick') return f.stats.kickDmg;
  if (f.state === 'special') return f.stats.specialDmg;
  return 0;
}

function tryLandHit(attacker, defender) {
  if (attacker.hasHit) return;
  if (attackPhase(attacker) !== 'active') return;
  const reach = attackReach(attacker.state);
  const dist = (defender.x - attacker.x) * attacker.facing;
  if (dist > 0 && dist < reach + defender.w / 2) {
    attacker.hasHit = true;
    resolveHit(attacker, defender);
  }
}

function resolveHit(attacker, defender) {
  const dmg = attackDamage(attacker);
  const isBlocked = defender.state === 'block';

  const hitX = defender.x - defender.facing * 6;
  const hitY = defender.y - 18;

  if (isBlocked) {
    defender.hp = Math.max(0, defender.hp - dmg * 0.15);
    sfx.block();
    spawnHitSpark(hitX, hitY, 'rgba(160,200,255,0.8)');
    attacker.comboCount = 0;
    state.shake = Math.min(state.shake + 1.5, 4);
  } else {
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.state = 'hit';
    defender.stateTime = 0;
    defender.vx = -attacker.facing * (attacker.state === 'special' ? 70 : 40);
    defender.hitFlash = 0.12;
    defender.squash = 0.6;

    const impact = attacker.state === 'special' ? 3.2 : attacker.state === 'kick' ? 1.6 : 1;
    state.shake = Math.min(state.shake + dmg * 0.3 * impact, 10);
    state.hitStop = attacker.state === 'special' ? 0.09 : attacker.state === 'kick' ? 0.05 : 0.03;
    triggerFlash(attacker.state === 'special' ? attacker.colorMain : null);

    const now = performance.now() / 1000;
    if (now - attacker.lastHitAt < 1.1) attacker.comboCount++;
    else attacker.comboCount = 1;
    attacker.lastHitAt = now;
    if (attacker.comboCount >= 2) showCombo(attacker.comboCount);

    attacker.special = Math.min(attacker.maxSpecial, attacker.special + dmg * 1.3);
    updateSpecialBar(attacker);

    if (attacker.state === 'special') {
      sfx.special();
      spawnRing(hitX, hitY, attacker.colorMain);
      spawnHitSpark(hitX, hitY, attacker.colorMain);
      spawnHitSpark(hitX, hitY, '#ffffff');
      state.specialZoom = 1;
    } else if (attacker.state === 'kick') {
      sfx.kick();
      spawnHitSpark(hitX, hitY, '#ffd27a');
    } else {
      sfx.punch();
      spawnHitSpark(hitX, hitY, '#ffffff');
    }

    if (defender.hp <= 0) handleKO(defender, attacker);
  }
  updateHealthBar(defender);
}

function triggerFlash(tintColor) {
  const el = document.getElementById('flash');
  el.classList.remove('hit', 'special');
  void el.offsetWidth;
  if (tintColor) {
    el.style.background = tintColor;
    el.classList.add('special');
  } else {
    el.style.background = '#fff';
    el.classList.add('hit');
  }
}

function showCombo(n) {
  const el = document.getElementById('comboPopup');
  el.textContent = `COMBO ×${n}`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function showCenterText(text, isKO) {
  const el = document.getElementById('centerText');
  el.textContent = text;
  el.classList.remove('show', 'ko');
  void el.offsetWidth;
  if (isKO) el.classList.add('ko');
  el.classList.add('show');
}

function updateHealthBar(f) {
  const id = f.isPlayer ? 'p1bar' : 'p2bar';
  const el = document.getElementById(id);
  const pct = Math.max(0, f.hp / f.maxHp * 100);
  el.style.width = pct + '%';
  el.classList.toggle('low', pct < 25);
}
function updateSpecialBar(f) {
  const id = f.isPlayer ? 'p1special' : 'p2special';
  const el = document.getElementById(id);
  el.style.width = (f.special / f.maxSpecial * 100) + '%';
  el.classList.toggle('ready', f.special >= f.maxSpecial);
}

function handleKO(loser, winner) {
  loser.state = 'ko';
  loser.stateTime = 0;
  winner.state = 'win';
  state.mode = 'roundEnd';
  state.timeScale = 0.25;
  sfx.ko();
  setTimeout(() => showCenterText('K.O.', true), 150);

  const winnerKey = winner.isPlayer ? 'p1' : 'p2';
  state.wins[winnerKey]++;
  updateRoundDots();

  setTimeout(() => {
    state.timeScale = 1;
    if (state.wins.p1 >= 2 || state.wins.p2 >= 2) {
      endMatch(state.wins.p1 >= 2 ? player.name : enemy.name);
    } else {
      state.round++;
      newRound(false);
    }
  }, 2200);
}

function updateRoundDots() {
  document.querySelectorAll('.dot').forEach(dot => {
    const p = dot.dataset.p, r = Number(dot.dataset.r);
    const won = p === '1' ? state.wins.p1 >= r : state.wins.p2 >= r;
    dot.classList.toggle('won', won);
  });
}

function endMatch(winnerName) {
  state.mode = 'matchEnd';
  sfx.win();
  document.getElementById('matchEndTitle').textContent = `${winnerName} WINS`;
  document.getElementById('matchEnd').classList.add('show');
}

/* ---------------- physics / control ---------------- */

const GRAVITY = 520;
const JUMP_VEL = -170;

function setState(f, s) {
  if (f.state === s) return;
  f.state = s;
  f.stateTime = 0;
  f.hasHit = false;
}

function canAct(f) {
  return !['punch', 'kick', 'special', 'hit', 'ko', 'win'].includes(f.state);
}

function updateFighter(f, opp, dt, input) {
  f.stateTime += dt;
  if (f.hitFlash > 0) f.hitFlash -= dt;
  if (f.squash > 0) f.squash = Math.max(0, f.squash - dt * 3.5);

  f.vy += GRAVITY * dt;
  f.y += f.vy * dt;
  if (f.y >= GROUND_Y) {
    if (!f.grounded && f.vy > 40) { spawnDust(f.x, GROUND_Y); f.squash = Math.min(1, f.vy / 260); }
    f.y = GROUND_Y;
    f.vy = 0;
    f.grounded = true;
  } else {
    f.grounded = false;
  }

  if (canAct(f) && f.grounded) f.facing = f.x < opp.x ? 1 : -1;

  if (f.state === 'hit') {
    f.vx *= (1 - Math.min(1, 6 * dt));
    f.x += f.vx * dt;
  }

  if (canAct(f)) {
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;

    if (move !== 0 && f.grounded) {
      setState(f, 'walk');
      f.walkPhase += dt * 10;
      spawnDustTick(f, dt);
    } else if (f.grounded) {
      setState(f, 'idle');
    }

    f.x += move * f.stats.speed * dt;
    f.x = Math.max(14, Math.min(VW - 14, f.x));

    if (input.jump && f.grounded) {
      f.vy = JUMP_VEL;
      f.grounded = false;
      f.squash = 0.5;
      sfx.jump();
      spawnDust(f.x, GROUND_Y);
    }
    if (!f.grounded) setState(f, 'jump');

    if (input.block && f.grounded) setState(f, 'block');

    if (f.cooldown <= 0) {
      if (input.punch && f.grounded) { setState(f, 'punch'); f.cooldown = attackDur('punch') + 0.08; }
      else if (input.kick && f.grounded) { setState(f, 'kick'); f.cooldown = attackDur('kick') + 0.08; }
      else if (input.special && f.grounded && f.special >= f.maxSpecial) {
        setState(f, 'special');
        f.cooldown = attackDur('special') + 0.1;
        f.special = 0;
        updateSpecialBar(f);
      }
    }
  }

  if (f.cooldown > 0) f.cooldown -= dt;

  const dur = attackDur(f.state) || (f.state === 'hit' ? 0.3 : 0);
  if (dur && f.stateTime >= dur && f.state !== 'ko' && f.state !== 'win') {
    setState(f, f.grounded ? 'idle' : 'jump');
  }

  if (['punch', 'kick', 'special'].includes(f.state)) tryLandHit(f, opp);

  const minGap = 20;
  const gap = Math.abs(f.x - opp.x);
  if (gap < minGap && f.grounded && opp.grounded) {
    const push = (minGap - gap) / 2;
    const dir = f.x < opp.x ? -1 : 1;
    f.x += dir * push * 0.5;
    f.x = Math.max(14, Math.min(VW - 14, f.x));
  }
}

let dustTickTimer = 0;
function spawnDustTick(f, dt) {
  dustTickTimer -= dt;
  if (dustTickTimer <= 0) { spawnDust(f.x, GROUND_Y); dustTickTimer = 0.18; }
}

/* ---------------- input mapping ---------------- */

function playerInput() {
  return {
    left: keys.has('KeyA'), right: keys.has('KeyD'), jump: keys.has('KeyW'),
    block: keys.has('KeyS'), punch: keys.has('KeyJ'), kick: keys.has('KeyK'), special: keys.has('KeyL'),
  };
}

/* ---------------- AI ---------------- */

function aiInput(f, opp, dt) {
  if (!f.ai) f.ai = { timer: 0, decisionEvery: aiReactionTime(), aggression: aiAggression() };
  f.ai.timer -= dt * 1000;
  if (f.ai.timer > 0) return f.ai.lastInput || {};

  f.ai.timer = f.ai.decisionEvery * (0.7 + Math.random() * 0.6);
  const dist = Math.abs(opp.x - f.x);
  const out = { left: false, right: false, jump: false, block: false, punch: false, kick: false, special: false };

  const opponentAttacking = ['punch', 'kick', 'special'].includes(opp.state);
  const blockChance = { easy: 0.2, medium: 0.45, impossible: 0.8 }[state.difficulty];

  if (opponentAttacking && dist < 24 && Math.random() < blockChance) {
    out.block = true;
  } else if (dist > 20) {
    if (f.x < opp.x) out.right = true; else out.left = true;
    if (Math.random() < 0.04) out.jump = true;
  } else {
    const roll = Math.random();
    if (f.special >= f.maxSpecial && roll < f.ai.aggression * 0.5) out.special = true;
    else if (roll < f.ai.aggression) out[Math.random() < 0.5 ? 'punch' : 'kick'] = true;
    else if (roll < f.ai.aggression + 0.15) out.block = true;
    else if (Math.random() < 0.5) { if (f.x < opp.x) out.left = true; else out.right = true; }
  }

  f.ai.lastInput = out;
  return out;
}

/* ---------------- main loop ---------------- */

function drawShakeOffset() {
  if (state.shake <= 0) return [0, 0];
  state.shake = Math.max(0, state.shake - 0.4);
  return [(Math.random() * 2 - 1) * state.shake, (Math.random() * 2 - 1) * state.shake];
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (!state.last) state.last = ts;
  let rawDt = (ts - state.last) / 1000;
  state.last = ts;
  rawDt = Math.min(rawDt, 0.05);

  if (state.hitStop > 0) {
    state.hitStop -= rawDt;
    rawDt *= 0.08;
  }
  let dt = rawDt * state.timeScale;

  if (state.specialZoom > 0) state.specialZoom = Math.max(0, state.specialZoom - rawDt * 3.2);

  ctx.clearRect(0, 0, VW, VH);
  const [sx, sy] = drawShakeOffset();
  ctx.save();
  const zoom = 1 + state.specialZoom * 0.025;
  ctx.translate(VW / 2 + sx, VH / 2 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-VW / 2, -VH / 2);

  drawArena(dt);

  if (state.mode === 'fighting' || state.mode === 'roundEnd') {
    const pIn = state.mode === 'fighting' && player.state !== 'ko' ? playerInput() : {};
    const eIn = state.mode === 'fighting' && enemy.state !== 'ko' ? aiInput(enemy, player, dt) : {};
    updateFighter(player, enemy, dt, pIn);
    updateFighter(enemy, player, dt, eIn);
  }

  updateParticles(dt);

  if (player && enemy) {
    const order = player.x < enemy.x ? [player, enemy] : [enemy, player];
    for (const f of order) drawFighter(f);
  }
  drawParticles();

  ctx.restore();

  if (state.mode === 'roundIntro') {
    state.introTimer += dt || 0.016;
    if (state.introTimer > 1.4) {
      state.mode = 'fighting';
      showCenterText('FIGHT!', false);
    }
  }
}

/* ===========================================================
   MENU WIRING — difficulty -> character -> arena
=========================================================== */

const stepDifficulty = document.getElementById('stepDifficulty');
const stepCharacter = document.getElementById('stepCharacter');
const stepArena = document.getElementById('stepArena');

function showStep(el) {
  [stepDifficulty, stepCharacter, stepArena].forEach(s => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

document.querySelectorAll('#stepDifficulty .menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.diff;
    initAudio();
    sfx.select();
    buildCharacterGrid();
    showStep(stepCharacter);
  });
});

function buildCharacterGrid() {
  const grid = document.getElementById('charGrid');
  grid.innerHTML = '';
  CHARACTERS.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.style.setProperty('--char-color', c.main);
    const mini = document.createElement('canvas');
    mini.width = 40; mini.height = 44;
    card.appendChild(mini);
    const label = document.createElement('div');
    label.className = 'char-name';
    label.textContent = c.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      state.playerChar = c;
      sfx.select();
      showCharPreview(c);
    });
    grid.appendChild(card);
    const mctx = mini.getContext('2d');
    mctx.imageSmoothingEnabled = false;
    drawMiniFighter(mctx, c.main, c.accent, 1);
  });
}

function showCharPreview(c) {
  const wrap = document.getElementById('charPreview');
  wrap.classList.add('show');
  const cv = document.getElementById('charPreviewCanvas');
  const pctx = cv.getContext('2d');
  pctx.imageSmoothingEnabled = false;
  pctx.clearRect(0, 0, cv.width, cv.height);
  drawMiniFighter(pctx, c.main, c.accent, 1.3);
  document.getElementById('charStats').innerHTML =
    `<div><b>SPD</b> ${c.stats.speed}</div>` +
    `<div><b>PUNCH</b> ${c.stats.punchDmg}</div>` +
    `<div><b>KICK</b> ${c.stats.kickDmg}</div>` +
    `<div><b>SPECIAL</b> ${c.stats.specialDmg}</div>` +
    `<div><b>HP</b> ${c.stats.health}</div>`;
}

document.getElementById('backToDiff').addEventListener('click', () => showStep(stepDifficulty));
document.getElementById('backToChar').addEventListener('click', () => showStep(stepCharacter));

function buildArenaGrid() {
  const grid = document.getElementById('arenaGrid');
  grid.innerHTML = '';
  ARENAS.forEach(a => {
    const card = document.createElement('div');
    card.className = 'arena-card';
    const mini = document.createElement('canvas');
    mini.width = 140; mini.height = 80;
    card.appendChild(mini);
    const label = document.createElement('div');
    label.className = 'arena-name';
    label.textContent = a.name;
    card.appendChild(label);
    card.addEventListener('click', () => {
      document.querySelectorAll('.arena-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      state.arena = a;
      sfx.select();
      document.getElementById('menu').style.display = 'none';
      newMatch();
    });
    grid.appendChild(card);
    const mctx = mini.getContext('2d');
    mctx.imageSmoothingEnabled = false;
    const sky = mctx.createLinearGradient(0, 0, 0, 60);
    sky.addColorStop(0, a.sky1); sky.addColorStop(1, a.sky2);
    mctx.fillStyle = sky;
    mctx.fillRect(0, 0, 140, 60);
    mctx.fillStyle = a.floor;
    mctx.fillRect(0, 60, 140, 20);
    mctx.strokeStyle = a.grid;
    mctx.strokeRect(0, 0, 140, 80);
  });
}

document.querySelectorAll('.menu-btn').forEach(() => {}); // (character/arena buttons wired above)

document.getElementById('backToChar').addEventListener('click', () => {}); // no-op placeholder guard

document.getElementById('charGrid'); // ensure exists before wiring next step
document.addEventListener('DOMContentLoaded', () => {});

const goArenaTrigger = document.getElementById('charPreview');
goArenaTrigger.addEventListener('dblclick', () => {}); // unused

document.getElementById('backToDiff');

/* proceed from character select to arena select when a character has been chosen and user clicks preview area's implicit "next" — simplest: clicking a character card immediately shows arena step after a short delay isn't desired, so add explicit continue via double-click on card is unclear. Instead add continue button dynamically. */
(function addContinueButton() {
  const wrap = document.getElementById('charPreview');
  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.style.marginTop = '10px';
  btn.textContent = 'NEXT ›';
  btn.addEventListener('click', () => {
    sfx.select();
    buildArenaGrid();
    showStep(stepArena);
  });
  wrap.appendChild(btn);
})();

document.getElementById('rematchBtn').addEventListener('click', () => {
  document.getElementById('matchEnd').classList.remove('show');
  document.getElementById('menu').style.display = 'flex';
  showStep(stepDifficulty);
  document.getElementById('charPreview').classList.remove('show');
});

document.getElementById('muteBtn').addEventListener('click', toggleMusic);

requestAnimationFrame(loop);