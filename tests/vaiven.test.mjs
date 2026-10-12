// Vaivén: un bot que oscila entre las mismas casillas replantea su meta (INVENTO del port).
import assert from "node:assert/strict";
import { vaiven, OSC } from "../web/src/shared/systems/bot.js";
const w = { time: 100000, map: { kind: "field" }, rng: () => 0.5, grid: { idx: (x, y) => y * 1000 + x }, teleports: new Set(), freeSpotNear: (x, y) => [x, y], log: [] };
const cmds = [], adv = { command: (id, c) => cmds.push(c) };
const p = { id: 1, name: "T", x: 10, y: 10, lastCombat: 0, bot: null };
const b = p.bot = { target: { id: 7 }, path: [1], goal: { x: 30, y: 10 }, travel: { x: 30, y: 10 }, fails: 0 };
for (let i = 0; i < OSC.steps - 1; i++) { p.x = 10 + (i % 2); vaiven(adv, w, p, b, 30, 10); w.time += 500; }
assert.ok(b.target, "aún no salta antes de completar la ventana");
p.x = 10; vaiven(adv, w, p, b, 30, 10);
assert.equal(b.target, null, "descarta el objetivo"); assert.equal(b.travel, null, "descarta el viaje"); assert.ok(b.ignore.has(7), "ignora al monstruo un rato");
assert.ok(b.hold > w.time, "se para un momento"); assert.ok(b.wander, "prueba otro sitio");
// andar de verdad (casillas distintas) no dispara nada
const b2 = { target: { id: 8 }, trail: [] }; p.bot = b2;
for (let i = 0; i < 40; i++) { p.x = 10 + i; vaiven(adv, w, p, b2, 90, 10); }
assert.ok(b2.target, "caminar no es vaivén");
// tres vaivenes seguidos → Recall
const b3 = { target: null, trail: [] }; p.bot = b3;
for (let k = 0; k < 3; k++) { for (let i = 0; i < OSC.steps; i++) { p.x = 10 + (i % 2); vaiven(adv, w, p, b3, 30, 10); } w.time += 5000; }
assert.ok(cmds.some(c => c.t === "recall"), "al tercero vuelve con Recall");
console.log("OK vaiven");
