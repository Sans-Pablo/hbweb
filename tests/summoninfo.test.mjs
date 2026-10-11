import { SPECIES } from "../web/src/shared/systems/companion.js";
import { LORE, infoOf, evolutionsOf } from "../web/src/shared/systems/summoninfo.js";
import { readFileSync } from "node:fs";
const magic = JSON.parse(readFileSync(new URL("../web/data/magic.json", import.meta.url)));
const p = { maxHp: 200, bag: [], str: 10, dex: 10, stats: {}, hp: 200 };
const bad = [];
for (const sp of Object.keys(SPECIES)) {
  if (!LORE[sp]) bad.push("sin leyenda " + sp);
  const i = infoOf(p, sp, magic);
  if (!(i.hi.hp >= i.lo.hp && i.lo.hp > 0)) bad.push("hp " + sp + JSON.stringify([i.lo, i.hi]));
  if (i.school && !i.spells.length) bad.push("sin hechizos " + sp);
}
const o = infoOf(p, "Orc", magic);
if (o.school !== "fire" || o.evo.tier2?.sp !== "Demon" || o.evo.stages.length !== 4 || !o.evo.stages[3].final) bad.push("orc " + JSON.stringify(o.evo));
if (evolutionsOf("Slime").tier2) bad.push("slime no evoluciona de especie");
console.log(bad.length ? "FALLO " + bad.join("; ") : "OK summoninfo");
process.exit(bad.length ? 1 : 0);
