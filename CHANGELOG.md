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

## v0.15.48 — 2026-09-25

### Theme Kit UTF-8 kimeneti javítás véglegesítése
- A Theme Kit minden generált JSON/CSS kimenetet explicit UTF-8 kódolással ír.
- Javítva a kit-report, runtime theme.json, artwork.css, themes index és capture.json írása Windows alatt.
- Ezzel megszűnik a CP1250/CP1252 UnicodeEncodeError a build végén.

## v0.15.47 — 2026-09-25

### Windows BAT indítók kódolásbiztosítása
- A Theme Studio indító BAT fájlok csak ASCII karaktereket használnak.
- Ez megszünteti a Windows cmd kódlap/UTF-8 értelmezési hibáit, amelyek ékezetes `echo` sorokat külön parancstöredékekként próbáltak futtatni.
- A szerverindító hiba esetén nyitva marad és láthatóan kiírja a Node hibát.

## v0.15.46 — 2026-09-25

### make_slots.py szintaxisjavítás
- Javítva a `make_slots.py` sérült több soros UTF-8 írása, ahol literális `\\n` karakterek SyntaxError-t okoztak.
- A Python szintaxisellenőrzés továbbra is kötelező a Theme Studio CI-ben.

## v0.15.45 — 2026-09-25

### Theme Kit Python szintaxis és UTF-8 javítás
- Javítva a `kit.py` sérült több soros `approval.json` írása, ahol a literális `\\n` karakterek SyntaxError-t okoztak.
- Minden érintett JSON/CSS kimeneti írás explicit UTF-8 és valódi soremelés használatára állt át.
- A Theme Studio CI most `python -m py_compile` ellenőrzést futtat a `kit.py` és `make_slots.py` fájlokra is.

## v0.15.44 — 2026-09-25

### Theme Studio Windows indító stabilizálás
- Külön `START_THEME_STUDIO_SERVER.bat` indító készült a Node szerverhez.
- A fő `START_THEME_STUDIO.bat` most ezt a külön szerverindítót hívja a korábbi, törékeny többszörös idézőjelezés helyett.
- A szerverablak induláskor kiírja a munkamappát és hiba esetén nyitva marad, így a tényleges Node hibaüzenet látható marad.

## v0.15.43 — 2026-09-25

### Theme Pipeline Windows kimeneti UTF-8 javítás
- A Theme Kit minden generált JSON/CSS kimenetet explicit UTF-8 kódolással ír Windows alatt is.
- Javítva a `kit-report.json`, `approval.json`, runtime `theme.json`, `artwork.css`, `content/themes/index.json` és `capture.json` írása.
- Ez megszünteti a Windows alapértelmezett kódlapja miatt jelentkező UnicodeEncodeError hibákat a build végén.

## v0.15.42 — 2026-09-25

### Theme Studio ↔ Theme Pipeline approval szinkron
- A Studio mood/target/sheets jóváhagyásai most automatikusan frissítik a Theme Pipeline által használt `approval.json` fájlt.
- Mood és target jóváhagyáskor szabványos `mood.png` illetve `target.png` másolat készül a kiválasztott képből.
- Sheets jóváhagyáskor a négy kötelező elemlap SHA-256 hash-e bekerül a pipeline approval manifestbe.
- A QA capture a szabványos `target.png` fájlt használja.
- Ez megszünteti a `approval validation failed: sheets stage not approved` buildhibát a Studio-ból indított buildnél.

## v0.15.41 — 2026-09-25

### Theme Kit Windows UTF-8 javítás
- A `make_slots.py` most explicit UTF-8 kódolással írja a `slots.json` fájlt Windows alatt is.
- A `kit.py` felismeri a korábbi ANSI/CP1252 `slots.json` fájlt, automatikusan újragenerálja UTF-8 formátumban, majd folytatja a buildet.
- Ez megszünteti a Windows alatt jelentkező `UnicodeDecodeError: byte 0x96` buildhibát.

## v0.15.40 — 2026-09-25

### Theme Studio build-előfeltétel ellenőrzés
- A Windows indító most UTF-8 kódlapot használ, így a magyar hibaüzenetek nem torzulnak.
- Induláskor ellenőrzi a Node.js mellett a Python jelenlétét is.
- Ha Python hiányzik, előre jelzi, hogy a Studio használható, de a TÉMA ÉPÍTÉSE funkció nem fog működni.
- Ha Python megvan, ellenőrzi a Pillow és Playwright csomagokat, és kiírja a pontos telepítési parancsokat.

## v0.15.39 — 2026-09-25

### Theme Studio projekt-export javítás
- A `.ggrid-theme-project` export/import többé nem igényel Python telepítést.
- Windows alatt a Studio a rendszer PowerShell `Compress-Archive / Expand-Archive` funkcióját használja; Linux/macOS alatt a szabványos `zip / unzip` parancsot.
- A SHA-256 manifestet és az export staging struktúrát maga a Node szerver készíti és ellenőrzi.
- A subprocess indítás most külön spawn-hibát is kezel.
- Export hiba esetén a felület már a szerver tényleges hibaüzenetét mutatja, nem csak az általános „Export hiba” szöveget.

## v0.15.38 — 2026-09-25

### Theme Studio elemlap-feltöltés állapotjavítás
- A négy elemlap kártyája most a tényleges projektfájlok alapján mutatja a `HIÁNYZIK / FELTÖLTVE / JÓVÁHAGYOTT` állapotot.
- Feltöltés után megmarad az előnézet, a fájlméret és a SHA-256 hash rövidített értéke; a böngésző fájlválasztójának „Nincs fájl kiválasztva” szövege többé nem téveszthető össze a projekt feltöltési állapotával.
- Az „Elemlapok jóváhagyása” gomb csak akkor aktív, ha mind a négy kötelező PNG ténylegesen létezik.
- A szerver jóváhagyáskor újra beolvassa és SHA-256-tal rögzíti mind a négy elemlapot; hiányzó fájl esetén a jóváhagyás hibával leáll.
- A jóváhagyott státusz csak addig marad érvényes, amíg a feltöltött fájl hash-e egyezik a jóváhagyott verzióval.

## v0.15.37 — 2026-09-25

### Egylépéses Theme Studio indítás Windows alatt
- Új gyökérszintű `START_THEME_STUDIO.bat` indító került a repóba.
- Dupla kattintásra ellenőrzi a Node.js elérhetőségét, külön parancssori ablakban elindítja a Theme Studio szervert, majd megnyitja a böngészőt a `http://127.0.0.1:4177` címen.
- Új `theme-studio/INDITAS-WINDOWS.txt` rövid leírás készült kézi indítási és leállítási lépésekkel.

## v0.15.36 — 2026-09-25

### Theme Studio v0.1 és Csillagkönyvtár pilot
- Elkészült a helyi, Node.js-alapú **Theme Studio v0.1** webalkalmazás a Theme Pipeline v1 fölött.
- A Studio kezeli a témakatalógust, a mood/target/sheets promptverziókat, a képfeltöltéseket, a jóváhagyási lépéseket, a Theme Pipeline build indítását, a QA státuszt, valamint a teljes projekt export/import folyamatot.
- Bevezetve a hordozható `.ggrid-theme-project` projektarchívum; exportkor a projektforrások mellett a megadott örökölt runtime források is bekerülnek, SHA-256 manifesttel.
- Az első pilotprojekt a **Csillagkönyvtár / celestial-library**. A meglévő v17 runtime téma és artwork baseline referenciaként megmarad, de az új Studio-folyamat MOOD fázisból indul.
- A pilot migráció explicit módon jelzi, hogy az eredeti 2026-09-24 jóváhagyott koncepciókép és az eredeti képgenerálási promptok nincsenek a repóban.
- Külön CI ellenőrzi a Studio szerver indulását, a pilot projekt állapotát és a self-contained projekt-exportot.

## v0.15.35 — 2026-09-25

### Theme Pipeline v1 — hangulattervtől reprodukálható játékbeli témáig
- Elkészült az önálló GGrid **Theme Pipeline v1**; a Claude-javaslat hasznos ötletei beépültek, de a rendszer nem függ Claude-tól.
- A folyamat rögzített: **hangulatterv → render-célkép → elemlapok → strict build → valódi játék screenshot QA → tulajdonosi átvétel**.
- A `showcase.png` és a geometriailag kötött `target.png` külön szerepet kapott; a végső összevetés a render-célképhez történik.
- SHA-256 alapú `approval.json` jóváhagyási lánc készült (`mood → target → sheets`); jóváhagyott kép módosítása után a build új jóváhagyás nélkül leáll.
- Strict módban kötelező a teljes board/chrome/Freeze/anyag assetkészlet; a külön festett 2H/2V/3H/3V/L alakok opcionálisak.
- Új `ThemeAutotile` renderer képes tetszőleges összefüggő többcellás rigid testet két 3×3 festett anyagmintából folytonos tárgyként kirajzolni.
- A meglévő per-shape artwork továbbra is elsőbbséget élvez; a régi témák működése változatlan marad.
- Új **GGrid theme templates** Action generálja a mindenkori játékból az elemlap-sablonokat és a render-célkép alapot.
- Új **GGrid theme pipeline** Action strict buildet, repository-teszteket, valódi játék screenshotokat és külön theme PR-t készít.
- Dokumentáció és CI-regresszió készült a pipeline slot-sémájára és az autotile alakzatkezelésére.

## v0.15.34 — 2026-09-25

### Compact Freeze Solver v2 nagy pályákhoz
- Új, külön `js/freeze-solver-v2.js` készült; a normál `solveDetailed()` és a Freeze Solver v1 változatlanul megmaradt.
- A v2 tömör `Int16Array` állapotokat használ, így jóval kevesebb objektumklónozás és string-alapú állapotépítés történik.
- Freeze-jelöltként csak olyan aktív, nem fal objektumot vizsgál, amely az adott normál irányparancsra ténylegesen elmozdulna; a már eleve helyben maradó objektumok felesleges Freeze-ágai kiesnek.
- A ❄💡 súgó most a v2 solvert használja. A kétgolyós nagy pályák idő-/állapotkerete is nőtt, de a fő gyorsulást az állapottér és a Freeze-elágazások csökkentése adja.
- Új regressziós teszt hasonlítja össze a v1 és v2 mentési képességét, visszajátssza a v2 Freeze-akcióit, és 5×8 D10 benchmarkpályákon is ellenőrzi a normál megoldások megőrzését.

## v0.15.33 — 2026-09-25

### Külön Freeze-aware solver v1 és kísérleti ❄💡 súgó
- Új, izolált `js/freeze-solver-v1.js` készült; a meglévő `solveDetailed()` változatlan maradt.
- A solver legfeljebb egy Freeze használatával is kereshet megoldást, és az útvonalban lépésenként tárolja az irányt és az esetleges `freezeId`-t.
- Normálisan megoldható állapotnál továbbra is Freeze nélküli optimális útvonalat ad vissza.
- A HUD-ban külön **❄💡 Freeze-súgó** gomb jelent meg: rövid nyomás egy Freeze-t is figyelembe vevő javaslatot ad, 2 másodperces nyomva tartás pedig a teljes megoldást animálja.
- Az automatikus Freeze-demó kijelöli a lefagyasztandó objektumot, majd végrehajtja a megfelelő irányparancsot; a demó nem von le Freeze-pontköltséget és az adott menetért nem jár pont.
- Külön regressziós teszt ellenőrzi, hogy a normál megoldások változatlanok maradnak, és hogy egy normálisan megoldhatatlan állapot egy Freeze használatával ténylegesen megmenthető és végigjátszható.

## v0.15.32 — 2026-09-25

### Külön V3 D10 benchmark tesztmód
- A Szabad játék választóban külön **🧪 V3 D10 TESZT** gomb jelent meg.
- A mód kizárólag a `fastgen-v3-d10-benchmark` pack 15 pályáját használja; nem keveri őket a 600-as régi generátor-tesztcsomaggal.
- A mód automatikusan D10-re állítja a nehézséget, és 5×6 / 5×7 / 5×8 méreten az adott 5 benchmarkpályát járja körbe.
- Az **Új pálya** gomb benchmark módban ugyanazon packon belül léptet tovább.
- A generált tesztkönyvtár pack-szintű `hasPack`, `nextPack`, `firstPackAvailable` API-t kapott.

## v0.15.31 — 2026-09-25

### FastGen v3 D10 benchmark tesztpack
- A 15 célzott FastGen v3 kétgolyós D10 benchmarkpálya külön `fastgen-v3-d10-benchmark` tesztpackba került.
- A pack 5×6, 5×7 és 5×8 méreten 5-5 pályát tartalmaz, kizárólag a `generated-test` katalógusban.
- A pályák metadata-ja egységesítve lett: `generatorVersion: 3`, `library: generated-test`, végleges benchmark `packId`.
- Javítva a közös `toRecord()` is, hogy a `content.generatorVersion` a tényleges generátorverzióból származzon.

## v0.15.30 — 2026-09-25

### Fast Generator v3 — adaptív multiball keresés
- Elkészült a külön Fast Generator v3; a működő v2 referencia változatlanul megmarad.
- A v3 átveszi a Claude-javaslat hasznos elemeit: multiball-specifikus layout profilok, transition-table alapú `graphSolver`, direct-open/direct-hard keresés, elite-pool alapú `direct-mutate`, valamint adaptív stratégia-választás.
- D8–D10 kétgolyós hiány esetén a worker automatikusan nagyobb súlyt ad az elite-mutate és hard-multiball keresésnek.
- Megmarad a jelenlegi Metadata Schema v3, globális `levelId`, family-diverzitás, 4–6 cellás nagy rigid shape támogatás, Freeze requirement, valamint canonical fingerprint / SimHash / LSH novelty-szűrés.
- Az új generátor elfogadási kapuja az aktív könyvtár és a futás során már elfogadott pályák ellen is ellenőrzi a duplikációt/hasonlóságot.
- A kétgolyós classifier opcionális solver-backendet kapott; alapértelmezett működése változatlan, state-space ágon pedig a gráfból gyorsítható.
- Új regressziós teszt ellenőrzi a graphSolver/runtime solver egyezést, a multiball classifier egyezést és a v3 end-to-end kimeneti metadata-t.

## v0.15.29 — 2026-09-25

### Freeze megoldási követelmény metaadat
- A pályák `analysis.solutionRequirements.freeze` mezőt kaptak.
- `status` értéke lehet `not-required`, `required` vagy `unknown`; a hozzá tartozó `minimumUses` rendre 0, legalább 1 vagy `null`.
- A jelenlegi aktív pályák normál solverrel megoldhatók, ezért migrációkor `not-required / 0` értéket kapnak.
- A Fast Generator normál pályái mostantól közvetlenül ugyanezt a mezőt írják.
- A validator ellenőrzi a Freeze-státusz és `minimumUses` konzisztenciáját.

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
