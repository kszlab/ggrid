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
