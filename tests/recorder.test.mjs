// Grabador de partidas (server/recorder.mjs): graba órdenes, fotos y eventos de jugadores reales; ignora observadores.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import assert from "node:assert/strict";
import { createRecorder } from "../server/recorder.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rec-"));
const rec = createRecorder(dir);
const me = { id: 1, name: "Ana", kind: "player", x: 10, y: 10, hp: 50, maxHp: 100, mp: 5, maxMp: 20, level: 7, stats: { str: 10 } };
const orc = { id: 2, name: "Orc", kind: "npc", x: 12, y: 11, hp: 30, maxHp: 30 }, far = { id: 3, name: "Lejos", kind: "npc", x: 90, y: 90, hp: 1, maxHp: 1 };
const world = { time: 1000, map: { id: "farm" }, ents: new Map([[1, me], [2, orc], [3, far]]) };
const adv = { worldFor: () => world };
const clients = [{ pid: 1 }, { pid: 1, watch: 5 }];
rec.tick(clients, adv, new Map([["farm", [{ t: "damage", id: 2, from: 1, amount: 4 }, { t: "damage", id: 9, from: 8 }]]]));
rec.cmd(1, world, { t: "attack", x: 12, y: 11 });
world.time = 1100; rec.tick(clients, adv, new Map());                 // < 250 ms: sin foto nueva
world.time = 1300; rec.tick(clients, adv, new Map());
rec.tick([], adv, new Map());                                         // sale el jugador: cierra
await new Promise(r => setTimeout(r, 100));
const files = fs.readdirSync(dir); assert.equal(files.length, 1);
const L = fs.readFileSync(path.join(dir, files[0]), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(L[0].k, "h"); assert.equal(L.filter(l => l.k === "s").length, 2);
assert.equal(L.filter(l => l.k === "e").length, 1); assert.equal(L.filter(l => l.k === "c").length, 1);
const s = L.find(l => l.k === "s"); assert.equal(s.near.length, 1); assert.equal(s.near[0].id, 2);
fs.rmSync(dir, { recursive: true, force: true });
console.log("recorder.test OK");
