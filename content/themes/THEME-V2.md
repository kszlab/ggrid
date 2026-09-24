# GGrid theme data

The current theme format is `ggrid-theme` with `formatVersion: 1`. Add a folder under `content/themes/` containing `theme.json`, then add the theme to `content/themes/index.json`. Existing game code reads the following optional fields without theme name checks:

| Field | Purpose |
| --- | --- |
| `colors` | Board and piece palette. |
| `scene.type` | CSS selector key (`body[data-scene="..."]`). |
| `scene.tier: "showcase"` | Showcase board layout. |
| `scene.markup.back`, `scene.markup.front` | Decorative scene HTML. |
| `pieces.ball/brick/wall/exit.className`, `.markup` | Decorations for pieces and exit. |
| `pieces.rigidBody.className`, `.markup` | Generic visual overlay for rectangular multicell bricks. It remains the backward-compatible fallback. |\n| `pieces.rigidBodyVariants.<shapeId>.className`, `.markup` | Optional dedicated overlay for one exact rigid-body orientation, including irregular shapes. Current IDs are `2H`, `2V`, `3H`, `3V`, `L3-TL`, `L3-TR`, `L3-BL`, `L3-BR`. |
| `preview.markup` | Optional Theme Lab preview HTML; use `{{cells25}}` to generate 25 preview cells. Without it, Theme Lab uses its standard grid. |
| `assets.css` or `css` | Theme stylesheet path relative to `theme.json`, loaded by the game. |
| `ui.skin: "full"` | Full UI skin layout. |
| `audio` | Audio profile and events. |

Piece markup supports `{{first:yes|no}}` (first cell of a multicell object) and `{{multi:yes|no}}` (any cell of a multicell object). Keep theme HTML and CSS under trusted authorship because they render in the page.

All built-in themes use `theme.css`; `css/game.css` contains shared game layout and effects. Add the theme's CSS path as `css` in the theme index entry so the Free Play carousel can display every theme preview at once. The active theme also loads `assets.css` during play, including Scenario mode.\n\nThe Theme Lab has its own shared layout in `css/theme-lab.css`. A theme with an elaborate Theme Lab preview may add `preview.css` and list it as `previewCss` in its index entry. Its `preview.markup` should use Theme Lab classes and preview CSS rather than game board markup.


## Rigid-body shape coverage

Rigid-body graphics are deliberately data-driven. Runtime shape identification is provided by `js/rigid-shapes.js`.

The repository shape catalog is generated with:

```
node tools/scan-rigid-shapes.mjs
```

It writes `content/shapes/rigid-shapes.json`. The scanner walks level and scenario JSON files and records every distinct oriented multicell rigid-body geometry. Unknown future geometries receive a deterministic generic ID, so adding a new level shape does not require a renderer change.

Theme coverage is generated with:

```
node tools/audit-theme-shapes.mjs
```

It writes `tools/theme-shape-audit.json` and classifies each shape per theme as:

- `custom`: a dedicated `rigidBodyVariants[shapeId]` overlay exists;
- `generic-composite`: no dedicated variant exists, but the shape is rectangular and uses `pieces.rigidBody`;
- `cell-fallback`: an irregular shape has no dedicated variant, so the existing joined-cell rendering remains visible.

The fallback is intentional and mandatory: a newly generated shape must stay playable even before theme artwork is updated. Showcase themes should normally reach `custom` coverage for every shape in the current catalog.

When level generation introduces new geometry, rerun both tools and then add theme-specific variants as needed. The player may also log a one-time console warning for a missing variant in themes that have opted into `rigidBodyVariants`.
