// Los iconos generados por tools/make_crypt_assets.py deben estar en ui.json (la conversión «ui» los borra si no se reejecuta).
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const ui = JSON.parse(readFileSync(new URL("../web/data/ui.json", import.meta.url)));
for (const k of ["summons_icon", "recall_icon", "pet_support", "pet_damage", "pet_warrior"]) {
  assert.ok(ui[k], "falta " + k + " en ui.json (reejecuta tools/make_crypt_assets.py)");
  assert.ok(existsSync(new URL("../web/data/ui/" + ui[k].png, import.meta.url)), "falta el PNG de " + k);
}
console.log("OK uiicons");
