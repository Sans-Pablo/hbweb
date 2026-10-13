// Bonos del conjunto de héroe (HG.cpp CheckHeroItemEquipped) y del daño mágico en zona de lucha / m_addMagicDmgPct.
import assert from "node:assert/strict";
import * as Inv from "../web/src/shared/inventory.js";
import { EQUIP } from "../web/src/shared/items.js";
import { spellDamage } from "../web/src/shared/magic.js";

const data = { item: id => ({ id, name: "x", effectType: 0, weight: 1 }) };
const mk = ids => {
  const p = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 }, bag: [], equip: {}, level: 1, gold: 0 };
  const pos = [EQUIP.HEAD, EQUIP.BODY, EQUIP.ARMS, EQUIP.LEGGINGS];
  ids.forEach((id, i) => { p.bag.push({ uid: i + 1, id }); p.equip[pos[i]] = i + 1; });
  return p;
};
const rc = ids => { const p = mk(ids); Inv.recalc(p, data); return p; };
assert.equal(rc([403, 411, 419, 423]).eff.hero, 1, "guerrero Aresden macho");
assert.equal(rc([406, 414, 422, 426]).eff.hero, 1, "guerrero Elvine hembra");
assert.equal(rc([407, 415, 419, 423]).eff.hero, 2, "mago");
assert.equal(rc([403, 415, 419, 423]).eff.hero, 0, "mezcla");
assert.equal(rc([403, 411, 419]).eff.hero, 0, "incompleto");

const rng = () => 0.5, base = rc([]), mage = rc([407, 415, 419, 423]);
const d0 = spellDamage(rng, base, 2, 6, 0);
assert.equal(spellDamage(rng, mage, 2, 6, 0), d0 + 4, "mago héroe +4");
base.eff.addMagicPct = 50;
assert.equal(spellDamage(rng, base, 2, 6, 0), d0 + Math.trunc(d0 * 50 / 100), "% de daño mágico");
base.eff.addMagicPct = 0;
assert.equal(spellDamage(rng, base, 2, 6, 0, true), d0 + Math.trunc(d0 / 3), "zona de lucha +1/3");
console.log("OK");
