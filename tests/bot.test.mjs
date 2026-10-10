// BOT: jugador simulado. Entra en el grupo del admin, caza, sube de nivel, se equipa y recoge botín con las mismas órdenes que un cliente.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(9) });
DEBUG.enabled = true;
const id = a.addPlayer("Admin", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const me = a.farm.ents.get(id); me.stats.str = 300; a.farm.recalc(me); me.hp = me.maxHp;
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };

// invocar por la orden de admin
assert.ok(a.command(id, { t: "dbg", op: "bot", n: 2, level: 25 }));
assert.equal(a.bots.size, 2);
const [A, B] = [...a.bots.values()];
assert.ok(A.bot && A.level === 25 && A.name !== B.name);
// equipo comprado por catálogo y repartidos los puntos
assert.ok(Object.keys(A.equip).length >= 3, "se equipa: " + Object.keys(A.equip));
assert.equal(A.pool, 0, "reparte sus puntos");
assert.ok(A.stats.str > 14 && A.stats.vit > 12);
// grupo con el admin
tick(1000);
assert.ok(A.party && A.party.id === me.party?.id, "entra en el grupo del admin");

// caza: un esqueleto cerca; el bot lo mata y gana experiencia
const w = a.farm, exp0 = A.exp + B.exp;
for (let i = 0; i < 3; i++) { const m = spawnFrom(w, { name: "Slime", rect: [me.x + 4, me.y + i, me.x + 6, me.y + i + 1], alive: 0, max: 0, respawn: false }); if (m) { m.hp = m.maxHp = 30; } }
tick(40000);
assert.ok([...w.ents.values()].filter(e => e.kind === "npc" && e.name === "Slime" && !e.dead).length === 0, "los bots matan a los monstruos");
assert.ok(A.exp + B.exp > exp0, "ganan experiencia");
assert.ok(Math.max(Math.abs(A.x - me.x), Math.abs(A.y - me.y)) <= 8, "siguen al dueño");

// muerte: reaparece
A.hp = 0; w.emit && null; A.dead = true; A.deadAt = w.time; A.hp = 0;
tick(8000);
assert.ok(!A.dead, "reaparece solo");

// un bot suelto caza por su cuenta
assert.ok(a.command(id, { t: "dbg", op: "bot", n: 1, level: 10, solo: true }));
const S = [...a.bots.values()].at(-1); assert.equal(S.bot.owner, null);
// quitar bots
assert.ok(a.command(id, { t: "dbg", op: "botclear" }));
assert.equal(a.bots.size, 0); assert.ok(!w.ents.has(A.id));
// los bots se van con su dueño
a.command(id, { t: "dbg", op: "bot", n: 1 }); const orphan = [...a.bots.keys()][0];
a.removePlayer(id); assert.equal(a.bots.size, 0); assert.ok(!a.farm.ents.has(orphan));
console.log("OK bot");
