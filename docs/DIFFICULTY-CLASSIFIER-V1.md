# GGrid: önálló pályanehézség-becslő (human-estimate-v1)

Ez az offline eszköz a játék tényleges `js/game-core.js` `step()` mozgásfizikáját használja. Nem része a játékos futtatókódnak. A korábbi LF2 pályák `D` osztálya a nyers érték méretenkénti *relatív rangsora* volt (4 pálya minden osztályban); a jelen modell abszolút, tartalmi becslés. A `raw` értékek a korábbi LF2 `raw` értékekkel **nem összehasonlíthatók**.

## Használat (Node.js 20+)

A projekt gyökeréből, telepítés nélkül:

```bash
node tools/classify-level.mjs LF2-5X8-D05-3 --json
node tools/classify-level.mjs content/levels/showcase-zen-01.json --json
node tools/classify-level.mjs saját-pálya.json --json
node tools/classify-level.mjs --all --json > helyi-audit.json
```

Bemenet lehet egy Level Data Model v2 `ggrid-level` JSON, egy `ggrid-level-pack` vagy a `js/game-core.js` által használt `state` (egy golyóval). `--all` a beépített LF2 készletet ellenőrzi. A kimenet `difficulty` (D1–D10), `raw`, `cap`, az összetevők, a mérési adatok és az optimális lépéssor. `priorClass` és `priorRaw` csak a beépített régi készletnél létezik. Az eredmény önállóan újra előállítható.

## Mérési és besorolási szabály

1. A valódi mozgásszabályokon BFS megkeresi a legrövidebb megoldást. Sikertelen vagy korlátba ütköző keresésnél `unsolvable` / `search_limit` a válasz; ilyen pályára nincs D-címke.
2. `baselineMoves`: a golyó és a kijárat Manhattan-távolsága + a kilépő lépés. `detourMoves = optimalMoves − baselineMoves`.
3. Az összes *geometriailag legrövidebb* (csak a kijárat felé tartó) iránysort a tényleges fizikával is lejátssza. A nem működő utak aránya a `routeConstraint` (0, ha mindegyik járható). Ez segít megkülönböztetni a pusztán hosszú, szabad utat a kényszerített sorrendtől.
4. Mérethez viszonyított megoldáshossz, irányváltás, a golyó mozgása nélküli előkészítés (`setup`), a kijárattól távolodás (`retreat`), tényleges választható irányok, valamint az optimális út első öt állapotában kipróbált hibás irányokból végzett korlátos új megoldáskeresés adja az öt részpontszámot: `solution`, `dependency`, `decision`, `mistakes`, `uniqueness`. Mindegyik 0–1 közötti.
5. A súlyozott képlet: `raw = 1 + 9 × (0.35×solution + 0.25×dependency + 0.20×decision + 0.15×mistakes + 0.05×uniqueness)`; kezdő D = `round(raw)`. Ezek a korábbi v2 terv arányai, jelenleg **becslési paraméterek**, nem emberi tesztből kalibrált értékek.
6. Kötelező korlátok: az egyirányú, akadálytalan kijutás D1; az akadálytalan, geometriailag legrövidebb út legfeljebb D3 (ha a téglák egyes sorrendeket kizárnak, legfeljebb D4); kicsi kerülő és előkészítés nélkül legfeljebb D5–D7; D10 csak legalább 3 kerülőlépéssel, 2 előkészítő lépéssel és 4 irányváltással lehetséges. A korlátok megakadályozzák, hogy pusztán sok látszólagos választás miatt a könnyű pálya magas osztályba kerüljön.

**Példa:** `LF2-5X8-D05-3` optimális 7 lépése megegyezik a 7 lépéses geometriai alsó korláttal; a 6 legrövidebb iránysor mind működik, `setup = 0`. Az új becslés D3, a korábbi relatív címke D5.

Az LF2 készlet mind a 240 pályája besorolható volt; új osztályok darabszámai: D1=0, D2=6, D3=83, D4=27, D5=3, D6=13, D7=27, D8=27, D9=53, D10=1. Az egyenetlen eloszlás fontos eredmény: a régi könyvtár méretenként pontosan 4 pályát *kényszerített* minden címkébe, ám az új abszolút mérce szerint több osztályhoz alig van megfelelő pálya. A hiányzó osztályok feltöltése generálási feladat, nem címkeátírás.

## Korlátok és a következő kalibráció

- A hibás irányok korlátozott keresése (`1800` állapot, legfeljebb `40` lépés) becslés. Az eszköz fő megoldáskeresése legfeljebb `50000` állapotot vizsgál. A limit túllépése nem egyenlő a megoldhatatlansággal.
- Az objektumfüggőség jelenleg a kerülő, a `setup` és a rövid utak elzártságának **közelítése**. Nem bizonyítja, hogy pontosan melyik tégla szükséges; ehhez objektumonkénti ellenpróba és több optimális megoldás elemzése kell. A D5 eredeti „több objektum tényleges részvétele” feltételét ezért ez a v1 még nem tudja teljes szigorral igazolni.
- A több golyós és Freeze-kötelező pályák külön erőforrásokat tartalmazó solver nélkül nem osztályozhatók ezzel az eszközzel; Freeze-képes bemenetre az eszköz hibát jelez.
- A képlet nem állítja, hogy a nehézségérzetet már validáltuk. Az azonos méretű, különféle szerkezetű D1–D10 pályákat játékosokkal tesztelve össze kell gyűjteni a nehézségértékeléseket, és azok alapján rögzíteni a következő modell verzióját. A `model` azonosító megőrzése biztosítja a későbbi összehasonlíthatóságot.
- A pályaazonosítók, a játékos helyi rekordjai és a játék aktuális pontszámai **nem változnak** ebben a fejlesztési körben. Publikált pálya tartalmi módosítása új azonosítót kíván; elemzési modellfrissítéshez új `LevelAnalysis` verzió szükséges.
