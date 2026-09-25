# Csillagkönyvtár – Theme Studio pilot

Ez a projekt a meglévő `content/themes/celestial-library` runtime téma Theme Studio v0.1 pilot-migrációja.

## Kiindulási helyzet

Megvan:
- részletes DESIGN.md;
- Artwork V2 implementation contract;
- approved-reference.json geometriai/metaadat;
- működő theme.json és runtime artwork;
- korábbi high-fidelity QA metaadat.

Hiányzik a repóból:
- az eredeti jóváhagyott koncepciókép;
- az eredeti képgenerálási promptok.

Ezért a pilot **nem tekinti automatikusan jóváhagyottnak** a mood/target/sheet fázisokat. A meglévő runtime csak baseline referencia.

## Pilot sikerfeltétele

A Studio-n keresztül újra végig kell menni:
1. mood;
2. target;
3. sheets;
4. build;
5. QA;
6. project export.

Az új buildet a jelenlegi v17 témával és az elfogadott új render-célképpel is össze kell vetni.
