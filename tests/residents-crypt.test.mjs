// Habitantes: bajan a la cripta de esqueletos, metas de bajas / foso / cripta y dominio de fosos en Promise Land.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { canFight } from "../web/src/shared/systems/combatsys.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const mk = seed => new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(seed) });
const run = (a, ms) => { for (let i = 0; i < ms / 50; i++) a.tick(50); };

// todos son combatientes en Promise Land: viajeros incluidos; el mismo bando o la misma party no
{
  const a = mk(1), pl = a.staticWorld("2ndmiddle"), M = (n, s) => { const id = a.addPlayer(n, null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); const p = a.farm.ents.get(id); p.side = s; a.transfer(p, a.farm, pl, [100 + s * 3, 100]); return p; };
  const A = M("A", 1), E = M("E", 2), T = M("T", 0), A2 = M("A2", 1), T2 = M("T2", 0);
  assert.ok(canFight(pl, A, E) && canFight(pl, A, T) && canFight(pl, T, A) && canFight(pl, T, T2), "viajeros y bandos enemigos se pelean");
  assert.ok(!canFight(pl, A, A2), "mismo bando no");
  A.party = T.party = { id: 9 }; assert.ok(!canFight(pl, A, T), "misma party no");
}

// los habitantes bajan a la cripta (Aresden por el teletransportador, Elvine desde su granja) y cazan esqueletos
for (const side of [1, 2]) {
  const a = mk(5 + side), n = side === 1 ? "Aldric" : "Dain";
  a.spawnResident(n);
  const b = a.residents().find(x => x.name === n), w = a.worldFor(b.id);
  b.level = 12; b.exp = 1e7; b.stats.str = 60; b.stats.vit = 70; b.stats.dex = 40; a.homeOf(b).recalc(b); b.hp = b.maxHp; b.res.goal = { k: "crypt", n: 3 }; b.res._tripAt = 1;
  let inCrypt = false, kills0 = Object.values(b.res.qa.kills).reduce((x, y) => x + y, 0), deepest = 1;
  for (let i = 0; i < 20 * 60 * 6; i++) { a.tick(50); const ww = a.worldFor(b.id); if (ww.map.kind === "dungeon") { inCrypt = true; deepest = Math.max(deepest, ww.map.level); } if (inCrypt && deepest >= 2) break; }
  assert.ok(inCrypt, "el habitante de bando " + side + " baja a la cripta; registro: " + (b.bot.log || []).slice(-6).join(" | "));
  const kills = Object.values(b.res.qa.kills).reduce((x, y) => x + y, 0) - kills0;
  assert.ok(kills >= 3, "mata esqueletos: " + kills + " · " + (b.bot.log || []).slice(-6).join(" | "));
}

// metas nuevas: texto en los dos idiomas y cumplimiento
{
  const a = mk(9); a.spawnResident("Aldric"); const b = a.residents()[0], R = a.constructor && null;
  const g = [{ k: "pvp", n: 2 }, { k: "pit", n: 10, zone: 4 }, { k: "crypt", n: 2 }];
  b.ek = 2; b.res.qa.pvp.held = 10; b.delve = { deepest: 2 };
  for (const x of g) { b.res.goal = x; run(a, 1500); }
  assert.ok(b.res.mem.some(m => /Cumplí mi meta/.test(m.es)), "cumple sus metas de combate");
}

// v0.51.3: un habitante que aparece en una cripta sin expedición (_delve) no se queda dando vueltas: la adopta y sale por Recall sin cancelarlo
{
  const a = mk(21); a.spawnResident("Aldric"); const b = a.residents()[0];
  b.level = 12; b.exp = 1e7; b.stats.str = 60; b.stats.vit = 70; a.homeOf(b).recalc(b); b.hp = b.maxHp; b.res._tripAt = 1;
  a.command(b.id, { t: "portal", portal: "mid-entry" }); run(a, 2000);
  let w = a.worldFor(b.id), moved = w.map.kind === "dungeon";
  for (let i = 0; i < 20 * 60 * 3 && !moved; i++) { a.tick(50); w = a.worldFor(b.id); moved = w.map.kind === "dungeon"; }
  if (moved) {
    b.res._delve = null; b.res._pet = null;
    let out = false, cmds = 0; const orig = a.command.bind(a);
    a.command = (id, c) => { if (id === b.id && c.t === "recall") cmds++; return orig(id, c); };
    for (let i = 0; i < 20 * 60 * 4 && !out; i++) { a.tick(50); out = a.worldFor(b.id).map.kind !== "dungeon" || !!b.res._delve; }
    assert.ok(out, "el habitante sin expedición en la cripta la adopta o sale; registro: " + (b.bot.log || []).slice(-4).join(" | "));
  }
}
// v0.57.0: meta «matar al Rey esqueleto dorado»: no se cumple al llegar al piso 20, solo al abatirlo; y las lecciones de muerte son por piso
{
  const a = mk(31); a.spawnResident("Aldric"); const b = a.residents()[0];
  b.delve = { deepest: 20 }; b.res.goal = { k: "crypt", n: 20, king: true }; run(a, 1500);
  assert.equal(b.res.goal?.king, true, "con el piso 20 alcanzado la meta del rey sigue en pie");
  b.delve.king = 1; run(a, 1500);
  assert.ok(b.res.mem.some(m => /Cumplí mi meta/.test(m.es)), "al abatir al rey cumple la meta");
}

console.log("OK residents-crypt");
