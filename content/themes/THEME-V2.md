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

The original showcase theme styles still live in `css/game.css`; a new theme can define its own selectors in its stylesheet. The Theme Lab has a separate preview layout and styles in `css/theme-lab.css`. Its `preview.markup` must use its own classes and CSS, rather than relying on game board markup.
