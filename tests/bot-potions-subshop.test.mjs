// v0.85.86: los bots deciden cuándo beber (nunca con el depósito lleno) y SUBSHOP ya no usa `api` fuera de ámbito (bug #3 «api is not defined @npcdialogs.js:32»)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { setDungeonPalette } from "../web/src/shared/dungeon.js";
import { potionUseful } from "../web/src/shared/systems/bot.js";
const dir = new URL("../web/data/", import.meta.url), J = f => JSON.parse(readFileSync(new URL(f, dir)));
const meta = J("map.json"), npcDb = J("npc.json");
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
setDungeonPalette(J("dungeon_palette.json"));
const a = new Adventure({ grid: new Grid(meta.w, meta.h, new Uint8Array(readFileSync(new URL(meta.map + ".bin", dir)))), start: meta.start, npcDb, data, spawns: [], maps: {} });
const w = a.worldFor(a.addPlayer("pots"));
const red = data.named("RedPotion"), blue = data.named("BluePotion");
// 2d12+10 -> media 23: con maná/vida llenos o casi llenos no se bebe; con falta suficiente, sí
for (const it of [red, blue]) {
  assert.equal(potionUseful(w, it, 0), false, "lleno: no bebe");
  assert.equal(potionUseful(w, it, 28), false, "falta menos que la poción: no bebe");
  assert.equal(potionUseful(w, it, 29), true, "falta lo que cura: bebe");
  assert.equal(potionUseful(w, it, 500), true);
}
assert.equal(potionUseful(w, null, 999), false, "sin poción conocida no hay nada que beber");
// bot.js usa la regla en maná y vida
const src = readFileSync(new URL("../web/src/shared/systems/bot.js", import.meta.url), "utf8");
assert.ok(/potionUseful\(w, catalog\(w\.data\)\.mana, p\.maxMp - p\.mp\)/.test(src) && /potionUseful\(w, catalog\(w\.data\)\.potion, p\.maxHp - p\.hp\)/.test(src), "maná y vida pasan por potionUseful");
// SUBSHOP: cada filtro recibe api (itemByName) y no revienta
const nd = readFileSync(new URL("../web/src/client/npcdialogs.js", import.meta.url), "utf8");
assert.ok(/SUBSHOP\[sub\]\(r, api\)/.test(nd), "begin pasa api a SUBSHOP");
const block = nd.slice(nd.indexOf("const SUBSHOP"), nd.indexOf("};", nd.indexOf("const SUBSHOP")) + 2);
const SUBSHOP = new Function(`const SUBSHOP = ${block.replace(/^const SUBSHOP = /, "").replace(/;\s*$/, "")}; return SUBSHOP;`).call(null);
const api = { itemByName: n => data.named(n) };
for (const r of [{ name: "Dagger", type: 1, equipPos: 8 }, { name: "RedPotion", type: 3, equipPos: 0 }]) for (const k of [1, 2, 3, 4, 5, 6]) assert.doesNotThrow(() => SUBSHOP[k](r, api), `SUBSHOP[${k}] con api`);
console.log("OK bot-potions-subshop");
