// enemy.js — Enemy that lurks behind and only closes in when player hits obstacles

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const IDLE_DISTANCE    = 18;   // comfortable gap during normal running
const CATCH_DISTANCE   = 2.5;  // game over — enemy reached player
const LUNGE_SPEED      = 14;   // how fast enemy closes in after a hit
const RETREAT_SPEED    = 3.5;  // how slowly enemy drifts back to idle after boost
const IDLE_DRIFT_SPEED = 0.4;  // tiny constant drift toward player (tension)

export class Enemy {
  constructor(scene) {
    this.scene   = scene;
    this.zOffset = IDLE_DISTANCE;
    this.runTime = 0;
    this.isDead  = false;

    // State: 'idle' | 'lunging' | 'retreating'
    this._state     = 'idle';
    this._lungeLeft = 0;   // remaining lunge distance

    this._buildMesh();
  }

  // ── Mesh ─────────────────────────────────────────────────
  _buildMesh() {
    this.root = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
    const eyeMat  = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 0.9 });
    const clawMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.38), bodyMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), bodyMat);
    this.head.position.y = 0.55;
    this.head.castShadow = true;
    this.torso.add(this.head);

    [-0.1, 0.1].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
      eye.position.set(x, 0.02, 0.23);
      this.head.add(eye);
      const glow = new THREE.PointLight(0xff2200, 0.6, 2);
      glow.position.copy(eye.position);
      this.head.add(glow);
    });

    [-0.1, 0.1].forEach(x => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), clawMat);
      horn.position.set(x, 0.28, 0);
      horn.rotation.z = x > 0 ? -0.3 : 0.3;
      this.head.add(horn);
    });

    this.hips = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.34), bodyMat);
    this.hips.position.y = -0.5;
    this.torso.add(this.hips);

    this.leftArm  = this._makeArm(bodyMat, clawMat, -1);
    this.rightArm = this._makeArm(bodyMat, clawMat,  1);
    this.leftLeg  = this._makeLeg(bodyMat, -1);
    this.rightLeg = this._makeLeg(bodyMat,  1);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.01, 0.6, 5), bodyMat);
    tail.position.set(0, -0.3, -0.3);
    tail.rotation.x = 0.8;
    this.hips.add(tail);

    this.root.position.set(0, 0, IDLE_DISTANCE);
    this.scene.add(this.root);
  }

  _makeArm(bodyMat, clawMat, side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.28, 0);
    this.torso.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 6), bodyMat);
    upper.position.y = -0.19; upper.castShadow = true; shoulder.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.34, 6), bodyMat);
    lower.position.y = -0.55; lower.castShadow = true; shoulder.add(lower);
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 4), clawMat);
      claw.position.set(i * 0.05, -0.77, 0.04);
      claw.rotation.x = -0.4;
      shoulder.add(claw);
    }
    return shoulder;
  }

  _makeLeg(bodyMat, side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.16, -0.12, 0);
    this.hips.add(hip);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.42, 6), bodyMat);
    upper.position.y = -0.21; upper.castShadow = true; hip.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.38, 6), bodyMat);
    lower.position.y = -0.62; lower.castShadow = true; hip.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.3), bodyMat);
    foot.position.set(0, -0.87, 0.05); hip.add(foot);
    return hip;
  }

  // ── Public API ────────────────────────────────────────────

  // Call this every time the player hits an obstacle — enemy lunges forward
  onPlayerHit() {
    // Each hit lunges the enemy 5 units closer
    this._lungeLeft = Math.min(this.zOffset - CATCH_DISTANCE, 5);
    this._state = 'lunging';
  }

  // Boost button — push enemy back toward idle distance
  pushBack(amount) {
    this.zOffset = Math.min(IDLE_DISTANCE, this.zOffset + amount);
    this._state  = 'retreating';
    this._lungeLeft = 0;
  }

  // ── Update ────────────────────────────────────────────────
  update(delta, playerPos) {
    if (this.isDead) return;

    this.runTime += delta * 1.5;

    if (this._state === 'lunging') {
      const step = Math.min(this._lungeLeft, LUNGE_SPEED * delta);
      this.zOffset    -= step;
      this._lungeLeft -= step;
      if (this._lungeLeft <= 0 || this.zOffset <= CATCH_DISTANCE) {
        this._lungeLeft = 0;
        this._state = 'idle';
      }
    } else if (this._state === 'retreating') {
      this.zOffset += RETREAT_SPEED * delta;
      if (this.zOffset >= IDLE_DISTANCE) {
        this.zOffset = IDLE_DISTANCE;
        this._state  = 'idle';
      }
    } else {
      // idle — very slow constant drift to keep tension
      this.zOffset -= IDLE_DRIFT_SPEED * delta;
      this.zOffset  = Math.max(CATCH_DISTANCE + 0.1, this.zOffset);
    }

    this.root.position.set(playerPos.x * 0.25, 0, this.zOffset);
    this._animate();
  }

  _animate() {
    const t     = this.runTime;
    const lunging = this._state === 'lunging';
    const speed = lunging ? 2.2 : 1.0;

    const swing = Math.sin(t * Math.PI * 2 * speed) * (lunging ? 0.9 : 0.65);
    const bob   = Math.abs(Math.sin(t * Math.PI * 2 * speed)) * (lunging ? 0.08 : 0.05);

    this.torso.position.y = 1.15 + bob;
    this.head.rotation.z  = Math.sin(t * Math.PI * 2) * 0.05;

    this.leftLeg.rotation.x  =  swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x  = -swing * 0.7;
    this.rightArm.rotation.x =  swing * 0.7;

    // Reach forward when close
    if (this.zOffset < 8) {
      const reach = (8 - this.zOffset) / 8;
      this.rightArm.rotation.x += reach * 1.4;
      this.leftArm.rotation.x  += reach * 1.4;
      this.root.rotation.x = 0.1 + reach * 0.25;
    } else {
      this.root.rotation.x = 0.1;
    }
  }

  isCatching()  { return this.zOffset <= CATCH_DISTANCE; }

  // 0 = far away, 1 = about to catch
  getProximity() {
    return Math.max(0, Math.min(1, 1 - (this.zOffset - CATCH_DISTANCE) / (IDLE_DISTANCE - CATCH_DISTANCE)));
  }

  reset() {
    this.isDead     = false;
    this.zOffset    = IDLE_DISTANCE;
    this.runTime    = 0;
    this._state     = 'idle';
    this._lungeLeft = 0;
    this.root.position.set(0, 0, IDLE_DISTANCE);
    this.root.rotation.set(0, 0, 0);
  }
}
