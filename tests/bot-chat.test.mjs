// Charla de los habitantes: mensajes largos partidos sin perder el final y memoria de lo hablado.
import assert from "node:assert/strict";
import { splitSay, logTalk, talkCtx } from "../web/src/shared/systems/residents.js";
const long = "Hoy he bajado a la cripta con el grupo y nos ha ido genial, aunque el esqueleto del tercer piso casi me mata. Mañana quiero volver con pociones de sobra. ¿Te apuntas, Mira? Llevo semanas buscando un buen arco.";
const parts = splitSay(long);
assert.ok(parts.length >= 2 && parts.every(x => x.length <= 108), "cada mensaje cabe en el chat");
assert.equal(parts.join(" ").replace(/\s+/g, " "), long.replace(/\s+/g, " "), "no se pierde texto");
assert.deepEqual(splitSay("hola"), ["hola"]);
assert.ok(splitSay("x".repeat(300)).every(x => x.length <= 108), "sin espacios también se parte");
const p = { name: "Aldric", res: {} }, w = { time: 1000 };
for (let i = 0; i < 50; i++) logTalk(p, w, "Mira", "linea " + i, "g");
logTalk(p, w, "Aldric", "yo digo", "g", true);
assert.equal(p.res.talk.length, 40, "memoria acotada");
assert.equal(p.res.talkN.Mira, 50);
assert.ok(talkCtx(p, "g", 2).endsWith("Aldric: yo digo"));
assert.equal(talkCtx(p, "l"), "");
console.log("OK bot-chat");
