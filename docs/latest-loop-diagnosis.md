# Latest loop diagnosis (2026-10-11)

Scope: three seeds (20261011, 1, 11), two short policies, at most 600 ticks each. No broad sweep or balance adjustment. Presence strength 2, threshold 1.5 and recovery 240 ticks remain unchanged.

| Seed | Initial legal / 609 interior samples | Legal outside old left strip | Focus-left conquest | Plants used | Cards left |
| --- | --- | --- | --- | --- | --- |
| 20261011 | 461 | 356 | 25.1 game seconds | 10 | 8 |
| 1 | 487 | 382 | 18.2 game seconds | 9 | 9 |
| 11 | 470 | 365 | 17.2 game seconds | 8 | 10 |

World point (4,4), between the initial enemies and outside the old strip, is legal in all three seeds. Initial choices are not restricted to the left edge. Field openness and physical/resource placement validity are reported separately: a finished run or exhausted charges can forbid a placement even while the enemy field is open.

The focus-left policy chooses legal positions near the leftmost surviving enemy, rewards immediate damage to that enemy, and penalizes incoming damage. The nearest-only policy still had 3/5/4 enemies and no living allies at 60 seconds. Those runs remained playing with cards left and can recover placement charges later; they are not classified as losses. This small comparison establishes reachable conquest and consequential positioning, not universal balance or human enjoyment.

Native isolated Edge 154 checks at 1366x768 and touch-emulated 390x844 reproduced all three focus-left conquests (same ticks, placements and remaining cards). Each viewport first placed at (4,4). Event skip stopped at destruction, recovery and completion; enemy deaths changed sampled forbidden points into open points (361/338/360 cumulative samples across the three runs). Screenshots were inspected for release and mobile conquest. The mobile runner explicitly opens the settings pane and asserts seed/tick reset, preventing hidden-control clicks from silently reusing a finished run. This is touch emulation, not a physical-phone test.

Understanding fixes: the next-placement hint now says to choose low-presence space rather than connect territory. Paused guidance refers to choosing plants and checking range/targeting. Friendly placement no longer produces a territory-claim pulse; enemy-death release still does. Removed a retired friendly-area forecast loop whose contradictory condition always returned zero. Simulation rules, save formats and balance values are unchanged.

Validation: 67 tests passed; production build passed (existing Phaser bundle-size advisory). Evidence: docs/evidence/loop/short-diagnosis.json and browser-check.json. Reproduce after npm test with node scripts/short-loop-diagnosis.mjs OUTPUT_JSON and node scripts/loop-browser-check.mjs OUTPUT_DIRECTORY (local dev URL :8781 and installed Edge).

Next feedback should focus on whether a human notices safe insertion locations and understands why concentrated attack succeeds while proximity alone fails. P/X and recovery timing remain feedback-pending. No new abilities were added; no push, publication, Unity startup, or old-project modification was performed.