# Kétgolyós pályakönyvtár v2

Az első kétgolyós tesztkönyvtár kevés, kizárólag egycellás akadályt
használt. A méretenként elsőként megtalált negyven pályát tíz egyenlő
csoportba osztotta, így a D10 sem jelentett feltétlenül nehéz feladványt.
A v2 ezt a generálást és besorolást váltja fel.

## Elfogadási feltételek

- Pontosan két golyó, érvényes, átfedésmentes tábla.
- Bizonyított Freeze nélküli megoldás a játék saját mozgásfüggvényével.
- Legalább egy irányváltás az optimális megoldásban.
- Az optimális út szigorúan hosszabb, mint ugyanannak a két golyónak az
  akadálymentes táblán mért optimális útja. Az akadályoknak tehát mérhető
  következménye van; az egyszerű geometriai kijutás kiesik.
- Minden legalább 5×5-ös pályán van többcellás, merev mozgó test.
- Egy osztályba csak a változatlan küszöbök szerint oda tartozó pálya kerül.
  A keresés nem módosíthatja a küszöböket és nem tölthet fel magasabb
  kategóriát gyengébb pályákkal.

## Nehézség: `puzzle-v3-multiball-anchored-v2`

A modell az egygolyós `puzzle-v2` öt komponensét és súlyait használja:
megoldás szerkezete 25%, akadályfüggőség 35%, döntési lehetőségek 15%,
hibás alternatívák következménye 15%, közvetlen útvonalak korlátozottsága 10%.
A nyers pont átalakítása is azonos. Az osztályhatárok közvetlenül a
változatlan `tools/difficulty-calibration-v2.json` fájlból származnak.
Nincs kétgolyós kvantilis-kalibráció vagy azonos pontokat szétválasztó zaj.

A többgolyós alkalmazás pontos értelmezése:

- A kerülőút alapja a két golyó **közös** akadálymentes optimális útja.
- Előkészítő lépés: egyik bent lévő golyó sem mozdul és nem jut ki.
- Visszalépés: a bent lévő golyók kijárattól mért össztávolsága nő.
- A geometriai útvonal-korlátozás minden golyó összes monoton geometriai
  legrövidebb útját vizsgálja a valódi, kétgolyós állapotból. A másik golyó
  és az akadályok a vizsgálat alatt jelen vannak.
- A konfliktusos lépés, az első kijutás és a második fázis hossza külön
  metrika. Ezekért önmagukban nem jár automatikus nehézségi bónusz.
- A hibakockázat az optimális út első öt állapotának alternatív lépéseit
  vizsgálja. Csak lezárt keresés mondhat ki zsákutcát. A limit miatt
  eldöntetlen alternatíva nulla kockázati hozzájárulást kap, és külön
  számlálóban megmarad. Ez konzervatív becslés; nem minősít nehézzé egy
  pályát pusztán azért, mert a solver elérte a korlátot.

Keresési határok: 65 lépés, fő keresésnél 60 000, alternatívánként 10 000
állapot. A megoldást megtaláló BFS bizonyítja annak minimális hosszát.
A limitet elérő fő keresésű jelölt nem kerül a könyvtárba.

**A közös szerkezeti skála nem emberi nehézségmérés.** Az egy- és kétgolyós
D-osztályok szubjektív azonosságát későbbi játékosi tesztekkel kell vizsgálni.
Az egygolyós pályákat, osztályozót és határértékeket ez a változat nem módosítja.

## Generálás és folytathatóság

A keresés a meglévő egygolyós pályák akadályrendszerét, véletlen elrendezéseket,
helyi módosításokat és megoldási utak köztes, még két aktív golyós állapotait
használja. A nagyobb táblákon dominók, triominók és L-alakok is szerepelnek.
A legnehezebb jelöltekből célzott szomszédos elrendezéskeresés indul.
A 3×3 könnyű csoportját külön, szisztematikus elrendezéskeresés egészíti ki.
A legnagyobb méretnél kisebb táblák szerkezeteinek ténylegesen megnövelt
változatait is vizsgáljuk: az új terület használható, nincs mesterséges
falcsíkos lezárás, és az egész megoldás és besorolás újraszámítódik.

A futások determinisztikus véletlenállapotot, vizsgált aláírásokat,
elfogadott pályákat és tartalék jelölteket mentenek. Minden méret külön
folytatható. Egy mérethez egyszerre csak egy író folyamat fusson.
A mentés átmeneti fájlból történő átnevezéssel készül.

## Ellenőrzés és játékbeli használat

Az exportáló minden kiválasztott pályát újra osztályoz, ellenőrzi az
azonosítók és állapotok egyediségét, a két golyót, az akadályfüggőséget és
a nagy pályák többcellás testeit. Az optimális megoldást visszajátssza az
eredeti `game-core.js` függvényeivel, és minden köztes állapot négy lehetséges
irányában összeveti az offline kereső átmenetét az eredeti motoréval.

Az offline gyorsító a változatlan geometriát külön tárolja, és a keresésben
csak az objektumok pozícióját mozgatja. A mozgási szabályokat a játékmotorból
képezi le. A teszt minden könyvtári megoldás köztes állapotának mind a négy
irányában összeveti az átmenetet az eredeti motorral, és összehasonlítja
a BFS pontos iránysorát és meglátogatott állapotainak számát is.
A játék fizikája és runtime solverje változatlan marad.

Az új katalógus a `multiball-v2-<méret>.json` csomagokra mutat.
A külön kétgolyós gomb, méret/D/téma választó, javaslat, automatikus
megoldás és pontozás nélküli működés megmarad. A pályaazonosítók új `MB2-`
előtagot kapnak. A régi `MB1` csomagok történeti adatként maradnak a repóban,
de az aktív katalógus nem tölti be őket.

## Futtatás

Node.js 24 alatt, a repó gyökeréből (nincs külső csomagfüggőség):

```sh
# Az aktív 240 pálya teljes, checkpoint nélküli újraellenőrzése:
node tools/verify-multiball-v2.mjs

# A tömör offline kereső és a változatlan játékmotor összevetése:
node tools/test-multiball-v2.mjs

# Generálás vagy folytatás egy méretre, legfeljebb 1500 új próbával:
node tools/build-multiball-v2.mjs 5x8 1500

# Célzott kiegészítő keresések, ugyanahhoz a mentéshez:
node tools/search-multiball-prefixes.mjs 5x8
node tools/search-hard-multiball.mjs 5x8
node tools/search-small-multiball.mjs

# Négy pálya/osztály kiválasztása, újraellenőrzése és csomagba írása:
node tools/export-multiball-v2.mjs 5x8
```

Mentési hely: `.cache/multiball-v2/`, amely nincs verziókezelésben.
Opcionálisan a `GGRID_WORK_DIR` környezeti változóval másik mappa adható meg.
A fő generátor nem írja át az aktív katalógust. Az export hiányos lefedettség
vagy ellenőrzési eltérés esetén hibával leáll. A kiegészítő golyópozíció- és
méretnövelési kereső külön jelöltfájlt ír, amit egyetlen író folyamat mellett
kell összefésülni a mentéssel, majd az exporttal ellenőrizni.

A verziózott `tools/multiball-verification-v2.json` tartalmazza a végső
lefedettséget, lépéstartományokat, fájlellenőrző összegeket és a runtime
pályakönyvtár vizsgálatának eredményét.
