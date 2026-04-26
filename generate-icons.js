// Run once with: node generate-icons.js
// Generates icons/icon-192.png and icons/icon-512.png

const { createCanvas } = require('canvas');
const fs = require('fs');

if (!fs.existsSync('icons')) fs.mkdirSync('icons');

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2;

  // Background circle
  const bg = ctx.createRadialGradient(cx, cy * 0.8, 0, cx, cy, r);
  bg.addColorStop(0, '#ff8c00');
  bg.addColorStop(1, '#1a0500');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolt ⚡
  const s = size * 0.55;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#ffdd00';
  ctx.shadowBlur  = size * 0.08;
  ctx.font        = `bold ${s}px serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', cx, cy + size * 0.04);

  return canvas.toBuffer('image/png');
}

fs.writeFileSync('icons/icon-192.png', makeIcon(192));
fs.writeFileSync('icons/icon-512.png', makeIcon(512));
console.log('Icons generated in icons/');
