# GGrid content publishing (v0.12.46)

## Add levels without changing game code
1. Export solver-validated levels as a JSON file with `format: "ggrid-level-pack"`, `formatVersion: 1`, and a `levels` array.
2. Put the file under `content/levels/packs/`.
3. Add one entry to `content/levels/catalog.json`: `{"id":"my-pack","src":"packs/my-pack.json"}`.
4. The player loads the catalog before Free Play, merges unique level IDs, validates format/rules/features, and derives size × D1–D10 coverage automatically.
5. Unavailable difficulty buttons are disabled. `LevelLibrary.health()` reports duplicates, invalid/unsupported levels and missing size/difficulty cells.

A full level may use Level Data Model v2 fields: `levelId`, `formatVersion`, `rulesVersion`, `requires.features`, `board`, `entities`, `initialResources`, `difficulty`, and `analysis.solution`.

## Add a theme without changing game code
1. Create `content/themes/<theme-id>/theme.json`.
2. Optional: add a self-contained `theme.css` and reference it as `assets.css` (relative to theme.json).
3. Add one entry to `content/themes/index.json`. Put picker data in `preview.shortName`, `preview.tag`, and four `preview.symbols`.
4. Basic themes can use the existing color variables. Advanced themes may declaratively provide `scene.markup.back/front`, `scene.compositeMarkup`, and `pieces.<ball|brick|wall|exit>.markup/className`; CSS styles them.
5. Existing showcase themes retain their legacy renderer fallback, so this migration is backward compatible.

The player code should not be edited merely to publish another level pack or theme.
