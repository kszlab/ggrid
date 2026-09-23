# GGrid theme data

The current theme format is `ggrid-theme` with `formatVersion: 1`. Add a folder under `content/themes/` containing `theme.json`, then add the theme to `content/themes/index.json`. Existing game code reads the following optional fields without theme name checks:

| Field | Purpose |
| --- | --- |
| `colors` | Board and piece palette. |
| `scene.type` | CSS selector key (`body[data-scene="..."]`). |
| `scene.tier: "showcase"` | Showcase board layout. |
| `scene.markup.back`, `scene.markup.front` | Decorative scene HTML. |
| `pieces.ball/brick/wall/exit.className`, `.markup` | Decorations for pieces and exit. |
| `pieces.rigidBody.className`, `.markup` | Visual overlay for a rectangular multicell brick. Its geometry tracks the game object. Irregular shapes retain their cell based visual so empty spaces stay clear. |
| `preview.markup` | Optional Theme Lab preview HTML; use `{{cells25}}` to generate 25 preview cells. Without it, Theme Lab uses its standard grid. |
| `assets.css` or `css` | Theme stylesheet path relative to `theme.json`, loaded by the game. |
| `ui.skin: "full"` | Full UI skin layout. |
| `audio` | Audio profile and events. |

Piece markup supports `{{first:yes|no}}` (first cell of a multicell object) and `{{multi:yes|no}}` (any cell of a multicell object). Keep theme HTML and CSS under trusted authorship because they render in the page.

All 15 built-in themes use `theme.css`; `css/game.css` contains shared game layout and effects. Add the theme's CSS path as `css` in the theme index entry so the Free Play carousel can display every theme preview at once. The active theme also loads `assets.css` during play, including Scenario mode.\n\nThe Theme Lab has its own shared layout in `css/theme-lab.css`. A theme with an elaborate Theme Lab preview may add `preview.css` and list it as `previewCss` in its index entry. Its `preview.markup` should use Theme Lab classes and preview CSS rather than game board markup.
