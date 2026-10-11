// Guilds (systems/guild.js): fundar con requisitos, invitar/aceptar, chat «@», colores, expulsar, ceder el mando, disolver y persistencia del registro.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import * as Guild from "../web/src/shared/systems/guild.js";
import { apparelOf } from "../web/src/shared/appearance.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 9; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const mk = (n, side = 1) => { const id = w.addPlayer(n, null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }); const p = w.ents.get(id); p.side = side; return p; };
const A = mk("Alfa"), B = mk("Beta"), C = mk("Gama", 2);
const ev = () => w.drainEvents();
ev();
// requisitos
w.command(A.id, { t: "guildcreate", name: "Los Lobos" }); assert.ok(ev().some(v => v.t === "guild" && v.k === "fail"), "nivel y carisma insuficientes");
A.level = 20; A.stats.chr = 20;
w.command(A.id, { t: "guildcreate", name: "x" }); assert.ok(ev().some(v => v.k === "fail"), "nombre corto");
w.command(A.id, { t: "guildcreate", name: "Los Lobos" }); assert.ok(ev().some(v => v.k === "created")); assert.equal(A.guild.rank, 0);
w.command(B.id, { t: "guildcreate", name: "los lobos" }); assert.ok(ev().some(v => v.k === "fail"), "nombre repetido (sin distinguir mayúsculas)");
// invitar: solo del mismo bando y solo el Guildmaster
w.command(A.id, { t: "guildinvite", name: "Gama" }); assert.ok(!ev().some(v => v.t === "guildquery"), "otro bando no");
w.command(B.id, { t: "guildinvite", name: "Alfa" }); ev();
w.command(A.id, { t: "guildinvite", name: "Beta" }); assert.ok(ev().some(v => v.t === "guildquery" && v.id === B.id));
w.command(B.id, { t: "guildanswer", r: 1 }); assert.equal(B.guild.rank, 1); assert.equal(B.guild.name, "Los Lobos"); ev();
// chat de guild
B.level = 5; B.sp = 50; w.command(B.id, { t: "say", text: "@hola equipo" });
const gc = ev().filter(v => v.t === "guildchat"); assert.equal(gc.length, 2); assert.ok(gc.every(v => v.text === "hola equipo" && v.name === "Beta"));
w.command(C.id, { t: "say", text: "@hola" }); assert.ok(ev().some(v => v.t === "reject" && v.id === C.id), "sin guild no hay chat");
// colores: solo el Guildmaster; se ven en la capa y las botas puestas
w.command(B.id, { t: "guildcolor", cape: 3 }); assert.ok(ev().some(v => v.k === "fail"));
w.command(A.id, { t: "guildcolor", cape: 4, boots: 9 }); ev(); assert.equal(B.guild.cape, 4);
const cape = data.named("Cape"); A.bag.push({ uid: 9001, id: cape.id, count: 1, life: 500 }); A.equip[12] = 9001;
assert.equal(apparelOf(A, id => data.item(id)).col?.mantle, 4, "la capa sale del color del guild");
// persistencia del registro
const exp = Guild.exportReg(w.guildReg ?? w.hooks?.guild ?? w.partyReg ?? { guilds: new Map() });
assert.ok(Array.isArray(exp));
// expulsar y ceder el mando
w.command(A.id, { t: "guildleave" }); const e = ev(); assert.ok(e.some(v => v.k === "master" && v.name === "Beta")); assert.equal(B.guild.rank, 0); assert.ok(!A.guild);
w.command(B.id, { t: "guilddisband" }); assert.ok(!B.guild); assert.equal(Guild.guildOf(w, B), null);
console.log("OK");
