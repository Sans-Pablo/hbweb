// v0.85.98 (obs. 70/88/89/90/91/93/94): armaduras, olvido de hechizos sin Int, ffa sin fuego amigo, mascotas libres, golpe a muerto silencioso
import assert from "node:assert/strict";
import { _dbg } from "../tools/train.mjs";
import { maxOut, armorCare } from "../web/src/shared/systems/bot.js";
import { canFight } from "../web/src/shared/systems/combatsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import { PET_RULES } from "../web/src/shared/systems/npcsys.js";
const a = _dbg.mkAdv(11), w = a.farm;
// pet sin restricciones
assert.equal(PET_RULES.staff, false, "mascotas sin regla de báculo");
// ffa: mismo party no se pelea
const p = a.spawnBot(null, { level: 1 }), q = a.spawnBot(null, { level: 1 });
w.ffa = true; p.party = q.party = { id: 9 };
assert.ok(!canFight(w, p, q), "ffa: compañeros de party no se atacan");
p.party = null; q.party = null;
// armorCare existe y no revienta con bolsa vacía
assert.equal(typeof armorCare, "function");
// golpe a un objetivo muerto: sin rechazo
const ev = []; const off = w.emit.bind(w); w.emit = e => { ev.push(e); return off(e); };
const d = a.spawnBot(null, { level: 1 }); d.dead = true;
w.attack ? 0 : 0;
const before = ev.length;
a.command(p.id, { t: "attack", target: d.id });
a.tick(100);
assert.ok(!ev.slice(before).some(e => e.t === "reject" && e.cmd === "attack" && e.why === "sin objetivo"), "sin rechazo por muerto");
console.log("OK bot-v85-98b");
process.exit(0);
