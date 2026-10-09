// Botón Recall: canaliza 3 s, se cancela al moverse o entrar en combate, y tiene enfriamiento. node tests/recall.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { RECALL_CHANNEL_MS, RECALL_COOLDOWN_MS } from "../web/src/shared/world.js";

const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const farm = new Uint8Array(readFileSync(new URL("arefarm.bin", dir)));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, farm), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(5) });
const id = a.addPlayer("recall");
assert.ok(a.command(id, { t: "dbg", op: "crypt", level: 1 }));
let w = a.worldFor(id), p = w.ents.get(id);
assert.notEqual(w, a.farm, "empieza en la cripta");
const evs = []; const hook = w => { const em = w.emit.bind(w); w.emit = e => { evs.push(e); em(e); }; }; hook(w); hook(a.farm);
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
const has = t => evs.some(e => e.t === t && e.id === id);

// cancelado por combate
assert.ok(a.command(id, { t: "recall" })); assert.ok(has("recalling"));
tick(1000); p.lastCombat = w.time; tick(RECALL_CHANNEL_MS);
assert.ok(has("recallfail") && a.worldFor(id) === w, "el combate cancela");

// segundo pulso cancela
evs.length = 0; assert.ok(a.command(id, { t: "recall" })); assert.ok(a.command(id, { t: "recall" }));
assert.ok(has("recallfail")); tick(RECALL_CHANNEL_MS + 200); assert.equal(a.worldFor(id), w, "no se teletransporta tras cancelar");

// completo: vuelve a la granja y entra el enfriamiento
evs.length = 0; assert.ok(a.command(id, { t: "recall" })); tick(RECALL_CHANNEL_MS + 200);
assert.equal(a.worldFor(id), a.farm, "vuelve a la granja"); assert.ok(has("recalled"));
p = a.farm.ents.get(id);
const rej = []; const em = a.farm.emit.bind(a.farm); a.farm.emit = e => { if (e.t === "reject") rej.push(e); em(e); };
a.command(id, { t: "recall" }); assert.ok(rej.length && /recarga/.test(rej[0].why), "enfriamiento");
tick(RECALL_COOLDOWN_MS + 100); rej.length = 0; evs.length = 0;
assert.ok(a.command(id, { t: "recall" }), "otra vez tras el enfriamiento");
console.log("OK recall");
