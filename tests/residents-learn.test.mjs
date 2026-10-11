// Habitantes y summons: compran su compañero en el hospital (Aresden: tienda general; Elvine: Gail al aire libre), lo invocan, le dan talentos y avisan de fallos.
import * as R from "../web/src/shared/systems/residents.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette, seededRandom } from "../web/src/shared/dungeon.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
setDungeonPalette(json("dungeon_palette.json"));
const maps = {};
for (const id of ["arefarm", "elvfarm", "2ndmiddle", "middled1n", "gshop_1f"]) { const mm = json("maps/" + id + ".json"); maps[id] = { meta: mm, grid: id === "arefarm" ? null : new Grid(mm.w, mm.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", dir)))) }; }
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps, rng: seededRandom(21) });
const reports = []; a.report = r => reports.push(r);
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };
// Aprendizaje con el modelo: el habitante reflexiona, guarda la lección y aplica los ajustes (evitar / priorizar / prudencia).
a.spawnResident("Aldric");
const b = a.residents().find(x => x.name === "Aldric");
b.kinds = { Slime: 20, Scorpion: 3 }; b.res.qa.deaths.Orc = 2; b.level = 6;
const asks = [];
a.llm = async req => { asks.push(req.task); return req.task === "reflect" ? '{"lesson":"Los Orc me matan, debo subir de nivel antes.","avoid":["Orc","Dragon"],"focus":["Scorpion"],"caution":2}' : "ok"; };
for (let i = 0; i < 20 * 60 * 8 && !b.res.insights?.length; i++) { a.tick(50); if (i % 40 === 0) await new Promise(r => setImmediate(r)); }
assert.ok(asks.includes("reflect"), "pidió reflexión al modelo");
assert.ok(b.res.insights?.length, "guardó la lección");
assert.ok((b.res.dlv?.Orc || 0) >= b.res.insights[0].lv, "evita los Orc");
assert.ok(!("Dragon" in (b.res.dlv || {})), "ignora nombres que no conoce");
assert.ok(b.res.focus?.Scorpion > 0, "prioriza escorpiones");
assert.ok((b.res.scare | 0) >= 2, "más prudente");
assert.match(R.describe(b, "en"), /What I have learned/);

// Conversación anclada: el modelo recibe los hechos y solo puede ejecutar acciones permitidas; un Guildmaster que acepta invita de verdad.
{
  const gm = b; { const w0 = a.worldFor(gm.id), h0 = a.homeOf(gm); if (w0 !== h0) a.transfer(gm, w0, h0, h0.home); } gm.res.followUntil = 0; gm.res._trip = null; gm.res._delve = null; const w = a.worldFor(gm.id); gm.level = 20; gm.stats.chr = 20; gm.side = 1;
  assert.ok(a.command(gm.id, { t: "guildcreate", name: "Los Lobos" }) || gm.guild, "el bot funda su guild");
  const hid = a.addPlayer("Pablo", null, { gender: 1, stats: { str: 20, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } }), me = a.worldFor(hid).ents.get(hid); assert.ok(me.side === 1, "un jugador nuevo ya no es viajero: empieza del bando de Aresfarm"); me.side = 1;
  a.relocate(me, a.worldFor(gm.id), [gm.x + 1, gm.y]);
  const seen = [];
  a.llm = async req => { seen.push(req); return req.task === "act" ? '{"say":"Claro, te invito a Los Lobos.","do":"guild_invite"}' : "ok"; };
  a.command(hid, { t: "say", text: "¿puedo unirme a tu guild?" });
  for (let i = 0; i < 400 && !me.guildQuery; i++) { a.tick(50); if (i % 20 === 0) await new Promise(r => setImmediate(r)); }
  const act = seen.find(r => r.task === "act");
  assert.ok(act && /Guildmaster of the guild "Los Lobos"/.test(act.system) && /guild_invite/.test(act.system), "el modelo recibe los hechos reales y las acciones permitidas");
  assert.ok(me.guildQuery, "la invitación al guild llega de verdad");
  // quien no es Guildmaster no puede invitar: la acción no se ofrece
}
console.log("OK residents-learn");
