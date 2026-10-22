// Copies the Sekka app icons from brand/icons/ to where the app serves them. The artwork
// is designed outside this repo: replace the files in brand/icons/, then run
// `npm run icons`. The outputs are committed.
//
//   public/icons/icon.svg           any size, rounded corners (browsers, Android "any")
//   public/icons/icon-192.png       Android home screen
//   public/icons/icon-512.png       Android splash screen, install dialogs
//   public/icons/maskable-512.png   Android adaptive icons: full bleed, artwork in the safe zone
//   src/app/apple-icon.png          iOS home screen (180px; iOS rounds the corners itself)
//   src/app/icon.svg                the browser tab icon (the bare symbol, teal in light and dark)
//   src/app/favicon.ico             the tab icon for browsers without SVG favicons

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** brand/icons/<source> → <destination> */
const COPIES = {
  "icon.svg": "public/icons/icon.svg",
  "icon-192.png": "public/icons/icon-192.png",
  "icon-512.png": "public/icons/icon-512.png",
  "maskable-512.png": "public/icons/maskable-512.png",
  "apple-icon.png": "src/app/apple-icon.png",
  "favicon.svg": "src/app/icon.svg",
  "favicon.ico": "src/app/favicon.ico",
};

for (const [source, destination] of Object.entries(COPIES)) {
  await mkdir(dirname(join(ROOT, destination)), { recursive: true });
  await copyFile(join(ROOT, "brand/icons", source), join(ROOT, destination));
}
console.log("Icons copied.");
