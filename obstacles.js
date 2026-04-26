// obstacles.js — Obstacles, coins, magnet powerup

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const SPAWN_Z   = -55;
const DESPAWN_Z =  8;
const LANE_X    = [-2, 0, 2];

const PLAYER_HW = 0.22;
const PLAYER_HD = 0.20;

const OBSTACLE_TYPES = ['barrier', 'wall', 'low_wall', 'double'];

export class ObstacleManager {
  constructor(scene) {
    this.scene     = scene;
    this.obstacles = [];
    this.speed     = 0;
    this.spawnTimer    = 0;
    this.spawnInterval = 2.2;

    this.coins        = [];
    this.coinTimer    = 0;
    this.coinInterval = 1.4;
    this.coinCount    = 0;

    // Magnet powerups
    this.magnets      = [];
    this.magnetTimer  = 0;
    this.magnetInterval = 12; // spawn every 12s

    this._buildMaterials();
  }

  _buildMaterials() {
    this.barrierMat = new THREE.MeshLambertMaterial({ color: 0xff6600 });
    this.wallMat    = new THREE.MeshLambertMaterial({ color: 0x888888 });
    this.coinMat    = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.4 });
    this.magnetMat  = new THREE.MeshLambertMaterial({ color: 0x00cfff, emissive: 0x0088ff, emissiveIntensity: 0.6 });
  }

  // ── Spawn obstacle ────────────────────────────────────────
  _spawnObstacle() {
    const type  = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const group = new THREE.Group();
    group.position.z    = SPAWN_Z;
    group.userData.boxes = [];

    if (type === 'barrier') {
      const lane = Math.floor(Math.random() * 3);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.28), this.barrierMat);
      mesh.position.set(LANE_X[lane], 0.26, 0);
      mesh.castShadow = true;
      group.add(mesh);
      group.userData.boxes.push({ laneX: LANE_X[lane], yMin: 0.0, yMax: 0.52, halfW: 0.62, jumpable: true, slideThrough: false });

    } else if (type === 'wall') {
      const open = Math.floor(Math.random() * 3);
      LANE_X.forEach((x, i) => {
        if (i === open) return;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.75, 0.28), this.wallMat);
        mesh.position.set(x, 0.875, 0);
        mesh.castShadow = true;
        group.add(mesh);
        group.userData.boxes.push({ laneX: x, yMin: 0.0, yMax: 1.75, halfW: 0.62, jumpable: false, slideThrough: false });
      });

    } else if (type === 'low_wall') {
      const lane = Math.floor(Math.random() * 3);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 0.28), this.wallMat);
      mesh.position.set(LANE_X[lane], 1.12, 0);
      mesh.castShadow = true;
      group.add(mesh);
      group.userData.boxes.push({ laneX: LANE_X[lane], yMin: 0.75, yMax: 1.75, halfW: 0.62, jumpable: false, slideThrough: true });

    } else if (type === 'double') {
      const start = Math.floor(Math.random() * 2);
      [start, start + 1].forEach(i => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.52, 0.28), this.barrierMat);
        mesh.position.set(LANE_X[i], 0.26, 0);
        mesh.castShadow = true;
        group.add(mesh);
        group.userData.boxes.push({ laneX: LANE_X[i], yMin: 0.0, yMax: 0.52, halfW: 0.62, jumpable: true, slideThrough: false });
      });
    }

    this.scene.add(group);
    this.obstacles.push(group);
  }

  // ── Spawn coins ───────────────────────────────────────────
  _spawnCoins() {
    const lane     = Math.floor(Math.random() * 3);
    const count    = Math.floor(Math.random() * 4) + 3;
    const elevated = Math.random() < 0.3;

    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12),
        this.coinMat
      );
      coin.position.set(LANE_X[lane], elevated ? 1.2 : 0.4, SPAWN_Z - i * 1.2);
      coin.rotation.x = Math.PI / 2;
      coin.userData.collected = false;
      this.scene.add(coin);
      this.coins.push(coin);
    }
  }

  // ── Spawn magnet powerup ──────────────────────────────────
  _spawnMagnet() {
    const lane = Math.floor(Math.random() * 3);

    // Horseshoe-style magnet: two cylinders + crossbar
    const group = new THREE.Group();
    group.position.set(LANE_X[lane], 0.9, SPAWN_Z);

    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
    const left  = new THREE.Mesh(armGeo, this.magnetMat);
    const right = new THREE.Mesh(armGeo, this.magnetMat);
    left.position.set(-0.18, 0, 0);
    right.position.set( 0.18, 0, 0);
    group.add(left, right);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), this.magnetMat);
    bar.position.y = 0.3;
    group.add(bar);

    // Glow
    const light = new THREE.PointLight(0x00cfff, 1.2, 3);
    group.add(light);

    group.userData.collected = false;
    this.scene.add(group);
    this.magnets.push(group);
  }

  // ── Update ────────────────────────────────────────────────
  // Returns { hitType, coinsCollected, magnetCollected }
  update(delta, playerPos, playerHeight, isSliding, isJumping, isInvincible, magnetActive) {
    const move = this.speed * delta;
    let hitType = null;
    let coinsCollected = 0;
    let magnetCollected = false;

    // Spawn timers
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnObstacle();
    }
    this.coinTimer += delta;
    if (this.coinTimer >= this.coinInterval) {
      this.coinTimer = 0;
      this._spawnCoins();
    }
    this.magnetTimer += delta;
    if (this.magnetTimer >= this.magnetInterval) {
      this.magnetTimer = 0;
      this._spawnMagnet();
    }

    // ── Obstacles ──
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.position.z += move;

      if (obs.position.z > DESPAWN_Z) {
        this.scene.remove(obs);
        this.obstacles.splice(i, 1);
        continue;
      }

      if (isInvincible || obs.position.z < -4 || obs.position.z > 2) continue;

      for (const box of obs.userData.boxes) {
        if (box.jumpable && isJumping && playerPos.y > 0.3) continue;
        if (box.slideThrough && isSliding) continue;

        const playerTop = playerPos.y + playerHeight;
        if (playerTop < box.yMin) continue;
        if (playerPos.y > box.yMax) continue;

        const dx = Math.abs(playerPos.x - box.laneX);
        const overlapX = (box.halfW + PLAYER_HW) - dx;
        if (overlapX <= 0) continue;

        const overlapZ = (0.14 + PLAYER_HD) - Math.abs(obs.position.z);
        if (overlapZ <= 0) continue;

        if (overlapX < 0.10) {
          if (!hitType) hitType = 'minor';
        } else {
          hitType = 'major';
        }
      }
    }

    // ── Coins ──
    const MAGNET_RADIUS = 5.5; // world-units attraction radius

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.position.z += move;
      coin.rotation.z += delta * 3;

      if (coin.position.z > DESPAWN_Z) {
        this.scene.remove(coin);
        this.coins.splice(i, 1);
        continue;
      }

      if (coin.userData.collected) continue;

      // Magnet: pull coins toward player when active
      if (magnetActive) {
        const dx = playerPos.x - coin.position.x;
        const dz = playerPos.z - coin.position.z; // player is at z=0
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < MAGNET_RADIUS) {
          const pull = Math.min(1, (MAGNET_RADIUS - dist) / MAGNET_RADIUS + 0.3);
          coin.position.x += dx * pull * delta * 8;
          coin.position.z += dz * pull * delta * 8;
          coin.position.y += (playerPos.y + 0.5 - coin.position.y) * pull * delta * 6;
        }
      }

      // Collect check
      if (coin.position.z > -2 && coin.position.z < 2) {
        const dx = Math.abs(playerPos.x - coin.position.x);
        const dy = Math.abs((playerPos.y + playerHeight * 0.5) - coin.position.y);
        if (dx < 0.55 && dy < 0.65) {
          coin.userData.collected = true;
          this.scene.remove(coin);
          this.coins.splice(i, 1);
          coinsCollected++;
          this.coinCount++;
        }
      }
    }

    // ── Magnets ──
    for (let i = this.magnets.length - 1; i >= 0; i--) {
      const mag = this.magnets[i];
      mag.position.z += move;
      mag.rotation.y += delta * 2;

      if (mag.position.z > DESPAWN_Z) {
        this.scene.remove(mag);
        this.magnets.splice(i, 1);
        continue;
      }

      if (!mag.userData.collected && mag.position.z > -2 && mag.position.z < 2) {
        const dx = Math.abs(playerPos.x - mag.position.x);
        const dz = Math.abs(mag.position.z);
        if (dx < 0.7 && dz < 1.0) {
          mag.userData.collected = true;
          this.scene.remove(mag);
          this.magnets.splice(i, 1);
          magnetCollected = true;
        }
      }
    }

    return { hitType, coinsCollected, magnetCollected };
  }

  setSpeed(s)         { this.speed = s; }
  setSpawnInterval(t) { this.spawnInterval = t; }

  reset() {
    this.obstacles.forEach(o => this.scene.remove(o));
    this.coins.forEach(c => this.scene.remove(c));
    this.magnets.forEach(m => this.scene.remove(m));
    this.obstacles     = [];
    this.coins         = [];
    this.magnets       = [];
    this.spawnTimer    = 0;
    this.coinTimer     = 0;
    this.coinCount     = 0;
    this.magnetTimer   = 0;
    this.spawnInterval = 2.2;
  }
}
