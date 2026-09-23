# GGrid: önálló pályanehézség-becslő (human-estimate-v1.2)

Ez az offline eszköz a játék tényleges `js/game-core.js` `step()` mozgásfizikáját használja. Nem része a játékos futtatókódnak. A korábbi LF2 pályák `D` osztálya a nyers érték méretenkénti *relatív rangsora* volt (4 pálya minden osztályban); a jelen modell abszolút, tartalmi becslés. A `raw` értékek a korábbi LF2 `raw` értékekkel **nem összehasonlíthatók**.

## Használat (Node.js 20+)

A projekt gyökeréből, telepítés nélkül:

```bash
node tools/classify-level.mjs LF2-5X8-D05-3 --json
node tools/classify-level.mjs content/levels/showcase-zen-01.json --json
node tools/classify-level.mjs saját-pálya.json --json
node tools/classify-level.mjs --all --json > helyi-audit.json
node tools/build-classified-library.mjs
```

Bemenet lehet egy Level Data Model v2 `ggrid-level` JSON, egy `ggrid-level-pack` vagy a `js/game-core.js` által használt `state` (egy golyóval). `--all` a beépített LF2 készletet ellenőrzi. A kimenet `difficulty` (D1–D10), `raw`, `cap`, az összetevők, a mérési adatok és az optimális lépéssor. `priorClass` és `priorRaw` csak a beépített régi készletnél létezik. Az eredmény önállóan újra előállítható.

## Mérési és besorolási szabály

1. A valódi mozgásszabályokon BFS megkeresi a legrövidebb megoldást. Sikertelen vagy korlátba ütköző keresésnél `unsolvable` / `search_limit` a válasz; ilyen pályára nincs D-címke.
2. `baselineMoves`: a golyó és a kijárat Manhattan-távolsága + a kilépő lépés. `detourMoves = optimalMoves − baselineMoves`.
3. Az összes *geometriailag legrövidebb* (csak a kijárat felé tartó) iránysort a tényleges fizikával is lejátssza. A nem működő utak aránya a `routeConstraint` (0, ha mindegyik járható). Ez segít megkülönböztetni a pusztán hosszú, szabad utat a kényszerített sorrendtől.
4. Mérethez viszonyított megoldáshossz, irányváltás, a golyó mozgása nélküli előkészítés (`setup`), a kijárattól távolodás (`retreat`), tényleges választható irányok, valamint az optimális út első öt állapotában kipróbált hibás irányokból végzett korlátos új megoldáskeresés adja az öt részpontszámot: `solution`, `dependency`, `decision`, `mistakes`, `uniqueness`. Mindegyik 0–1 közötti.
5. A súlyozott képlet: `raw = 1 + 9 × (0.35×solution + 0.25×dependency + 0.20×decision + 0.15×mistakes + 0.05×uniqueness)`; kezdő D = `round(raw)`. Ezek a korábbi v2 terv arányai, jelenleg **becslési paraméterek**, nem emberi tesztből kalibrált értékek.
6. Kötelező korlátok: az egyirányú, akadálytalan kijutás D1; az akadálytalan, geometriailag legrövidebb út legfeljebb D3 (ha az objektumok egyes sorrendeket kizárnak, legfeljebb D4, kifejezetten erős útkorlátnál D5); kicsi kerülő és előkészítés nélkül legfeljebb D5–D7; D10 csak legalább 3 kerülőlépéssel, 2 előkészítő lépéssel, 4 irányváltással és `raw >= 9` értékkel lehetséges. A rövid, de irányváltást igénylő utak `raw < 2.85` esetén D2-be, a kevés kerülőt igénylő `5.45 <= raw < 5.6` pályák D5-be kerülnek. Ezek explicit kalibrációs határok, amelyeket a strukturális osztályok közötti üres tartományok miatt rögzítettünk.

**Példa:** `LF2-5X8-D05-3` optimális 7 lépése megegyezik a 7 lépéses geometriai alsó korláttal; a 6 legrövidebb iránysor mind működik, `setup = 0`. Az új becslés D3, a korábbi relatív címke D5.

Az LF2 készlet mind a 240 pályája besorolható volt. A `build-classified-library.mjs` a régi rekordok új besorolását a `content/levels/classification-v1.js` állományba írja; a régi azonosító változatlan. A hiányzó osztályokhoz determinisztikusan generálja a `content/levels/packs/classified-v1.json` pályacsomagot. A 240 régi és 106 új pálya minden méretben és D1–D10 osztályban legalább 5 játszható pályát ad. Az új osztály látható a régi azonosító mellett, így az azonosítóba írt korábbi D érték nem téveszthető össze az új besorolással. A v1.1 a D10 nyers küszöbét, a v1.2 az explicit D2/D5 kalibrációs határokat módosította; a `model` mező megőrzi ezt az eltérést.

## Korlátok és a következő kalibráció

- A hibás irányok korlátozott keresése (`1800` állapot, legfeljebb `40` lépés) becslés. Az eszköz fő megoldáskeresése legfeljebb `50000` állapotot vizsgál. A limit túllépése nem egyenlő a megoldhatatlansággal.
- Az objektumfüggőség jelenleg a kerülő, a `setup` és a rövid utak elzártságának **közelítése**. Nem bizonyítja, hogy pontosan melyik tégla szükséges; ehhez objektumonkénti ellenpróba és több optimális megoldás elemzése kell. A D5 eredeti „több objektum tényleges részvétele” feltételét ezért ez a v1 még nem tudja teljes szigorral igazolni.
- A több golyós és Freeze-kötelező pályák külön erőforrásokat tartalmazó solver nélkül nem osztályozhatók ezzel az eszközzel; Freeze-képes bemenetre az eszköz hibát jelez.
- A képlet nem állítja, hogy a nehézségérzetet már validáltuk. Az azonos méretű, különféle szerkezetű D1–D10 pályákat játékosokkal tesztelve össze kell gyűjteni a nehézségértékeléseket, és azok alapján rögzíteni a következő modell verzióját. A `model` azonosító megőrzése biztosítja a későbbi összehasonlíthatóságot.
- A régi pályaazonosítók és a helyi rekordok változatlanok; az új pályák `LC1-` azonosítót kapnak. Az elért egyenleg nem számolódik újra, míg a jövőbeni pályák jutalmát az új D-osztály számítja. Publikált pálya tartalmi módosítása új azonosítót kíván; elemzési modellfrissítéshez új `LevelAnalysis` verzió szükséges.
