// Neon Dodge - Arcade Game
// Made with vanilla JS + Canvas. Keyboard and touch joystick supported.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const playBtn = document.getElementById('playBtn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMessage = document.getElementById('overlayMessage');
  const howToLink = document.getElementById('howToLink');

  // Touch joystick
  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0; // canvas logical size (CSS pixels)

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, Math.floor(rect.width));
    H = Math.max(180, Math.floor(rect.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();

  // Game state
  const STATE = {
    INIT: 'init', RUN: 'run', PAUSE: 'pause', GAMEOVER: 'gameover'
  };
  let state = STATE.INIT;
  let time = 0; // seconds since run started
  let score = 0; // integer
  let best = parseInt(localStorage.getItem('neon_dodge_best') || '0', 10);
  bestEl.textContent = best;

  // Player
  const player = {
    x: 0, y: 0, r: 16,
    vx: 0, vy: 0,
    accel: 900, // px/s^2
    maxSpeed: 380, // px/s
    friction: 0.9,
    colorA: '#00e5ff',
    colorB: '#ff00e5'
  };

  // Enemies
  const enemies = [];
  const enemySpawn = {
    timer: 0,
    interval: 0.9, // seconds, will ramp down
    minInterval: 0.25
  };

  // Input
  const keys = new Set();
  const input = { x: 0, y: 0 }; // -1..1 from keyboard/joystick combined

  // Utility
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  function resetGame() {
    player.x = W / 2; player.y = H / 2; player.vx = 0; player.vy = 0;
    enemies.length = 0;
    time = 0; score = 0;
    enemySpawn.timer = 0; enemySpawn.interval = 0.9;
    updateHUD();
  }

  function startGame() {
    resetGame();
    state = STATE.RUN;
    overlay.classList.add('hidden');
    pauseBtn.textContent = 'Pause';
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    overlayTitle.textContent = 'Game Over';
    overlayMessage.textContent = `Score: ${score}`;
    overlay.classList.remove('hidden');
    if (score > best) {
      best = score; localStorage.setItem('neon_dodge_best', String(best));
      bestEl.textContent = best;
    }
  }

  function togglePause() {
    if (state === STATE.RUN) {
      state = STATE.PAUSE; pauseBtn.textContent = 'Resume';
      overlayTitle.textContent = 'Paused';
      overlayMessage.textContent = 'Take a breath. Press P or click Resume to continue.';
      overlay.classList.remove('hidden');
    } else if (state === STATE.PAUSE) {
      state = STATE.RUN; pauseBtn.textContent = 'Pause';
      overlay.classList.add('hidden');
    }
  }

  function updateHUD() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
  }

  // Spawning enemies from edges towards random directions
  function spawnEnemy() {
    // spawn at random edge
    const size = rand(10, 22);
    let x, y, vx, vy;
    const edge = Math.floor(rand(0, 4)); // 0 top,1 right,2 bottom,3 left
    const speed = rand(120, 240) + Math.min(200, time * 6);
    if (edge === 0) { // top
      x = rand(-30, W + 30); y = -30;
      const tx = rand(0, W), ty = rand(H * 0.3, H);
      const ang = Math.atan2(ty - y, tx - x);
      vx = Math.cos(ang) * speed; vy = Math.sin(ang) * speed;
    } else if (edge === 1) { // right
      x = W + 30; y = rand(-30, H + 30);
      const tx = rand(0, W * 0.7), ty = rand(0, H);
      const ang = Math.atan2(ty - y, tx - x);
      vx = Math.cos(ang) * speed; vy = Math.sin(ang) * speed;
    } else if (edge === 2) { // bottom
      x = rand(-30, W + 30); y = H + 30;
      const tx = rand(0, W), ty = rand(0, H * 0.7);
      const ang = Math.atan2(ty - y, tx - x);
      vx = Math.cos(ang) * speed; vy = Math.sin(ang) * speed;
    } else { // left
      x = -30; y = rand(-30, H + 30);
      const tx = rand(W * 0.3, W), ty = rand(0, H);
      const ang = Math.atan2(ty - y, tx - x);
      vx = Math.cos(ang) * speed; vy = Math.sin(ang) * speed;
    }

    const hue = Math.random() < 0.5 ? 185 : 305;
    enemies.push({ x, y, vx, vy, r: size, hue, life: 10 });
  }

  function update(dt) {
    if (state !== STATE.RUN) return;
    time += dt;

    // difficulty ramps spawning faster
    enemySpawn.timer += dt;
    const targetInterval = clamp(0.9 - time * 0.03, enemySpawn.minInterval, 0.9);
    enemySpawn.interval = lerp(enemySpawn.interval, targetInterval, 0.02);
    while (enemySpawn.timer >= enemySpawn.interval) {
      enemySpawn.timer -= enemySpawn.interval;
      spawnEnemy();
    }

    // Input from keyboard
    let ix = 0, iy = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) ix -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) ix += 1;
    if (keys.has('ArrowUp') || keys.has('w')) iy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) iy += 1;

    // Combine with joystick
    ix += input.x;
    iy += input.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }

    // Acceleration-based movement
    player.vx += ix * player.accel * dt;
    player.vy += iy * player.accel * dt;

    // Clamp speed
    const spd = Math.hypot(player.vx, player.vy);
    if (spd > player.maxSpeed) {
      const s = player.maxSpeed / spd; player.vx *= s; player.vy *= s;
    }

    // Apply motion and soft friction when no input
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (len < 0.05) { player.vx *= player.friction; player.vy *= player.friction; }

    // Bounds clamp
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);

    // Enemies move; remove offscreen
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.x < -80 || e.x > W + 80 || e.y < -80 || e.y > H + 80 || e.life <= 0) {
        enemies.splice(i, 1);
      }
    }

    // Collision detection
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      if (dist < e.r + player.r - 1) {
        gameOver();
        break;
      }
    }

    // Score increases over time; bonus for speed
    score += Math.max(1, Math.floor(dt * 60));
    updateHUD();
  }

  function drawBackground() {
    // Grid and vignette
    ctx.clearRect(0, 0, W, H);

    // Vignette
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#7dffef';
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = (-(time * 30) % grid); x < W; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = (-(time * 18) % grid); y < H; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer() {
    // Outer glow
    ctx.save();
    const t = (Math.sin(time * 6) + 1) * 0.5;
    const glow = lerp(8, 20, t);
    ctx.shadowBlur = glow;
    ctx.shadowColor = player.colorA;
    // Body
    const grad = ctx.createLinearGradient(player.x - player.r, player.y - player.r, player.x + player.r, player.y + player.r);
    grad.addColorStop(0, player.colorA);
    grad.addColorStop(1, player.colorB);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    // Inner core
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemies() {
    for (const e of enemies) {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = `hsla(${e.hue}, 100%, 60%, 0.9)`;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, `hsla(${e.hue}, 100%, 65%, 0.95)`);
      g.addColorStop(1, `hsla(${e.hue}, 100%, 55%, 0.25)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render() {
    drawBackground();
    drawEnemies();
    drawPlayer();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Keyboard events
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(k)) {
      keys.add(k);
      e.preventDefault();
    }
    if (k === 'p' || k === 'P') {
      if (state === STATE.RUN || state === STATE.PAUSE) togglePause();
    }
    if (k === 'r' || k === 'R') {
      resetGame();
      state = STATE.RUN;
      overlay.classList.add('hidden');
      pauseBtn.textContent = 'Pause';
    }
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key);
  });

  // Buttons
  playBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    resetGame(); state = STATE.RUN; overlay.classList.add('hidden'); pauseBtn.textContent = 'Pause';
  });
  pauseBtn.addEventListener('click', () => {
    if (state === STATE.RUN || state === STATE.PAUSE) togglePause();
  });
  howToLink.addEventListener('click', (e) => {
    e.preventDefault();
    overlayTitle.textContent = 'How to Play';
    overlayMessage.textContent = 'Move to avoid the neon orbs. Survive as long as possible to increase your score!';
    overlay.classList.remove('hidden');
  });

  // Touch joystick implementation
  let joyActive = false;
  let joyCenter = { x: 0, y: 0 };
  const maxJoy = 45; // pixels

  function setStick(dx, dy) {
    const mag = Math.hypot(dx, dy);
    const lim = Math.min(maxJoy, mag);
    const nx = mag > 0 ? (dx / mag) : 0;
    const ny = mag > 0 ? (dy / mag) : 0;
    stick.style.transform = `translate(${nx * lim}px, ${ny * lim}px)`;
    input.x = nx * (lim / maxJoy);
    input.y = ny * (lim / maxJoy);
  }

  function resetStick() {
    stick.style.transform = 'translate(0,0)';
    input.x = 0; input.y = 0;
  }

  function onJoyStart(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width / 2;
    joyCenter.y = rect.top + rect.height / 2;
    setStick(clientX - joyCenter.x, clientY - joyCenter.y);
    joyActive = true;
  }

  function onJoyMove(clientX, clientY) {
    if (!joyActive) return;
    setStick(clientX - joyCenter.x, clientY - joyCenter.y);
  }

  function onJoyEnd() {
    joyActive = false; resetStick();
  }

  joystick.addEventListener('pointerdown', (e) => {
    joystick.setPointerCapture(e.pointerId);
    onJoyStart(e.clientX, e.clientY);
  });
  joystick.addEventListener('pointermove', (e) => onJoyMove(e.clientX, e.clientY));
  joystick.addEventListener('pointerup', onJoyEnd);
  joystick.addEventListener('pointercancel', onJoyEnd);
  joystick.addEventListener('lostpointercapture', onJoyEnd);

  // Show overlay initially
  overlayTitle.textContent = 'Neon Dodge';
  overlayMessage.textContent = 'Use WASD or Arrow Keys to move. Avoid everything. Survive to score!';
  overlay.classList.remove('hidden');
})();
