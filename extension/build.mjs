// Builds the extension into dist/, ready to load unpacked or to zip for the Web Store.
//
//   npm run build                                   the production web app
//   SEKKA_APP_URL=http://localhost:3000 npm run build   a local web app (development, e2e)

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { build } from "esbuild";

const APP_URL = (process.env.SEKKA_APP_URL ?? "https://applytrack-psi-five.vercel.app").replace(/\/+$/, "");
const { version } = JSON.parse(await readFile("package.json", "utf8"));

const ICONS = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };

const manifest = {
  manifest_version: 3,
  name: "__MSG_name__",
  description: "__MSG_description__",
  default_locale: "en",
  version,
  icons: ICONS,
  action: { default_popup: "popup.html", default_icon: ICONS },
  // activeTab: read the open page only when the user clicks the extension, nothing else.
  // scripting: run the reader (src/extract.ts) in that page.
  permissions: ["activeTab", "scripting"],
  // The web app, so requests to it carry the user's Sekka session.
  host_permissions: [`${APP_URL}/*`],
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/popup.ts"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: "dist/popup.js",
  define: { __APP_URL__: JSON.stringify(APP_URL) },
  logLevel: "warning",
});
await cp("static", "dist", { recursive: true });
await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built dist/ (version ${version}) for ${APP_URL}`);
