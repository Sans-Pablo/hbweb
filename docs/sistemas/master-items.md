# Objetos Master eliminados (v0.85.100, obs. 111)

Ids quitados de `web/data/items.json`: 245 AresdenFlag(Master), 246 ElvineFlag(Master), 1891-1913 (MasterHauberk/Helm/Leggings/PlateMail/ChainMail/Robe en M y W, MasterWand MS20/MS30, Rapier, GreatSword, Flameberge, GiantSword, BHammer, Master-Cap M/W, MasterBow, MasterPenitence). Lista en `REMOVED_MASTER_IDS` (`web/src/shared/items.js`).
Se conserva 2027 ElfMasterBall (bola de la mascota Elf-Master, no es un objeto Master).

- Tiendas/bots: ya filtraban `IS_MASTER_ITEM` (shopsys.js); no había drops ni filas en shops.json.
- Migración: `loadSave` (systems/player.js) filtra bag/bank/pending con `w.data.item(id)`, así que los personajes guardados pierden esos objetos al cargar y el equipo se reconstruye sin ellos.
- Test: `tests/master-items.test.mjs`; `original-data.test.mjs` exime estos ids de "FALTA".
