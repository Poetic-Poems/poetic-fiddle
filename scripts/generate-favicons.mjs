#!/usr/bin/env node
// Rasterises public/poetic-fiddle-logo.svg into the fixed-resolution icon
// formats browsers and OSes need but can't derive from an SVG themselves:
// a multi-resolution favicon.ico, an apple-touch-icon, and the two PNG
// sizes the web app manifest lists. The SVG's `prefers-color-scheme` swap
// (see its own header comment) has no raster equivalent, so every output
// here freezes the light-mode fill — these are fallbacks for contexts that
// can't load src/app/icon.svg, not a replacement for it.
//
// Not run automatically (no npm-install/CI hook): re-run manually whenever
// the logo mark's geometry or colour changes.
//
//   node scripts/generate-favicons.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, "..");
const sourceSvg = readFileSync(
  path.join(repoRoot, "public", "poetic-fiddle-logo.svg"),
);

// `opaque: true` fills the canvas white behind the mark instead of leaving
// it transparent — iOS composites a transparent apple-touch-icon onto a
// black square on older versions, and a transparent PWA/Android icon looks
// wrong against most home-screen wallpapers, so the manifest and
// apple-touch icons need a real background. The favicon itself stays
// transparent: browser tab chrome already supplies one.
async function renderPng(size, { opaque = false } = {}) {
  const mark = await sharp(sourceSvg, { density: 600 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  if (!opaque) return mark;
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: mark }])
    .png()
    .toBuffer();
}

// Minimal ICO container (ICONDIR + ICONDIRENTRY per image) wrapping PNG
// image data directly, which every browser and OS supports since Vista/
// Chrome and avoids reimplementing BMP/DIB encoding.
function buildIco(pngsBySize) {
  const count = pngsBySize.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  const images = [];
  for (const { size, png } of pngsBySize) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // colour count (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // image data size
    entry.writeUInt32LE(offset, 12); // image data offset
    entries.push(entry);
    images.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

async function main() {
  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(
    icoSizes.map(async (size) => ({ size, png: await renderPng(size) })),
  );
  writeFileSync(
    path.join(repoRoot, "src", "app", "favicon.ico"),
    buildIco(icoPngs),
  );

  const appleTouchIcon = await renderPng(180, { opaque: true });
  writeFileSync(
    path.join(repoRoot, "src", "app", "apple-icon.png"),
    appleTouchIcon,
  );

  const manifestSizes = [192, 512];
  for (const size of manifestSizes) {
    const png = await renderPng(size, { opaque: true });
    writeFileSync(path.join(repoRoot, "public", `icon-${size}.png`), png);
  }

  console.log("Wrote favicon.ico, apple-icon.png, and manifest icons.");
}

main();
