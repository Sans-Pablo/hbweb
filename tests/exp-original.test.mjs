// Experiencia por baja fiel a NpcKilledHandler (HG.cpp:6538, líneas 6593-6602): iExp = m_iExp/3 (+ m_iNoDieRemainExp) (+ AddExp %).
// Sin multiplicador por especie (el de variedad era un invento del port).
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../web/src/shared/systems/npcsys.js", import.meta.url), "utf8");
const assert = (c, m) => { if (!c) { console.log("FALLO:", m); process.exit(1); } };
assert(/let xp = Math\.floor\(n\.exp \/ 3\) \+ n\.noDieRemainExp;/.test(src), "xp = exp/3 + noDieRemainExp");
assert(!/0\.8 \/ \(1 \+ prev/.test(src), "sin multiplicador de variedad");
assert(/xp \+= Math\.floor\(\(p\.eff\.addExp \/ 100\) \* xp\)/.test(src), "AddExp %");
console.log("OK");
