# GGrid Theme Pipeline v1

A cél: egy jóváhagyott képi tervből reprodukálható, témánkénti kézi CSS/JS-utánrajzolás nélkül készüljön játszható GGrid téma.

## Kötelező folyamat

1. **Hangulatterv** – `mood.png`. Szabad koncepciókép, a tulajdonos jóváhagyja.
2. **Render-célkép** – `target.png`. A Theme Pipeline `target-base.png` képének átfestése; a játék geometriája nem változhat.
3. **Elemlapok** – `sheet-board.png`, `sheet-rigid.png`, `sheet-chrome.png`, `sheet-tiles.png`.
4. **Strict build** – kivágás, transzparencia, méretezés, theme.json/artwork.css generálás.
5. **Valódi játék QA** – telefon/portré/fekvő screenshotok, tetszőleges polyomino alakzatok és `compare.png`.
6. **Átvétel** – a tulajdonos a render-célkép és a valódi játék összevetése alapján hagyja jóvá.

A pipeline nem fest. A vizuális tartalom képgenerátorból érkezik; a kód csak kivág, méretez, összerak és ellenőriz.

## Showcase vs render-célkép

- `showcase.png`: opcionális, szabadabb hangulati/marketing kép.
- `target.png`: kötelező render-célkép, a valódi játék geometriájához kötve. A végső `compare.png` ehhez hasonlít.

## Approval manifest

A `design/themes/<id>/approval.json` SHA-256 hash-ekkel rögzíti a jóváhagyott fájlokat. A sorrend kötelező:

```bash
python tools/theme-kit/kit.py approve --input design/themes/<id> --stage mood --actor Krisztian
python tools/theme-kit/kit.py approve --input design/themes/<id> --stage target --actor Krisztian
python tools/theme-kit/kit.py approve --input design/themes/<id> --stage sheets --actor Krisztian
```

Ha egy jóváhagyott kép később megváltozik, a build leáll és új jóváhagyás kell.

## Kötelező és opcionális assetek

Strict módban kötelező: 4 cellavariáns, fal, golyó, 3 egycellás mozgóelem, 4 kijárat, 4 irányjel, Freeze-jel, a két rigid-anyagminta, keret, vízszintes/függőleges vezérlősáv, header, HUD és victory panel.

A külön festett 2H/2V/3H/3V/L alakok opcionálisak. Ha hiányoznak, az általános `rigidTiles` anyagminta rendereli őket.

## Tetszőleges többcellás testek

A `sheet-tiles.png` két 3×3 mintát tartalmaz:

- `rigid-tiles-ring`: gyűrű üres középpel;
- `rigid-tiles-block`: tömör blokk.

A renderer minden rigid cellát negyedekre oszt, és a saját test szomszédsága alapján külső sarkot, élt, belső sarkot vagy kitöltést választ. Így T, U, V, S, téglalap és tetszőleges összefüggő 2–6+ cellás alak ugyanabból az anyagból egyetlen folyamatos tárgyként jelenik meg.

## Input

```text
design/themes/<id>/
  theme-kit.json
  approval.json
  mood.png
  target.png
  showcase.png          # opcionális
  sheet-board.png
  sheet-rigid.png
  sheet-chrome.png
  sheet-tiles.png
  bg-portrait.png       # ajánlott
  bg-landscape.png      # ajánlott
  <slot-id>.png         # opcionális egyedi felülírás
```

Példa `theme-kit.json`:

```json
{
  "id": "moonlight-library",
  "name": "Holdfény-könyvtár",
  "shortName": "Holdfény-könyvtár",
  "tag": "Az égi archívum",
  "description": "Ősi könyvtár és csillagvizsgáló.",
  "strict": true,
  "semantic": {
    "ball": "Asztrálgömb",
    "brick": "Kódex",
    "wall": "Talapzat",
    "exit": "Asztrolábium-kapu",
    "freeze": "Időpecsét"
  },
  "tokens": {}
}
```

## Helyi parancsok

```bash
python tools/theme-kit/kit.py templates
python tools/theme-kit/kit.py scaffold --theme classic
python tools/theme-kit/kit.py slice --input design/themes/<id> --out /tmp/theme-check
python tools/theme-kit/kit.py build --input design/themes/<id>
python tools/theme-kit/kit.py capture --theme <id> --out /tmp/theme-qa --target design/themes/<id>/target.png
```

## GitHub Actions

- **GGrid theme templates**: a mindenkori játékból sablonokat és render-célkép alapot generál artifactként.
- **GGrid theme pipeline**: jóváhagyott inputból témát épít, tesztel, screenshotol és külön PR-t nyit.

A PR csak vizuális átvétel után merge-elhető. A döntő ellenőrzés a `compare.png`, valamint a `shapes-extra-phone.png`.
