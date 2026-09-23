# Teljes játékképernyős témák

A `theme.json` meglévő `colors`, `scene`, `pieces` és `audio` mezői változatlanul használhatók. A `ui.tokens` a közös játékfelület szemantikus színeit adja meg. A `ui.skin: "full"` egyedi pályakeret és vezérlőgeometria kialakítását is engedi a téma `theme.css` fájljában; az egyszerű témák ugyanazt a közös sablont kapják, kevesebb saját CSS-sel.

| Token | Feladat |
| --- | --- |
| `surface`, `surfaceRaised` | panelek és kijelzők |
| `control`, `controlRaised`, `controlPressed` | normál, kiemelt és lenyomott gomb |
| `accent`, `text`, `muted` | hangsúly, fő és másodlagos felirat |
| `border`, `shadow`, `focus`, `scrim` | keret, árnyék, fókusz és menü háttere |

A `js/scenario-loader.js` minden tokent CSS-változóvá alakít (`surfaceRaised` → `--ui-surface-raised`). Hiányzó tokenhez a téma meglévő színeiből számolható alapérték tartozik. A `css/game-ui-theme.css` csak a `body[data-ui-context="game"]` állapotában érvényes. Új játék közbeni gomb `data-ui-role="action"` vagy `ability`, új eredménykijelző `data-ui-role="display"`, új státusz `data-ui-role="status"` jelöléssel ugyanazokat a színeket kapja. Az új panelek a `.ui-panel .ui-card` szerkezetet használják. Az aktuális témához tartozó részletes rajzolatot a téma saját CSS-e adhatja meg `body[data-scene="..."]` alatt.

A főképernyő és az önálló beállítások a `shell` kontextusban működnek, saját, tartósan tárolt megjelenésválasztással. A játékból megnyitott beállításokat viszont az aktív játéktéma színezi. Ez az elválasztás az új kijelzésekre és vezérlőkre is érvényes.

Az `audio.music.notes` legfeljebb 32 hangból álló, `loopSeconds` hosszú halk zenei ciklus; minden hang `freq`, `dur`, `gain`, `at`, opcionális `instrument` (`harp`/`bell`) vagy `wave` mezőt használ. Az `audio.synthesis.events` az `move`, `blocked`, `freeze`, `exit`, `win` eseményekhez legfeljebb hat hangot adhat. Ha nincsenek ilyen mezők, az eddigi hangprofil marad érvényben. A böngésző a hangot csak felhasználói művelet után indítja.
