// player.js — Player avatar with procedural mesh + animations

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const LANE_X     = [-2, 0, 2];
const LANE_SPEED = 8;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.lane  = 1;
    this.targetX = LANE_X[1];

    this.isJumping  = false;
    this.isSliding  = false;
    this.isDead     = false;
    this.isStumbling = false;

    this.jumpVel     = 0;
    this.jumpGravity = 28;
    this.jumpForce   = 11;

    this.slideTimer    = 0;
    this.slideDuration = 0.7;

    this.stumbleTimer    = 0;
    this.stumbleDuration = 0.55;

    this.invincibleTimer = 0;
    this.invincibleDuration = 0.9;

    this.runTime = 0;

    this.dustParticles = [];

    this._buildAvatar();
    this._buildDustSystem();
    this._buildShadowBlob();
  }

  // ── Build procedural humanoid ─────────────────────────────
  _buildAvatar() {
    this.root = new THREE.Group();
    this.root.position.set(LANE_X[1], 0, 0);

    const skinMat  = new THREE.MeshLambertMaterial({ color: 0xf4a460 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x1a3a6b });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2d2d2d });
    const shoesMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const hairMat  = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirtMat);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // Head
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skinMat);
    this.head.position.y = 0.55;
    this.head.castShadow = true;
    this.torso.add(this.head);

    // Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hair.position.y = 0.06;
    this.head.add(hair);

    // Eyes
    [-0.07, 0.07].forEach(x => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      eye.position.set(x, 0.02, 0.18);
      this.head.add(eye);
    });

    // Hips
    this.hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.26), pantsMat);
    this.hips.position.y = -0.4;
    this.torso.add(this.hips);

    // Arms
    this.leftUpperArm  = this._makeArm(skinMat, shirtMat, -1);
    this.rightUpperArm = this._makeArm(skinMat, shirtMat,  1);

    // Legs
    this.leftLeg  = this._makeLeg(pantsMat, shoesMat, -1);
    this.rightLeg = this._makeLeg(pantsMat, shoesMat,  1);

    this.scene.add(this.root);
  }

  _makeArm(skinMat, shirtMat, side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.32, 0.22, 0);
    this.torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.32, 6), shirtMat);
    upper.position.y = -0.16;
    upper.castShadow = true;
    shoulder.add(upper);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.28, 6), skinMat);
    lower.position.y = -0.46;
    lower.castShadow = true;
    shoulder.add(lower);

    return shoulder;
  }

  _makeLeg(pantsMat, shoesMat, side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, -0.11, 0);
    this.hips.add(hip);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.38, 6), pantsMat);
    upper.position.y = -0.19;
    upper.castShadow = true;
    hip.add(upper);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.36, 6), pantsMat);
    lower.position.y = -0.56;
    lower.castShadow = true;
    hip.add(lower);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), shoesMat);
    shoe.position.set(0, -0.79, 0.04);
    shoe.castShadow = true;
    hip.add(shoe);

    return hip;
  }

  // ── Shadow blob ───────────────────────────────────────────
  _buildShadowBlob() {
    this.shadowBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true })
    );
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = 0.01;
    this.root.add(this.shadowBlob);
  }

  // ── Dust particles ────────────────────────────────────────
  _buildDustSystem() {
    const count = 40;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.dustMat = new THREE.PointsMaterial({
      color: 0xc8a96e, size: 0.12,
      transparent: true, opacity: 0.6, depthWrite: false
    });

    this.dustSystem = new THREE.Points(geo, this.dustMat);
    this.scene.add(this.dustSystem);

    for (let i = 0; i < count; i++) {
      this.dustParticles.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0 });
    }
  }

  _emitDust() {
    const p = this.dustParticles.find(p => p.life <= 0);
    if (!p) return;
    p.x = this.root.position.x + (Math.random() - 0.5) * 0.3;
    p.y = 0.05;
    p.z = this.root.position.z + 0.2;
    p.vx = (Math.random() - 0.5) * 1.5;
    p.vy = Math.random() * 0.8 + 0.2;
    p.vz = Math.random() * 1.0;
    p.life = p.maxLife = 0.4 + Math.random() * 0.3;
  }

  _updateDust(delta) {
    const pos = this.dustSystem.geometry.attributes.position.array;
    this.dustParticles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        p.vy -= 2 * delta;
      }
      pos[i * 3]     = p.life > 0 ? p.x : 0;
      pos[i * 3 + 1] = p.life > 0 ? p.y : -10;
      pos[i * 3 + 2] = p.life > 0 ? p.z : 0;
    });
    this.dustSystem.geometry.attributes.position.needsUpdate = true;
  }

  // ── Controls ──────────────────────────────────────────────
  moveLeft()  { if (this.lane > 0) { this.lane--; this.targetX = LANE_X[this.lane]; } }
  moveRight() { if (this.lane < 2) { this.lane++; this.targetX = LANE_X[this.lane]; } }

  jump() {
    if (!this.isJumping && !this.isSliding) {
      this.isJumping = true;
      this.jumpVel   = this.jumpForce;
    }
  }

  slide() {
    if (!this.isJumping && !this.isSliding) {
      this.isSliding  = true;
      this.slideTimer = this.slideDuration;
    }
  }

  // Called by main.js on obstacle hit
  stumble() {
    if (this.isInvincible()) return false;
    this.isStumbling   = true;
    this.stumbleTimer  = this.stumbleDuration;
    this.invincibleTimer = this.invincibleDuration;
    return true;
  }

  isInvincible() {
    return this.invincibleTimer > 0;
  }

  // ── Update ────────────────────────────────────────────────
  update(delta, gameSpeed) {
    if (this.isDead) return;

    this.runTime += delta * (gameSpeed / 8);

    // Timers
    if (this.invincibleTimer > 0) this.invincibleTimer -= delta;
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= delta;
      if (this.stumbleTimer <= 0) this.isStumbling = false;
    }

    // Lateral movement
    this.root.position.x += (this.targetX - this.root.position.x) * Math.min(1, LANE_SPEED * delta);

    // Jump physics
    if (this.isJumping) {
      this.jumpVel -= this.jumpGravity * delta;
      this.root.position.y += this.jumpVel * delta;
      if (this.root.position.y <= 0) {
        this.root.position.y = 0;
        this.isJumping = false;
        this.jumpVel   = 0;
      }
    }

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    // Invincibility flicker
    if (this.invincibleTimer > 0) {
      this.root.visible = Math.floor(this.invincibleTimer * 10) % 2 === 0;
    } else {
      this.root.visible = true;
    }

    this._animate(delta, gameSpeed);
    this._updateDust(delta);

    // Emit dust while running on ground
    if (!this.isJumping && Math.floor(this.runTime * 6) !== Math.floor((this.runTime - delta * (gameSpeed / 8)) * 6)) {
      this._emitDust();
    }

    // Shadow scale with height
    const shadowScale = Math.max(0.3, 1 - this.root.position.y * 0.1);
    this.shadowBlob.scale.set(shadowScale, shadowScale, 1);
    this.shadowBlob.material.opacity = 0.35 * shadowScale;
  }

  _animate(delta, gameSpeed) {
    const t = this.runTime;

    if (this.isStumbling) {
      // Stumble: lurch forward, arms flail
      const lurch = Math.sin(this.stumbleTimer * Math.PI * 6) * 0.3;
      this.torso.rotation.x = 0.5 + lurch;
      this.torso.position.y = 0.9;
      this.leftUpperArm.rotation.x  =  1.2 + lurch;
      this.rightUpperArm.rotation.x = -0.8 - lurch;
      this.leftLeg.rotation.x  = -0.3;
      this.rightLeg.rotation.x =  0.3;
      return;
    }

    if (this.isSliding) {
      this.torso.position.y = 0.6;
      this.torso.rotation.x = 0.5;
      this.leftLeg.rotation.x  = 0.4;
      this.rightLeg.rotation.x = 0.4;
      this.leftUpperArm.rotation.x  = -0.3;
      this.rightUpperArm.rotation.x = -0.3;
      return;
    }

    this.torso.rotation.x = 0.1;
    this.torso.position.y = 1.1;

    if (this.isJumping) {
      this.leftLeg.rotation.x  = -0.5;
      this.rightLeg.rotation.x = -0.5;
      this.leftUpperArm.rotation.x  = -0.8;
      this.rightUpperArm.rotation.x = -0.8;
      return;
    }

    // Running animation
    const swing = Math.sin(t * Math.PI * 2) * 0.55;
    const bob   = Math.abs(Math.sin(t * Math.PI * 2)) * 0.04;

    this.torso.position.y = 1.1 + bob;
    this.head.rotation.z  = Math.sin(t * Math.PI * 2) * 0.04;

    this.leftLeg.rotation.x  =  swing;
    this.rightLeg.rotation.x = -swing;

    this.leftUpperArm.rotation.x  = -swing * 0.8;
    this.rightUpperArm.rotation.x =  swing * 0.8;

    this.root.rotation.x = 0.08;
  }

  // ── Collision info ────────────────────────────────────────
  getPosition() { return this.root.position; }
  getHeight()   { return this.isSliding ? 0.5 : 1.5; }

  getBoundingBox() {
    const h   = this.getHeight();
    const pos = this.root.position;
    const box = new THREE.Box3();
    box.min.set(pos.x - 0.28, pos.y,     pos.z - 0.28);
    box.max.set(pos.x + 0.28, pos.y + h, pos.z + 0.28);
    return box;
  }

  die() {
    this.isDead = true;
    this.root.visible = true;
    this.root.rotation.x = 1.2;
    this.root.position.y = 0;
  }

  reset() {
    this.isDead      = false;
    this.isStumbling = false;
    this.lane        = 1;
    this.targetX     = LANE_X[1];
    this.isJumping   = false;
    this.isSliding   = false;
    this.jumpVel     = 0;
    this.slideTimer  = 0;
    this.stumbleTimer    = 0;
    this.invincibleTimer = 0;
    this.runTime     = 0;
    this.root.visible = true;
    this.root.position.set(LANE_X[1], 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.torso.position.y = 1.1;
  }
}
