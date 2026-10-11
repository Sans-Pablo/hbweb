// Habitantes sociales: comercian (regalo, venta, compra) con jugadores y entre ellos, aceptan/piden grupo, se reúnen en la tienda, equipan por item level y aprenden de sus muertes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
import { newInst } from "../web/src/shared/systems/itemsys.js";
import * as Inv from "../web/src/shared/inventory.js";
import { itemLevel } from "../web/src/shared/itemlevel.js";
import { tooStrong } from "../web/src/shared/systems/bot.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(5) });
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
const w = a.farm;
const give = (p, name, n = 1) => { const inst = newInst(w, data.named(name).id, n); Inv.addToBag(p, data, inst); return inst; };

// ---- 1. equipo por item level: se pone el arma del botín aunque no esté en el catálogo de la tienda
a.spawnResident("Aldric");
const A = a.residents().find(x => x.name === "Aldric"); A.level = 12; w.recalc(A); A.gold = 50;
const good = data.named("LongSword"), before = Object.values(A.equip).map(u => Inv.instOf(A, u)).filter(Boolean);
const inst = newInst(w, good.id, 1, { attr: (7 << 20) | (8 << 16) }); Inv.addToBag(A, data, inst);
tick(8000);
const wield = Inv.instOf(A, A.equip[8] ?? A.equip[9]);
assert.equal(wield?.uid, inst.uid, "equipa el arma con atributos");

// ---- 2. aprendizaje: tras morir a manos de un monstruo no lo vuelve a pelear hasta llevar +3 niveles
A.res._killer = "Troll"; A.res.dlv = { Troll: A.level };
const fake = { kind: "npc", name: "Troll", cfg: { attackDiceThrow: 1, attackDiceRange: 1 }, hp: 10, boss: 0 };
assert.ok(tooStrong(w, A, fake), "lo evita"); A.level += 3; assert.ok(!tooStrong(w, A, fake), "tras 3 niveles más vuelve a intentarlo");

// ---- 3. comercio humano -> habitante: regalo (afinidad alta) y venta
{
  const hid = a.addPlayer("Humano", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), H = w.ents.get(hid);
  H.x = A.x; H.y = A.y; H.side = A.side; A.res.rel.Humano = 8; A.bot.next = 1e12; A.res.next = 1e12;
  const gift = give(H, "Dagger"); H.gold = 10;
  w.drainEvents(); assert.ok(a.command(hid, { t: "tradereq", name: "Aldric" }));
  A.res.next = 0; A.bot.next = 0; for (let i = 0; i < 80 && !H.trade; i++) tick(50);
  assert.ok(H.trade && A.trade, "el habitante acepta el trato");
  a.command(hid, { t: "tradeset", uid: gift.uid });
  A.res.next = 0; for (let i = 0; i < 80 && H.bag.some(x => x.uid === gift.uid); i++) { A.res.next = 0; A.bot.next = 0; tick(50); }
  assert.ok(!H.bag.some(x => x.uid === gift.uid) || H.trade, "estado coherente");
  // el humano confirma y el habitante, que aprecia, acepta el regalo si le sirve o lo rechaza con educación
  a.command(hid, { t: "tradeok" }); for (let i = 0; i < 120; i++) { A.res.next = 0; A.bot.next = 0; tick(50); if (!H.trade) break; }
  assert.ok(!H.trade && !A.trade, "el trato termina (hecho o cancelado)");
}

// ---- 4. grupo: el habitante acepta la invitación de un humano
{
  const hid = a.addPlayer("Humano2", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), H = w.ents.get(hid);
  H.x = A.x + 1; H.y = A.y; H.side = A.side; A.res.rel.Humano2 = 2; A.bot.next = 0; A.res.next = 0;
  assert.ok(a.command(hid, { t: "partyreq", name: "Aldric" }));
  for (let i = 0; i < 120 && !H.party; i++) { A.res.next = 0; A.bot.next = 0; tick(50); }
  assert.ok(H.party?.names.includes("Aldric"), "el habitante entra en el grupo");
}
console.log("OK");
