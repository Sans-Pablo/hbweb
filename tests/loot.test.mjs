import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rollKillDrop } from "../web/src/shared/drops.js";
import { rarityOf, BOSS_UNIQUE } from "../web/src/shared/rarity.js";
import { recalc } from "../web/src/shared/inventory.js";
import { damagePlayer } from "../web/src/shared/systems/combatsys.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
import { GameData } from "../web/src/shared/data.js";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const npc = { type: 11, cfg: { goldMin: 5, goldMax: 20 } };

test("los únicos de los reyes existen en Item.cfg con efecto ADDEFFECT", () => {
  for (const [k, ids] of Object.entries(BOSS_UNIQUE)) for (const id of ids) {
    const d = data.item(id); assert.ok(d, "item " + id); assert.equal(d.effectType, 14, d.name + " rey " + k);
    assert.equal(rarityOf(id, 0), 3);
  }
});

test("rarityOf", () => {
  assert.equal(rarityOf(1, 0), 0);
  assert.equal(rarityOf(1, (3 << 20) | (3 << 16)), 1);
  assert.equal(rarityOf(1, (3 << 20) | (7 << 16) | (2 << 12) | (6 << 8)), 2);
});

test("el botín mejora con la profundidad: menos oro, más equipo y mejores atributos", () => {
  const stat = depth => {
    const rng = seededRandom(99); let gold = 0, gear = 0, rare = 0, n = 6000;
    for (let i = 0; i < n; i++) {
      const r = rollKillDrop(rng, npc, { data, depth, month: 1 }); if (!r) continue;
      if (r.id === 90) gold++; else if (r.attr !== undefined) { gear++; if (rarityOf(r.id, r.attr) >= 2) rare++; }
    }
    return { gold, gear, rare };
  };
  const a = stat(0), b = stat(20);
  assert.ok(b.gold < a.gold, "menos oro " + a.gold + "→" + b.gold);
  assert.ok(b.gear > a.gear, "más equipo " + a.gear + "→" + b.gear);
  assert.ok(b.rare / b.gear > a.rare / a.gear, "más raros");
});

test("protección elemental del equipo reduce el daño del elemento", () => {
  const w = { time: 0, emit() {}, setAct() {}, busy: () => false, rng: () => .5, tryStep() {}, grid: { release() {} } };
  const mk = prot => ({ hp: 1000, maxHp: 1000, eff: { prot: { light: 0, fire: 0, ice: 0, poison: 0, ...prot } }, id: 1 });
  const p = mk({ fire: 50 }); damagePlayer(w, p, 100, { id: 2 }, "fire"); assert.equal(p.hp, 950);
  const q = mk({ fire: 50 }); damagePlayer(w, q, 100, { id: 2 }, "ice"); assert.equal(q.hp, 900);
  const r = mk({ fire: 50 }); damagePlayer(w, r, 100, { id: 2 }); assert.equal(r.hp, 900);
});
console.log("OK");
{
  const { EQUIP } = await import("../web/src/shared/items.js");
  const p = { stats: { dex: 10, str: 10 }, skills: {}, bag: [{ uid: 1, id: 638, count: 1 }], equip: { [EQUIP.NECK]: 1 } };
  assert.equal(recalc(p, data).prot.fire, 50, "FirePro = 50 %");
  p.bag[0].id = 645; assert.equal(recalc(p, data).prot.fire, 90, "Efreet = 90 %");
  p.bag[0].id = 643; assert.equal(recalc(p, data).prot.ice, 90, "IceEle = 90 %");
  console.log("OK");
}
