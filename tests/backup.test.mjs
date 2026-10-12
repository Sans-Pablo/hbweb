// Backup de guild (leisure.js): quien pide refuerzos fija el aviso con enfriamiento; las palabras clave se reconocen.
import assert from "node:assert/strict";
import * as L from "../web/src/shared/systems/leisure.js";
for (const t of ["backup!", "necesito ayuda", "help", "SOS", "refuerzos"]) assert.ok(L.BACKUP_WORDS.test(t), t);
assert.ok(!L.BACKUP_WORDS.test("hola a todos"));
const said = [], H = { pitNear: () => null, gsay: (a, p, t) => said.push(t), line: () => "ayuda", blog() {} };
const G = { name: "G" }, w = { time: 1000 }, p = { name: "Aldric", side: 1 };
assert.ok(L.backupCall({}, w, p, {}, G, H), "primera petición");
assert.equal(G._bk.by, "Aldric");
assert.equal(L.backupCall({}, w, p, {}, G, H), false, "enfriamiento de 4 min");
w.time += 240001;
assert.ok(L.backupCall({}, w, p, {}, G, H), "pasado el enfriamiento");
assert.equal(said.length, 2);
console.log("OK backup");
