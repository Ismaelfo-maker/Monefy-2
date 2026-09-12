const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// Minimal pure-JS PNG encoder for 24/32-bit RGBA
function createPNG(width, height, getPixelRGBA) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = chunk('IHDR', ihdr);

  // IDAT
  const idatChunk = chunk('IDAT', deflated);

  // IEND
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw Monefy Emerald Icon
function drawMonefyIcon(x, y, width, height, isMaskable = false) {
  const cx = width / 2;
  const cy = height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background corner radius check for standard icon
  if (!isMaskable) {
    const r = width * 0.22;
    const qx = Math.max(0, Math.abs(x - cx) - (cx - r));
    const qy = Math.max(0, Math.abs(y - cy) - (cy - r));
    if (Math.sqrt(qx * qx + qy * qy) > r) {
      return [0, 0, 0, 0]; // Transparent outside
    }
  }

  // Base background: #059669 to #047857 emerald gradient
  const t = y / height;
  let bgR = Math.round(5 + (4 - 5) * t);
  let bgG = Math.round(150 + (120 - 150) * t);
  let bgB = Math.round(105 + (87 - 105) * t);

  // Donut ring (radius ~ 27% to 35% of width)
  const innerR = width * 0.22;
  const outerR = width * 0.32;
  if (dist >= innerR && dist <= outerR) {
    const angle = Math.atan2(dy, dx); // -PI to PI
    // Main green arc vs accent orange arc
    if (angle > -0.5 && angle < 0.6) {
      // Amber arc
      return [245, 158, 11, 255];
    } else {
      // Emerald light arc
      return [52, 211, 153, 255];
    }
  }

  // Center white circle
  if (dist < innerR - 2) {
    if (dist < innerR - 10) {
      // Center glyph: wallet / euro card in emerald
      const scale = width / 512;
      const gx = dx / scale;
      const gy = dy / scale;
      if (Math.abs(gx) < 32 && Math.abs(gy) < 28) {
        // inside wallet card
        if (gx > 12 && Math.abs(gy) < 7) {
          return [245, 158, 11, 255]; // coin/lock clasp
        }
        return [5, 150, 105, 255]; // emerald wallet
      }
      return [255, 255, 255, 255];
    }
    return [240, 253, 244, 255];
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// 192x192
const png192 = createPNG(192, 192, (x, y, w, h) => drawMonefyIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

// 512x512
const png512 = createPNG(512, 512, (x, y, w, h) => drawMonefyIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

// 512x512 maskable (full-bleed)
const pngMaskable = createPNG(512, 512, (x, y, w, h) => drawMonefyIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

// apple-touch-icon (180x180)
const appleIcon = createPNG(180, 180, (x, y, w, h) => drawMonefyIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

console.log('PNG icons created successfully in public/');
