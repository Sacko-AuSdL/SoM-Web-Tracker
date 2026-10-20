# Secret of Mana Web Tracker

An unofficial world-map and inventory tracker for Secret of Mana Randomizer
Open Mode. Track your adventure manually or connect your local emulator with SNI.

## [Open Web Tracker](https://sacko-ausdl.github.io/SoM-Web-Tracker/)

Runs directly in your browser. **Normal users do not need Node.js or a local
installation of the tracker.** No ROM, emulator or SNI installation is bundled.

## Features

- World-map checks, reachability and completion counters.
- Normal, Compact and Square inventory layouts, including stream-friendly views.
- Local SNI autotracking with manual tracking as a fallback.
- Randomizer Settings String import, Crystal Orbs, Cannon Travel and Kakkara Start.
- Compatible Sandship builds: one Captain prize check, plus a separate Morie hint.
- Grand Palace hint knowledge, Mana Tree Revival counter and scoped resets.

## How to use the tracker

1. [Open Web Tracker](https://sacko-ausdl.github.io/SoM-Web-Tracker/).
2. In **Settings**, import your Randomizer Settings String or review the options.
3. Choose **N / C / S** for your preferred inventory layout. Drag/zoom the map;
   hover or click a marker for details. Green is reachable, red blocked,
   amber unknown/partial, and grey completed.
4. Click a Crystal Orb to record its known requirement. Orb requirements and
   completion are separate. Enable Cannons to record directed Shuffle/Chaos routes.
5. Use an item's GP corner to cycle **Unknown → Required → Not Required**.
   Unknown stays visually quiet; confirmed hints show GP or struck-through GP.
   These controls do not change ownership or complete Orbs.
6. For Mana Tree Revival, click the required count beside **Mana Seeds** in
   Inventory. Choose 1–8 (or only the imported range). **Unknown / Reset** removes
   your override and restores the imported requirement.

Progress/configuration stays in this browser, not in a cloud account. Use
**New Seed Reset** when changing seeds; the tracker does not automatically keep
separate profiles for each ROM. Localhost and the public site have separate storage.

In **Settings**, each reset asks for confirmation:

- **Reset Crystal Orbs:** clears manual Orb requirements/clears and GP knowledge.
- **Reset Manual Tracking:** clears manual progress, but keeps seed settings,
  Orb requirements, GP hints, MTR resolution and known travel routes.
- **New Seed Reset:** clears manual progress and seed configuration back to defaults.

Resets preserve layout/connection preferences and do not reset live emulator RAM.
See the [technical reference](docs/technical-reference.md) for exact boundaries.

## SNI autotracking setup

1. Install [SNI](https://github.com/alttpo/sni/releases) and start it.
2. Start your supported emulator with your own Open Mode ROM. For Snes9x,
   run the SNI Lua Connector supplied with your setup; SNI's
   [documentation](https://github.com/alttpo/sni#for-end-users) lists supported devices.
3. Confirm SNI exposes the emulator through its usb2snes WebSocket service at
   `ws://localhost:23074`. Keep SNI running on the same computer as the browser.
4. Open the tracker. It attaches automatically; choose **Settings → SNI device**
   if necessary. Enter the game and check for **SNI Connected / Game Detected**.

The public tracker is HTTPS, unlike local development. Browser mixed-content
and loopback/local-network policies can block local SNI even when local HTTP
works. If your browser asks, allow local-network/loopback access **only for the
trusted tracker origin**. If previously denied, review that site's permissions
and reload. Chrome/Edge, Firefox and Safari can behave differently by version
and policy; a permission prompt is not guaranteed.

**Public HTTPS SNI with a real emulator is not yet certified.** Use **Debug**
and the [browser diagnostic guide](docs/deployment.md#sni-over-https) to distinguish
a browser block, missing SNI service, missing device and unsupported game.
Do not disable browser security globally. Manual tracking remains available;
contributors can also run the tracker locally.

Memory is read directly from your local SNI service. There is no remote SNI
proxy, and the tracker does not upload ROM or gameplay RAM to GitHub or another
server. It does not write emulator/game memory.

## Manual tracking without SNI

Open a map marker and click a check row to toggle permanent manual completion.
Click inventory items for session-only ownership marks. Record Orb requirements,
GP hints and known Cannon routes as you learn them. Hints show sources, not
spoiler contents. Morie read/unread is manual because no persistent game read
flag exists. Live RAM follows save-state rollback; permanent check marks remain
until undone or reset.

## Development setup (contributors)

Use Node.js 24+ and npm. From a clone:

```sh
npm ci
npm run dev
```

Vite's default development port is unchanged. No sibling repository is needed.

```sh
npm test -- --maxWorkers=2 --pool=threads
npm run typecheck
npm run build
npm run check:dist
npm run preview
```

Open the printed preview URL under `/SoM-Web-Tracker/` to test the production build.
On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

Details: [deployment and HTTPS/SNI diagnostics](docs/deployment.md),
[Cannon network, option mappings, event/chest audit and implementation reference](docs/technical-reference.md),
[source findings and dated verification history](docs/sandship-source-and-verification.md),
and [source provenance](source/provenance.json).

## Credits and licenses

Original project code: [MIT](LICENSE), Copyright (c) 2026 Sacko.
Third-party components retain their own licenses:

- SoM-Open_Mode-Tracker by Cyb3R and contributors: data/logic and bundled assets;
  [original package notice](public/POPTRACKER_LICENSE.txt).
- Secret of Mana Randomizer by Moppleton and contributors: source-backed mappings;
  its LGPL-2.1 material is not relicensed by this project's MIT notice.
- Manaspace by codeman38 / zone38: [font license](public/fonts/license.txt).

Secret of Mana and its game artwork, sprites and map imagery belong to their
respective rights holders and are **not covered by this repository's MIT license**.
This unofficial project is not affiliated with or endorsed by Square Enix.
These notices do not grant ownership or redistribution rights to game artwork.
See [third-party notices](THIRD_PARTY_NOTICES.md) and [provenance](source/provenance.json).
