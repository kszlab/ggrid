# Two-ball library v1

GGrid v0.12.97 introduces a separate, pre-generated two-ball library. It does not modify the existing one-ball `puzzle-v2` packs or calibration.

The first library contains 240 solver-verified levels: 4 levels for every combination of the six supported board sizes (3x3, 4x4, 5x5, 5x6, 5x7, 5x8) and D1-D10. Every stored starting state has an optimal Freeze-free solution found with the real `game-core.js` physics.

The provisional `puzzle-v3-multiball` signal intentionally stays simple. It combines optimal solution length, the extra moves above an obstacle-free two-ball baseline, direction changes, setup moves, retreat moves, conflict moves where one ball improves while another worsens, how late the first ball exits, and whether the first exiting ball is not the geometrically nearest ball at the start.

Classes are calibrated separately for each board size by sorting a deterministic solved candidate pool and splitting it into ten bands. This mirrors the size-specific calibration approach already used by the one-ball library, but the two models remain separate so the new weights and boundaries can be adjusted after play-testing without changing the established one-ball classes.

Regeneration:
`node tools/build-multiball-library-v1.mjs`

Independent analysis:
`node tools/classify-multiball-level.mjs <level-or-pack.json>`

The runtime keeps the two-ball mode unscored for now. Hint and automatic solution use the stored optimum at the initial state and the bounded runtime solver after the player deviates from it.
