# GGrid Level Metadata Schema v3

## Cél

A v3 metadata-réteg egységes adatmodellt ad a régi egygolyós, a kétgolyós és a Fast Generator pályáknak úgy, hogy a játékszabály-formátum változatlan marad (`formatVersion: 2`).

A schema a későbbi GGrid Content Manager, pályacsomag-kezelés, jogosultság/entitlement rendszer, keresés, szűrés és játékosi visszajelzés alapja.

## Mi kerül a statikus pályafájlba?

### `content`

Minden aktív pálya:

```json
{
  "content": {
    "metadataVersion": 3,
    "packId": "classified-v2-5x8",
    "library": "core",
    "familyId": "fam-0123456789abcdef",
    "ballCount": 1,
    "generatorVersion": null,
    "structure": {
      "ballCount": 1,
      "wallCount": 4,
      "rigidBodyCount": 6,
      "rigidCellCount": 12,
      "multiCellRigidCount": 4,
      "largeRigidCount": 0,
      "maxRigidCells": 3,
      "rigidSizeHistogram": {"1":2,"2":2,"3":2}
    },
    "provenance": {
      "origin": "legacy-library",
      "metadataMigratedBy": "level-metadata-v3"
    }
  }
}
```

A `familyId` a méret, kijárat, falelrendezés és az objektumok shape-készlete alapján képzett strukturális család azonosítója. A mozgatható objektumok kezdőpozíciója nem része a családazonosítónak.

### `analysis`

A meglévő solver-metrikák megmaradnak. Ehhez egységesen hozzáadódik:

- `qualityScore` — 0..1, a meglévő solver-metrikákból számított minőségi jelző;
- `noveltyScore` — 0..1, jelenleg a teljes aktív könyvtárban mért family-gyakoriság reciproka;
- `qualityMethod: "solver-metrics-v1"`;
- `noveltyMethod: "family-frequency-v1"`.

A novelty v1 szándékosan egyszerű és determinisztikus. Később fejlettebb hasonlósági modell válthatja fel anélkül, hogy a schema szerkezete változna.

## Pack metadata

Minden catalog-bejegyzés és pack kap:

```json
{
  "metadataVersion": 3,
  "contentType": "level-pack",
  "status": "active",
  "levelCount": 100,
  "access": {
    "entitlement": null,
    "visibility": "public"
  }
}
```

Az `access.entitlement` ma `null`, tehát minden tartalom elérhető. Később például:

```json
"access": {
  "entitlement": "pack.large-expert-01",
  "visibility": "catalog"
}
```

A játék/UI később ebből döntheti el, hogy egy pack játszható vagy csak szürkén/lakattal jelenjen meg.

## Mi NEM kerül a statikus pályafájlba?

A felhasználói és közösségi adatok külön backend-adatok lesznek:

- egyéni értékelés;
- aggregált rating/ratingCount;
- érzékelt nehézség;
- teljesítési arány;
- átlag/medián lépésszám;
- felhasználói entitlementek;
- vásárlási adatok.

Ezek dinamikusan változnak, ezért nem helyes minden értékelésnél pályapackot újrakiadni.

A Content Manager később a statikus level metadata és a backend aggregátumok összekapcsolt nézetét használja.

## Könyvtárak

- `core`: aktív egygolyós főkönyvtár;
- `multiball`: aktív kétgolyós könyvtár;
- `generated-test`: Fast Generator tesztkönyvtár.

## Migráció

`node tools/migrate-level-metadata-v3.mjs`

A migráció:

1. beolvassa mindhárom aktív katalógust;
2. meghatározza minden pálya familyId-ját és structure adatait;
3. globálisan megszámolja a családokat;
4. kiszámolja a quality/novelty értékeket;
5. bővíti a pack- és catalog-metadata mezőket;
6. elkészíti a `tools/level-metadata-v3-report.json` riportot.

A migráció nem változtatja meg a pálya geometriáját, solver-megoldását vagy D-osztályát.

## Validáció

`node tools/verify-level-metadata-v3.mjs`

A validator újraszámolja a determinisztikus mezőket és hibát jelez, ha egy tárolt familyId, structure vagy qualityScore elavult/hibás.
