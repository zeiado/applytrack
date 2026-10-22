// Draws the app icons: a winding route (the job search as a path) on the brand teal.
// Run after changing the artwork: `npm run icons`. The outputs are committed.
//
//   public/icons/icon.svg           any size, rounded corners (browsers, Android "any")
//   public/icons/icon-192.png       Android home screen
//   public/icons/icon-512.png       Android splash screen, install dialogs
//   public/icons/maskable-512.png   Android adaptive icons: full bleed, artwork in the safe zone
//   src/app/apple-icon.png          iOS home screen (180px; iOS rounds the corners itself)
//   src/app/icon.svg                the browser tab icon

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEAL = "#00695a"; // --primary, oklch(0.46 0.1 180)

/** The route, drawn on a 512 grid and scaled by `scale` around the centre. */
function artwork(scale) {
  const offset = (512 * (1 - scale)) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M140 372 C268 372 244 140 372 140" stroke-width="40"/>
    <circle cx="140" cy="372" r="34" fill="${TEAL}" stroke-width="28"/>
    <circle cx="372" cy="140" r="46" fill="#fff" stroke="none"/>
  </g>`;
}

function svg({ rounded, scale }) {
  const radius = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${TEAL}"/>
  ${artwork(scale)}
</svg>
`;
}

async function png(source, size, path) {
  await mkdir(dirname(join(ROOT, path)), { recursive: true });
  await sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ROOT, path));
}

const any = svg({ rounded: true, scale: 1 });
// Android may crop a maskable icon to a circle: keep the route inside the middle 80%.
const fullBleed = svg({ rounded: false, scale: 0.78 });

await writeFile(join(ROOT, "public/icons/icon.svg"), any);
await writeFile(join(ROOT, "src/app/icon.svg"), any);
await png(any, 192, "public/icons/icon-192.png");
await png(any, 512, "public/icons/icon-512.png");
await png(fullBleed, 512, "public/icons/maskable-512.png");
await png(svg({ rounded: false, scale: 0.86 }), 180, "src/app/apple-icon.png");
console.log("Icons written.");
