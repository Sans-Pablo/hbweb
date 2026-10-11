// HABITANTES: ficha estable, objetivos, memoria, respuesta al chat (frase hecha y modelo), guardado/carga, acompañamiento y botclear.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Adventure } from "../web/src/shared/adventure.js";
import { Grid } from "../web/src/shared/grid.js";
import { GameData } from "../web/src/shared/data.js";
import { DEBUG } from "../web/src/shared/systems/debug.js";
import { seededRandom } from "../web/src/shared/dungeon.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import * as R from "../web/src/shared/systems/residents.js";
const dir = new URL("../web/data/", import.meta.url);
const json = n => JSON.parse(readFileSync(new URL(n, dir)));
const meta = json("map.json"), npcDb = json("npc.json");
const data = new GameData({ items: json("items.json"), magic: json("magic.json"), npcs: npcDb });
const mkAdv = () => new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL("arefarm.bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {}, rng: seededRandom(5) });
const a = mkAdv(), w = a.farm;
DEBUG.enabled = true;
const tick = ms => { for (let i = 0; i < ms / 50; i++) a.tick(50); };

// ficha estable y distinta entre nombres
assert.deepEqual(R.create("Aldric").origin, R.create("Aldric").origin);
assert.equal(R.RESIDENT_NAMES.length, 40);
assert.equal(new Set(R.RESIDENT_NAMES.map(n => R.create(n).origin.join() + R.create(n).motive.join())).size > 10, true);

// 40 habitantes con ficha, meta y recuerdo
for (const n of R.RESIDENT_NAMES) a.spawnResident(n);
assert.equal(a.residents().length, 40);
const A = a.residents()[0];
assert.ok(A.res.goal && A.res.mem.length >= 1 && R.storyOf(A, "es").includes(A.name));
assert.match(R.describe(A, "en"), /Level/);
tick(5000);

// sin frases escritas: todo lo que dicen lo genera el modelo de lenguaje (aquí, uno de prueba)
a.llm = async ({ who, from, text }) => (from === "situation" ? "Frase de situación de " + who : "Soy " + who + ", respondo a " + from);

// un jugador habla cerca: responde el más próximo, recuerda al jugador y habla en su idioma
const hid = a.addPlayer("Pablo", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 10, mag: 10, chr: 10 } });
const me = w.ents.get(hid);
const say = [], listen = () => { for (const e of w.drainEvents()) if (e.t === "chat") say.push(e); };
a.relocate(A, w, [me.x + 2, me.y]);
a.command(hid, { t: "say", text: "Hola, ¿quién eres?" });
await new Promise(r => setImmediate(r));          // la respuesta del modelo llega entre ticks
tick(6000); listen();
const reply = say.find(e => e.id === A.id || a.bots.get(e.id)?.res?.rel?.Pablo);
assert.ok(reply, "un habitante contesta");
assert.ok(R.relOf(a.bots.get(reply.id), "Pablo") >= 1, "recuerda al jugador");

// modelo de lenguaje: si responde a tiempo, su texto sustituye a la frase hecha
a.llm = async ({ who, from }) => (from === "situation" ? "situación" : "Soy " + who + " y charlo contigo, " + from + ".");
const B = a.bots.get(reply.id); a.relocate(B, w, [me.x + 1, me.y]); say.length = 0;
a.command(hid, { t: "say", text: B.name + ", ¿qué haces?" });
await new Promise(r => setImmediate(r));            // la respuesta del modelo llega entre ticks
tick(8000); listen();
assert.ok(say.some(e => e.id === B.id && /charlo contigo, Pablo/.test(e.text)), "usa la voz del modelo: " + JSON.stringify(say.map(e => e.text)));

// grupo: solo acepta a quien ya conoce (≥3 charlas)
const C = a.residents().find(b => b !== B && b !== A);
a.relocate(C, w, [me.x + 2, me.y + 1]); say.length = 0;
a.command(hid, { t: "say", text: C.name + " ven conmigo" }); tick(4000);
assert.ok(!C.bot.owner, "aún no se fía");
C.res.rel.Pablo = 5; a.command(hid, { t: "say", text: C.name + " ven conmigo" }); tick(4000);
assert.equal(C.bot.owner, hid, "acepta acompañar al amigo");
C.res.followUntil = w.time + 100; tick(1000);
assert.equal(C.bot.owner, null, "vuelve a su vida");

// metas: al cumplirla, recuerdo y meta nueva
A.res.goal = { k: "level", n: A.level }; const g0 = A.res.mem.length; tick(2000);
assert.ok(A.res.mem.some(m => /meta/.test(m.es)) && A.res.mem.length > g0 - 1, "cumple y renueva su meta");

// guardado y carga: la ficha (memoria, amigos) sobrevive; lo transitorio no se guarda
A.res.rel.Lucía = 4; A.gold = 777;
const sv = a.saveOf(A.id), name = A.name;
assert.ok(sv.res && sv.res.rel.Lucía === 4 && !("reply" in sv.res) && !("next" in sv.res));
const b = mkAdv(); b.spawnResident(name, JSON.parse(JSON.stringify(sv)));
const A2 = b.residents()[0];
assert.equal(A2.gold, 777); assert.equal(A2.res.rel.Lucía, 4); assert.equal(A2.level, A.level); assert.deepEqual(A2.res.goal, A.res.goal);

// probador: avisos con dedupe, rechazos de órdenes y muerte contra un monstruo
const reps = []; a.report = r => reps.push(r);
const D = a.residents().find(b => b !== A && b !== B && b !== C);
assert.ok(R.report(a, D, "bug", "x", "es", "en") && !R.report(a, D, "bug", "x", "es", "en"), "mismo tema: un aviso cada 10 min");
for (let i = 0; i < 3; i++) w.emit({ t: "reject", id: D.id, cmd: "use", why: "no puedes usar eso" });
w.emit({ t: "reject", id: D.id, cmd: "use", why: "ocupado" });
assert.ok(reps.some(r => r.kind === "comfort" && /use/.test(r.es)) && reps.length === 2, "rechazo repetido = incomodidad: " + reps.length);
const sl = spawnFrom(w, { name: "Slime", rect: [D.x + 1, D.y, D.x + 2, D.y + 1], alive: 0, max: 0, respawn: false });
w.emit({ t: "damage", id: D.id, from: sl.id, amount: 5, hp: 1, max: 9 });
D.hp = 0; D.dead = true; D.deadAt = w.time; tick(500);
assert.ok(reps.some(r => r.kind === "balance" && r.topic.startsWith("death:")), "informa de contra qué muere");
assert.equal(R.create("Aldric").lang, "es"); assert.equal(R.create("Brenna").lang, "en");
assert.equal(new Set(R.RESIDENT_NAMES.map(n => R.create(n).lang)).size, 2);

// botclear no toca a los habitantes
a.command(hid, { t: "dbg", op: "botclear" }); assert.equal(a.residents().length, 40);
console.log("OK residents");
