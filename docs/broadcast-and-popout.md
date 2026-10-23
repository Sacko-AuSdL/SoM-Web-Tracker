# Broadcast presentation and inventory pop-out

This implementation supersedes the earlier inventory-only Broadcast design.
It does not change inventory RAM definitions, event mappings or game logic.

## Presentation versus layout

- Main tracker: footer **Broadcast** toggles full-page black presentation.
  `?view=broadcast` explicitly enables it; the main map and controls remain.
- Inventory layout: **N / C / S**, independently of presentation. Broadcast
  supports the N/C/S keys, too. Escape exits Broadcast without changing layout;
  an open Settings/Debug panel consumes Escape first. Form inputs keep typing.
- The existing v1 preferences record stores presentation as a separate field.
  Old N/C/S preferences are retained. An old `inventoryMode: broadcast` migrates
  to Broadcast presentation + Normal layout: that old record contains no prior
  N/C/S choice to recover. No tracking-state migration/reset is introduced.

## Inventory window

Click **↗** beside N/C/S. A named window opens at the current inventory layout,
with the dedicated URL `?view=inventory-popout&layout=normal` (or compact/square).
You can also open `?view=inventory-popout` directly; it restores the pop-out's
own saved layout, initially falling back to the main layout. Changing it never
changes main-window layout or Broadcast preference. The optional `layout` URL
parameter selects a specific layout and is updated when switching N/C/S.

The same `ItemPanel` renders the original bundled icons, role picker, GP hints,
weapon Orb stages, MTR dropdown and manual marks. No second inventory renderer
or special fourth layout exists. The window title is **Secret of Mana Inventory**.
Only a small SNI/game status accompanies the inventory. Its title exposes errors,
and a device selector appears when SNI reports multiple devices. The **x** calls
the browser's normal window-close action. Browsers may refuse to close a directly
opened tab; an inline explanation tells you to use its tab controls instead.
Blocked pop-ups have a direct-link fallback. Window sizing/placement and native
title-bar appearance ultimately belong to the browser/OS.

## Local state and SNI boundaries

Each document runs the existing Autotracker and its own usb2snes SNI connection.
A standalone pop-out does not require an opener or a surviving main tracker.
There is no remote proxy, RAM write, cloud synchronization, stored RAM snapshot,
or transmission of gameplay RAM between windows.

Within the **same origin and browser storage partition**:

- Existing localStorage records share seed configuration, roles, GP/MTR, Orb
  knowledge, Cannon routes and permanent manual check completion. Storage-event
  listeners reload through the existing validation/migration functions. Saved
  configuration edits use localStorage's last-write-wins behavior; the app does
  not provide independent seed profiles for concurrent different-ROM windows.
- Session-only manual inventory marks use `BroadcastChannel`, not localStorage.
  A joining/reloading view requests the active marks. Per-item logical versions
  merge independent edits and deterministically resolve simultaneous edits;
  retained false records prevent older peers restoring reset marks.
- Manual/New Seed resets clear session marks in the other open views. Orb reset
  retains session ownership, as before. Existing reset scopes are unchanged.
- With no surviving peer, reloading/closing the last document ends its manual
  inventory session. Unsupported/blocked BroadcastChannel environments keep
  manual marks local to each view. Saved seed configuration remains persistent.

Different origins (including different ports), profiles, private sessions or OBS
storage partitions do **not** share these mechanisms. Every view must attach to
the intended SNI device; main-window device selection is not a remote control
for another window's connection.

## OBS and verification

For OBS Window Capture, use the inventory window. For Browser Source, use the
dedicated pop-out URL. Browser Source must have its own seed configuration and
SNI/local-network permission where required. Configure the full tracker URL in
that same OBS profile first if needed, then return to the inventory URL. Do not
assume an OBS source receives the normal browser's manual marks or permissions.

Production browser QA on 2026-10-23 verified:

- Full suite: 491 passing tests across 40 files (`--maxWorkers=2 --pool=threads`),
  TypeScript typecheck, production build, and Pages base-path asset check.
- Full-page Broadcast in N/C/S at 1280×720, all major background surfaces black,
  map/markers and original help placement retained, Escape/layout persistence.
- Inventory-only N/C/S: Normal 260×780, Compact 240×540, Square 350×440; no document
  scrolling at these sizes, no broken icons. The QA browser clamps requests below
  240px width; 190px-wide browser rendering is not claimed as visually verified.
- Real same-origin browser channels: main-to-pop-out initialization, bidirectional
  manual marks, GP/MTR updates, peer-assisted reload, reset propagation, independent
  layout preferences, standalone reload and direct-tab close explanation.
- The in-app QA browser did not expose `window.open` as a controllable new window.
  Two-window content/synchronization was therefore verified using the dedicated
  URL in separate browser tabs. Window-open URL/features, blocked-pop-up fallback
  and close callbacks are also covered by component tests; a native OS pop-up
  window/OBS capture was not verified by the agent.
- SNI was reachable but had no attached device during QA. Two independent mocked
  usb2snes clients cover inventory acquisition, rollback, and the pop-out continuing
  after the main client stops. No new real-emulator live-update claim is made.

GitHub Pages base paths/deployment, the development port, assets and license
notices remain unchanged. This work is committed locally only, not published.
