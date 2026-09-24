# GGrid – mozdulatfelismerés és helyi kalibráció, v0.12.89

## A beépített felismerés

A vezérlés kalibráció nélkül, alapértékekkel használható. Egy rövid billentés
egyetlen `move(direction)` hívást eredményez. A külön kapcsolható, a képernyő
síkjában végzett csúsztatás ugyanazt a nyilat adja. A felismerő mindvégig
megőrzi, hogy billentést vagy csúsztatást észlelt. Ugyanaz a játékfizika és
animáció érvényesül, mint a nyílgombnál. Döntve tartás nem ismétel.
Visszaállítás, emelés és süllyesztés nem játékparancs.

**Bemenetek:** `DeviceMotionEvent.acceleration.{x,y,z}` (gravitáció nélküli
gyorsulás, m/s²), `DeviceMotionEvent.rotationRate.{alpha,beta,gamma}` (°/s),
`DeviceOrientationEvent.{beta,gamma}` (°), `screen.orientation.angle` (°),
és az egyes minták monoton időbélyege (`performance.now()`, ms).

**Eseményfeldolgozás:** 650 ms-nyi előzményt tárolunk. A gyorsulás vagy
forgás küszöbátlépése csak egy *mozdulatjelöltet* indít; ekkor még nincs
lépés. A kiinduló tájolást a mozdulat előtt legalább 45 ms-mal vett minták
adják. A kezdeti 450 ms előjeles forgási csúcsait, a kezdőhelyzethez mért
legnagyobb szögkitéréseket, a kezdeti 160 ms átlagos forgását és mélységi
gyorsulását, a gyorsulási csúcsokat és mintaszámot jellemzőkké alakítjuk.
A végső helyzetből nem számítunk irányt: a játékos addigra visszaállíthatja
a telefont. Csúsztatás esetén a kezdeti 160 ms képernyő síkjába forgatott
`x,y` gyorsulását és a kezdeti 220 ms két ellenkező gyorsulási csúcsát
vizsgáljuk; a függőleges gyorsulási és forgási csúcsok kiszűrik az emelést,
süllyesztést és a billentést. Ellentmondó iránynál nincs parancs.
A mozdulat végét a beállított, alaphelyzetben 140 ms-os nyugalom vagy
1700 ms időkorlát jelöli. Ezután 130 ms alatt nem indul új jelölt, hogy a visszaállítás ne
számítson újabb lépésnek.

**Döntés:** a `motion-model.js` helyi osztályozója jobb/bal/fel/le vagy
„nincs parancs” eredményt ad. A döntést csak akkor fogadjuk el, ha a
profilban szereplő minimális forgási sebesség, szögkitérés és tengelydominancia
is teljesül. Ha a billentés nem igazolható, az engedélyezett csúsztatás
külön gyorsulási feltételeit vizsgáljuk; máskülönben nincs parancs.
Az 1–10-es „Mozdulat érzékenysége” skála a billentési és csúsztatási
küszöbökkel együtt a **mozdulat indítását** is hangolja: **10 az
érzékenyebb**, alapértéke 5. Az indításnak külön alsó határa van, hogy a
legérzékenyebb fokozat se induljon el egy tétova előmozdulatra. A külön
1–10-es „Lépés késleltetése” a nyugalmi várakozást 60–240 ms között
állítja. A „Csúsztatás is léptet” jelölőnégyzet alaphelyzetben kikapcsolt.
Mindhárom beállítás ezen a böngészőn marad meg a `ggrid.motion.gesture.v2`
kulcs alatt.
Nincs ismétlési tempó. Az érzékelők hiánya/engedélyének hiánya nem ad nyilat;
2500 ms-on át hiányzó használható mozgás- vagy tájolási adat kikapcsolja
a mozgásvezérlést. A képernyő és billentyűzet nyilai működnek tovább.

**Mérés:** `node tools/replay-motion-gesture.js --slides /útvonal/GGrid-calibration-*.json`.
A hat fájl 112 jelzett mozdulatából az alapbeállításoknál 68/72 billentés és
16/16 csúsztatás adta az elvárt nyilat. A leggyorsabb késleltetésnél és
közepes érzékenységnél 69/72 billentés sikerült.
Az emelés/süllyesztés 0/24 esetben adott parancsot. Kikapcsolt
csúsztatásnál mind a 16 csúsztatás figyelmen kívül maradt. A próbák során
egy mozdulat sem adott egynél több lépést. Ez fejlesztési visszajátszás:
az osztályozót ugyanennek a hat mérésnek az alapján készítettük, tehát az
eredmény nem független pontosságbecslés. Más telefon és szabad játék közben
még szükséges a tényleges próba.

## Későbbi kalibráció: bemenet, folyamat, kimenet

A készüléken futó, egyszerű animációs kalibráció **még nincs megírva**.
Célja a mozdulatok bemutatása és begyakoroltatása, a szükséges érzékelők
vizsgálata és a már működő algoritmus kis mértékű finomhangolása. Nem tanul
új irányjelentést és nem fordítja meg a jobb/bal vagy fel/le viszonyt.

1. **Érzékelők vizsgálata.** Felhasználói gombnyomás után engedélyt kér,
   és ellenőrzi az események jelenlétét, frissességét, időbélyegeit,
   numerikus értékeit, mintavételét, nyugalmi zaját, valamint a kért
   mozdulatokra adott forgási és gyorsulási választ. Hiányzó, végig nullás,
   szakadozó vagy fordított jelet készülékhibának/összeférhetetlenségnek
   jelöl; nem próbálja meg „javításként” megfordítani a játék irányait.
2. **Bemutató és próbasor.** Animáció mutatja a négy rövid billentést,
   valamint a telefon visszaállítását. Több ismétlést kér mindegyik irányra.
   Külön felirattal/animációval kér emelést, süllyesztést és négy csúsztatást
   a játékos felé néző kijelző síkjában. A nyíl mindig billentést jelent;
   a csúsztatási próbák a kapcsoló állapotától függően ugyanazt az irányt
   vagy „nincs parancs” eredményt várnak. Emelés és süllyesztés mindig
   „nincs parancs”.
3. **Mérési bemenet.** A fenti időbélyegzett érzékelőmintákon felül minden
   próbához rögzíti a felszólítás címkéjét, a jelzés idejét, a tényleges
   mozdulat kezdetét/végét és a mozdulat előtti nyugalmi szakaszt.
4. **Helyi számítás.** A pozitív és negatív próbákból csak kis mértékű,
   korlátozott küszöb- és időzítésmódosítást becsül. Külön visszatartott
   próbákon ellenőrzi az irányokat és az emelés/süllyesztés elutasítását.
   Ha egy negatív próba nyilat ad, az irányok összekeverednek, vagy a jelek
   nem megbízhatók, nincs érvényes kalibráció: ismétlést vagy hibajelzést ad.
5. **Kimenet.** Siker esetén az alábbi profilt a készülék saját
   `localStorage` tárába írja `ggrid.motion.profile.v1` kulccsal.
   Nincs szerveroldali tanítás vagy nyers adat feltöltése. Hibás/hiányzó
   profilnál a beépített alapértékek maradnak; hiányzó szenzornál a vezérlés
   nem működik. A jelenlegi „Mozdulatmérés” JSON-export kutatási eszköz,
   nem kalibráció.

### Kimeneti JSON-profil és megengedett tartományok

```json
{
  "version": 1,
  "coordinateSystem": "screen",
  "sensorMode": "gyro",
  "gyroAxes": {"x": {"alpha": 0, "beta": 1, "gamma": 0},
               "y": {"alpha": 1, "beta": 0, "gamma": 0}},
  "orientationAxes": {"x": {"beta": 0, "gamma": 1},
                      "y": {"beta": 1, "gamma": 0}},
  "minimumRate": 75,
  "minimumExcursion": 8,
  "slideAcceleration": 0.6,
  "dominance": 1.45,
  "triggerAcceleration": 2.2,
  "triggerRate": 60,
  "quietAcceleration": 0.85,
  "quietRate": 23,
  "quietMs": 170,
  "maxGestureMs": 1700,
  "minSamples": 5,
  "orientationRequired": true
}
```

Az alapértékeket a `js/motion-gesture.js` tartalmazza. A tengelyleképezés
**rögzített**: a `isMotionGestureProfile()` eltérő előjelet vagy cserét
elutasít. A becsülhető mezők tartományai: `minimumRate` 70–140 °/s,
`minimumExcursion` 7–18°, `dominance` 1,2–1,8,
`slideAcceleration` 0,4–1,2 m/s²,
`triggerAcceleration` 1,5–3,2 m/s², `triggerRate` 45–85 °/s,
`quietAcceleration` 0,5–1,3 m/s², `quietRate` 15–33 °/s,
`quietMs` 130–230 ms, `maxGestureMs` 1300–2100 ms, `minSamples` 4–9.
Későbbi új paraméter új profilverziót és külön ellenőrzést igényel.
Tájolás-only tartalék mód jelenleg nincs; az alapműködés sem helyettesíti
észrevétlenül a hiányzó forgási sebesség érzékelőt.
