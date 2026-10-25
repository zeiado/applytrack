# Sekka browser extension

Save the job you're looking at to Sekka in one click (#69). Chrome, Manifest V3.

1. On a job page, click the Sekka icon.
2. The popup reads the company, role and link from the page, only then and only that
   page. The user checks and corrects them, picks *Applied* or *Want to apply*.
3. *Save to Sekka* adds the application, and *Open in Sekka* opens it in the web app.

It reads LinkedIn, Wuzzuf, Bayt and Forasna, and makes a rough guess on any other page
(`src/extract.ts`): first the page's schema.org `JobPosting`, then LinkedIn's tab
title, then the page's heading or title.

## How it signs in

It doesn't have its own sign-in. It calls the **web app** (`/api/extension/*` routes),
not the API, and the browser sends the web app's session cookies with those requests
because the extension has a host permission for the web app. So whoever is logged in to
Sekka in this browser is logged in here, whether with a password or with Google. Logged
out, the popup links to the login page.

The web app accepts these requests only with a `chrome-extension://` origin (set
`EXTENSION_IDS` in Vercel to our extension's id once it's published, to allow only
ours). Websites can't send that origin, and the cookies are `SameSite=Lax`, so a
website can't make the browser save applications.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the open page, only when the user clicks the extension |
| `scripting` | Run the reader (`src/extract.ts`) in that page |
| Host permission for the web app | Send requests to Sekka with the user's session |

No access to other sites, browsing history, or anything in the background.

## Develop

```bash
npm install
npm run check                                       # type check, tests, build
SEKKA_APP_URL=http://localhost:3000 npm run build   # for a local web app
```

`npm run build` writes `dist/` for the production web app. To try it: Chrome ›
`chrome://extensions` › Developer mode › *Load unpacked* › choose `dist/`. After a
rebuild, click the extension's reload button there.

The end-to-end test (`web/e2e/extension.spec.ts`) loads `dist/` (built for
`http://localhost:3000`) into Chromium with the real web app and API.

## Publish to the Chrome Web Store

1. Bump `version` in `package.json`, then `npm run build`.
2. Zip the **contents** of `dist/` (not the folder itself):
   `cd dist && zip -r ../sekka-extension.zip .`
   (Windows: `Compress-Archive -Path dist\* -DestinationPath sekka-extension.zip`).
3. First time only: register at the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (a one-time US$5 fee), then *New item* › upload the zip.
4. Listing: name, description (from `static/_locales/*/messages.json`), the 128px icon
   (`static/icons/icon-128.png`), at least one 1280×800 screenshot, category
   *Productivity*, languages English and Arabic.
5. Privacy practices:
   - Single purpose: "Save the job posting the user is viewing to their Sekka account."
   - `activeTab` and `scripting`: "Reads the company, role and link from the open job
     page when the user clicks the extension, so they don't have to type them."
   - Host permission: "Sends the job the user chose to save to their Sekka account."
   - Data collected: website content (the job's company, role and link), sent only when
     the user clicks Save. Not sold, not used for anything else.
   - Privacy policy URL: the web app's privacy page, `<web app URL>/en/privacy`.
6. Visibility: **Unlisted** first (only people with the link can install it), then
   Public once it has been tried.
7. After the first upload, copy the item's id and set `EXTENSION_IDS` to it in Vercel
   (Production), and `NEXT_PUBLIC_EXTENSION_URL` to its store page (the board's first-run
   guide links to it), then redeploy the web app.
