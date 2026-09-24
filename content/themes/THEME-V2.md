# GGrid theme data

The current theme format is `ggrid-theme` with `formatVersion: 1`. Add a folder under `content/themes/` containing `theme.json`, then add the theme to `content/themes/index.json`. Existing game code reads the following optional fields without theme name checks:

| Field | Purpose |
| --- | --- |
| `colors` | Board and piece palette. |
| `scene.type` | CSS selector key (`body[data-scene="..."]`). |
| `scene.tier: "showcase"` | Showcase board layout. |
| `scene.markup.back`, `scene.markup.frame`, `scene.markup.front` | Decorative scene HTML behind, around and in front of the board. |
| `pieces.ball/brick/wall/exit.className`, `.markup`, `.variants[]` | Decorations for pieces and exit; optional deterministic visual variants are merged with the base spec. |
| `pieces.rigidBody.className`, `.markup` | Generic visual overlay for rectangular multicell bricks. It remains the backward-compatible fallback. |
| `pieces.rigidBodyVariants.<shapeId>.className`, `.markup`, `.variants[]` | Optional dedicated overlay for one exact rigid-body orientation, including irregular shapes. Each shape may also expose deterministic visual variants. Current IDs are `2H`, `2V`, `3H`, `3V`, `L3-TL`, `L3-TR`, `L3-BL`, `L3-BR`. |
| `preview.markup` | Optional Theme Lab preview HTML; use `{{cells25}}` to generate 25 preview cells. Without it, Theme Lab uses its standard grid. |
| `assets.css` or `css` | Theme stylesheet path relative to `theme.json`, loaded by the game. |
| `assets.preload[]` | Critical image assets to preload before the theme becomes active. |
| `render.pieceInsetPx` / `render.rigidInsetPx` | Visual inset in pixels for single-cell pieces and rigid overlays. Defaults to `1.8`. |
| `render.moveMs` | Shared visual movement duration for pieces and rigid overlays. Defaults to `190`. |
| `board.cellVariants[]` | Deterministic visual cell variants (`className`, optional `markup`). |
| `ui.skin: "full"` | Full UI skin layout. |
| `audio` | Audio profile and events. |

Piece markup supports `{{first:yes|no}}` (first cell of a multicell object) and `{{multi:yes|no}}` (any cell of a multicell object). Keep theme HTML and CSS under trusted authorship because they render in the page.

All built-in themes use `theme.css`; `css/game.css` contains shared game layout and effects. Add the theme's CSS path as `css` in the theme index entry so the Free Play carousel can display every theme preview at once. The active theme also loads `assets.css` during play, including Scenario mode.

The Theme Lab has its own shared layout in `css/theme-lab.css`. A theme with an elaborate Theme Lab preview may add `preview.css` and list it as `previewCss` in its index entry. Its `preview.markup` should use Theme Lab classes and preview CSS rather than game board markup.


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


## Theme Render V3

Theme Render V3 extends the presentation layer without changing physics, level JSON or the theme format version.

Visual variants are deterministic. A piece with the same theme ID, object ID and shape keeps the same selected artwork across renders and restarts. A variant is merged onto its base specification, so a theme may define common markup once and vary only classes or selected markup.

Example:

```json
{
  "render": {
    "pieceInsetPx": 0.5,
    "rigidInsetPx": 0.5,
    "moveMs": 190
  },
  "board": {
    "cellVariants": [
      {"className":"cell-plain"},
      {"className":"cell-moon"},
      {"className":"cell-constellation"}
    ]
  },
  "pieces": {
    "brick": {
      "className":"book",
      "markup":"<i class=\"cover\"></i>",
      "variants":[
        {"className":"book-red"},
        {"className":"book-green"}
      ]
    },
    "rigidBodyVariants": {
      "3H": {
        "className":"atlas atlas-3h",
        "markup":"<i class=\"cover\"></i>",
        "variants":[
          {"className":"atlas-blue-moon"},
          {"className":"atlas-green-astrolabe"}
        ]
      }
    }
  },
  "assets": {
    "css":"theme.css",
    "preload":["library-bg.webp","atlas-3h-blue.webp"]
  }
}
```

Cells receive `data-x`, `data-y` and `data-index` attributes. Themes should prefer `board.cellVariants` over unstable random selection. The existing rigid-body fallback remains mandatory for unknown future shapes.
