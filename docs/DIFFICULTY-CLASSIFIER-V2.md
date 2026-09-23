# GGrid Puzzle v2: reproducible difficulty classification

The independent executable is `node tools/classify-level.mjs content/levels/packs/classified-v2-3x3.json --json`. It imports the actual `js/game-core.js` `step()` and `validateLevel()` functions, finds a shortest solution by breadth-first search, and reports the class, raw score, complete solution and structural metrics for each level. A single Level Data Model v2 JSON file also works. For original built-in levels, use `node tools/classify-level.mjs --all --json`; this returns an exit status of 1 when it encounters levels classified as trivial. The classifier rejects Freeze resources, so these classes describe Freeze-free levels only. The search limits are 50,000 states and 40 moves; exhausted searches are marked `search_limit`, never assigned a grade.

## Structural exclusion

Let `L` be shortest solution length, `B` the Manhattan distance from ball to exit plus the exit move, `detour = L − B`, `setup` the number of optimal moves that move other objects without moving the ball, and `constraint = 1 − feasible direct routes / geometrically shortest routes`. Then

`challenge = 0.45·clamp(detour/2) + 0.35·clamp(setup) + 0.20·constraint`.

`challenge < 0.08` returns `trivial`, without a D class. This excludes unobstructed direct exits by structural measurement, irrespective of their former ID or class. It also excludes geometric navigation that does not genuinely depend on obstacles.

## Score and calibration

All component values are in [0,1]. Let `T` be optimal direction changes, `R` steps moving the ball away from the exit, `A` normalized average available alternatives, `F` forced steps, `M` the penalty of alternative moves found by bounded recovery searches along the first five optimal states, and `C = constraint`. With `clamp(x) = min(1,max(0,x))`:

- `solution = clamp(0.38·clamp((L−2)/(1.35·(width+height))) + 0.36·clamp(T/5) + 0.26·clamp((setup+R)/3))`.
- `dependency = clamp(0.50·clamp(detour/4) + 0.35·clamp(setup/3) + 0.15·C)`.
- `decision = clamp(0.60·A + 0.40·C)`.
- `uniqueness = clamp(C + 0.20·F/L)`.
- `score = 0.25·solution + 0.35·dependency + 0.15·decision + 0.15·M + 0.10·uniqueness`.
- `raw = 1 + 9·(score−0.24)/0.72`, deliberately not capped at 10.

The nine per-size class cutoffs are in `tools/difficulty-calibration-v2.json`. The first eight separate measured, structurally qualified levels into D1–D9, ensuring at least five distinct level records per class for each size. The ninth is above the highest old level's measured raw score at that size: former D10 levels that remain in the library move to D9, and new D10 records must exceed the former maximum. These cutoffs are calibrated against this test library and **have not yet been validated against human play**. Class is a useful initial ordering, not a guarantee that every player will perceive adjacent classes in exactly this order. The frozen cutoffs make later independent classification reproducible.

## Library and regeneration

`node tools/build-level-library-v2.mjs` rebuilds the six `classified-v2-{size}.json` packs, their combined offline audit pack and the calibration file. Inputs are the original test library, the earlier v1 pack, `tools/audit-{original,extra}-v2.json` and `tools/hard-candidates-v2.json`. `tools/expand-hard-v2.mjs` documents and deterministically generates the hard candidates. Generation uses fixed seeds, symmetry and controlled object placement; every final candidate is reclassified from the game physics before boundaries and metadata are written. The catalog loads the six size packs. Every level has a new `LV3-` ID; the free-play score uses a new local storage key, so old local best scores and balances do not carry over.

Verification: classify each of the six packs with `node tools/classify-level.mjs FILE --json`, check that every status is `ok`, its measured class equals the stored class, each class has at least five records per size, and replay `analysis.solution` through the game engine to victory. The current library contains 462 levels; the old built-in test set had 120 structurally trivial levels removed from 346 audited old entries (the resulting set also contains generated levels). Freeze-dependent puzzles require a separate resource-aware solver and are outside this version.
