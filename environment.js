// environment.js — Road, trees, sky, lighting

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const ROAD_WIDTH   = 6;
const ROAD_SEGMENT = 20;   // length of each road tile
const ROAD_COUNT   = 12;   // tiles in pool
const TREE_ROWS    = 3;    // trees per side per tile

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.roadTiles = [];
    this.treePairs  = [];
    this.speed = 0;

    this._buildLighting();
    this._buildSky();
    this._buildRoad();
    this._buildInitialTrees();
  }

  // ── Lighting ──────────────────────────────────────────────
  _buildLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffeedd, 0.6);
    this.scene.add(ambient);

    // Sun
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(30, 60, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 200;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top   = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // Hemisphere sky/ground fill
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.5);
    this.scene.add(hemi);
  }

  // ── Sky ───────────────────────────────────────────────────
  _buildSky() {
    // Gradient sky via large sphere with vertex colors
    const skyGeo = new THREE.SphereGeometry(400, 16, 8);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(0x0a1a3a) },
        bottomColor: { value: new THREE.Color(0xff7733) },
        offset:      { value: 20 },
        exponent:    { value: 0.5 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main(){
          float h = normalize(vWorldPos + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0),exponent),0.0)),1.0);
        }`
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Fog
    this.scene.fog = new THREE.FogExp2(0x1a0a00, 0.012);
  }

  // ── Road ──────────────────────────────────────────────────
  _buildRoad() {
    // Asphalt texture via canvas
    const tex = this._makeAsphaltTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, ROAD_SEGMENT / 6);

    const roadMat = new THREE.MeshLambertMaterial({ map: tex });
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_SEGMENT);

    // Kerb (white lines)
    const kerbMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const kerbGeo = new THREE.PlaneGeometry(0.12, ROAD_SEGMENT);

    for (let i = 0; i < ROAD_COUNT; i++) {
      const tile = new THREE.Group();

      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      tile.add(road);

      // Lane dividers
      for (let l = -1; l <= 1; l++) {
        const line = new THREE.Mesh(
          new THREE.PlaneGeometry(0.06, ROAD_SEGMENT),
          new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.4, transparent: true })
        );
        line.rotation.x = -Math.PI / 2;
        line.position.set(l * 2, 0.01, 0);
        tile.add(line);
      }

      // Kerbs
      [-ROAD_WIDTH / 2, ROAD_WIDTH / 2].forEach(x => {
        const k = new THREE.Mesh(kerbGeo, kerbMat);
        k.rotation.x = -Math.PI / 2;
        k.position.set(x, 0.01, 0);
        tile.add(k);
      });

      tile.position.z = -i * ROAD_SEGMENT;
      this.scene.add(tile);
      this.roadTiles.push(tile);
    }
  }

  _makeAsphaltTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base dark grey
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);

    // Noise grains
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.5;
      const v = Math.floor(Math.random() * 40 + 20);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }

  // ── Trees ─────────────────────────────────────────────────
  _buildInitialTrees() {
    for (let i = 0; i < ROAD_COUNT; i++) {
      this._spawnTreeRow(-i * ROAD_SEGMENT);
    }
  }

  _spawnTreeRow(z) {
    const group = new THREE.Group();
    const sides = [-1, 1];

    sides.forEach(side => {
      const count = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < count; j++) {
        const tree = this._makeTree();
        const xOff = side * (ROAD_WIDTH / 2 + 1.5 + Math.random() * 4);
        const zOff = (Math.random() - 0.5) * ROAD_SEGMENT * 0.8;
        tree.position.set(xOff, 0, zOff);
        group.add(tree);
      }
    });

    group.position.z = z;
    this.scene.add(group);
    this.treePairs.push(group);
  }

  _makeTree() {
    const group = new THREE.Group();
    const h = 3 + Math.random() * 3;

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, h * 0.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x5c3d1e })
    );
    trunk.position.y = h * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage layers
    const green = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.3 + Math.random() * 0.05, 0.6, 0.25 + Math.random() * 0.1)
    });

    [0, 0.5, 1].forEach((t, i) => {
      const r = (1.2 - t * 0.3) * (0.8 + Math.random() * 0.4);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, h * 0.45, 7),
        green
      );
      cone.position.y = h * 0.4 + i * h * 0.22;
      cone.castShadow = true;
      group.add(cone);
    });

    return group;
  }

  // ── Update ────────────────────────────────────────────────
  update(delta) {
    const move = this.speed * delta;

    // Scroll road tiles
    this.roadTiles.forEach(tile => {
      tile.position.z += move;
      if (tile.position.z > ROAD_SEGMENT) {
        tile.position.z -= ROAD_COUNT * ROAD_SEGMENT;
      }
    });

    // Scroll tree rows
    this.treePairs.forEach(group => {
      group.position.z += move;
      if (group.position.z > ROAD_SEGMENT) {
        group.position.z -= ROAD_COUNT * ROAD_SEGMENT;
      }
    });
  }

  setSpeed(s) { this.speed = s; }
}
