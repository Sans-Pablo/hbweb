import { readFileSync } from "node:fs";
import { Voice, personaOf } from "../web/src/client/voice.js";
import assert from "node:assert/strict";
const data = JSON.parse(readFileSync(new URL("../web/data/voice.json", import.meta.url)));
let T = 0; const bubbles = new Map();
const mk = (rng = () => 0.01) => { bubbles.clear(); const v = new Voice({ data, bubbles, pid: 1, rng, now: () => T }); v.setPlayer("Pablo"); return v; };
const world = { ents: new Map([[1, { id: 1, x: 10, y: 10 }]]), generators: [{ name: "Slime", rect: [20, 10, 25, 15] }], map: { id: "farm" } };
// determinista por nombre
assert.equal(personaOf("Pablo"), personaOf("Pablo"));
// compra -> agradece y el herrero responde después
let v = mk(); const smith = { id: 7, type: 24 };
v.onEvent({ t: "purchased", id: 1 }, world, smith);
assert.ok(bubbles.get(1)?.text, "el jugador agradece");
assert.equal(bubbles.has(7), false);
T += 1000; v.update(world, world.ents.get(1), {});
assert.ok(bubbles.get(7)?.text, "el NPC responde");
// enfriamiento
bubbles.clear(); T += 100; v.onEvent({ t: "purchased", id: 1 }, world, smith);
assert.equal(bubbles.has(1), false, "cooldown");
// eventos ajenos no hablan
v = mk(); v.onEvent({ t: "nogold", id: 2 }, world, smith); assert.equal(bubbles.size, 0);
// sin oro
T += 20000; v = mk(); v.onEvent({ t: "nogold", id: 1 }, world, smith); assert.ok(bubbles.get(1));
// pit: probabilidad baja = calla; alta = habla y solo una vez por visita
T += 60000; v = mk(() => 0.9); v.update(world, { id: 1, x: 18, y: 12, maxHp: 100 }, { Slime: { hitDice: 2 } });
assert.equal(bubbles.size, 0, "no siempre");
v = mk(() => 0.01); const me = { id: 1, x: 18, y: 12, maxHp: 100 };
T += 60000; v.update(world, me, { Slime: { hitDice: 2 } }); assert.ok(bubbles.get(1), "habla cerca del pit");
bubbles.clear(); T += 2000; v.update(world, me, { Slime: { hitDice: 2 } }); assert.equal(bubbles.size, 0, "una vez por visita");
// inglés
const ven = new Voice({ data, bubbles, pid: 1, lang: () => "en", rng: () => 0.01, now: () => T }); bubbles.clear();
ven.onEvent({ t: "levelup", id: 1 }, world); assert.match(bubbles.get(1).text, /[a-z]/i);
// todas las frases tienen es y en
const walk = o => { if (typeof o.es === "string") assert.ok(o.en, JSON.stringify(o)); else Object.values(o).forEach(walk); };
walk(data);
console.log("voice OK");
// mascota: invocar -> el personaje habla y el compañero contesta con su sonido
{
  T += 100000; const v = mk(); bubbles.clear();
  const pw = { ents: new Map([[1, { id: 1, x: 5, y: 5 }], [9, { id: 9, kind: "npc", comp: true, master: 1, name: "Giant-Ant" }]]), generators: [], map: { id: "farm" } };
  v.onEvent({ t: "companion", id: 1, on: true, sp: "Giant-Ant" }, pw);
  assert.ok(bubbles.get(1)?.text, "el personaje habla");
  T += 1200; v.update(pw, pw.ents.get(1), {});
  assert.match(bubbles.get(9).text, /^¡Clic clic!/, "la hormiga contesta con su sonido");
  assert.equal(v.talkPet({ ents: new Map() }, "chat", "x"), false, "sin mascota no hay diálogo");
}
console.log("voice+pet OK");
