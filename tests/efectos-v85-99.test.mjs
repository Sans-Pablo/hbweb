// v0.85.99 (#105 #96): Berserk dibuja su círculo fx58 al castear; la ventana de log (F9) se adapta a pantallas pequeñas
import assert from "node:assert/strict";
import fs from "node:fs";
import { SpellFx } from "../web/src/client/spellfx.js";
import { ChatWin } from "../web/src/client/chatwin.js";

const s = new SpellFx();
s.spell(50, 10, 10, 12, 12);
assert.equal(s.list[0].type, 150, "Berserk (mágia 50) crea el efecto 150");
for (let i = 0; i < 60; i++) for (const e of [...s.list]) if (!e.dead) s.step(e);
assert.ok(s.list.every(e => e.dead), "el efecto termina");
const src = fs.readFileSync(new URL("../web/src/client/spellfx.js", import.meta.url), "utf8");
assert.ok(/case 150: P\(58,/.test(src), "el efecto 150 se dibuja con fx58 (Game.cpp:7182)");

const w = new ChatWin({ chatLog: [] });
w.fit({ g: { W: 320, H: 240 } });
assert.ok(w.w <= 320 && w.h <= 240 && w.x + w.w <= 320 && w.y + w.h <= 240, "cabe en pantalla pequeña");
assert.ok(w.inner.w > 0 && w.inner.h > 0);
w.fit({ g: { W: 800, H: 600 } });
assert.equal(w.w, 540);
console.log("OK efectos-v85-99");
