# GitHub Pages deployment and browser diagnostics

Public URL: https://sacko-ausdl.github.io/SoM-Web-Tracker/

## Deployment

The existing `main` branch publishes `dist/` through `.github/workflows/deploy.yml`.
Pushes to main and manual Actions runs use Node.js 24, `npm ci`, the complete
two-worker thread-pool test suite, typecheck, production build and asset checks.
Official Pages Actions upload/deploy the artifact using the `github-pages`
environment. Concurrency serializes deployments without interrupting one in flight.
Actions are pinned to verified official release commits, not third-party deployers.
No `gh-pages` branch, force push, release tag or committed build output is needed.

Repository prerequisites:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Actions must be enabled and allowed to use the official `actions/*` actions.
3. If the `github-pages` environment has approval/branch restrictions, allow
   `main` and approve the deployment when requested. Keep HTTPS enabled.
4. Inspect **Actions → Deploy tracker to GitHub Pages** after a push. Rerun a
   failed run, or use **Run workflow** after correcting repository settings.

Production Vite base is `/SoM-Web-Tracker/`; normal development remains `/`
with the default port. Public font URLs are rewritten by Vite; bundled map,
inventory/element/weapon/Orb assets are hashed or inlined. Cannon artwork is
the existing inline vector. Sandship definitions/signatures ship in the JS,
without a ROM or sibling checkout. Footer notices use Vite's base URL.

Local release checks:

```sh
npm ci
npm test -- --maxWorkers=2 --pool=threads
npm run typecheck
npm run build
npm run check:dist
npm run preview
```

Visit the printed local URL with `/SoM-Web-Tracker/`. The verifier checks HTML,
CSS and emitted base-prefixed JS asset references against actual dist files,
rejects unprefixed root URLs and development/Windows paths, and checks font/notices.
Browser QA must additionally inspect loaded images/fonts, inventory layouts,
Orbs, Cannons, settings and reset controls. No emulator is needed for manual UI QA.

Guidance: [Vite static deployment](https://vite.dev/guide/static-deploy#github-pages),
[GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## SNI over HTTPS

The app preserves the existing usb2snes protocol at `ws://localhost:23074`.
This points to the visitor's machine, not GitHub's server. The app has no remote
proxy or gameplay/ROM upload endpoint; Pages only supplies static files. The
SNI client uses discovery/attachment/info and memory-read requests, not game writes.

An HTTPS page connecting to an unencrypted WebSocket is subject to browser
mixed-content and local-network/loopback policies. Loopback is treated specially
by some browsers, but a successful local HTTP test is not evidence for HTTPS.
Permission names and WebSocket coverage vary by browser/version/enterprise policy.
Chrome's original LNA rollout explicitly did not gate WebSockets yet; newer
documentation includes them. Do not infer today's result from that older rollout.
Use an up-to-date desktop browser; test Chrome/Edge, Firefox or Safari separately
rather than assuming universal support. If prompted, grant the trusted tracker
origin local-network/loopback access; revoke/regrant a denied site permission and
reload if necessary. Managed computers may need administrator policy approval.
Never enable insecure-content access globally or disable browser security flags.

### Actionable diagnosis

1. Start SNI and the emulator's connector on this same computer. Confirm the
   emulator device in SNI. Open the **public HTTPS URL**, not a local preview.
2. Open browser developer tools, select **Network → WS**, then reload. Inspect
   `ws://localhost:23074`. A successful handshake (normally HTTP 101) and SNI
   DeviceList/Info responses prove transport, **not** game detection or tracking.
3. If blocked before opening: read the Console. Mixed-content / SecurityError,
   local-network denial or enterprise-policy messages point to browser policy.
   Review the tracker site's permissions. A generic WebSocket error alone does
   not identify the cause. No prompt may simply mean that browser handles
   WebSocket/loopback access differently; it does not prove access is permitted.
4. Connection refused / no handshake: verify SNI is running, port 23074 is
   listening and local firewall/endpoint settings permit the loopback connection.
   Do not expose SNI to the Internet. Do not substitute `wss://` unless SNI is
   actually configured with trusted TLS; the default service is plain `ws://`.
5. Connected but no device: enable the emulator's SNI Lua bridge and inspect
   SNI logs. Connected with a device but **Game Not detected**: enter the game
   and inspect tracker Debug for game/memory or isolated check errors.
6. For actual production autotracking verification, require **Connected + Game
   Detected**, then observe a real check and inventory change (for example the
   Potos chest and its current seed reward) and save-state rollback. Do not
   infer success from a mock socket or a connection-only test.
7. If HTTPS remains blocked, use manual tracking or a locally hosted tracker.
   Do not send a ROM, RAM dump or private SNI log to a remote proxy.

**Release verification boundary:** local SNI/emulator functionality has been
tested during development. Public HTTPS-to-SNI with a real emulator is not
certified by those earlier tests. A public-origin transport observation, if
available, must be reported separately from real emulator/RAM verification.

Primary references:

- [SNI setup and usb2snes interface](https://github.com/alttpo/sni#usb2snes-compatibility)
- [Chrome LNA rollout and its initial WebSocket limitation](https://developer.chrome.com/blog/local-network-access)
- [MDN local-network/loopback permissions and mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access)

See [technical reference](technical-reference.md) for persistence/reset semantics
and [dated source/verification notes](sandship-source-and-verification.md) for
event-level findings. Historical test counts describe their dated snapshots,
not the current release suite. No release tag should be published before the
public site has passed deployment and production checks.

## v0.1.0 local release verification (2026-10-20)

- Clean `npm ci`: passed after stopping a project Vite process holding a Windows
  native-binary lock; dependency versions were unchanged, audit reported zero vulnerabilities.
- Complete suite: 402 tests / 35 files passed with `--maxWorkers=2 --pool=threads`.
- TypeScript typecheck and production build: passed (95 modules).
- Production base-path verifier: 34 references passed; all 35 emitted files
  returned HTTP 200 under `http://127.0.0.1:4184/SoM-Web-Tracker/`.
- Browser smoke: loaded map/item/weapon/element/Orb images and Manaspace font;
  no broken images or console warnings/errors. Normal, Compact and Square,
  imported 5–8 MTR choices, inline resolution, GP independence, reload
  persistence, Orb selection and directed Cannon interaction were exercised.
  Reset controls remained present; their behavior and Sandship compatibility/
  76–77 totals are covered by the unchanged full suite, not claimed as live ROM tests.
- Local SNI service answered, but no emulator device was available. This local
  preview result does not establish public HTTPS SNI or real emulator tracking.
- Pages configuration was inspected: Actions source (`build_type: workflow`),
  main branch, HTTPS enforced. Deployment/public-origin results must be checked
  after push; no release tag is created by this workflow.
