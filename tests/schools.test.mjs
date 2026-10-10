// Escuelas de magia de los summons: el jugador lanza, el summon de la escuela paga y tira; sin regeneración (caramelo azul); cambio al nivel 50.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
import { spawnCitizen } from "../web/src/shared/systems/citizens.js";
import { spawnFrom } from "../web/src/shared/systems/npcsys.js";
import * as C from "../web/src/shared/systems/companion.js";
import * as T from "../web/src/shared/systems/talents.js";
import * as S from "../web/src/shared/systems/schools.js";
MAGIC_MODE.free = false;
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json"), magic = J("magic.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic, npcs: npcDb });
const w = new World({ grid, npcDb, data, spawns: [], rng, start: [10, 10] });
const id = w.addPlayer("Mago", null, { gender: 1, stats: { str: 30, vit: 20, dex: 20, int: 90, mag: 90, chr: 10 } });
const A = w.ents.get(id); A.stats.str = 400; A.level = 50; w.recalc(A); A.hp = A.maxHp; A.mp = A.maxMp = 500; A.gold = 1e6;
for (const k of [1, 13, 20, 45, 43]) A.magic[k] = 1;                     // Heal, Defense Shield, Fire Ball, Chill Wind, Lightning
const tick = ms => { for (let i = 0; i < ms / 50; i++) w.tick(50); };
const nurse = spawnCitizen(w, C.HOSPITAL.npc, A.x, A.y + 3, C.HOSPITAL.role);
const buy = sp => { const ok = w.command(A.id, { t: "petbuy", npc: nurse.id, sp }); if (!ok) console.log(JSON.stringify(w.events.slice(-3)), nurse.x, nurse.y, A.x, A.y, A.dead); assert.ok(ok, sp); return A.bag.find(i => i.comp?.sp === sp); };
const mob = () => { const gen = { name: "Slime", rect: [A.x + 3, A.y, A.x + 3, A.y], alive: 0, max: 0, respawn: false }; const n = spawnFrom(w, gen); n.hp = n.maxHp = 5000; return n; };

// clasificación de hechizos
assert.equal(S.spellSchool(magic[20]), "fire"); assert.equal(S.spellSchool(magic[45]), "ice"); assert.equal(S.spellSchool(magic[43]), "lightning");
assert.equal(S.spellSchool(magic[1]), null); assert.ok(S.isSupportSpell(magic[1]) && S.isSupportSpell(magic[13]));

// sin summon de la escuela, no sale; los hechizos de apoyo ya no son del jugador
let tgt = mob();
assert.equal(w.command(A.id, { t: "cast", spell: 20, x: tgt.x, y: tgt.y }), false, "sin summon");
assert.equal(w.command(A.id, { t: "cast", spell: 1, x: A.x, y: A.y }), false, "apoyo solo para Dummy");
tick(2000);

// Orc (fuego): lanza él, paga él
const orc = buy("Orc"); orc.comp.lvl = 20;
assert.ok(w.command(A.id, { t: "use", uid: orc.uid }));
const o = [...w.ents.values()].find(e => e.comp && e.master === A.id);
w.command(A.id, { t: "petmode", mode: "peace" });
tick(500);
const top = T.maxMp(orc.comp);  assert.ok(Math.abs(o.mp - top) < 1, "maná completo al invocar");
assert.equal(w.command(A.id, { t: "cast", spell: 45, x: tgt.x, y: tgt.y }), false, "hielo no es de su escuela");
const mp0 = A.mp, hp0 = tgt.hp; w.events.length = 0;
assert.ok(w.command(A.id, { t: "cast", spell: 20, x: tgt.x, y: tgt.y }));
tick(1500);
assert.ok(tgt.hp < hp0, "el hechizo daña");
assert.equal(A.mp, mp0, "el jugador no paga maná");
assert.ok(o.mp < top, "el summon paga");
assert.ok(w.events.some(e => e.t === "spell" && e.spell === 20 && e.id === o.id), "el efecto sale del summon");
// sin regeneración natural
const m1 = o.mp; tick(8000); assert.equal(Math.floor(o.mp), Math.floor(m1), "no regenera");
// sin maná no sale
o.mp = 0; tick(100); assert.equal(w.command(A.id, { t: "cast", spell: 20, x: tgt.x, y: tgt.y }), false);
// caramelo azul
const blue = (await import("../web/src/shared/systems/itemsys.js")).newInst(w, 781); A.bag.push(blue);
assert.ok(w.command(A.id, { t: "use", uid: blue.uid, dest: orc.uid }));
assert.ok(o.mp > 0, "el caramelo azul devuelve maná al summon");
// guardado: el maná viaja con la bola
const mpSaved = Math.floor(o.mp);
assert.ok(w.command(A.id, { t: "use", uid: orc.uid }));        // guardar
assert.equal(orc.comp.mp, mpSaved);
assert.ok(w.command(A.id, { t: "use", uid: orc.uid }));        // sacar
const o2 = [...w.ents.values()].find(e => e.comp && e.master === A.id); tick(200);
assert.ok(Math.abs(o2.mp - mpSaved) < 2, "no se rellena al volver a invocarlo");
// el caramelo sobre la bola guardada también
assert.ok(w.command(A.id, { t: "use", uid: orc.uid }));

// general: sin magia
const sk = buy("Skeleton"); assert.equal(S.schoolOfSpecies("Skeleton"), null);
// cambio al nivel 50
orc.comp.lvl = 49; A.hp = A.maxHp;
assert.equal(w.command(A.id, { t: "petup", npc: nurse.id, uid: orc.uid }), false, "hace falta nivel 50");
orc.comp.lvl = 50;
const hpOrc = C.statsOf(A, orc.comp).hp, mpOrc = T.maxMp(orc.comp);
assert.ok(w.command(A.id, { t: "petup", npc: nurse.id, uid: orc.uid }));
const dem = A.bag.find(i => i.comp?.sp === "Demon");
assert.ok(dem && dem.comp.lvl === 1 && dem.comp.nm === orc.comp.nm && !A.bag.includes(orc));
dem.comp.lvl = 50;
assert.ok(C.statsOf(A, dem.comp).hp > hpOrc && T.maxMp(dem.comp) > mpOrc, "Demon más vida y maná");
assert.equal(w.command(A.id, { t: "petbuy", npc: nurse.id, sp: "Demon" }), false, "las especies superiores no se compran");
assert.equal(S.TIER2.Orc, "Demon"); assert.equal(S.TIER2.Tentocle, "Frost"); assert.equal(S.TIER2["Cannibal-Plant"], "Liche");
// los talentos de hechizo de los summons normales ya no existen
assert.equal(T.TALENTS.filter(t => t.spell != null && !t.dummy).length, 0);
console.log("OK schools");
