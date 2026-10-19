# Sandship source findings and verification

Authoritative source: the existing local `SecretOfManaRandomizer/SoMRandomizer`
checkout, inspected read-only. No Randomizer files, ROMs or game state were changed.
These are source-backed identities and small event signatures, not a bundled
Randomizer implementation. Its existing LGPL-2.1 notice remains separate from
the tracker's original-code MIT license.

## Source findings

- `processing/openworld/events/SandshipEvents.cs`: entry `28A` goes through Door
  `193` to the existing Mech Rider 1 arena, map 340, (16,20), layer 1. Death `2A1`
  first calls `504` (native fixed Weapon Orb), then sets `DESERT_SHIP_FLAG` to F,
  uses Door `1FF` to crew map 91, and calls `7C2` for desert music. Return Door
  `194` leads to southern desert map 92, (21,39). The desert entrance inserts
  three `28A` trigger words at the original map-93 trigger offset; detection
  does not depend on a guessed fixed trigger offset.
- `processing/common/EventFlags.cs`: `DESERT_SHIP_FLAG = 0x28`.
  `processing/openworld/events/InitialEventFlagStates.cs` starts it at E.
  `processing/common/structure/EventScript.cs` documents SetFlag values 0..F
  and encodes Logic's inclusive low/high bounds in one byte. The NPC visibility
  guard is F..F, so the tracker uses equality, not >=. Event flags are addressed
  individually at `0x7ECF00 + flag`, also explicit in
  `processing/hacks/openworld/CrystalOrbWeaponBreaking.cs`'s
  `EVENT_FLAGS_RAM_BASE` and native `FastWhipPosts.cs`'s `LDA $CF00,X`.
  Boss clear is thus byte `0x7ECF28 == 0x0F`, usb2snes `0xF5CF28`.
  Out-of-range reads become isolated diagnostics, not a false victory.
- `processing/common/BossSwaps.cs` includes `VanillaBossMaps.MECHRIDER1` in
  its existing swap slots; `processing/common/VanillaBossMaps.cs` retains that
  arena's normal compatible candidate list. No new boss/check slot is created.
- `processing/openworld/randomization/OpenWorldLocations.cs` registers
  `sandship captain`, event `2A3`, normal prize slot 0, no extra locked prizes.
  `processing/openworld/cannon/CannonTravelRegions.cs` assigns it to Kakkara.
  `processing/openworld/PlandoProperties.cs` and `processing/hacks/openworld/Plando.cs`
  map `p_Sandship-Captain`. Admiral Meria is map 91 object 1.
- `SandshipEvents.cs` prefixes Captain with the boss guard `42 28 0E 10 00`,
  then `PrizeEvents.injectReplacementPattern`. `OpenWorldResultInjector.cs`
  replaces that pattern with the selected `PrizeItem.eventData`.
  `OpenWorldPrizes.cs` gives each prize its ordinary acquired flag and already-
  claimed guard (range 1..F -> event 396), followed by SetFlag/increment as
  appropriate. `OpenWorldLocationPrizeMatcher.cs` excludes repeatable 'nothing'
  here. The Captain's acquired flag is seed-dependent; generic EventResolver
  resolves it from `2A3`, and LocationAutotracker reads the normal flags block.
  Required persistent-flag resolution rejects execution-pointer fallback, so
  merely talking before boss victory or entering the script cannot claim it.
  Neither boss flag 28 nor a hardcoded Sea Hare Tail flag is used for the check.
- Morie is map 91 object 0, event `2A2`, with the same post-boss guard.
  `HintEvents.cs` injects dialogue, and `OpenWorldHints.cs` injects wrapped text
  into it. Neither records a hint-read flag. Read/unread is therefore manual
  browser persistence (`manualReadHints`, an additive v3 world-state field).
  Actual hint text is not inferred or displayed. Existing v3 data defaults to
  no read marks; v1/v2 migrations and completion IDs remain unchanged.
- `RomGenerator.cs` still uses version 1.49, so that version/settings string
  cannot identify this extension. Auto detection instead follows the relocated
  table at ROM `01E7A3` and compares four independent source-backed signatures:
  full entrance `28A`, full death `2A1`, and boss-guard/dialogue prefixes of
  Captain `2A3` and Morie `2A2`. All must match. Reads are refreshed every poll;
  false/unknown support hides the area, Captain and Morie and retains 76 active
  checks. Supported builds activate exactly one more logical check (77).
  No manual compatibility override is needed for this verified patch shape.

## Tracker behavior

Sandship is at world-image pixel (660,1690), south of Kakkara (660,1484).
Its arena uses the existing Kakkara travel access, excluding the unrelated
Sea Hare Tail trade gate; no new item requirement is added. Captain logical
reachability includes defeating the normal boss challenge, so it does not
require the boss-clear RAM flag in advance. Only the independent Captain prize
flag (or persistent manual mark) completes the check. The Sandship area uses
the same check-level access/completion aggregation as other areas.
Morie is visible in the Hints layer for supported builds; actual hint
availability/read controls remain boss-gated. The fixed boss Weapon Orb
stays in generic inventory RAM progression, not a second Prize check. Boss and
Captain RAM states follow save-state rollback; a permanent manual Captain mark
or Morie read mark does not change boss/inventory RAM.

## Automated coverage and live retest

Tests cover independent boss/claim resolution with two synthesized prize
shapes (weapon increment and flag set), rollback, every compatibility-signature
mismatch, invalid boss RAM, required-flag failure with a matching execution
pointer, continued polling/game/Potos/Mantis/Spear after isolated errors,
76/77 totals, Kakkara-start/no-extra-item reachability, old persistence and
separate hint controls. Existing Normal/Compact/Square and travel tests remain.

Live retest:

1. In this project run `npm.cmd run dev`. Start SNI on `ws://localhost:23074`,
   load a compatible Open World ROM in Snes9x and run its SNI Lua bridge.
2. Enter the game; verify Connected/Detected, Debug's Sandship support=true,
   and total 77. With Kakkara Start and Drum in logic, before victory boss value
   should be E and Captain green but unfinished. Morie is visible but blocked
   in the enabled Hints layer. Neither boss clear nor Morie adds a Prize check.
3. Travel south from Kakkara through the desert/southern desert entrance and
   defeat the shuffled boss. Verify boss value F, Captain still green and
   unfinished (no artificial reachability transition), and Morie available.
   Check generic weapon-orb inventory separately.
4. Collect the Captain's randomized prize; verify generic event `2A3` resolves
   to this seed's acquired flag, then becomes grey/RAM complete. Do not assume a
   particular reward. Read Morie and mark the hint read; reload the page.
5. Load a pre-claim state: Captain RAM reverts and its check is green again.
   Load a pre-boss state: boss reverts, Captain stays green if the route is
   reachable, and Morie remains visible but blocked; its manual read mark
   persists. A manual Captain completion remains effective without altering
   boss or inventory RAM. With Default Start and no entered route in Shuffle,
   Captain must remain blocked regardless of the boss-clear flag.
6. Reconnect with an older unsupported seed: Sandship/Captain/Morie are absent
   and the total is 76. Existing Potos/Mantis/inventory remain operational.
7. In Shuffle/Chaos enable Cannons: click an office, then a destination. No
   Add route control should appear. Hover for Replace/Remove/Closed management;
   Escape cancels a replacement without changing the old directed route.

Real emulator validation and a fresh pixel-level visual pass are still required.
Browser automation failed before startup with the Windows sandbox helper error;
DOM interaction/layout-rule tests are not claimed as visual inspection.

## Verification result (2026-10-08)

- Full Vitest suite: 249 tests / 28 files passed (final run).
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, 91 transformed modules.
- `npm.cmd run generate:map`: passed; frozen PopTracker content stays at 27
  groups / 76 rules / 14 Orbs / 7 hint groups / 16 sources. Sandship is an
  optional additive browser definition, not a rewritten source snapshot.
- `npm.cmd run dev -- --host 127.0.0.1 --strictPort`: starts on default 5173.
  HTTP smoke checks for `/`, `/src/main.tsx`, `/src/ui/WorldMap.tsx` returned 200.
- Blank markers and correct color classes (including partial) are DOM/CSS
  tested; direct source/destination selection, precise route removal, management
  controls and cancellation are covered. Undersea's (-8,+8) offset, existing
  Gaia/Earth/Upper Land placements and all three inventory layouts are covered.
  Morie's display offset (+20,+24) avoids the nearby Kakkara Cannon at fit scales.
- Browser automation initialization and reset/retry failed before page access
  (`helper_unknown_error: setup refresh had errors` / trusted Node process
  exited). No new desktop/960x540 screenshots or no-overflow visual claims.
- No real running SNI/emulator was used. Tests synthesize minimal command bytes
  from the inspected source and exercise the existing SNI WebSocket protocol.

## Files changed in this phase

```text
README.md
THIRD_PARTY_NOTICES.md
source/provenance.json
scripts/generate-map-groups.mjs
src/App.tsx
src/autotracking/Autotracker.ts
src/autotracking/EventResolver.ts
src/autotracking/LocationAutotracker.ts
src/autotracking/SandshipAutotracker.ts
src/autotracking/SniClient.test.ts
src/data/definitions.test.ts
src/data/hintMarkers.ts
src/data/locationDefinitions.ts
src/data/mapAreas.test.ts
src/data/mapAreas.ts
src/data/mapGroups.test.ts
src/data/sandship.test.ts
src/data/sandship.ts
src/data/sourceWorldData.ts
src/data/splitChecks.test.ts
src/domain/cannons.ts
src/domain/tracker.ts
src/logic/progress.test.ts
src/logic/progress.ts
src/logic/reachability.ts
src/logic/travel.test.ts
src/state/trackerState.ts
src/state/worldState.ts
src/styles.css
src/ui/CannonLayer.tsx
src/ui/DebugPanel.tsx
src/ui/SettingsPanel.tsx
src/ui/WorldMap.tsx
src/ui/finalPolish.test.tsx
src/ui/functionalPhase.test.tsx
src/ui/markerStyles.test.js
src/ui/preReleaseUx.test.tsx
src/ui/releaseCleanup.test.tsx
src/ui/sandship.test.tsx
src/ui/ui.test.tsx
verification/sandship-source-and-verification.md
```
