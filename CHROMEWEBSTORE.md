# Publishing mt-md to the Chrome Web Store (unlisted)

Everything the dashboard asks for is below. Build the files with:

```
npm run package                 # writes release/mt-md/store/mt-md-<version>-chrome-store.zip
npm run store:assets            # screenshots and promo tile into release/mt-md/store/
```

The store zip is the Chrome build **without** `key` and `update_url` (the store assigns the extension ID and
hosts updates). The self-hosted CRX keeps its own ID (`keahkebjkabggblfaffdgdpiobhmdfon`); the store listing
gets a different one, so do not install both in one browser.

## One-time account (the maintainer does this)

1. Sign in at <https://chrome.google.com/webstore/devconsole> with the Google account that will own it.
2. Pay the one-time US$5 registration fee and verify the contact email.
3. **Items > New item**, upload `mt-md-<version>-chrome-store.zip`.

## Store listing and Privacy tab: one source, checked every release

The texts for the dashboard are **not written here**. They live once in `store/listing.json` (summary, description, single purpose and a
justification for every permission, plus the one-line description the install page shows). `npm run listing` checks them and writes
`release/mt-md/store/listing.md`, ready to paste into the **Store listing** and **Privacy** tabs. The check fails when:

- a toolbar tool or core feature has no line in the description (add a tool to `src/toolbar.js` and the gate fails until the listing mentions it),
- a manifest permission has no justification, or a justification is left for a permission that is gone,
- the summary is over the store's 132 characters, or the text repeats a claim known to be out of date.

The Chrome Web Store API can upload and publish a package but **cannot change listing text or screenshots**, so the dashboard paste stays manual.
To make sure it is not forgotten, `npm run release` and `npm run release:store` refuse to run until the texts have been confirmed for the
version being released (`reviewedFor` in `store/listing.json`).

### Every release

1. Read `store/listing.json` against what changed since `reviewedFor` (`git log`), and edit it.
2. `npm run store:assets`: four 1280x800 screenshots and the promo tile into `release/mt-md/store/`. Look at them. (Source pages are in `store/shots/`.)
3. `npm run listing`, then paste `release/mt-md/store/listing.md` into the dashboard (Store listing, Privacy) and upload the screenshots; **Save draft**.
4. `npm run listing:confirm` (records the version), then `npm run release` / `npm run release:store`.

- **Category:** Productivity > Tools (the store groups categories; alternatives in that group: Developer Tools, Workflow and planning). **Language:** English.
- **Graphics:** icon `icons/icon-128.png`; screenshots `1-overview.png`, `2-diagrams.png`, `3-math.png`, `4-dark.png`; small promo tile `promo-small-440x280.png`.
- **Privacy policy URL:** optional when no data is handled; if asked, publish one at `<baseUrl>/mt-md/privacy.html` (baseUrl is in `hosting.json`).

## Distribution tab

- **Visibility: Unlisted** (anyone with the link can install; not searchable). Or **Private** and add trusted
  Google accounts as testers.
- **Regions:** all.

## After approval

1. Copy the listing URL (`https://chromewebstore.google.com/detail/<name>/<new-id>`).
2. Add it to `release/mt-md/meta.json` (`chromeStore`), which the install page script (not part of this repository) reads to link its
   Chrome button to the store instead of the CRX.
3. Later versions: bump `version` in both manifests, `npm run package`, upload the new zip. Review repeats.
4. Firefox is unaffected: it stays on the signed XPI and `updates.json` on your own host.

## Known limits of this package

- Mermaid's optional ELK layout engine is not bundled; diagrams that request `layout: elk` show an error.

## Automating uploads (Chrome Web Store API v2)

`npm run release:store` packages, uploads the zip to the existing item and submits it for review
(`scripts/cws.mjs`; also `npm run cws -- status|upload|publish`). Google still reviews every version.
Only the first listing is made by hand; every upload needs a higher `version` in the manifests.

Auth is a Google **service account** (no consent screen, no token that expires), can be shared across several extensions.
One-time setup, already done for the Cloud project **Model Tether** (`model-tether`):

1. Cloud project with the **Chrome Web Store API** enabled.
2. Service account `store-publisher@model-tether.iam.gserviceaccount.com` (no roles needed).
3. A JSON key for it, installed (the maintainer, never into chat or git):
   `install -m 600 ~/Downloads/model-tether-*.json ~/.config/browser-ext/cws-service-account.json`
4. Developer Dashboard > **Account**: add the service account's email (only one service account per publisher).
5. `~/.config/browser-ext/cws.env` containing `CWS_PUBLISHER_ID=<id>` (Dashboard > Account/Settings); the item ID goes in
   `store/cws-item-id.txt` in the package (32 letters, in the item's URL; not secret).

Items publish with the visibility already saved in the dashboard (Unlisted). If you change visibility in the dashboard,
publish once from the dashboard before the API can publish again. A new item must have its Store listing and Privacy
tabs complete, and the account needs 2-step verification.

## Upload gotchas (learned the hard way)

- An item **in review cannot be uploaded to** ("You may not edit or publish an item that is in review"). `npm run cws -- cancel`
  withdraws the submission first (the item goes back to Draft); the review queue position is lost.
- `publish` fails with `INVALID_ITEM_METADATA` when the draft is incomplete. A new permission needs its justification on the
  Privacy tab (activeTab and scripting were added in 0.1.7); fill it in the dashboard, press **Save draft**, then publish again.
- The upload state in the response is `SUCCEEDED`.
