# Secret of Mana Web Tracker

A local, browser-based tracker for Secret of Mana Randomizer Open Mode.
The world map is the primary surface, with compact inventory, reachability,
check counters, and SNI autotracking. No ROM or emulator is bundled.

## Requirements and local setup

- Node.js 22.18+ (or a current supported release) and npm.
- A modern desktop browser.
- For autotracking: SNI with its usb2snes-compatible WebSocket service,
  Snes9x connected through SNI's Lua bridge, and your own Open Mode ROM.

From a clone of this repository:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite. The normal Vite default port is unchanged;
an optional command-line override is `npm.cmd run dev -- --port 5174`.
On non-Windows systems use `npm` instead of `npm.cmd`.

All required images, fonts, generated data, and test fixtures are included.
No sibling PopTracker or Randomizer checkout is needed.

## Connect SNI

1. Start SNI and its WebSocket service at `ws://localhost:23074`.
2. Load your randomized ROM in Snes9x and run the Lua bridge supplied with
   your SNI/Snes9x setup. Confirm that SNI lists the emulator device.
3. Open the tracker. It discovers devices and attaches automatically;
   select a different device under **Settings → SNI device** if necessary.
4. Enter the game. The header should show **SNI Connected** and **Game Detected**.
   Use **Debug** for memory readings and isolated subsystem/check errors.

To use a different endpoint, set `VITE_SNI_ENDPOINT` before starting Vite.
The tracker reads emulator memory; it does not write game state.

## Using the tracker

Tracks 76 independent standard checks (76 event bindings), 40 inventory values,
and 14 persistent Crystal Orb cleared states. Check counts refer to underlying
checks, not reward slots. Water Palace and Undine Cave are separate areas;
Undine's Biting Lizard is one check with two reward slots.

Drag the map, scroll to zoom, or use **Fit**. Hover/focus a marker for details;
click to pin its popup. Green means reachable, amber partial/unknown, red
unreachable, and grey complete. AVAILABLE counts reachable unfinished checks,
not unknown or checkable-only checks. Hints show regional sources, not contents.

The inventory **N/C** toggle selects Normal or narrow Compact stream layouts.
Weapon numbers are weapon-orb stages, not weapon power. Settings and layout
preferences are stored in this browser. They are not isolated by ROM/seed:
review or reset manual entries when changing seeds.

## Randomizer Options String

Paste your Randomizer Options/Settings String into the prominent import field
in **Settings**, then choose **Import / Apply**. Mappings are verified against
Randomizer 1.49. Omitted options use that version's defaults; imported values
appear in the ordinary controls and remain manually adjustable.

Success feedback is short. Parser warnings are tucked into optional diagnostics;
malformed tracker-relevant values remain visible errors and apply no changes.
`spoilerLog` and `opStartGold` are silently ignored. Import does not discover
seed-specific Orb requirements, Cannon routes, or rolled character roles.

## Crystal Orbs and travel

- **Magic Only / Mixed / Weapon Only:** click an Orb to enter its known element
  or weapon requirement. Requirements, ability to break the Orb, and its actual
  cleared state remain separate. RAM clearing follows save states; an explicit
  manual cleared mark is permanent until undone.
- **Vanilla Cannons:** the fixed source network remains in logic; the optional
  layer shows offices without editing or a route mesh.
- **Open Cannons:** automatic deterministic travel, without a 56-edge display
  or route-selection UI.
- **Shuffle / Chaos:** enable **Cannons**, hover/click an office for its compact
  local controls. Choose **Add route**, then a destination in that popup or on
  the map. Replace/remove outgoing routes at the office; clicking a visible
  route directly removes only that directed edge. All entered routes stay
  visible; reverse routes are never inferred. Hover an office to highlight
  outgoing/incoming routes, or hover/focus a line to highlight its endpoints
  and dim unrelated routes. Cancel with **Esc** or the local **Cancel** button.
  The footer contains helper text only. Gameplay markers are temporarily
  passive only while choosing a destination.
- **Chaos Closed:** click an office and choose **Mark Closed**. A small × marks
  it. Closed contributes no outgoing traversal; Unknown means no confirmed
  route, not Closed. Unmarking restores retained known routes. Adding a route
  reopens that office. **Settings → Cannon network fallback → Clear seed network**
  removes entered routes, not Closed marks. This fallback is collapsed by default.
- **Kakkara start:** becomes effective only with Flammie Drum **In logic**, as
  in the Randomizer. Unknown Cannon routes never invent travel.

## Characters: availability versus roles

`opStartChar` imports Boy, Girl, Sprite, or unresolved Random. `opCharacters`
imports starting/findable/nonexistent party configuration, including Level 1
versus Current Level joins. The default is Boy plus both others findable at Level 1.

`start1only`, `start1find1`, `find1L1`, and `find1CL` roll which additional slot
is selected. That identity is not encoded in these options. Identify it with
the small Settings selector; Random starting identity has its own selector.
Plando may override this configuration and is not imported.

Availability badges: **S** configured starting party, **F** findable, **×** absent,
**…** unresolved seed identity. Tooltips explain the state and join level.
Offline, a known configured starting party is initially present. Findable is
not owned until obtained or explicitly session-marked; absent is never assumed
obtainable. Valid live RAM presence overrides configuration and session marks.

Role overlays remain separate: the large icon is the physical character slot;
the existing **?** overlay means an unidentified randomized role, not uncertain
existence. Click a randomized slot for its role picker. Boy/Girl/Sprite
assignments drive existing caster logic without changing availability.

## Save states and manual marks

RAM checks, Orb clearing, and inventory revert when loading an earlier save
state. Clicking a check row adds/removes a persistent manual completion;
effective completion is RAM OR that permanent mark. Inventory does not inherit
permanent check completion. Item manual marks are session-only; valid live
character presence remains authoritative. Local configuration, routes, Closed
marks, role identities, and Orb requirements persist. World schema v3 safely
migrates v1/v2; intentionally retained legacy completion keys remain supported.

## Independent chest audit

Bundled PopTracker `locations.lua` maps separate events with `clearAll=false`:

| Group | Independent chest events | Area total |
| --- | --- | --- |
| Pandora king room | 673, 67c, 683, 684, 685, 686 | 8 (six chests + two other checks) |
| Moogle Village | 670, 676 | 2 |
| North Town Castle double chest | 679, 68f | 5 (pair + three other checks) |
| Elinee's Castle chests | 688, 689 | 2 |
| Undine Cave | 581 only (`clearAll=true`) | 1, with two reward slots |

Event numbers are hexadecimal. Numbered chest labels identify source events,
not inferred physical sides or randomized contents. These splits increase
logical checks from 68 to 76 without adding event bindings. Each chest inherits
its original source access/visibility rules and tracks independently through
RAM rollback or manual marking. An old permanent group completion migrates
to all of its child chests; an individual child can then be undone separately.

Clarified titles retain the original IDs/events: **Kakkara NPC - Sea Hare Tail
Trade** describes the access requirement, not a guaranteed reward.
**Tropical Town After Boss - Stove** is event 38c, the stove prize unlocked
after Boreal Face. Source file/line evidence is in `source/provenance.json`.
No suitable accepted Cannon artwork exists in the bundled assets, so the
existing arrow symbol is retained. Display-only marker offsets separate
Gaia's Navel office and Joch's Cave/Doppelgangers; Upper Land's Orb sits lower,
left of Sprite Village. Gameplay mappings and travel regions are unchanged.

## Verification and limitations

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

The included source snapshots also support `npm.cmd run generate:map`.
No automatic seed-specific Orb/Cannon import, settings/plando file import,
LiveSplit, Christmas Mode, additional dungeon maps, or weapon-power tracking.
Regional coordinates and travel logic are approximations, not emulator room maps.
Live SNI/emulator compatibility and seed-specific event shapes still need live
validation. Faults in one tracked entity do not stop other subsystems.

## Credits and licenses

- Accepted SoM-Open_Mode-Tracker assets and data by Cyb3R and contributors;
  bundled unchanged images are in `src/assets/poptracker`, source snapshots in
  `source/poptracker`. The package MIT notice is preserved in
  [POPTRACKER_LICENSE.txt](public/POPTRACKER_LICENSE.txt).
- Secret of Mana Randomizer behavior informed the mappings, notably
  `OpenWorldSettings.cs`, `OpenWorldCharacterSelection.cs`, and Cannon travel
  models. No Randomizer checkout is required or modified.
- Manaspace by codeman38 / zone38; font and its original redistribution terms
  are bundled in [public/fonts](public/fonts/license.txt).
- Secret of Mana and underlying game artwork belong to their respective owners.
  The PopTracker package notice is not a guarantee of rights to underlying game
  artwork; review that provenance before public distribution.

The tracker application's own license has not yet been selected. Choose one
before presenting this repository as an openly licensed public release.
