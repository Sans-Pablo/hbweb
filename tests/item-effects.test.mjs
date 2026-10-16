// Sistema 23: efectos de objetos (UseItemHandler, HG.cpp:17551-17919): SP cura veneno, WARM, MAGIC (invisibilidad/detectar), CHANGEATTR. node tests/item-effects.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
MAGIC_MODE.player = true;
const D = new URL("../web/data/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("map.json", D)));
const bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = JSON.parse(readFileSync(new URL("npc.json", D)));
const data = new GameData({ items: JSON.parse(readFileSync(new URL("items.json", D))), magic: JSON.parse(readFileSync(new URL("magic.json", D))), npcs: npcDb });
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const w = new World({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], rng: Math.random, start: meta.start });
const aid = w.addPlayer("mago"), a = w.ents.get(aid);
for (const u of Object.values(a.equip)) w.command(a.id, { t: "unequip", uid: u });
w.tick(1000);
import { newInst } from "../web/src/shared/systems/itemsys.js";
import { sget, sset } from "../web/src/shared/systems/status.js";
import { poison } from "../web/src/shared/systems/fields.js";
import * as Inv from "../web/src/shared/inventory.js";
a.skills[4] = 100;
a.bag.length = 0; a.gold = 0;
const give = name => { const d = data.named(name); const i = newInst(w, d.id); Inv.addToBag(a, data, i); return i.uid; };
const use = name => {  const u = give(name); const r = w.command(aid, { t: "use", uid: u }); w.tick(200); return r; };
// poción de resistencia: cura veneno
poison(w, a, 1); assert(sget(w, a, "poison"), "envenenado");
a.sp = 0; use("GreenPotion");
assert(!sget(w, a, "poison"), "GreenPotion cura el veneno (HG.cpp:17686)"); assert(a.sp > 0, "GreenPotion da SP");
// WARM: deshiela al cabo de 1 s
sset(w, a, "ice", 1, w.time + 60000); use("UnfreezePotion");
assert(sget(w, a, "ice"), "aun helado antes de 1 s"); w.tick(1300);
assert(!sget(w, a, "ice"), "UnfreezePotion deshiela tras 1 s (HG.cpp:17580)");
// invisibilidad por objeto: gratis y sin fallo
const mp = a.mp; a.fullMage = false; w.recalc(a);
use("InvisibilityScroll"); w.tick(500);
assert(sget(w, a, "invis"), "InvisibilityScroll vuelve invisible (HG.cpp:17761)"); assert(a.mp === mp, "sin coste de mana");
// usar otro objeto MAGIC antes quita la invisibilidad
w.fightZone = true; use("DetectInviScroll"); w.fightZone = false;
assert(!sget(w, a, "invis"), "RemoveMagicEffect(INVISIBILITY) antes de cualquier MAGIC (HG.cpp:17752)");
// CHANGEATTR
a.look = { skin: 3, hair: 7, hairCol: 15, under: 7 };
use("HairColorPotion"); use("HairStylePotion"); use("SkinColorPotion"); use("UnderWearPotion");
assert(a.look.hairCol === 0 && a.look.hair === 0 && a.look.skin === 1 && a.look.under === 0, "atributos dan la vuelta (HG.cpp:17867)");
a.look = { skin: 1, hair: 2, hairCol: 3, under: 4 };
use("HairColorPotion"); use("HairStylePotion"); use("SkinColorPotion"); use("UnderWearPotion");
assert(a.look.hairCol === 4 && a.look.hair === 3 && a.look.skin === 2 && a.look.under === 5, "avanzan una unidad");
console.log("OK item-effects");
