# Csillagkönyvtár – Artwork Theme V2 implementation contract

Status: **APPROVED VISUAL DIRECTION**  
GGrid target: Artwork Theme Renderer v0.15.x

## 1. Source of truth

The concept approved in the 2026-09-24 design review is the visual reference.
The portrait gameplay reference is the approved concept sheet cropped to the gameplay panel, excluding the concept-sheet heading.

Canonical reference canvas:

- width: 540
- height: 748
- source concept crop: x=8, y=186, width=540, height=748
- reference board: square 5×5 example
- visual priority: board > pieces/exit > controls/HUD > environment

Implementation must not reinterpret the reference as a CSS approximation. Artwork assets are the primary visual source; CSS is for layout, state and animation.

## 2. Gameplay composition

Gameplay does **not** show the theme title, subtitle or a large theme crest.

The upper game bar contains only functional game information (mode, level/difficulty/progress and menu). Theme identity comes from the environment and artwork.

The theme title and short description belong to the theme selector only.

Portrait reference zones on the 540×748 design canvas:

- top functional header: approximately y=0..56
- square-board safe area: x=46, y=68, width=448, height=448
- left/right interaction gutters run beside the fitted board
- upper/lower interaction gutters run across the fitted board width
- HUD is below the scene and remains compact

The renderer must preserve square cells. Rectangular 5×6 / 5×7 / 5×8 boards are fitted inside the available board safe area; later profile overrides may enlarge the tall-board safe area without changing the artwork contract.

## 3. Direction controls

The four perimeter controls have **two separate responsibilities**:

1. a large continuous hit zone around the board;
2. sparse visual cues showing that the entire zone acts as the corresponding direction.

The hit zone must not be visually represented as one long solid pill/button.

Allowed visual treatment:
- central embossed arrow;
- sparse stars/ornaments along the band;
- subtle edge line or filigree;
- pressed/highlight state over the full hit area.

The complete band remains clickable/press-and-hold capable.

## 4. Exit

The exit must read as a **real opening/portal through the board boundary**, not as a decorative board cell.

Requirements:
- it intersects/breaks the outer board boundary;
- it has a luminous portal/arch silhouette distinct from normal cells;
- a large arrow points **outward** in the only valid exit direction;
- all four directions are supported independently: up/right/down/left;
- the direction must remain understandable without any text.

A localized EXIT/KIJÁRAT label may exist as secondary UI/accessibility text, but must never be required to understand the exit.

## 5. Board cell vs fixed wall

These are semantically and visually different.

### Traversable decorated cell
- parchment/ivory surface;
- faint astronomy motif;
- low visual weight;
- never looks solid/heavy.

### Fixed wall
- stone/metal/brass construction;
- visibly raised and heavier;
- hard rim/corners and stronger shadow;
- cannot be confused with a decorative cell.

## 6. Moving pieces

Single-cell and rigid multi-cell pieces are illustrated objects.

Required rigid shape coverage:
- 2H
- 2V
- 3H
- 3V
- L3-TL
- L3-TR
- L3-BL
- L3-BR

Rigid bodies are rendered as one visual object with transparent unused area for irregular shapes. They are not reconstructed from adjacent CSS rectangles.

The whole rigid body moves in lockstep with the logical cells.

## 7. Ball

The astral ball is the strongest moving focal point:
- luminous sphere;
- blue/violet/gold internal light;
- clear silhouette over every cell;
- glow may animate, but must not obscure nearby geometry.

## 8. HUD

Gameplay action order follows the current GGrid controls:

1. Freeze – counter is allowed;
2. Hint – **no counter**;
3. Undo;
4. Restart;
5. Level/theme chooser action;
6. Score display.

Artwork supplies frames/material treatment. Functional labels/tooltips remain live UI text.

## 9. Victory screen

Victory has a theme-specific artwork panel, but all functional text is live/localized.

Artwork:
- celestial brass/navy frame;
- star/astrolabe ornament;
- background lighting;
- button frames.

Live text:
- victory heading;
- moves;
- score;
- restart;
- level selection;
- next.

No Hungarian functional text may be baked into the victory image.

## 10. Text policy

### Functional UI text
Always localized and rendered by the game. Never baked into artwork.

### Theme identity
Theme name + short description appear in the theme selector only, localized.
They do not appear on the gameplay canvas.

### Diegetic text
Ambient world text may remain in an authentic fixed language when it is decorative and non-functional.

## 11. Asset-first rule

An approved visual element must not be replaced by a merely similar CSS recreation.

Asset categories:
- environment background / optional foreground;
- board frame (9-slice);
- traversable cell variants;
- fixed wall;
- ball;
- single-cell books;
- every current rigid shape;
- four directional exit portal states;
- control cue artwork;
- HUD chrome;
- victory chrome;
- theme-selector preview.

CSS is restricted primarily to:
- geometry;
- responsive positioning;
- animation/state;
- glow/shadow adjustments;
- accessibility/focus/pressed states.

## 12. Acceptance rule

The theme is complete only when:
- the approved portrait reference is recognizably the same composition in an overlay comparison;
- ball, walls, moving pieces and exit are immediately distinguishable;
- 3×3 through 5×8 remain playable;
- portrait and landscape layouts do not distort pieces or cells;
- no gameplay theme title consumes board space;
- Hint has no counter and Freeze may have one;
- exit direction is unmistakable without reading text.


## 13. Tall-board sizing policy

Portrait artwork uses adaptive scene height. A 5×6, 5×7 or 5×8 board must not be made narrower merely to fit the original square-board safe-area height.

- square cell geometry is preserved;
- the preferred portrait board width is preserved;
- when additional rows require more height, the artwork scene grows vertically;
- the upper board anchor remains stable and the lower directional zone moves down with the board;
- the library background fills the expanded scene without geometric distortion.

Landscape currently retains contain-mode behavior because the available horizontal composition is substantially wider.


## 14. Direction artwork rule

Artwork direction cues are already orientation-specific assets. The generic legacy CSS rotation must never be applied to an artwork cue.

- control-up.svg points up;
- control-right.svg points right;
- control-down.svg points down;
- control-left.svg points left.

The full surrounding hit band remains directional even though only a compact central arrow is visible.

## 15. L-shape artwork semantics

The rigid shape ID names describe the occupied junction corner, not the missing corner:

- L3-TL occupies TL/TR/BL and therefore has BR missing;
- L3-TR occupies TL/TR/BR and therefore has BL missing;
- L3-BL occupies TL/BL/BR and therefore has TR missing;
- L3-BR occupies TR/BL/BR and therefore has TL missing.

Each L artwork must use a real transparent missing quadrant. Decorative lines, highlights and emblems must be clipped to the actual L silhouette.
