# Fast Generator v3

A Fast Generator v3 a GGrid jelenlegi v2 generátorának továbbfejlesztése. A Claude-féle gyors multiball generátor hasznos keresési ötleteit egyesíti a később elkészült GGrid infrastruktúrával.

## Megtartott v2+ funkciók

- paraméterezhető `--target "100@5x8:D1-D10:B1,B2"`;
- 1 és 2 golyós generálás;
- Metadata Schema v3;
- globálisan egyedi `levelId`;
- `familyId` és family-korlát;
- canonical fingerprint, SimHash és LSH novelty index;
- 4–6 cellás nagy rigid alakzatok;
- `analysis.solutionRequirements.freeze`;
- külön `generated-test` katalógus;
- runtime solveres végső optimalitás-ellenőrzés;
- alapból legfeljebb 4 worker és state-space memóriaőr.

## Új v3 keresési motor

Két keresési család működik együtt.

### State-space ág

- `space-mixed`
- `space-walled`

A teljes elérhető állapottér egyszer kerül felépítésre. A v3 már az összes irányátmenetet (`trans`) és az állapotindexet is megőrzi.

A `graphSolver()` ugyanebből a gráfból szolgálja ki a kétgolyós classifier további BFS-kéréseit. Ha a keresett állapot nincs a gráfban, automatikusan a játék runtime solverére esik vissza.

### Direct ág — főleg B2 high-D kereséshez

- `direct-open`: nyitottabb, sok kisebb rigid objektumot tartalmazó startállapot;
- `direct-hard`: multiball-specifikus, magas objektumsűrűségű layout;
- `direct-mutate`: a jelenlegi legnehezebb ismert/jelen futásban talált pályák helyi mutációja.

A direct ág nem építi fel a teljes state-space-t, ezért olyan nagy állapotterű 5×6–5×8 kétgolyós pályák is kereshetők vele, amelyeket a state-cap miatt a teljes gráfos ág kihagyna.

## Multiball-specifikus profilok

A kétgolyós generálás külön fal/tégla tartományokat használ, amelyek a jelenlegi multiball könyvtárból származnak. Nagyobb táblákon továbbra is engedélyezettek a GGrid v2-ben bevezetett 4–6 cellás alakzatok.

## Elite pool

Minden worker megkapja az adott méret/golyószám legmagasabb raw score-ú meglévő pályáit. A futás közben talált még nehezebb jelöltek bekerülnek ugyanebbe az elite poolba.

A `direct-mutate` ebből a poolból indul, így a ritka D9/D10 régióban lokális keresést végez.

## Adaptív stratégia

A worker minden stratégiánál méri:

- eltelt idő;
- a még nyitott D-osztályokba adott találatok száma.

A választási valószínűség ennek megfelelően változik. Ha D8–D10 még hiányzik kétgolyós módban, a `direct-mutate` és `direct-hard` külön prioritást kap.

## Novelty / duplikáció

A v3 elfogadási kapuja a jelenlegi fingerprint indexet használja.

- `--novelty strict`: csak UNIQUE;
- `--novelty review`: DUPLICATE és NEAR_DUPLICATE kiesik, SIMILAR még elfogadható;
- `--novelty off`: csak exact canonical duplicate esik ki.

Az elfogadott új pályák azonnal bekerülnek a futás lokális indexébe, így egymással szemben is működik a novelty-szűrés.

## Példák

```bash
node tools/generate-levels-v3.mjs --target "100@5x8:D1-D10:B1,B2"
node tools/generate-levels-v3.mjs --target "10@5x8:D10:B2" --minutes 15 --official-check
node tools/generate-levels-v3.mjs --target "20@5x7:D8-D10:B2" --strategy direct-mutate --novelty strict
```

## D-besorolás

A v3 nem változtatja meg a nehézségi modellt.

- B1: jelenlegi `puzzle-v2`;
- B2: jelenlegi `puzzle-v3-multiball-anchored-v2`.

A classifier most opcionális `solve` backend-et fogad, így a graphSolver gyorsíthatja a state-space ágon, de alapértelmezésben továbbra is a meglévő solverrel működik.

## Freeze

A v3 jelenleg továbbra is Freeze nélküli pályákat generál. Minden ilyen rekord:

```json
"solutionRequirements": {
  "freeze": {
    "status": "not-required",
    "minimumUses": 0
  }
}
```

A későbbi Freeze-required generátor ugyanebbe a metadata mezőbe írhatja a `required` állapotot.
