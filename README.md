# Secret of Mana Web Tracker

A local, browser-based Secret of Mana Open Mode tracker. It connects to SNI's
usb2snes-compatible WebSocket service and tracks 68 standard logical checks
(76 event bindings), 40 inventory values and 14 persistent Orb open states.
The existing event resolver, SNI transport, and persistent manual-check
behavior are preserved; Orb polling is an independently diagnosed subsystem.

## Start

From `D:\views\tools\bots\som-web-tracker`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. The default SNI endpoint is
`ws://localhost:23074`. To override it, set `VITE_SNI_ENDPOINT` before
starting Vite.

## Map-first UI

- The map is the primary surface. Small high-contrast pins encode unreachable
  (dark red dashed ×), reachable (green +), unknown (amber dotted ?),
  partial/checkable (amber ◐), and completed (grey ✓) states. Dark outlines
  and shadows separate them from the terrain; hover/focus adds a light ring.
  Counts live in the popup, not on the pin. The unchanged map image is
  centered against the dark tracker background rather than extended ocean.
- Hover or focus a check pin to see its checks; click the pin to pin the popup.
  Click a check row once to add or undo a persistent manual completion. An
  `M` marks manual completion. RAM completion and manual completion remain
  separate.
- The left inventory is an icon grid. Weapon orb stages appear on the matching
  weapon icon. Inventory manual marks are session-only and never inherit
  persistent check completion. Its N/C toggle switches between Normal and
  narrow Compact layouts; this UI preference persists separately from game
  and manual-check state. In randomized Roles mode, clicking a character slot
  opens a compact role picker without changing slot presence. The large icon
  stays Boy/Girl/Sprite; a PopTracker overlay shows unknown `?` or the selected
  Boy/Warrior, Girl/Light Mage, or Sprite/Dark Mage identity. The picker has a
  separate explicit session-presence mark. Role identity is persisted with
  seed/world configuration, never written to or derived from RAM.
- The top bar derives CHECKS completed/total from the active logical check
  definitions and AVAILABLE from visible, reachable, unfinished checks only.
  Unknown, checkable-only, hidden, and completed checks are not available.
- Checks, Orbs, and Hints have independent map-layer controls. Hints are off
  by default: 16 individually identified sources are represented by 7 regional
  scroll markers, never hint contents. No exact individual coordinates exist
  in the supplied PopTracker package; the regional fallback is explicit.
  Cannons toggles offices/landings and the selected office's outgoing routes.
  Shuffle/Chaos also expose Edit Cannons: click a source office, then a
  destination. No reverse route is inferred. Select a line to remove it or
  replace its destination; Clear seed network removes all manually entered
  routes. Vanilla/Open networks are automatic and read-only.
  Gameplay markers stay visible but are passive during Cannon editing, so
  nearby check/Orb popups cannot intercept source/destination clicks.
- Click an Orb and then its requirement. Magic Only offers elements; Weapon
  Only offers weapon families; Mixed offers both. Unknown is always available.
  Selected requirements and tracker settings persist in browser local storage.
  Switching modes clears requirements incompatible with the new mode.
  An unselected requirement makes the gate and its dependent routes
  **unknown**, not blocked or definitely passable. Known unmet requirements
  block; known satisfied requirements pass but are NOT marked complete.
  Requirement indicators reuse the inventory element/weapon PNGs; Unknown
  retains its centered ?. Actual cleared/open state has a grey ✓, from RAM
  or an explicitly persistent manual mark. The popup distinguishes the
  requirement state from completion availability. Seven Grand Palace Orbs form a
  deterministic 4+3 group near their shared source coordinate.
- Settings includes Basic/Restrictive logic, Flammie Drum logic, roles,
  Crystal Orb mode, goal, disabled characters, Dungeon Map Auto/Hidden, and
  SNI device selection. A prominent Randomizer Settings String input applies
  normalized globals to the same controls; manual overrides remain available.
  Starting Location and Cannon Travel controls are included.
  Debug remains a separate drawer with all SNI/event/RAM diagnostics.

## Source data and logic

`npm.cmd run generate:map` reads the adjacent
`../SoM-Open_Mode-Tracker` package, producing `src/data/mapGroups.ts`
and `src/data/sourceWorldData.ts`. These contain original coordinates,
access/visibility tiers, 14 hosted Crystal Orbs, and 7 hint marker groups.
The explicit browser `MapArea` layer changes UI grouping without modifying
stable autotracking IDs.

Water Palace and Undine Cave are separate UI areas. The authoritative
PopTracker has one `Undine - Biting Lizard` logical check (event `0x581`)
with two reward slots, **not two independently autotracked checks**. The
Undine Cave popup states this. PopTracker gives them one regional coordinate;
the palace pin uses its original (2125,2925) anchor on the small building
behind the walkway, not Elinee's Castle at (2010,2955). Undine Cave uses
(2207,2895) at the waterfall to its east, with a (+10,-8) screen offset to
separate compact pins. Elinee's source anchor remains unchanged, with a
(-7,+3) screen offset to keep it distinct from Water Palace. The Upper Land Forest Orb uses
(1705,2325), the forest/meadow transition south of Matango: a deliberate
approximate route-gate display anchor, not an exact in-room Orb coordinate.
The three Fire Palace Orbs use screen offsets (-48,+30), (0,+30), (+48,+30)
from the palace anchor, one evenly spaced row below it. Grand Palace retains
its 4+3 arrangement. Unknown Orbs carry a centered ? overlay inside their
rounded sprite control; known requirements use the corresponding inventory icon.
Their identities and logic are unchanged.

Hint coordinate precision: **0 exact individual locations; 16 regional**.
`locations/hints.json` gives coordinates only on parent regions, not on
individual sections. `src/data/hintMarkers.ts` preserves every source ID/name
and coordinate without adding reachability rules or storing hint contents:

- Potos (2430,3200): Potos Elder Hint, Potos Forest Sign, Potos Threeway Sign,
  Beware Goblins Sign, Sign in front of Neko, Sign north of Pandora.
- Gaia's Navel (2180,3235): Gaia's Navel Sign, Flower Guy, Sign in front of
  Kippo Vilalge (spelling preserved from source).
- Water Palace (2125,2925): Water Palace Sign.
- North Town (3200,1150): Krissie, Dyluck.
- Santa's House (2625,625): Rudolph.
- Mountain (1300,2900): Mandala Village Tower, Jehk and Johk.
- Tasnica (388,3203): Tasnica King.

These fallback markers have a (+20,+14) screen offset (Water Palace: -26,-16)
to avoid covering gameplay pins, explicitly not a more precise geographic location. Multi-source
regions list only source identities; single-source popups use the source name.

Reachability is evaluated at check level from PopTracker's source access and
visibility tiers and `scripts/logic.lua` functions. OR alternatives and
inherited AND tiers are retained; bracketed optional and braced checkable
routes produce partial/checkable access. Area state derives from visible
checks after completion. Unknown Orb gates now propagate uncertainty in all
three modes. This deliberately differs from PopTracker's original Magic-only
conservative all-elements behavior; it avoids asserting blocked/passable
without the seed requirement. Weapon requirements use weapon ownership,
not Weapon Power.

PopTracker's `scripts/custom_items/character.lua` separates character state
(`0` disabled, `1` not found, `2` found) from role identity (`0` unknown,
`1` boy/warrior, `2` girl/light mage, `3` sprite/dark mage), using 32px overlay
images. Browser presence remains RAM/autotracked (or an explicit session-only
mark); `WorldState.roles` stores the independently chosen identity. The
existing global Normal/Random Roles setting applies to all slots by default;
`roleModeBySlot` receives individual `opBoyRole`/`opGirlRole`/`opSpriteRole`
values from the importer. Random/randomunique does not reveal the rolled
identity. Fixed OGboy/OGgirl/OGsprite values can assign cross-slot roles,
shown with the existing overlay while leaving slot ownership independent.

The overworld uses PopTracker's `images/overworld_map.png` at its native
4096×4096 pixels. No better authoritative map asset was found in the accepted
project sources. The square image is fitted without aspect-ratio distortion;
browser smoothing is used while downscaling and pixelated rendering at or
above native scale. The surrounding viewport is dark.

The current map ID is already read for game detection and shown in Debug.
`src/data/dungeons.ts` is the data-driven resolver for multiple room IDs per
dungeon, and `DungeonMapPanel` is conditionally mounted beside the World Map
when Auto resolves a verified dungeon. The authoritative PopTracker package
provides only `overworld` and `overworld_hints` using one overworld image;
it has no dungeon-map images or vetted map-ID-to-dungeon room sets. The
resolver therefore ships with no entries and Auto currently hides the panel.
Hidden always hides it. No fake dungeon map is displayed. Area, Orb, and hint
overlays and directed Cannon lines use one world-to-screen transform.

Current scope excludes automatic seed-specific import, Christmas Mode,
Weapon Power, LiveSplit, new dungeon maps, and deployment.

## Randomizer integration: exact local sources

The adjacent `../SecretOfManaRandomizer/SoMRandomizer` checkout is read-only.
No Randomizer files were changed. The adapter is verified against its local
`RomGenerator.VERSION_NUMBER = 1.49`, not an assumed upstream format.

- `config/ui/UiOptionsManager.cs`, `getOptionsString` / `setOptions`:
  whitespace-delimited `key=value`, version and mode, changed options only,
  omitted values reset to defaults, duplicate keys use the last value.
- `config/settings/OpenWorldSettings.cs`: exact option names, enum values,
  and defaults; `config/settings/StringValueSettings.cs`: yes/no serialization,
  case-insensitive yes/true/1 input. Unlike the source's permissive boolean
  fallback, unrecognized values are diagnosed instead of silently made false.
- `src/adapters/randomizerSettings.ts` is the sole parsing/normalization boundary.
  Errors reject the entire import without changing configuration. Unknown
  unrelated keys and source-version differences produce visible warnings.
  There is no base64 or invented flag-string encoding.

Imported mappings (case-sensitive enums):

| Source key | Source values → tracker |
| --- | --- |
| `crystalOrbWeaponBreaking` | `off` → magic-only; `on` → mixed; `weaponOnly` → weapon-only |
| `cannonTravelRandomization` | `off` → vanilla; `open`, `shuffle`, `chaos` unchanged |
| `opFlammieDrumInLogic` | yes/true/1 → in logic; no/false/0 → out of logic |
| `opStartingLocation` | default, kakkara |
| `opBoyRole`, `opGirlRole`, `opSpriteRole` | random/randomunique → randomized slot; OGboy/OGgirl/OGsprite → fixed role |
| `opLogic` | basic, restrictive |
| `opGoal` | vshort → short; vlong → long; mtr → revive |
| `opNumSeeds` | fixed 1–8 → required Revive seed count; random needs manual resolved-count entry |

Christmas goals and random `opNumSeeds` are rejected, not approximated.
No rolled Orb requirements, roles, or Cannon routes are invented by import.
Seed configuration survives compatible imports; incompatible Orb requirements
are cleared under the existing explicit mode-switch rule.

### Orb completion evidence

PopTracker provides requirement/passability logic, not actual Orb completion.
The Randomizer's `processing/common/EventFlags.cs`,
`processing/common/ElementSwaps.cs` (event checker/success paths),
`processing/openworld/events/OpenWorldSupportingEvents.cs` (success mutations),
and `processing/openworld/events/InitialEventFlagStates.cs` (open-state thresholds)
provide all 14 persistent cleared/open signals:

| Orb | SNES WRAM byte | Cleared/open when |
| --- | --- | --- |
| Earth Temple | `0x7ECF18` | ≥ 2 |
| Upper Land Forest | `0x7ECF20` | ≥ 4 |
| Matango Cave | `0x7ECF24` | ≥ 4 |
| Fire Palace 1 | `0x7ECF2C` | ≥ 1 |
| Fire Palace 2 | `0x7ECF2B` | ≥ 1 |
| Fire Palace 3 | `0x7ECF2B` | ≥ 4 |
| Moon Palace | `0x7ECF3B` | ≥ 2 |
| Grand Palace 1–7 | `0x7ECFE8`–`0x7ECFEE` | each ≥ 1 |

`InitialEventFlagStates.cs` explicitly documents Fire Palace 2/3 sharing
different thresholds. Temporary element-check flags `0x98`–`0x9F` are ignored.
`processing/hacks/openworld/CrystalOrbWeaponBreaking.cs` preserves the original
post-check success script, so magic/mixed/weapon paths use the same signals.
The reader performs one usb2snes read at `0xF5CF18`, length `0xD7`, and diagnoses
short/failed reads without stopping checks, inventory, detection, or future polls.

These signals reliably indicate an open gate in the inspected source, not
proof of the player's personal activation: the seed can preinitialize them for
bypassed/removed Orbs. None of the 14 needs an invented completion flag.
Manual clearing remains a persistent fallback; RAM values themselves are not
persisted and roll back with a save state. Real activation on the running seed
still needs the live checks below.

### Cannon topology and alternate start

`processing/openworld/cannon/CannonTravelModel.cs` is authoritative for seven
offices, nine landing targets and `getVanillaRegionNetwork()` (14 directed
routes, copied in `src/domain/cannons.ts`). Water Palace and Pandora are landing
targets without offices. `resolveAndStore(Open)` offers every landing except
the source office's home: **56 deterministic directed edges**, not merely a
seven-office complete graph. No seed-specific entry is needed in Open mode.
The map draws outgoing routes for one inspected office, at most eight in Open,
not a 56-edge mesh. Positions are approximate world/region anchors, not exact
in-room Cannon/landing coordinates.

`CannonTravelRegions.cs`, `OpenWorldSimulator.cs`, and `PrizeLocation.cs` define
region ownership, reachable-source traversal and replacement of old coarse
continent locks while retaining local gates. Vanilla + Default keeps the
existing PopTracker evaluator. Non-Vanilla or effective Kakkara uses the
region solver, matching the Randomizer's `useCannonRegionModel` condition.
Flammie access is separate: in logic requires the Drum; out of logic treats
Flammie as available in this source region model. Only known directed routes
contribute in Shuffle/Chaos; unentered routes are not guessed.

`processing/openworld/OpenWorldStartingLocation.cs` enables Kakkara only with
Drum in logic and a non-Christmas goal. Kakkara replaces the Potos initial
frontier. Selecting it with Drum out of logic retains the override but shows
effective Default and an import warning. `CannonTravelRegions.cs` explicitly
permits Upper Land ↔ Matango walking when the UF gate opens; both directions
are modeled, independently of Cannon direction. Axe is a separate local
Matango-entry dependency (Axe OR Flammie for its chest), not a requirement
invented on that walking edge.

Configuration now uses `som-web-tracker:world-state:v2`, migrating v1 while
preserving requirements, role identities and settings. Manual Orb marks and
directed routes are configuration, never RAM; CHECKS remains 68 logical checks
and AVAILABLE still excludes unknown/checkable/complete checks.

## Assets and font

Selected PNG assets are imported from the adjacent PopTracker package during
the Vite build; that package must remain alongside this project. Its MIT
notice is copied to `public/POPTRACKER_LICENSE.txt`.

The unmodified `manaspc.ttf` was obtained from codeman38's/zone38's
[Manaspace author page](https://zone38.net/font/) and bundled at
`public/fonts/manaspc.ttf`. Its accompanying `public/fonts/license.txt`
permits bundling in free or commercial software, prohibits resale as a
commercial font collection, and requests attribution. The font is used
selectively for title, area headings, and short map labels; normal UI text
uses the system font.

## Verify

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

For a live regression:

1. Start SNI with the Snes9x Lua bridge and a Secret of Mana Open Mode seed.
   Start the tracker, select the attached device in Settings if needed, and
   confirm **SNI Connected** and **Game Detected**.
2. With a pre-chest save state, hover Potos. Confirm Potos Chest is incomplete
   and Spear unowned on a seed that puts Spear in the chest. Open it; confirm
   the check completes and Spear is acquired. Restore the save state; both
   automatic values should roll back.
3. Click Potos Chest in the popup to mark it manually, reload the page, and
   confirm its `M` remains while Spear still follows RAM. Click again to
   undo the manual mark.
4. Verify a Mantis Ant no-item event still completes by execution pointer.
   Open Debug to inspect event strategies, resolved flags, RAM, and any
   entity error. Disconnect/reconnect SNI and confirm polling resumes.
5. Check Water Palace and Undine Cave appear as two separate pins. Change
   Logic Basic/Restrictive and confirm Water Palace seed access reacts to
   Water Seed. Undine Cave should be east/right of Water Palace and continue
   to show only the event `0x581` check.
6. With Upper Land Orb still `?`, confirm the Orb and dependent areas show
   unknown, not blocked, and AVAILABLE excludes those checks. Set Axe as its
   requirement: without Axe the gate blocks; with Axe it passes, and the
   corresponding available count changes. Verify the Orb selection survives
   reload and all seven Grand Palace Orbs remain individually clickable in
   their aligned group.
7. Toggle Normal/Compact inventory at the intended OBS capture size. Confirm
   icons, weapon stages, and role overlays remain usable and no inventory or
   check state changes. Confirm the preference survives reload.
8. Compare the CHECKS and AVAILABLE counters while completing/rolling back
   a RAM check, manually completing a check, and leaving an Orb gate unknown.
   Check that counts match the popup states.
9. Set Dungeon Map Auto/Hidden; with the current source package, neither mode
   should show a fabricated panel. Observe current map ID in Debug.
10. Turn Hints on, inspect source labels, and confirm no hint contents appear
   or affect reachability. Recheck the browser view at the OBS capture size.

For this phase's live verification:

1. Copy the actual options string from the matching local Randomizer, import
   it in Settings and compare its Orb/Cannon/Drum/start/per-slot role values
   with the normal controls. Review warnings for ignored options. Override
   one control manually; the map must immediately respond. Unsupported goals
   or random required-seed counts need manual setup, not fabricated imports.
2. With a save state before an active Orb, inspect its raw WRAM value and
   threshold in Debug. Enter its actual requirement. Owning that requirement
   may make it passable, but must not create a grey completion ✓. Activate the
   Orb in game: its persistent flag must reach the table's threshold and its
   marker become cleared/open. Restore the save state: RAM completion must
   revert. Repeat on the current seed across Earth/UF/Matango/Fire/Moon/GP;
   Fire Palace 2/3 must distinguish shared-byte thresholds 1 and 4. A seed-
   preopened Orb is correctly reported open without a player activation.
3. Mark an Orb cleared manually, reload and restore the earlier save state:
   manual clearing persists while inventory still follows RAM. Undo the
   manual mark to return to RAM-derived completion. Disconnect the emulator:
   unknown Orb reads must not claim that a gate is definitely closed.
4. With Drum in logic, no Drum and Kakkara + Shuffle/Chaos selected, a new
   empty network must not grant Potos access. Enter the actual observed route
   Kakkara → Matango, then test UF Unknown / known blocked / known passable.
   Potos remains inaccessible unless a known directed route from the reached
   Upper Land side leads back there. Vanilla's fixed UF-side return routes
   are supplied automatically. Restore Default and compare the start frontier.
5. Enable Cannons and Edit Cannons; add a source → destination, select its
   exposed line or focus it and press Enter, remove, replace and clear routes.
   Verify each change adjusts AVAILABLE, never invents a reverse route, and
   manual routes survive reload. Turn editing off to interact with gameplay
   markers again. Pan/zoom and repeat at the OBS capture size.
6. Select Open: it supplies eight destinations per office automatically and
   draws only the inspected office's routes. Verify Flammie access still
   bypasses continental Cannon travel independently, with local Orb/weapon/
   seed requirements retained. CHECKS remains 68, and unknown reachability
   never contributes to AVAILABLE.

Automated verification for this phase: 172 tests in 20 files pass, TypeScript
typecheck passes, production Vite build passes. The mock WebSocket suite
includes Orb completion/rollback, failed Orb-read isolation/recovery, and the
existing Potos/Mantis/inventory regressions. Desktop 1280×720 and Compact
960×540 browser reviews verified import controls, icons, editing and
shared pan/zoom; screenshots are in `verification/`. Real SNI was reachable
but no emulator device was attached during this review, so the new Orb
signals have source/mock verification, not a claimed live activation pass.

Phase file inventory (paths relative to this project):

- New source: `src/adapters/randomizerSettings.ts`,
  `src/autotracking/OrbAutotracker.ts`, `src/data/orbCompletion.ts`,
  `src/domain/cannons.ts`, `src/logic/travel.ts`, `src/ui/CannonLayer.tsx`.
- Modified source: `src/App.tsx`, `src/autotracking/Autotracker.ts`,
  `src/logic/reachability.ts`, `src/state/trackerState.ts`,
  `src/state/worldState.ts`, `src/styles.css`, `src/ui/assets.ts`,
  `src/ui/DebugPanel.tsx`, `src/ui/ItemPanel.tsx`, `src/ui/mapTransform.ts`,
  `src/ui/SettingsPanel.tsx`, `src/ui/WorldMap.tsx`.
- New tests: `src/adapters/randomizerSettings.test.ts`,
  `src/autotracking/OrbAutotracker.test.ts`, `src/domain/cannons.test.ts`,
  `src/logic/travel.test.ts`, `src/ui/functionalPhase.test.tsx`.
- Extended tests: `src/autotracking/SniClient.test.ts`,
  `src/state/worldState.test.ts` (v2 key assertion and actual v1 migration).
- Documentation/evidence: `README.md`,
  `verification/orbs-cannons-desktop.jpg`, `verification/orbs-cannons-compact.jpg`,
  `verification/settings-import-compact.jpg`, `verification/cannon-edit-compact.jpg`.
- Regenerated output: `dist/` production assets and TypeScript build metadata.
  No dependency/toolchain changes or Randomizer writes were needed in this phase.
