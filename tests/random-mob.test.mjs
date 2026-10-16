// Generador aleatorio de monstruos (HG.cpp:15993-16780): tabla por nivel, tope maxObjects-30, grupos y habilidades especiales (_cGetSpecialAbility, HG.cpp:28959).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { pickMob, MOB_TABLE, MOB_COUNT, GROUP_KEEP_1_IN_5, GROUP_DROP_1_IN_5 } from "../web/src/shared/randommob.gen.js";
import { getSpecialAbility, randomMobGenerator } from "../web/src/shared/systems/npcsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const d = n => 1 + Math.floor(rng() * n);

// Nivel 1 (HG.cpp:15997-16009): 1-19 Slime, 20-39 Giant-Ant, 40-84 Rabbit, 85-94 Cat, 95-100 Orc.
const cnt = {}; for (let i = 0; i < 20000; i++) { const id = pickMob(1, d).id; cnt[id] = (cnt[id] || 0) + 1; }
const pct = id => (cnt[id] || 0) / 200;
assert.ok(Math.abs(pct(1) - 19) < 1.5 && Math.abs(pct(2) - 20) < 1.5 && Math.abs(pct(24) - 45) < 2 && Math.abs(pct(25) - 10) < 1.5 && Math.abs(pct(3) - 6) < 1.5, JSON.stringify(cnt));
assert.deepEqual(Object.keys(cnt).map(Number).sort((a, b) => a - b), [1, 2, 3, 24, 25]);
assert.equal(MOB_TABLE[1][0], "Slime"); assert.equal(MOB_TABLE[24][0], "Rabbit");
assert.deepEqual(MOB_COUNT[34], ["n", 1]); assert.deepEqual(MOB_COUNT[1], ["d-1", 5]);
assert.ok(GROUP_KEEP_1_IN_5.includes(1) && GROUP_DROP_1_IN_5.includes(9));

// _cGetSpecialAbility
const seen = k => { const s = new Set(); for (let i = 0; i < 400; i++) s.add(getSpecialAbility(rng, k)); return [...s].sort((a, b) => a - b); };
assert.deepEqual(seen(1), [3, 4]); assert.deepEqual(seen(4), [3, 4, 7]); assert.deepEqual(seen(8), [1, 2, 3, 4, 8]); assert.deepEqual(seen(10), [1]);

// Tope maxObjects-30: solo crea si hay hueco
const npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const mk = max => new World({ grid: new Grid(80, 80, new Uint8Array(80 * 80 * 10)), npcDb, data, spawns: [], rng, start: [40, 40], maxObjects: max, randomMob: { kind: 1, count: 1 } });
const w = mk(40);
for (let i = 0; i < 400; i++) randomMobGenerator(w);
const n = [...w.ents.values()].filter(e => e.kind === "npc").length;
assert.ok(n >= 10 && n < 40 + 10, "crece hasta maxObjects-30=10 y se detiene (+ esclavos del último grupo): " + n);
const w2 = mk(30); randomMobGenerator(w2);
assert.equal([...w2.ents.values()].filter(e => e.kind === "npc").length, 0, "maxObjects-30 no es mayor que 0");
console.log("OK random-mob");
