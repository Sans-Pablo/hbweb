// Paridad de magias y combate con el original (auditoría 0.85.x): magic.json sale de Helbreath.ServerFiles/Config/Magic.cfg,
// sin multiplicadores de balance en hechizos, y el aturdimiento de monstruos usa 1d(oro/55+3) (combat.cpp:1375).
import fs from "node:fs";
const magic = JSON.parse(fs.readFileSync("web/data/magic.json", "utf8"));
const bal = JSON.parse(fs.readFileSync("web/data/balance.json", "utf8"));
const src = fs.readFileSync("web/src/shared/systems/combatsys.js", "utf8");
let bad = 0; const eq = (n, a, b) => { if (a !== b) { console.log(`FALLO ${n}: ${a} != ${b}`); bad++; } };
eq("Paralyze last", magic[35].last, 15);
eq("Inhibition last", magic[83].last, 40);
eq("Illusion Movement type", magic[77].type, 16);
eq("Mass Illusion Movement type", magic[95].type, 16);
eq("Meteor Strike v3", magic[81].v3, 3);
eq("Fire Ball v2", magic[20].v2, 1);
eq("balance de hechizos vacío", Object.keys(bal.spells).length, 0);
eq("aturdimiento original", /dice\(w\.rng, 1, Math\.floor\(\(n\.cfg\.gold \|\| 0\) \/ 55\) \+ 3\) === 1/.test(src), true);
console.log(bad ? "FALLO magic-original" : "OK magic-original"); process.exit(bad ? 1 : 0);
