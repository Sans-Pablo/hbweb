// Descansos de los habitantes (leisure.js): pescan en la orilla o hacen otra actividad, y lo anotan en r.lz.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(33) });
a.report = () => {};
const run = (ms, f) => { for (let i = 0; i < ms / 50; i++) { a.tick(50); if (f?.()) return true; } return false; };
a.spawnResident("Aldric");
const b = a.residents().find(x => x.name === "Aldric"), home = a.farm;
import * as Leisure from "../web/src/shared/systems/leisure.js";
assert.ok(Leisure.KINDS.fish && Leisure.KINDS.backup, "KINDS con pesca y backup");
b.hp = b.maxHp; b.gold = 500; b.res._petAt = 1e12; b.res._gatherAt = 1e12; b.res._stallAt = 1e12;
let did = false;
for (let k = 0; k < 40 && !did; k++) { b.res._lzAt = 1; run(2000, () => !!b.res._leis); did = !!b.res._leis; }
assert.ok(did, "se toma un descanso; log: " + b.bot.log.slice(-6).join(" | "));
const kind = b.res._leis.kind;
assert.ok(Leisure.KINDS[kind], "tipo conocido: " + kind);
assert.ok(run(400000, () => !b.res._leis), "el descanso termina; log: " + b.bot.log.slice(-6).join(" | "));
assert.ok(b.res.lz[kind] && b.res.lz[kind].n >= 1, "se anota el descanso");
console.log("OK leisure", kind, JSON.stringify(b.res.lz));
