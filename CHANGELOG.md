# GGrid changelog

A fájl a GGrid felhasználói és fejlesztői szempontból lényeges verzióváltozásait foglalja össze.

A korábbi repository-történetben egy-egy verzió gyakran több, fájlonként külön technikai commitból állt. Ez a changelog ezeket **logikai kiadásokba csoportosítja**, ezért nem commitlista, hanem verziótörténet.

## Verziózási szabály innentől

- Minden felhasználó által érzékelhető vagy működést érintő kiadás új alkalmazásverziót kap.
- A verziószám módosításával együtt ezt a fájlt is frissíteni kell.
- Egy fejlesztési feladat lehetőleg egy logikai commit legyen; ha a használt eszköz technikai okból több commitot hoz létre, azok ugyanahhoz a changelog-bejegyzéshez tartoznak.
- A commitüzenet röviden írja le a **célt vagy eredményt**, ne csak a módosított fájl nevét.
- CI/tesztjavítás csak akkor kap külön changelog-bejegyzést, ha a termék működését, kompatibilitását vagy a release megbízhatóságát érdemben érinti.
- A már meglévő történetet nem írjuk át és nem squasholjuk visszamenőleg.

---

## v0.15.28 — 2026-09-25

### Level Fingerprint / novelty index v1
- Elkészült a külön futtatható pálya-ujjlenyomat és újdonságvizsgáló eszköz: `tools/level-novelty-v1.mjs`.
- Minden pályához determinisztikus, szimmetriára normalizált SHA-256 `canonicalHash`, 64 bites `simHash` és 8 LSH bucket-kulcs számítható.
- Az exact hash figyelmen kívül hagyja az objektumazonosítókat és az objektumok JSON-sorrendjét; négyzetes táblán a forgatások és tükrözések, téglalapnál a mérettartó tükrözések/180° forgatás azonos pályának számítanak.
- A hasonlósági keresés indexelt LSH multi-probe módszert használ, így nem kell a teljes pályakatalógust lineárisan végigvizsgálni; a jelenlegi 8×8 bites felosztás 1 bites band-probe-bal minden legfeljebb 15 bites Hamming-távolságú jelöltet felvesz a jelölthalmazba.
- A Fast Generator v2 `toRecord()` útvonala automatikusan beírja a `content.fingerprints` blokkot az újonnan generált pályákba.
- Hozzáadva külön invariancia/duplikáció/hasonlóság teszt: `tools/test-level-fingerprint-v1.mjs`.

## v0.15.27 — 2026-09-25

### Egységes Level Metadata Schema v3
- Bevezetve az egységes metadata-réteg az aktív egygolyós, kétgolyós és Fast Generator pályákhoz.
- Új determinisztikus mezők: `packId`, `library`, `familyId`, `ballCount`, strukturális shape-statisztikák, provenance, egységes `qualityScore` és `noveltyScore` módszerazonosítóval.
- Pack- és katalógusszinten előkészítve a későbbi entitlement/access modell (`status`, `visibility`, `entitlement`).
- A dinamikus közösségi értékelések szándékosan nem kerülnek a statikus pályafájlba; azok később backend aggregátumok lesznek.
- Elkészült a teljes aktív könyvtár migrációs és validációs eszköze.
- A Fast Generator v2 mostantól közvetlenül metadata v3 kompatibilis rekordokat állít elő.

## v0.15.26 — 2026-09-25

### Fast Generator invalid-state és kevert kvóta javítás
- Az érvénytelen state-space jelöltek már nem állítják le a workert, hanem kiesnek és a generálás tovább fut.
- A 600-as tesztcsomag D-osztályonként továbbra is 10 pályát céloz, de a kétgolyós arány nem kényszerített 5+5; ahol van megfelelő B2 jelölt, legfeljebb 5 kerül be, a hiányt B1 tölti fel.
- A nagyobb pályákon a 4–6 cellás rigid alakzatok továbbra is aktívak.

## v0.15.25 — 2026-09-25

### Fast Generator CLI parser javítás
- Javítva a dokumentált `D1-D10` és `B1,B2` target-formátum feldolgozása.
- A 600 pályás generálási futás ezzel a javított parserrel indul újra.

## v0.15.24 — 2026-09-25

### Generátor teszt indítás javítása
- A **⚗ GENERÁTOR TESZT** gomb most akkor is indítható, ha az aktuálisan kiválasztott méret/D kombinációhoz nincs generált tesztpálya.
- Ilyenkor a játék automatikusan az első elérhető generált tesztprofilra vált.
- A jelenlegi bootstrap pack 3×3-as, ezért a korábbi 4×4 / D5 alapállapot többé nem tiltja le a teszt indítását.
- Külön `hasAny()` és `firstAvailable()` tesztkönyvtár API került be, valamint közvetlen indításnál is működik a biztonsági fallback.

## v0.15.23 — 2026-09-25

### Fast Generator v2 — első tesztelhető verzió
- Beépült a Claude-féle state-space/reverse-BFS ötlet továbbfejlesztett változata.
- A generátor paraméterezhető célokat fogad, például: `100@5x8:D1-D10:B1,B2`.
- Egy futás több célt is kezelhet, és 3–8 cellás szélesség/magasság tartományban egyedi méretet is elfogad (például 4×8).
- 1 golyós pályáknál gyors `puzzle-v2` classifier, 2 golyós pályáknál a meglévő `puzzle-v3-multiball-anchored-v2` classifier működik.
- Nagyobb táblákon `auto` módban 4–6 cellás rigid objektumok is generálhatók.
- Javítva lett a korábbi ball/brick fingerprint-típusütközés; külön exact és family szintű változatossági szűrés működik.
- A worker-szám alapból legfeljebb 4, a state-space workerenkénti memóriaőrrel fut.
- A generált rekordok pack/family/ballCount/generator metadata, valamint quality/novelty mezők számára előkészített struktúrát kapnak.
- Külön `content/levels/generated-test/` katalógus és **⚗ GENERÁTOR TESZT** játékmód készült, amely nem keveri a tesztpackokat az éles könyvtárral.
- A teszt UI azonnali kipróbálásához külön 3×3-as bootstrap pack került be 1 és 2 golyós pályákkal.
- A `--publish-test` kapcsolóval a generátor közvetlenül ebbe az elkülönített tesztkatalógusba tud publikálni.
- CI smoke teszt ellenőrzi a kétgolyós compact state-space támogatást, a nagy shape-készletet, a fingerprintet és a family-szűrést.

## v0.15.22 — 2026-09-25

### Automatikus megoldás kiadásfüggő engedélyezése
- Az automatikus megoldás indításához szükséges hosszú nyomás 3 másodpercről **2 másodpercre** csökkent.
- Bevezetésre került az alkalmazáskiadástól függő feature gate:
  - `development`: automatikus megoldás engedélyezve;
  - `free`: automatikus megoldás tiltva;
  - `paid`: automatikus megoldás engedélyezve.
- A jelenlegi build alapértelmezett kiadása `development`, így az automatikus megoldás továbbra is elérhető.
- A súgó és a kapcsolódó tooltip-szövegek 2 másodpercre frissültek.

## v0.15.21 — 2026-09-25

### Gyors runtime solver és pályaforgatás
- A játékban használt solver compact állapotreprezentációra váltott.
- A korábbi solver `solveDetailedLegacy()` néven referencia-implementációként megmaradt.
- Új runtime solver-equivalence regressziós teszt készült.
- A CI 1002 pályán, 1348 összehasonlítással ellenőrzi az új és a legacy solver azonosságát.
- A Szabad játék először a még nem teljesített pályákat adja; ha minden pálya teljesített, visszatér a normál körforgáshoz.
- A multiball offline eszköz explicit módon a legacy solverhez lett kötve a referencia-viselkedés megtartása érdekében.
- A Csillagkönyvtár elavult contract tesztje a tényleges theme v17 / artwork v2 struktúrához lett igazítva.
- A teljes GGrid validation workflow ismét zöld állapotba került.

## v0.15.20 — 2026-09-25

### Csillagkönyvtár — jóváhagyott könyv- és kódexgrafika
- A kódexek a jóváhagyott, antik könyvszerű megjelenéshez lettek igazítva.
- Az L alakú kódexek részletezése és sziluettje tovább finomodott.
- A túlméretezett szimbólumokat visszafogottabb könyvdíszítés váltotta.
- A téma az elfogadott vizuális referencia irányába lett egységesítve.

## v0.15.19 — 2026-09-25

### Csillagkönyvtár — kompozíció és könyvmegjelenés
- A pályakompozíció közelebb került az elfogadott látványtervhez.
- A nagyobb könyv/kódex objektumok megjelenése egységesebb és részletesebb lett.
- A vizuális passz külön ellenőrzéssel került lezárásra.

## v0.15.16–v0.15.18 — 2026-09-25

### Csillagkönyvtár — stabilizálás és térhatás
- Helyreállt a stabil artwork-betöltés.
- A kódexek és L alakú könyvobjektumok térhatásos, könyvszerű grafikát kaptak.
- A téma vizuális részletezettsége több iterációban nőtt.

## v0.15.15 — 2026-09-24

### High-fidelity Csillagkönyvtár
- Bevezetésre került a nagy részletességű Csillagkönyvtár artwork.
- A téma vizuális minőségéhez külön QA-mérőszámok és referenciaellenőrzés társult.

## v0.15.13–v0.15.14 — 2026-09-24

### Mobil vezérlők és nyíl-visszajelzés
- A vezérlőzóna és a lenyomott nyíl vizuális eleme különvált.
- Csak a tényleges nyíljelzés kap aktív lenyomási visszajelzést.
- Mobilon megszűnt a zavaró kék tap-highlight a Csillagkönyvtár vezérlőin.

## v0.15.9–v0.15.12 — 2026-09-24

### Csillagkönyvtár elrendezés és vezérlőgeometria
- A portré artwork-elrendezés rögzítésre és finomhangolásra került.
- A pálya körüli iránygombok a kerethez és a kontrollsávokhoz igazodtak.
- A kijárat mérete és rétegzése úgy változott, hogy a golyó láthatósága megmaradjon.
- A felső, alsó és oldalsó irányvezérlők egységes artwork-logikát kaptak.
- Az elfogadott Csillagkönyvtár kompozíció további vizuális finomítást kapott.

## v0.15.8 — 2026-09-24

### Többcellás alakzatok és Freeze-kijelölés
- Javult az L alakú merev testek artwork-geometriája.
- A többcellás összeragasztott objektumok Freeze-kijelölése egyetlen összetett alakzatként jelenik meg.
- A pálya hasznos megjelenítési területe megnőtt.
- Az iránynyilak és a rigid-shape clip-pathok tesztelése bővült.

## v0.15.5–v0.15.7 — 2026-09-24

### Artwork-alapú témák aktiválása
- A Csillagkönyvtár artwork-témává vált.
- Bevezetésre kerültek az egyedi cella-, golyó-, fal-, könyv-, kijárat-, HUD-, victory- és vezérlőgrafikák.
- A témaválasztó képes lett artwork előnézetet mutatni.
- Javult a mobil témaléptetés és a magasabb pályák megjelenítése.

## v0.15.0–v0.15.4 — 2026-09-24

### Artwork Theme infrastruktúra
- Elkészült az artwork asset resolver és layout engine.
- A renderer támogatni kezdte a témamanifestből származó saját grafikákat.
- Bevezetésre került a safe-area alapú pálya- és vezérlőgeometria.
- Megjelent a nine-slice keretrenderelés.
- Rögzítésre került a Csillagkönyvtár jóváhagyott referenciageometriája.
- A téma-váltáskor keletkező régi artwork-geometria takarítása stabilabb lett.
- Asset-, layout- és frame-tesztek készültek.

## v0.14.4 — 2026-09-24

### Mozgásérzékelő desktop felismerés
- Javult annak felismerése, hogy egy eszköz valóban alkalmas-e mozgásvezérlésre.
- A desktop böngésző puszta DeviceMotion/DeviceOrientation API-támogatása önmagában már nem tekintendő használható szenzornak.

## v0.14.0–v0.14.2 — 2026-09-24

### Theme Render V3 és Napüvegház
- Bevezetésre került a Theme Render V3.
- A témák shape-aware megjelenítése fejlődött.
- A Napüvegház nagyobb többcellás alakzatai külön növénytartó/megjelenítési logikát kaptak.
- A nagy alakzatok vizuális illeszkedése tovább finomodott.

## v0.13.0–v0.13.1 — 2026-09-24

### Shape-aware témák és Csillagkönyvtár
- A témarendszer felismeri és külön tudja megjeleníteni a merev alakzatokat.
- Megjelent a Csillagkönyvtár téma.
- A Csillagkönyvtár megkapta a korai Visual V2 megjelenést.

## v0.12.97–v0.12.99 — 2026-09-24

### Kétgolyós pályakönyvtár
- Elkészült a külön kétgolyós pályakönyvtár.
- A kétgolyós pályák D1–D10 nehézségi besorolást kaptak.
- A kezdetben túl könnyű pályák újragenerálásra kerültek.
- A 240 kétgolyós pálya nehézségét erősebben a tényleges megoldási komplexitáshoz kötöttük.
- Javult a kétgolyós pályák közötti továbblépés és kalibráció.

## v0.12.95–v0.12.96 — 2026-09-24

### Kétgolyós tesztmód és solver
- Megjelent az izolált kétgolyós tesztmód.
- A solver többgolyós állapotokkal is tud dolgozni.
- Bounded solver-tesztek készültek a többgolyós működéshez.

---

## Megjegyzés a korábbi történetről

A fenti, régebbi bejegyzések a `main` ág commit-történetéből rekonstruált, összevont kiadásjegyzetek. A repository korábbi fejlesztési módszere miatt egyetlen alkalmazásverzió több technikai commitból is állhatott, és nem minden commit rendelkezett önálló release-leírással.

A részletes technikai előzmények továbbra is megtalálhatók a Git commit historyban.
