// Auditoría combate/magia 2026-10-19 (audit G): contraataque (combat.cpp:1316-1331), actionLimit sin daño, PFA de Dark-Elf/AGT, Berserk por bando,
// Earthworm con SPDOWN (HG.cpp:10859) y manuales de hechizo (ITEMEFFECTTYPE_STUDYMAGIC, HG.cpp:17736).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const src = f => readFileSync(new URL("../web/src/shared/systems/" + f, import.meta.url), "utf8");
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Probador", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 120, mag: 10, chr: 10 } });
const p = w.ents.get(id); p.level = 30; p.side = 1; w.recalc(p);

// STUDYMAGIC: el manual enseña el hechizo sin oro y se gasta; con Int insuficiente se gasta igual y no enseña
const man = newInst(w, data.named("IceStormManual").id); p.bag.push(man);
assert.ok(!p.magic[55]);
p.gold = 0; p.stats.int = 120;
assert.equal(w.command(id, { t: "use", uid: man.uid }), true);
assert.ok(p.magic[55], "Ice-Storm aprendido"); assert.ok(!p.bag.some(i => i.uid === man.uid), "manual gastado");
const man2 = newInst(w, data.named("IceStormManual").id); p.bag.push(man2); p.magic[55] = 0; p.stats.int = 1;
assert.equal(w.command(id, { t: "use", uid: man2.uid }), true);
assert.ok(!p.magic[55], "Int baja: no aprende"); assert.ok(!p.bag.some(i => i.uid === man2.uid), "se gasta igual (ItemDepleteHandler)");

// contraataque: un monstruo del mismo bando que el atacante no se vuelve contra él; uno hostil sí (1/3 de las veces)
const cs = src("combatsys.js");
assert.ok(cs.includes("(n.side ?? n.cfg.side) === p.side && n.type !== 21 && n.type !== 55 && n.type !== 56"), "sin contraataque al propio bando");
assert.ok(cs.includes("n.type === 51 || n.permAttack"), "sin contraataque de cp / ataque permanente");
assert.ok(cs.includes("lim === 1 || lim === 2 || lim === 4 || lim === 6"), "actionLimit 1/2/4/6 no pierden vida");
assert.ok(cs.includes("!n.master) {"), "sin exp por golpe a invocados");
assert.ok(cs.includes("n.type === 54 || n.type === 36"), "PFA contra Dark-Elf y AGT");
const ms = src("magicsys.js");
assert.ok(ms.includes("(target.side ?? target.cfg.side) !== p.side"), "Berserk compara el bando efectivo del NPC");
assert.ok(ms.includes("dice(w.rng, sp.v7, sp.v8) + sp.v9"), "Earthworm baja el aguante");

console.log("OK combat-audit-g");
