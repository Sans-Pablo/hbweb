// Objetos-bola propios de cada especie de compañero (ids 2001+, companion.js SPECIES): se añaden a web/data/items.json y la hoja de iconos
// (sprite 23 -> ip20/ig20, ver names.js itemSet) a sprites.json. Idempotente. El PNG (ip20.png) se hornea en el navegador con el juego en marcha:
// drawBall de cada especie sobre un lienzo de 8x4 celdas de 48 px (ver docs/sistemas/bolas-de-invocacion.md).
import fs from "node:fs";
import { SPECIES } from "../web/src/shared/systems/companion.js";
const P = new URL("../web/data/", import.meta.url), rd = f => JSON.parse(fs.readFileSync(new URL(f, P), "utf8")), wr = (f, o) => fs.writeFileSync(new URL(f, P), JSON.stringify(o));
const items = rd("items.json"), base = items["651"], sp = Object.keys(SPECIES), COLS = 8, CELL = 48;
sp.forEach((s, i) => {
  const id = SPECIES[s][1];
  items[id] = { ...base, name: s.replace(/-/g, "") + "Ball", display: s.replace(/-/g, " ") + " Ball", sprite: 23, spriteFrame: i };
});
wr("items.json", items);
const spr = rd("sprites.json");
const frames = sp.map((_, i) => [(i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL, -CELL / 2, -CELL / 2]);
spr.ip20 = { png: "ip20.png", frames }; spr.ig20 = { png: "ip20.png", frames };   // en el suelo se ve la misma imagen
wr("sprites.json", spr);
console.log("OK", sp.length, "bolas");
