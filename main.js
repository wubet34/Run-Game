// main.js — Game orchestrator

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Environment }    from './environment.js';
import { Player }         from './player.js';
import { Enemy }          from './enemy.js';
import { ObstacleManager } from './obstacles.js';
import { UI }             from './ui.js';
import { SoundSystem }    from './sound.js';

// ── Constants ─────────────────────────────────────────────
const BASE_SPEED      = 8;
const MAX_SPEED       = 22;
const SPEED_INCREMENT = 0.4;

const BOOST_DURATION  = 3.0;
const BOOST_COOLDOWN  = 10.0;
const BOOST_POWER     = 7;
const BOOST_PROXIMITY = 0.35; // show boost button when enemy is 35%+ close

const MAGNET_DURATION = 8.0;  // seconds magnet stays active

// ── Renderer ──────────────────────────────────────────────
const canvas   = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace   = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 3.5, 9);
camera.lookAt(0, 1, 0);

// ── Systems ───────────────────────────────────────────────
const env       = new Environment(scene);
const player    = new Player(scene);
const enemy     = new Enemy(scene);
const obstacles = new ObstacleManager(scene);
const ui        = new UI();
const sound     = new SoundSystem();

// ── State ─────────────────────────────────────────────────
let state         = 'start';
let gameSpeed     = BASE_SPEED;
let score         = 0;
let distance      = 0;
let coins         = 0;
let lastTime      = 0;
let footstepTimer = 0;
let cameraShake   = { x: 0, y: 0, intensity: 0 };

// Boost
let boostTimer    = 0;
let boostCooldown = 0;

// Magnet
let magnetTimer   = 0;  // > 0 while magnet is active

// ── Boost UI refs ─────────────────────────────────────────
const boostWrap  = document.getElementById('boost-wrap');
const boostBtn   = document.getElementById('boost-btn');
const boostRing  = document.getElementById('boost-ring').querySelector('circle');
const boostFlash = document.getElementById('boost-flash');
const RING_FULL  = 119.4;

// Magnet HUD icon
const magnetIcon = document.getElementById('magnet-icon');

// ── Camera ────────────────────────────────────────────────
const camTarget = new THREE.Vector3(0, 3.5, 9);

function updateCamera(delta) {
  camTarget.x += (player.root.position.x * 0.4 - camTarget.x) * 4 * delta;

  if (cameraShake.intensity > 0) {
    cameraShake.x = (Math.random() - 0.5) * cameraShake.intensity;
    cameraShake.y = (Math.random() - 0.5) * cameraShake.intensity;
    cameraShake.intensity *= 0.85;
  }

  camera.position.set(
    camTarget.x + cameraShake.x,
    camTarget.y + cameraShake.y,
    camTarget.z
  );
  camera.lookAt(camTarget.x * 0.3, 1, 0);
}

function triggerShake(intensity) {
  cameraShake.intensity = Math.max(cameraShake.intensity, intensity);
}

// ── Game loop ─────────────────────────────────────────────
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);
  const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (state === 'playing') tick(delta);
  renderer.render(scene, camera);
}

function tick(delta) {
  // Speed ramp (boost adds on top temporarily)
  gameSpeed = Math.min(MAX_SPEED, gameSpeed + SPEED_INCREMENT * delta);
  if (boostTimer > 0) {
    gameSpeed = Math.min(MAX_SPEED + BOOST_POWER, gameSpeed + BOOST_POWER * delta * 4);
  }

  distance += gameSpeed * delta;
  score     = Math.floor(distance * 1.5 + coins * 10);

  const difficultyFactor = Math.min(1, (gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
  obstacles.setSpawnInterval(Math.max(0.9, 2.2 - difficultyFactor * 1.3));

  // ── Update systems ──
  env.setSpeed(gameSpeed);
  env.update(delta);

  player.update(delta, gameSpeed);

  // Enemy no longer races the player — it only lunges on hits
  enemy.update(delta, player.root.position);

  obstacles.setSpeed(gameSpeed);
  const playerPos    = player.getPosition();
  const playerHeight = player.getHeight();

  const { hitType, coinsCollected, magnetCollected } = obstacles.update(
    delta, playerPos, playerHeight,
    player.isSliding, player.isJumping,
    player.isInvincible(),
    magnetTimer > 0
  );

  // ── Coins ──
  if (coinsCollected > 0) {
    coins += coinsCollected;
    sound.playCoin();
    triggerShake(0.03);
  }

  // ── Magnet pickup ──
  if (magnetCollected) {
    magnetTimer = MAGNET_DURATION;
    sound.playMagnet();
    triggerShake(0.06);
  }
  if (magnetTimer > 0) {
    magnetTimer -= delta;
    if (magnetTimer < 0) magnetTimer = 0;
  }

  // ── Obstacle hits — enemy lunges, player stumbles ──
  if (hitType === 'major') {
    if (player.isStumbling) {
      // Second hit while stumbling = game over
      triggerShake(0.5);
      endGame();
      return;
    } else {
      player.stumble();
      enemy.onPlayerHit();          // enemy lunges forward
      gameSpeed = Math.max(BASE_SPEED, gameSpeed * 0.72);
      triggerShake(0.3);
      sound.playHit();
    }
  } else if (hitType === 'minor') {
    triggerShake(0.08);
  }

  // ── Boost timers ──
  if (boostTimer > 0) {
    boostTimer -= delta;
    if (boostTimer <= 0) { boostTimer = 0; boostCooldown = BOOST_COOLDOWN; }
  }
  if (boostCooldown > 0) {
    boostCooldown -= delta;
    if (boostCooldown < 0) boostCooldown = 0;
  }

  // ── Footsteps ──
  if (!player.isJumping) {
    footstepTimer += delta;
    const stepInterval = Math.max(0.18, 0.35 - gameSpeed * 0.01);
    if (footstepTimer >= stepInterval) { footstepTimer = 0; sound.playFootstep(); }
  }

  if (Math.random() < 0.04) triggerShake(0.012);

  // ── Enemy proximity effects ──
  const proximity = enemy.getProximity();
  if (proximity > 0.35) {
    const r = 0.06 + proximity * 0.2;
    scene.fog.color.setRGB(r, 0.01, 0.01);
  } else {
    scene.fog.color.setHex(0x1a0a00);
  }

  _updateBoostUI(proximity);
  _updateMagnetUI();
  updateCamera(delta);
  ui.updateHUD(score, coins, distance);

  // ── Game over: enemy catches player ──
  if (enemy.isCatching()) {
    triggerShake(0.7);
    endGame();
    return;
  }
}

// ── Boost ─────────────────────────────────────────────────
function activateBoost() {
  if (state !== 'playing') return;
  if (boostTimer > 0 || boostCooldown > 0) return;

  boostTimer = BOOST_DURATION;
  enemy.pushBack(8);

  boostFlash.classList.add('active');
  setTimeout(() => boostFlash.classList.remove('active'), 200);

  triggerShake(0.15);
  sound.playBoost();
}

function _updateBoostUI(proximity) {
  if (proximity >= BOOST_PROXIMITY) {
    boostWrap.classList.add('visible');
  } else {
    boostWrap.classList.remove('visible');
  }

  const ready = boostTimer === 0 && boostCooldown === 0;
  boostBtn.disabled = !ready;

  if (proximity > 0.65 && ready) {
    boostBtn.classList.add('danger');
  } else {
    boostBtn.classList.remove('danger');
  }

  if (boostCooldown > 0) {
    boostRing.style.strokeDashoffset = RING_FULL * (1 - boostCooldown / BOOST_COOLDOWN);
  } else if (boostTimer > 0) {
    boostRing.style.strokeDashoffset = RING_FULL * (1 - boostTimer / BOOST_DURATION);
  } else {
    boostRing.style.strokeDashoffset = RING_FULL;
  }
}

function _updateMagnetUI() {
  if (!magnetIcon) return;
  const bar = document.getElementById('magnet-bar');
  if (magnetTimer > 0) {
    magnetIcon.style.opacity = '1';
    magnetIcon.style.transform = `scaleX(${magnetTimer / MAGNET_DURATION})`;
    if (bar) bar.style.opacity = '1';
  } else {
    magnetIcon.style.opacity = '0';
    if (bar) bar.style.opacity = '0';
  }
}

// ── Start / End / Reset ───────────────────────────────────
function startGame() {
  state         = 'playing';
  gameSpeed     = BASE_SPEED;
  score         = 0;
  distance      = 0;
  coins         = 0;
  footstepTimer = 0;
  boostTimer    = 0;
  boostCooldown = 0;
  magnetTimer   = 0;
  cameraShake.intensity = 0;
  camTarget.set(0, 3.5, 9);

  player.reset();
  enemy.reset();
  obstacles.reset();
  env.setSpeed(gameSpeed);
  scene.fog.color.setHex(0x1a0a00);

  boostWrap.classList.remove('visible');
  boostBtn.classList.remove('danger');
  boostRing.style.strokeDashoffset = RING_FULL;
  if (magnetIcon) magnetIcon.style.opacity = '0';

  sound.init();
  sound.resumeBGM();
  ui.showHUD();
}

function endGame() {
  if (state === 'dead') return;
  state = 'dead';
  player.die();
  sound.stopBGM();
  sound.playGameOver();
  setTimeout(() => ui.showGameOver(score, Math.floor(distance), coins), 1200);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  sound.stopBGM();
  ui.showPause();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  lastTime = performance.now();
  sound.resumeBGM();
  ui.hidePause();
}

// ── Input ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (state !== 'playing') return;
  switch (e.code) {
    case 'ArrowLeft':  case 'KeyA': player.moveLeft();  break;
    case 'ArrowRight': case 'KeyD': player.moveRight(); break;
    case 'Space': case 'ArrowUp': case 'KeyW':
      e.preventDefault();
      player.jump(); sound.playJump();
      break;
    case 'ArrowDown': case 'KeyS': player.slide(); break;
    case 'KeyP': case 'Escape':   pauseGame();    break;
    case 'ShiftLeft': case 'ShiftRight': case 'KeyB': activateBoost(); break;
  }
});

let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (state !== 'playing') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -30) player.moveLeft();
    else if (dx > 30) player.moveRight();
  } else {
    if (dy < -30) { player.jump(); sound.playJump(); }
    else if (dy > 30) player.slide();
  }
}, { passive: true });

// ── UI Buttons ────────────────────────────────────────────
document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('boost-btn').addEventListener('click', activateBoost);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('restart-btn-pause').addEventListener('click', () => { ui.hidePause(); startGame(); });
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('sound-btn').addEventListener('click', () => {
  const on = sound.toggle();
  document.getElementById('sound-btn').textContent = on ? '🔊' : '🔇';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Boot ──────────────────────────────────────────────────
ui.showStart();
lastTime = performance.now();
requestAnimationFrame(gameLoop);
