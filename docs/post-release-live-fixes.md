# Post-release live audit and Broadcast view

Date: 2026-10-20. Existing Randomizer/PopTracker checkouts were inspected read-only.
No Randomizer, ROM, event IDs, prize flags or saved check IDs were modified.
The public deployment remains unchanged until these local commits are reviewed.

## Evidence boundary

The user reports a successful real-emulator SNI session from the public HTTPS
site. This pass found SNI running but `DeviceList` returned an empty array, so
it cannot independently reproduce that session or inspect its original bytes.
Source-backed/mock regressions are not claimed as a new real-emulator test.

The exact live Settings String is preserved in `src/testFixtures/liveSettings.ts`.
It supplies no rolled additional-character identity, shuffled spell permutation,
Orb identity or resolved Chaos network. Those outcomes must not be guessed.

## Girl: physical presence is not an acquisition flag or a class

Previous inventory definitions treated `$7ECF0C..0E` as authoritative character
presence. Those are the PopTracker acquisition/event flags; `SwordGrabEvent.cs`
sets them as part of initialization and `OpenWorldPrizes.cs` increments them
when characters are awarded. A zero event byte could erase a correctly
configured starting Girl in the UI, and all-zero flags blocked game detection.

`StartingCharacterRandomizer.cs` documents the native `$00D9` initialization:
Boy uses 01; Girl writes 02; Sprite writes 04. Its native character structures
remain physical Boy/Girl/Sprite, with stats at `$7EE180/$7EE380/$7EE580`
(`Autosave.cs` independently lists the saved structures and `$7E00D9`).
CharacterClasses changes casting roles separately; it does not reorder physical
identities. The tracker now reads `$7E00D9` bits 1/2/4 for live presence and
keeps `$CF0C..0E` as diagnostics, not an ownership override.

This corrects the demonstrated pipeline mismatch, including pre-event
initialization, reconnect and rollback, without forcing configuration over a
valid native absence. No party identity is guessed from spell roles. The old
session's raw bytes were not supplied, so the exact moment its flags diverged
cannot be proved retrospectively.

Party reads are isolated from the existing small event/inventory block; a
failed party read does not erase weapon/seed/element results or expand reads
into a 53 KiB WRAM block. Disconnected/unknown RAM still uses the existing
configured-start/manual fallback; valid native presence remains authoritative.

## Element identities: correct flags, distinct presentation order

`scripts/autotracking/items/magic.lua`, `EventFlags.cs` and the named prize
flags in `OpenWorldPrizes.cs` agree. No Gnome/Undine RAM swap was justified.
Canonical UI order now follows the user-confirmed order, independently of RAM:

| UI index | Element | Event-flag WRAM | Offset in A8–AF |
| --- | --- | --- | --- |
| 0 | Undine | 7ECFA9 | 1 |
| 1 | Gnome | 7ECFA8 | 0 |
| 2 | Sylphid | 7ECFAB | 3 |
| 3 | Salamando | 7ECFAA | 2 |
| 4 | Shade | 7ECFAD | 5 |
| 5 | Lumina | 7ECFAC | 4 |
| 6 | Luna | 7ECFAE | 6 |
| 7 | Dryad | 7ECFAF | 7 |

Positive flag = acquired, zero = absent. The same stable IDs select icons,
Orb requirements and logic; imported/manual identities are strings, not indices.
Do not confuse these flags with native learned spell-byte order. In
`SpellShuffleAssignments.cs`, learned-slot family order is Gnome, Undine,
Salamando, Sylphid, Luna, Dryad, Shade, Lumina. Learned bits belong to a physical
caster, and shuffled actual effects are seed-owned permutations.

The importer previously ignored `spellShuffle=perCharacter`, incorrectly
applying vanilla caster rules (e.g. Undine Orb needs Sprite role) even though a
Girl's shuffled effects may activate that family. Spell Shuffle is now imported
and persisted. Missing spirit ownership is a known block; an owned spirit with
a present magic caster is Unknown until the seed-specific Orb-compatible
effect assignment is known. The tracker does not pretend to decode or import
those permutations. Authoritative/manual Orb clear remains passable regardless
of ownership/caster availability. Off-mode casting rules remain unchanged.

## Weapon identities: correct native indices, reordered display only

PopTracker `weapons.lua`, `OpenWorldPrizes.cs` and its explicit ownership flag
arguments agree. Ownership is positive/zero; weapon Orb stages are independent.

| UI index | Weapon | Native index | Ownership WRAM | Orb stage WRAM |
| --- | --- | --- | --- | --- |
| 0 | Sword | 1 | 7ECFC9 | 7ECFB9 |
| 1 | Spear (Lanze) | 3 | 7ECFCB | 7ECFBB |
| 2 | Glove / Claw | 0 | 7ECFC8 | 7ECFB8 |
| 3 | Boomerang | 6 | 7ECFCE | 7ECFBE |
| 4 | Bow | 5 | 7ECFCD | 7ECFBD |
| 5 | Axe | 2 | 7ECFCA | 7ECFBA |
| 6 | Whip | 4 | 7ECFCC | 7ECFBC |
| 7 | Javelin (Speer) | 7 | 7ECFCF | 7ECFBF |

Spear/Javelin and Boomerang/Bow retain distinct flags, icons, stable IDs and
manual Orb identities. The display and Orb picker share canonical ordering;
the raw definition table retains its explicit native addresses.

## MTR: existing importer/dropdown repaired, not duplicated

The exact live export omits `opNumSeeds` while specifying min=5/max=7. The old
parser fell back to the inspected source's default fixed 8, so it ignored those
bounds. As requested, an explicit bounds-only export is now interpreted as an
unresolved range with a diagnostic explaining that interpretation. An explicit
fixed `opNumSeeds` still wins. Without bounds/explicit random, the source
default remains 8; `random` without bounds offers the full 1–8 range.

`OpenWorldMtrSeedNumSelection.cs` confirms inclusive limits and clamps min to
max when reversed. Equal bounds resolve a fixed count. The inventory displays
the range until manually resolved; Reset removes the override, not the imported
definition. Seed acquisition remains RAM/session inventory, not configuration.
Reload and Manual Tracking reset preserve configuration; New Seed Reset clears
it. A changed imported requirement clears a stale resolution. Identical settings
strings cannot distinguish two seeds: use New Seed Reset when changing seeds;
no fingerprinting or hidden synchronization was added.

## Moon Palace: separate the actual gates

Stable check is `moon-palace-seed`, event `584`; Orb is `mp_orb`. Existing
persistent clear mapping remains `$7ECF3B >= 2`, not temporary checker flags.
No Orb threshold, event or prize mapping was changed.

`evaluateOrbTraversal` already bypassed casting/ownership for RAM/manual clear.
Full inventory + valid Flammie travel + cleared Moon Orb reproduces reachable,
not red. Therefore the report does not justify forcing the area green or
swapping a flag. `CannonTravelRegions.cs` consults
`OpenWorldPrizes.flammieRequiredLocations`, which explicitly includes both
Luna prizes. A Chaos route to Kakkara does not replace this Flammie-only gate.
`OpenWorldLocations.cs:115–116` independently requires Moon Seed in Restrictive
logic, but not Basic. Either missing gate can legitimately remain red after
Orb clearance. The original session's raw Orb flag, Drum/Moon Seed bytes and
tracker configuration are missing, so its exact red dependency is unresolved.

The source-backed correction removes the false vanilla caster certainty under
Spell Shuffle; it does not remove genuine travel/seed gates. Debug now shows
each Moon gate, physical party mask, identity/presence/role and shuffle mode.
This makes the original case actionable without resetting its completed save.

Fire Palace's four checks and all 14 clear mappings remain unchanged: FP1;
FP1+FP2; FP1+FP2; FP1+FP2+FP3+Whip, with Fire Seed only in Restrictive. Known
blocks still dominate unknowns; RAM-cleared Orbs stay passable through rollback.

## Broadcast and live retest

Broadcast reuses ItemPanel, its exact state/callbacks and the existing SNI
subscription. It renders five icon rows on #000000 with no capture chrome.
Normal/Compact/Square remain unchanged apart from canonical ordering/MTR labels.
Choose B or `?view=broadcast`; N/C/S/Escape exits without an in-capture control.
The preference uses the existing v1 store; OBS profiles may have separate
storage/connections. Manual session marks do not synchronize between tabs.

Retest with the exact live string and the already completed save:

1. Connect SNI, enter the game, open Debug. Compare native party mask with
   physical icons; Girl bit 02 must not depend on a Sprite/Boy role assignment.
2. Inspect element raw event flags individually; do not index by icon position.
3. Inspect Moon Palace's Flammie-only travel, Orb traversal and Restrictive
   Moon Seed factors, plus `$CF3B`. A cleared Orb must be passable even if the
   former caster/spirit disappears. Record the precise remaining blocker.
4. Reconnect/load earlier states without writing memory: party, inventory and
   Orb RAM should revert; permanent manual completions/configuration should not.
5. Test FP1 exactly as in the user's successful run; its missing requirement
   still blocks the first chest. Test all four layouts and MTR selection/reset.
6. In OBS use 280×180, confirm black margins and all five categories; use
   Interact and N/C/S/Escape to exit. Verify that source's own settings/SNI,
   rather than assuming another browser tab has synchronized them.

## Verification results

- Complete Vitest run: **460 tests / 38 files passed**, including the retained
  402-test baseline and 58 focused additions. Command:
  `npm.cmd test -- --maxWorkers=2 --pool=threads`. One earlier run hit the known
  Windows worker-startup timeout; the unchanged retry passed with no global
  test configuration change. Test-fixture corrections preserved the intentional
  no-magic bypass rather than changing production logic to satisfy a fixture.
- TypeScript typecheck, production build (95 modules) and the existing
  base-path check (34 asset references): passed. All 35 emitted files were
  available from the local production preview under `/SoM-Web-Tracker/`.
- All 16 named bundled element/weapon images match the corresponding existing
  PopTracker files byte-for-byte; no assets were replaced or downloaded.
- Visual browser QA: Normal 1280×720, Compact 960×540, Square 960×540 and
  1280×720, Broadcast 280×180 and 320×240. Broadcast has 32 item buttons and a
  270×168 icon panel; the 280×180 document has equal client/scroll dimensions,
  pure-black background and no headings/map/footer/GP chrome. The fourth
  button fits Compact after a small heading-size correction.
- The exact live string, 5–7 options, count override/Reset, reload persistence,
  canonical ordering, Girl configured fallback, native dropdown opening,
  shared manual item changes, direct Broadcast URL, keyboard exit and returned
  layout persistence were checked in the built browser app. No broken images
  or captured console warnings/errors. Real SNI-driven updates/rollback and
  socket reconnect are covered by protocol mocks, not claimed as new live tests.
- Screenshots are local-only in ignored `tmp/verification/post-release-*.jpg`.
  The supplemental party read has independent failure handling; its absence
  does not suppress otherwise-valid shared game detection.
- GitHub Pages workflow/base path, SNI protocol, event/check IDs, all 14 Orb
  mappings, Sandship 76/77 compatibility, license notices and game assets were
  left unchanged. No push or release tag is part of this pass.
