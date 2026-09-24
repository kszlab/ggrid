# CSILLAGKÖNYVTÁR // Az égi archívum

## Vizuális alapelv

A Csillagkönyvtár egy csillagvizsgálóval egybeépített, régi égi archívum. Nem sci-fi kezelőfelület és nem steampunk gépház: a fő anyagok sötét fa, mélykék zománc, öregített bronz, pergamen/elefántcsont és hideg csillagfény.

A képernyő három fényréteget használ:
- meleg, arany könyvtári/lámpafény;
- hideg kék-lila csillagfény;
- visszafogott elefántcsont fény a pályacellákon.

A játéktábla mindig elsődleges marad. A háttér részletes, de a mozgó elemek körvonala és a kijárat kontrasztja erősebb.

## Játékelemek

| Logikai elem | Témabeli jelentés |
| --- | --- |
| ball | Asztrálgyöngy – apró fénylő égbolt, bronz pályagyűrűkkel |
| brick (1 cella) | Archívumkötet – bőr/vászon kötésű csillagászati könyv |
| wall | Csillagtérkép-talapzat – kő/bronz fix archívumi oszlop |
| exit | Asztrolábium-kapu – forgó gyűrűs csillagajtó |
| freeze | Időpecsét |
| rigid body | Archívumbútor / atlaszszekrény, alakzatonként megtervezve |

## Többcellás alakzatok

A jelenlegi shape-katalógus minden orientációja külön grafikai változatot kap:

- `2H`: kétcellás széles atlaszszekrény;
- `2V`: kétcellás álló kódex;
- `3H`: háromcellás csillagatlasz-pult;
- `3V`: háromcellás magas archívumkódex;
- `L3-TL`, `L3-TR`, `L3-BL`, `L3-BR`: négy sarok-archívumbútor.

Az L alakok 2×2 bounding boxban készülnek, de a hiányzó negyed átlátszó. A fedőréteg `pointer-events:none`, ezért a grafika nem módosítja a fizikát vagy a kattintási geometriát.

Ha később új alakzat jelenik meg és még nincs egyedi Csillagkönyvtár-grafikája, a Scene Renderer kötelező cellás fallbackje használható. A shape-audit jelzi a hiányt.

## Felület

- Fejléc: sötétkék zománc + bronz keret.
- Témacím: íves, csillagtérképes bronz tábla.
- Nyílvezérlők: gravírozott égi műszerkarok.
- HUD: ugyanaz a sötétkék/bronz rendszer, nem különálló modern panel.
- Pálya: világos pergamen/üveg cellák halvány csillagtérkép-rajzzal.
- Menü és dialógusok: az aktív téma `ui.tokens` színeit használják.

## Környezet

A háttérben:
- magas könyvespolcok;
- íves csillagvizsgáló-ablak;
- csillagképek;
- asztrolábium és orrery;
- rézlámpák;
- csillagtérképek;
- lassan lebegő porszemek.

A környezeti elemek nem takarhatják a táblát és nem lehetnek interaktívak.

## Hang

A zenei alap halk drón + hárfa + üvegharang. A mozgás rövid pengetés, a Freeze magas harang, a kijárat és győzelem emelkedő csillagászati akkord. A hangprofil teljesen procedurális, külső audio asset nélkül.

## Karbantartás

Új pályaalakzatok után:

```
node tools/scan-rigid-shapes.mjs
node tools/audit-theme-shapes.mjs
```

A Csillagkönyvtár célállapota: minden aktuális alakzat `custom` coverage.
