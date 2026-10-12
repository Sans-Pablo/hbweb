// Susurros «/to nombre texto»: llegan a otro jugador aunque esté en otro mapa; el emisor recibe el eco; sin destinatario se rechaza.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: () => 0.5 });
const mk = n => a.farm.ents.get(a.addPlayer(n, null, { gender: 1, stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 } })), A = mk("Ana"), B = mk("Beto");
const evs = []; for (const w of a.worlds.values()) { const o = w.emit.bind(w); w.emit = e => { evs.push(e); return o(e); }; }
assert.ok(a.command(A.id, { t: "say", text: "/to beto hola" }));
assert.ok(evs.some(e => e.t === "whisper" && e.id === B.id && e.name === "Ana" && e.text === "hola"));
assert.ok(evs.some(e => e.t === "whisper" && e.id === A.id && e.to === "Beto"));
evs.length = 0;
assert.equal(a.command(A.id, { t: "say", text: "/to nadie hola" }), false);
assert.ok(evs.some(e => e.t === "reject" && e.id === A.id));
assert.ok(!evs.some(e => e.t === "chat"), "un susurro no sale por el chat del mapa");
console.log("OK whisper");
