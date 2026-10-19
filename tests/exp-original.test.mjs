// Experiencia por baja fiel a NpcKilledHandler (HG.cpp:6538, líneas 6593-6602): iExp = m_iExp/3 (+ m_iNoDieRemainExp) (+ AddExp %).
// Sin multiplicador por especie (el de variedad era un invento del port).
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../web/src/shared/systems/npcsys.js", import.meta.url), "utf8");
const assert = (c, m) => { if (!c) { console.log("FALLO:", m); process.exit(1); } };
assert(/let xp = Math\.floor\(n\.exp \/ 3\) \+ n\.noDieRemainExp;/.test(src), "xp = exp/3 + noDieRemainExp");
assert(!/0\.8 \/ \(1 \+ prev/.test(src), "sin multiplicador de variedad");
assert(/xp \+= Math\.floor\(\(p\.eff\.addExp \/ 100\) \* xp\)/.test(src), "AddExp %");
// por golpe (combat.cpp:~1513-1520): cruzada /3 y Rabbit/Cat (55/56) sin exp a nivel > 100
const cs = readFileSync(new URL("../web/src/shared/systems/combatsys.js", import.meta.url), "utf8");
assert(cs.includes("if (w.crusade) xp = Math.floor(xp / 3)"), "cruzada /3 por golpe");
assert(cs.includes("p.level > 100 && (n.type === 55 || n.type === 56)) xp = 0"), "tipos 55/56 nivel>100 = 0");
console.log("OK");
