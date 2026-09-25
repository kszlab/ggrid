# Theme design workspace

Az új témák festett forrásai a `design/themes/<theme-id>/` mappában élnek. A runtime `content/themes/<theme-id>/` mappát a Theme Pipeline építi elő.

Kötelező folyamat: [docs/THEME-PIPELINE-V1.md](../../docs/THEME-PIPELINE-V1.md).

Minimum források:

- `theme-kit.json`
- `approval.json`
- `mood.png`
- `target.png`
- `sheet-board.png`
- `sheet-rigid.png`
- `sheet-chrome.png`
- `sheet-tiles.png`

A jóváhagyott képeket SHA-256 hash rögzíti. Ha egy jóváhagyott fájl módosul, új approval szükséges.
