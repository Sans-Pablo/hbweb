// Pretend-Corpse (skill 19, HG.cpp UseSkillHandler): tirada contra maestría, no con vecinos, no en zona de lucha; los monstruos lo ignoran; moverse lo termina.
// node tests/feign.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { ACT } from "../web/src/shared/const.js";
const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const evs = []; w.emit = (e => ev => { evs.push(ev); return e.call(w, ev); })(w.emit);
const aid = w.addPlayer("fingidor"), a = w.ents.get(aid);
w.tick(1000);
a.skills[19] = 0;
assert(!w.command(aid, { t: "useskill", skill: 19 }), "sin maestría no se usa");
a.skills[19] = 100; a.ssn[19] = 0;
// vecino en una casilla contigua: fallo
const bid = w.addPlayer("vecino"), b = w.ents.get(bid);
const [nx, ny] = w.freeSpotNear(a.x + 1, a.y); w.grid.release?.(b.x, b.y, b.id); b.x = b.fx = a.x + 1; b.y = b.fy = a.y; w.grid.occupy(b.x, b.y, bid);
w.command(aid, { t: "useskill", skill: 19 });
assert(!a.feign && evs.some(e => e.t === "skillend" && e.id === aid && !e.ok), "con alguien al lado falla");
// sin vecinos: éxito (maestría 100 nunca falla la tirada)
w.grid.release(b.x, b.y, bid); b.x = b.fx = a.x + 6; b.y = b.fy = a.y; w.grid.occupy(b.x, b.y, bid);
w.tick(500);
w.command(aid, { t: "useskill", skill: 19 });
assert(a.feign && a.act === ACT.DYING, "fingir muerte deja al personaje tumbado");
assert(!a.dead, "no está muerto de verdad");
w.tick(60000);
assert(a.feign, "sigue fingiendo mientras no se mueva");
// el monstruo no lo elige
// moverse lo levanta
w.command(aid, { t: "move", dir: 3 });
assert(!a.feign && a.act !== ACT.DYING, "moverse termina Pretend-Corpse");
// zona de lucha: falla
w.fightZone = true; w.tick(500);
w.command(aid, { t: "useskill", skill: 19 });
assert(!a.feign, "en zona de lucha falla");
w.fightZone = false;
// GetDeadOwner: un cadáver en la propia casilla impide fingir
b.dead = true; w.grid.release(b.x, b.y, bid); b.x = b.fx = a.x; b.y = b.fy = a.y; w.tick(500);
w.command(aid, { t: "useskill", skill: 19 });
assert(!a.feign, "con un cadáver en la casilla falla");
b.dead = false; b.x = b.fx = a.x + 6; w.grid.occupy(b.x, b.y, bid);
// maestría baja: la tirada falla a veces
a.skills[19] = 1; let fails = 0;
for (let i = 0; i < 40; i++) { w.tick(500); w.command(aid, { t: "useskill", skill: 19 }); if (a.feign) w.command(aid, { t: "useskill", skill: 19 }); else fails++; }
assert(fails > 20, "con maestría 1 casi siempre falla (" + fails + "/40)");
console.log("OK");
