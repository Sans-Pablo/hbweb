// Generador de spots (HG.cpp MobGenerator 16841, llamado cada >600 ms en 2093): hueco liberado al borrar el cadáver (regenTime, 6806),
// relleno con dice(1,3)==2 por spot y tope maxObjects (maximumObject).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { killNpc } from "../web/src/shared/systems/npcsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json"), data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (max, maxObjects) => new World({ grid: new Grid(60, 60, new Uint8Array(60 * 60 * 10)), npcDb, data, rng, start: [5, 5], maxObjects,
  spawns: [{ name: "Slime", kind: 1, max, rect: [10, 10, 50, 50] }] });
const mobs = w => [...w.ents.values()].filter(e => e.kind === "npc");
const w = mk(5, 100), regen = npcDb.Slime.regenTime;
assert.equal(mobs(w).length, 5);
for (const n of mobs(w)) killNpc(w, n, null);
const dying = mobs(w)[0].dur.dying, gap = Math.max(dying, regen);
w.tick(gap - 100);
assert.equal(w.generators[0].alive, 5, "el hueco sigue ocupado mientras dura el cadáver");
assert.equal(mobs(w).length, 5, "cadáveres presentes");
w.tick(200);
assert.equal(mobs(w).filter(n => !n.dead).length < 5, true, "tras regenTime se borra el cadáver y empieza a rellenar");
// tasa: 1/3 por tick de 600 ms por spot -> ~1 monstruo cada 1,8 s
const w2 = mk(300, 1000); for (const n of mobs(w2)) w2.ents.delete(n.id); w2.generators[0].alive = 0;
w2.tick(600 * 300);
const got = mobs(w2).length; assert.ok(got > 80 && got < 120, "1/3 por tick: " + got + " de 300 ticks");
// tope del mapa
const w3 = mk(50, 10); for (const n of mobs(w3)) w3.ents.delete(n.id); w3.generators[0].alive = 0;
w3.tick(600 * 400); assert.equal(mobs(w3).length, 10, "maxObjects");
console.log("OK spot-generator");
