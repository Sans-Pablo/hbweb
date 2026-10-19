// v0.85.98 (#66 #73 #87 #92): fidelidad cliente: Energy Strike, sonidos de Frog/Rudolph, ritmo de ataque, círculo FOE
import assert from "node:assert/strict";
import fs from "node:fs";
import { SpellFx } from "../web/src/client/spellfx.js";
import { MOB_SFX, mobSfx } from "../web/src/client/audio.js";
import { PLAYER } from "../web/src/shared/const.js";

// #73: Energy Strike (Magic.cfg 60 -> efecto 160, Game.cpp:6000/14631): maxFrame 7, cada uno lanza un rayo (efecto 16) que llega y deja el efecto 18
const s = new SpellFx();
s.spell(60, 10, 10, 14, 12);
assert.equal(s.list[0].type, 160, "el hechizo 60 crea el efecto 160");
let bolts = 0, hits = 0; const add = s.add.bind(s);
s.add = (t, ...a) => { if (t === 16) bolts++; if (t === 18) hits++; return add(t, ...a); };
for (let i = 0; i < 60 && s.list.length; i++) for (const e of [...s.list]) s.step(e);
assert.ok(bolts >= 7, "7-8 rayos (maxFrame 7)");
assert.ok(hits >= 1, "los rayos alcanzan el destino (efecto 18)");

// #87: sonidos por tipo (MapData.cpp OBJECTMOVE/ATTACK/DAMAGE/DYING)
assert.deepEqual(mobSfx({ type: 57 }), { step: "M73", attack: "M77", hit: "M81", death: "M85" }, "Giant-Frog");
assert.deepEqual(mobSfx({ type: 61 }), { step: "C11", attack: "M38", hit: "M69", death: "M65" }, "Rudolph");
assert.equal(mobSfx({ type: 1 }), undefined);

// #66: ritmo de ataque = 8 fotogramas x (78 + 12 x velocidad) ms (MapData.cpp:31 y 1989-1993)
assert.equal(PLAYER.attackMs, 8 * 78);
assert.equal(PLAYER.attackMs + 3 * 12 * 8, 8 * (78 + 3 * 12));

// #92: el círculo es el fx38 de DrawObjectFOE (Game.cpp:17850), no un dibujo propio
const r = fs.readFileSync(new URL("../web/src/client/renderer.js", import.meta.url), "utf8");
assert.ok(/sp\.put\(ctx, 38, f, x, y, "add"\)/.test(r) && !/ellipse\(x, y \+ 4, 24, 11/.test(r));
console.log("OK fidelidad-v85-98");
