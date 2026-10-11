# Placement visibility / input QA (2026-10-11)

Minimal changes: bind pane-switch handling to `.tabs button[data-pane]`, and replace the old Area rejection with the short summed-presence threshold reason. No rules, balance values, save formats, or extra help panels changed.

Reproduced defect: the old `[data-pane]` query also matched `<main data-pane="board">`. A bubbled control click ran the pane handler, cancelled the gesture and cleared the stationary placement preview. At tick 239, zero-charge preview correctly rejected placement; after a recovery tick, this unrelated pane handler erased the position. Restricting the listener to actual tabs lets the same point update immediately after recovery/death. Real pane changes still clear previews and gestures.

Lightweight isolated Edge 154 checks at 1366x768 and touch-emulated 390x844:

- Summed-presence threshold, overlap outside the selectable body, seed-circle crossing board bounds, and zero-charge rejection match `validatePlacement` text and invalid style; unavailable forecasts stay hidden.
- Rejected native taps leave the action count unchanged. Legal taps add exactly one action.
- Zoom and pan preserve the legal world point and clear an obsolete drag preview.
- A validated snapshot fixture isolates tick 239 -> 240 recovery; another bounds-valid fixture sets one enemy to 1 HP, isolating a single death. Focused tick controls activated with native Enter input while the pointer stays still. Same-position previews change from invalid to valid; subsequent native taps succeed.
- The mobile pane switches and returns correctly; main has no pane-switch click handler.

Snapshots use the actual seed/inventory/stats/origin positions and pass `replay` validation. Recovery charges and enemy HP are controlled QA fixtures rather than an organically played conquest. Mobile input uses touch emulation, not a physical phone. The QA helper waits for its own automatic scroll to settle before taking screen coordinates: an earlier mobile mismatch was a moving-viewport test error, and actual PointerEvent coordinates agreed with the game's verdict.

Regression evidence is in `docs/evidence/placement/`. Reproduce after npm test with `node scripts/placement-browser-check.mjs OUTPUT_DIRECTORY` against the existing dev server on :8781 and installed Edge. Unit coverage additionally verifies rejection when each enemy's presence is individually below threshold but their sum exceeds it, then acceptance after death.

Validation: 67 unit tests pass; production build passes (existing Phaser bundle-size advisory). No sweep, new abilities, installation, publication, push, or Unity work.

Next remaining decisions: human first-play feedback on recognizing safe insertion and target choice; P/X/recovery balance remains pending. Public URL hosting and actual-phone browser verification remain separate delivery work requiring the agreed destination/access. No further rule/UI expansion is needed to complete this QA request.
