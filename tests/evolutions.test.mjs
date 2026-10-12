// Tabla única de evoluciones (shared/systems/evolutions.js): coherencia con compañeros, datos, escuelas y partidas antiguas.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAINS, TIER2, BASE_OF, TIER2_SET, SCHOOL_OF, STAFF_FOR, look, schoolList, fixLegacy, LEGACY } from "../web/src/shared/systems/evolutions.js";
import { SPECIES } from "../web/src/shared/systems/companion.js";
import * as Sch from "../web/src/shared/systems/schools.js";
import { STAFF_FOR as GEAR } from "../web/src/shared/classgear.js";
const npc = JSON.parse(readFileSync(new URL("../web/data/npc.json", import.meta.url)));
for (const c of CHAINS) {
  for (const sp of [c.base, c.evo]) { assert.ok(SPECIES[sp], sp + " en SPECIES"); assert.ok(npc[sp], sp + " en npc.json"); }
  assert.equal(TIER2[c.base], c.evo); assert.equal(BASE_OF[c.evo], c.base);
  assert.ok(SPECIES[c.evo][0] === 0 && SPECIES[c.base][0] > 0, "la evolución no se compra; la base sí");
  assert.equal(!!c.school, !!SCHOOL_OF[c.base]); assert.equal(Sch.SCHOOL_OF[c.evo], c.school || undefined);
  assert.equal(GEAR[c.evo], c.family || undefined);
  assert.ok(c.es && c.en);
}
assert.ok([...TIER2_SET].every(Sch.isTier2));
assert.equal(Sch.TIER2.Skeleton, "Liche"); assert.equal(SCHOOL_OF.Skeleton, "lightning"); assert.equal(SCHOOL_OF["Cannibal-Plant"], undefined);
assert.equal(look("Frost"), "Frost"); assert.equal(look("Demon"), "Demon"); assert.equal(look("Orc"), "Orc");
assert.match(schoolList("es"), /Orc \(fuego\), Tutelary-Angel \(hielo\) o Skeleton \(rayo\)/);
assert.equal(STAFF_FOR.Frost, "ice");
assert.equal(fixLegacy({ sp: "Frost" }).sp, "Frost");
console.log("OK evolutions");
