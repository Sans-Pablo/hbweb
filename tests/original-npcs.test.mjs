// npc.json y los generadores de los mapas coinciden con el servidor ORIGINAL (Config/Npc.cfg, HGServer/MAPDATA). Se omite si no está la copia local.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { npcExp } from "../web/src/shared/rules.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
const SF = process.env.HB_ORIGINAL || "C:/Users/sansp/Documents/HelbreathOriginal/Helbreath.ServerFiles";
const dir = new URL("../web/data/", import.meta.url), json = n => JSON.parse(readFileSync(new URL(n, dir)));
const npc = json("npc.json");
if (!existsSync(SF + "/Config/Npc.cfg")) { console.log("OK original-npcs (omitido: sin copia del original)"); process.exit(0); }
let n = 0;
for (const line of readFileSync(SF + "/Config/Npc.cfg", "latin1").split(/\r?\n/)) {
  const m = line.match(/^\s*Npc\s*=\s*(\S+)\s+(.*)/); if (!m || !npc[m[1]]) continue;
  const v = m[2].trim().split(/\s+/).map(Number), c = npc[m[1]];
  assert.equal(c.type, v[0], m[1]); assert.equal(c.actionTime, v[11], m[1] + " actionTime"); assert.equal(c.regenTime, v[17], m[1] + " regenTime");
  assert.equal(c.expDice, v[5] * 150, m[1] + " expDice (EXPMULTIPLIER 150, HG.cpp:9603)"); assert.equal(c.gold, v[23] * 100, m[1] + " gold (GOLDDROPMULTIPLIER 100, HG.cpp:9813)");
  n++;
}
assert.ok(n > 60, "fichas comparadas: " + n);
// exp por muerte = dice(expDice,4)+expDice (Npc.cpp:109): media 3,5 * expDice, mínimo 2 * expDice
const rng = seededRandom(5), s = npc.Slime; let sum = 0; const N = 2000;
for (let i = 0; i < N; i++) { const e = npcExp(rng, s); assert.ok(e >= 2 * s.expDice); sum += e; }
assert.ok(Math.abs(sum / N / (3.5 * s.expDice) - 1) < 0.02, "media de exp");
// generadores de 2ndmiddle.txt
const g = json("maps/2ndmiddle.json"), txt = readFileSync(SF + "/HGServer/MAPDATA/2ndmiddle.txt", "latin1");
const spots = [...txt.matchAll(/^spot-mob-generator\s*=\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/gim)];
assert.equal(g.spawns.length, spots.length);
spots.forEach((m, i) => assert.deepEqual([g.spawns[i].id, g.spawns[i].rect, g.spawns[i].mob, g.spawns[i].max], [+m[1], m.slice(3, 7).map(Number), +m[7], +m[8]]));
console.log("OK original-npcs");
