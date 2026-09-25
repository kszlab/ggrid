# GGrid Theme Studio v0.1

Helyi fejlesztői webalkalmazás a Theme Pipeline v1 fölött.

## Indítás

A GGrid repo gyökeréből:

```bash
node theme-studio/server.mjs
```

Majd:

```text
http://127.0.0.1:4177
```

Nincs szükség npm csomagtelepítésre: a Studio szervere csak Node.js beépített modulokat használ. A build/QA műveletekhez a Theme Pipeline Python/Playwright környezete szükséges.

## v0.1 funkciók

- témakatalógus;
- új Theme Project;
- promptverziók mood/target/sheets fázisokhoz;
- PNG/JPG/WebP feltöltés;
- mood és target jóváhagyás;
- 4 elemlap feltöltése és sheet approval;
- Theme Pipeline build indítása;
- QA státusz;
- teljes projekt export `.ggrid-theme-project` formátumba;
- projekt import hash-ellenőrzéssel;
- örökölt runtime források csomagolása az exportba.

## Első pilot

`celestial-library` / **Csillagkönyvtár**.

A pilot a meglévő v17 runtime témát baseline-ként őrzi, de az új folyamat MOOD fázisból indul. Az eredeti elfogadott 2026-09-24 koncepciókép nincs a repository-ban, ezért azt vagy vissza kell tölteni, vagy új Studio-ban jóváhagyott mood képet kell készíteni.

## Fontos

A Studio a `design/themes/<id>/` projektforrásokat szerkeszti. A működő `content/themes/<id>/` runtime téma csak explicit build során változik.
