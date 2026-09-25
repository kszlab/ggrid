# Fast Generator v2 — első tesztverzió

A Fast Generator v2 a Claude-féle state-space/reverse-BFS generátor továbbfejlesztett, GGridbe integrált változata.

## Cél

- nagy mennyiségű pálya előállítása kevés ismételt solver-munkával;
- 1 és 2 golyós pályák közös generálási pipeline-ban;
- D1–D10 célkvóták;
- nagyobb táblákon 4–6 cellás rigid objektumok;
- exact duplicate és strukturális family szűrés;
- külön generátor-tesztkönyvtár, az éles könyvtár módosítása nélkül;
- későbbi pack/entitlement rendszerhez használható metadata.

## Példák

```bash
node tools/generate-levels-v2.mjs --target "100@5x8:D1-D10:B1,B2"
node tools/generate-levels-v2.mjs --target "100@5x8:D1-D10:B1" --target "100@4x8:D1-D10:B1,B2"
node tools/generate-levels-v2.mjs --size 5x7 --classes 6-10 --balls 1,2 --count 200
```

A `--target` elején lévő szám az adott célhoz kért teljes pályaszám. Több golyószám esetén a kvóta pontosan megoszlik köztük, a D-osztályokon belül pedig közel egyenletesen. Az egygolyós mód 3–8 közötti egyedi táblaméreteket is elfogad (például 4×8). A kétgolyós D-besorolás jelenleg csak a kalibrált 3×3, 4×4, 5×5, 5×6, 5×7 és 5×8 méretekre engedélyezett.

## Fontos kapcsolók

- `--workers N`: alapból legfeljebb 4 worker, hogy a state-space keresések ne fogyasszanak indokolatlanul sok memóriát.
- `--state-cap 180000`: workerenkénti állapottér-limit.
- `--large-shapes auto|on|off`: 4–6 cellás rigid testek. `auto` nagyobb táblákon bekapcsolja őket.
- `--family-cap 2`: ugyanabból a szerkezeti családból legfeljebb ennyi kezdőállás kerülhet egy futás eredményébe.
- `--seed N`: generálási seed. Teljes bitreprodukálhatósághoz `--workers 1` javasolt.
- `--publish-test`: a packot a `content/levels/generated-test/` könyvtárba teszi, és regisztrálja a külön tesztkatalógusban.

## Nehézségmérés

- 1 golyó: gyors, a jelenlegi `puzzle-v2` modellhez illesztett classifier.
- 2 golyó: a jelenlegi `puzzle-v3-multiball-anchored-v2` classifier.
- Minden elfogadott pálya megoldását a játék saját motorja visszajátssza, majd a runtime solverrel optimalitás-ellenőrzést végez.

## Változatosság

Két külön szűrés működik:

1. exact fingerprint — szimmetriákat is figyelembe vevő konkrét duplikációszűrés;
2. family fingerprint — azonos kijárat/falstruktúra és azonos objektum-shape készlet esetén korlátozza az ugyanabból a családból elfogadott pályákat.

A fingerprint külön típuskódot használ golyóra, rigid testre és falra; a korábbi ball/brick elsőbetű-ütközés nincs jelen.

## Nagy rigid objektumok

A generator v2 extra shape-készlete 4, 5 és 6 cellás alakzatokat tartalmaz (egyenes, négyzet, T/L/U/V és téglalap jellegű formák). `auto` módban a 35 vagy több cellás táblákon legalább egy nagy rigid testet próbál elhelyezni.

Ezek a generator kimenetében szabályos `rigid-body` objektumok. A témák későbbi kezelőfelületén külön ellenőrizni kell, hogy egy adott téma rendelkezik-e saját artworkkel az adott shape-hez; generikus renderer fallback ettől külön kérdés.

## Tesztelés a játékban

A Szabad játék választóban külön **⚗ GENERÁTOR TESZT** gomb található.

Ez kizárólag a következő katalógust olvassa:

`content/levels/generated-test/catalog.json`

így az új generator packok nem keverednek a normál és a jelenlegi 2-golyós könyvtárral.

A repó tartalmaz egy kis bootstrap packot 3×3-as, 1 és 2 golyós pályákkal, hogy maga az interface azonnal kipróbálható legyen. Ezt később valódi Fast Generator v2 packok válthatják.

## Későbbi content/paid modell

A kimeneti rekordok már tartalmaznak `content` metadata-részt:

- `packId`
- `familyId`
- `ballCount`
- `generatorVersion`

és az analysis tartalmazhat `qualityScore` / `noveltyScore` értéket. Ez előkészíti a későbbi Content Catalog / AccessManager / entitlement rendszert, de ebben a verzióban még nincs fizetési vagy backend logika.
